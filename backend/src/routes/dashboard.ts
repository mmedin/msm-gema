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

    // Ejecución concurrente de todas las métricas operativas con eliminación de N+1
    const [
      activeP1Count,
      activeP2Count,
      impededTasksCount,
      unassignedTasksCount,
      inactiveP1P2Incidents,
      inactiveP1P2Tasks,
      inactiveP3P4Incidents,
      inactiveP3P4Tasks,
      evacTotalsRows,
      areasBreakdown,
      totalIncidents,
      totalNotices,
      pendingNotices,
    ] = await Promise.all([
      // 1. Contadores de incidentes P1 y P2 activos
      prisma.incident.count({
        where: {
          event_id: eventId,
          priority: priority.P1,
          status: { notIn: [incident_status.RESUELTO, incident_status.CERRADO] },
        },
      }),
      prisma.incident.count({
        where: {
          event_id: eventId,
          priority: priority.P2,
          status: { notIn: [incident_status.RESUELTO, incident_status.CERRADO] },
        },
      }),

      // 2. Tareas impedidas
      prisma.task.count({
        where: {
          event_id: eventId,
          status: task_status.IMPEDIDA,
        },
      }),

      // 3. Tareas sin asignar a persona (Pendientes etapa 2)
      prisma.task.count({
        where: {
          event_id: eventId,
          assignee_id: null,
          status: { in: [task_status.CREADA, task_status.ASIGNADA] },
        },
      }),

      // 4. Semáforo de Inactividad
      prisma.incident.findMany({
        where: {
          event_id: eventId,
          priority: { in: [priority.P1, priority.P2] },
          status: { notIn: [incident_status.RESUELTO, incident_status.CERRADO] },
          last_activity_at: { lt: thirtyMinutesAgo },
        },
        select: { id: true, code: true, title: true, priority: true, last_activity_at: true },
      }),
      prisma.task.findMany({
        where: {
          event_id: eventId,
          priority: { in: [priority.P1, priority.P2] },
          status: { notIn: [task_status.VERIFICADA, task_status.CANCELADA] },
          last_activity_at: { lt: thirtyMinutesAgo },
        },
        select: { id: true, code: true, action: true, priority: true, last_activity_at: true },
      }),
      prisma.incident.findMany({
        where: {
          event_id: eventId,
          priority: { in: [priority.P3, priority.P4] },
          status: { notIn: [incident_status.RESUELTO, incident_status.CERRADO] },
          last_activity_at: { lt: twoHoursAgo },
        },
        select: { id: true, code: true, title: true, priority: true, last_activity_at: true },
      }),
      prisma.task.findMany({
        where: {
          event_id: eventId,
          priority: { in: [priority.P3, priority.P4] },
          status: { notIn: [task_status.VERIFICADA, task_status.CANCELADA] },
          last_activity_at: { lt: twoHoursAgo },
        },
        select: { id: true, code: true, action: true, priority: true, last_activity_at: true },
      }),

      // 5. Centros de evacuados y ocupación total (Optimización N+1 con DISTINCT ON)
      prisma.$queryRaw<Array<{ totalCapacity: number; totalOccupied: number }>>`
        SELECT
          COALESCE(SUM(c.capacity), 0)::int AS "totalCapacity",
          COALESCE(SUM(l.occupied_after), 0)::int AS "totalOccupied"
        FROM evacuation_centers c
        LEFT JOIN (
          SELECT DISTINCT ON (center_id) center_id, occupied_after
          FROM evacuation_occupancy_logs
          WHERE event_id = ${eventId}
          ORDER BY center_id, created_at DESC
        ) l ON l.center_id = c.id
        WHERE c.active = true
      `,

      // 6. Desglose por Área (Optimización N+1 con una única consulta agrupada)
      prisma.$queryRaw<
        Array<{
          id: string;
          code: string;
          name: string;
          total: number;
          pendingDistribution: number;
          inExecution: number;
          resolved: number;
          verified: number;
          impeded: number;
        }>
      >`
        SELECT
          a.id,
          a.code,
          a.name,
          COUNT(t.id)::int AS total,
          COUNT(CASE WHEN t.assignee_id IS NULL AND t.status IN ('CREADA', 'ASIGNADA') THEN 1 END)::int AS "pendingDistribution",
          COUNT(CASE WHEN t.status IN ('ACEPTADA', 'EN_DESPLAZAMIENTO', 'EN_EJECUCION') THEN 1 END)::int AS "inExecution",
          COUNT(CASE WHEN t.status = 'RESUELTA' THEN 1 END)::int AS resolved,
          COUNT(CASE WHEN t.status = 'VERIFICADA' THEN 1 END)::int AS verified,
          COUNT(CASE WHEN t.status = 'IMPEDIDA' THEN 1 END)::int AS impeded
        FROM areas a
        LEFT JOIN tasks t ON t.area_id = a.id AND t.event_id = ${eventId}
        WHERE a.active = true
        GROUP BY a.id, a.code, a.name
        ORDER BY a.name ASC
      `,

      // 7. Totales generales de incidentes y avisos
      prisma.incident.count({ where: { event_id: eventId } }),
      prisma.notice.count({ where: { event_id: eventId } }),
      prisma.notice.count({ where: { event_id: eventId, status: 'RECIBIDO' } }),
    ]);

    const evacTotals = evacTotalsRows[0];
    const totalCapacity = Number(evacTotals?.totalCapacity || 0);
    const totalOccupied = Number(evacTotals?.totalOccupied || 0);

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
      title: 'Corte Operativo de Situación - GEMA',
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
