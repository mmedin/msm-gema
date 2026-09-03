import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticateToken } from '../middleware/auth';
import { incident_status, task_status, priority } from '@prisma/client';

export const dashboardRouter = Router();

// Métricas de situación en tiempo real
dashboardRouter.get('/stats', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { event_id } = req.query;

    let targetEvent = null;
    if (event_id) {
      targetEvent = await prisma.event.findUnique({ where: { id: String(event_id) } });
    } else {
      targetEvent = await prisma.event.findFirst({
        where: { status: { not: 'CERRADO' } },
        orderBy: { opened_at: 'desc' },
      });
    }

    if (!targetEvent) {
      res.status(404).json({ error: 'No se encontró un evento para calcular métricas' });
      return;
    }

    const eventId = targetEvent.id;
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 120 * 60 * 1000);

    // 1. Contadores de incidentes P1 y P2 activos
    const activeP1Count = await prisma.incident.count({
      where: {
        event_id: eventId,
        priority: priority.P1,
        status: { notIn: [incident_status.RESUELTO, incident_status.CERRADO] },
      },
    });

    const activeP2Count = await prisma.incident.count({
      where: {
        event_id: eventId,
        priority: priority.P2,
        status: { notIn: [incident_status.RESUELTO, incident_status.CERRADO] },
      },
    });

    // 2. Tareas impedidas
    const impededTasksCount = await prisma.task.count({
      where: {
        event_id: eventId,
        status: task_status.IMPEDIDA,
      },
    });

    // 3. Tareas sin asignar a persona (Pendientes etapa 2)
    const unassignedTasksCount = await prisma.task.count({
      where: {
        event_id: eventId,
        assignee_id: null,
        status: { in: [task_status.CREADA, task_status.ASIGNADA] },
      },
    });

    // 4. Semáforo de Inactividad
    // P1/P2 > 30m sin actividad
    const inactiveP1P2Incidents = await prisma.incident.findMany({
      where: {
        event_id: eventId,
        priority: { in: [priority.P1, priority.P2] },
        status: { notIn: [incident_status.RESUELTO, incident_status.CERRADO] },
        last_activity_at: { lt: thirtyMinutesAgo },
      },
      select: { id: true, code: true, title: true, priority: true, last_activity_at: true },
    });

    const inactiveP1P2Tasks = await prisma.task.findMany({
      where: {
        event_id: eventId,
        priority: { in: [priority.P1, priority.P2] },
        status: { notIn: [task_status.VERIFICADA, task_status.CANCELADA] },
        last_activity_at: { lt: thirtyMinutesAgo },
      },
      select: { id: true, code: true, action: true, priority: true, last_activity_at: true },
    });

    // P3/P4 > 2h sin actividad
    const inactiveP3P4Incidents = await prisma.incident.findMany({
      where: {
        event_id: eventId,
        priority: { in: [priority.P3, priority.P4] },
        status: { notIn: [incident_status.RESUELTO, incident_status.CERRADO] },
        last_activity_at: { lt: twoHoursAgo },
      },
      select: { id: true, code: true, title: true, priority: true, last_activity_at: true },
    });

    const inactiveP3P4Tasks = await prisma.task.findMany({
      where: {
        event_id: eventId,
        priority: { in: [priority.P3, priority.P4] },
        status: { notIn: [task_status.VERIFICADA, task_status.CANCELADA] },
        last_activity_at: { lt: twoHoursAgo },
      },
      select: { id: true, code: true, action: true, priority: true, last_activity_at: true },
    });

    // 5. Centros de evacuados y ocupación total
    const centers = await prisma.evacuationCenter.findMany({ where: { active: true } });
    let totalCapacity = 0;
    let totalOccupied = 0;

    for (const c of centers) {
      totalCapacity += c.capacity;
      const lastLog = await prisma.evacuationOccupancyLog.findFirst({
        where: { center_id: c.id, event_id: eventId },
        orderBy: { created_at: 'desc' },
      });
      if (lastLog) {
        totalOccupied += lastLog.occupied_after;
      }
    }

    // 6. Desglose por Área
    const areas = await prisma.area.findMany({ where: { active: true } });
    const areasBreakdown = await Promise.all(
      areas.map(async (a) => {
        const total = await prisma.task.count({ where: { event_id: eventId, area_id: a.id } });
        const pendingDistribution = await prisma.task.count({
          where: {
            event_id: eventId,
            area_id: a.id,
            assignee_id: null,
            status: { in: [task_status.CREADA, task_status.ASIGNADA] },
          },
        });
        const inExecution = await prisma.task.count({
          where: {
            event_id: eventId,
            area_id: a.id,
            status: { in: [task_status.ACEPTADA, task_status.EN_DESPLAZAMIENTO, task_status.EN_EJECUCION] },
          },
        });
        const resolved = await prisma.task.count({
          where: { event_id: eventId, area_id: a.id, status: task_status.RESUELTA },
        });
        const verified = await prisma.task.count({
          where: { event_id: eventId, area_id: a.id, status: task_status.VERIFICADA },
        });
        const impeded = await prisma.task.count({
          where: { event_id: eventId, area_id: a.id, status: task_status.IMPEDIDA },
        });

        return {
          id: a.id,
          code: a.code,
          name: a.name,
          total,
          pendingDistribution,
          inExecution,
          resolved,
          verified,
          impeded,
        };
      })
    );

    // 7. Totales generales de incidentes y avisos
    const totalIncidents = await prisma.incident.count({ where: { event_id: eventId } });
    const totalNotices = await prisma.notice.count({ where: { event_id: eventId } });
    const pendingNotices = await prisma.notice.count({ where: { event_id: eventId, status: 'RECIBIDO' } });

    res.json({
      event: targetEvent,
      metrics: {
        activeP1Count,
        activeP2Count,
        impededTasksCount,
        unassignedTasksCount,
        totalIncidents,
        totalNotices,
        pendingNotices,
      },
      evacuation: {
        totalCapacity,
        totalOccupied,
        availableCapacity: Math.max(0, totalCapacity - totalOccupied),
        percentage: totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0,
      },
      inactivityAlerts: {
        criticalCount: inactiveP1P2Incidents.length + inactiveP1P2Tasks.length,
        warningCount: inactiveP3P4Incidents.length + inactiveP3P4Tasks.length,
        inactiveP1P2Incidents,
        inactiveP1P2Tasks,
        inactiveP3P4Incidents,
        inactiveP3P4Tasks,
      },
      areasBreakdown,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Error al generar dashboard stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de situación' });
  }
});

// Corte de Situación completo (para exportación JSON y reporte imprimible)
dashboardRouter.get('/snapshot', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { event_id } = req.query;

    let targetEvent = null;
    if (event_id) {
      targetEvent = await prisma.event.findUnique({ where: { id: String(event_id) } });
    } else {
      targetEvent = await prisma.event.findFirst({
        where: { status: { not: 'CERRADO' } },
        orderBy: { opened_at: 'desc' },
      });
    }

    if (!targetEvent) {
      res.status(404).json({ error: 'No se encontró evento activo' });
      return;
    }

    const eventId = targetEvent.id;

    const [incidents, tasks, notices, centers, logs] = await Promise.all([
      prisma.incident.findMany({
        where: { event_id: eventId },
        orderBy: [{ priority: 'asc' }, { created_at: 'desc' }],
        include: {
          created_by: { select: { name: true, username: true } },
          triage_by: { select: { name: true, username: true } },
        },
      }),
      prisma.task.findMany({
        where: { event_id: eventId },
        orderBy: [{ priority: 'asc' }, { created_at: 'desc' }],
        include: {
          area: true,
          assignee: { select: { name: true, username: true } },
          verified_by: { select: { name: true, username: true } },
        },
      }),
      prisma.notice.findMany({
        where: { event_id: eventId },
        orderBy: { received_at: 'desc' },
      }),
      prisma.evacuationCenter.findMany({ where: { active: true } }),
      prisma.evacuationOccupancyLog.findMany({
        where: { event_id: eventId },
        orderBy: { created_at: 'desc' },
        take: 30,
        include: {
          center: { select: { name: true } },
          created_by: { select: { name: true, username: true } },
        },
      }),
    ]);

    const snapshot = {
      title: 'Corte Operativo de Situación - MSM-CRISIS',
      municipality: 'Municipalidad de General San Martín',
      event: targetEvent,
      generatedAt: new Date().toISOString(),
      generatedBy: req.user!.name,
      summary: {
        totalIncidents: incidents.length,
        totalTasks: tasks.length,
        totalNotices: notices.length,
      },
      incidents,
      tasks,
      notices,
      evacuationCenters: centers,
      recentOccupancyLogs: logs,
    };

    res.json(snapshot);
  } catch (error) {
    console.error('Error al generar snapshot:', error);
    res.status(500).json({ error: 'Error al generar corte de situación' });
  }
});
