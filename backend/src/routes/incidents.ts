import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireTriage, requireGeneralCoordOrAdmin } from '../middleware/auth';
import { priority, incident_status, task_status } from '@prisma/client';
import { generateNextIncidentCode, withTransactionRetry } from '../utils/atomicSequence';

export const incidentsRouter = Router();

// Listar incidentes
incidentsRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { event_id, status, priority: prioFilter, limit, offset, cursor } = req.query;

    const whereClause: any = {};
    if (event_id) whereClause.event_id = String(event_id);
    if (status) whereClause.status = status as incident_status;
    if (prioFilter) whereClause.priority = prioFilter as priority;

    // Paginación con límite por defecto razonable de 50
    const take = limit === 'all' ? undefined : limit ? Math.min(Math.max(1, parseInt(String(limit), 10)), 500) : 50;
    const skip = offset ? Math.max(0, parseInt(String(offset), 10)) : cursor ? 1 : undefined;
    const cursorObj = cursor ? { id: String(cursor) } : undefined;

    const [totalCount, incidents] = await Promise.all([
      prisma.incident.count({ where: whereClause }),
      prisma.incident.findMany({
        where: whereClause,
        take,
        skip,
        cursor: cursorObj,
        orderBy: [
          { priority: 'asc' }, // P1 primero
          { last_activity_at: 'desc' },
        ],
        include: {
          created_by: { select: { id: true, name: true, username: true } },
          triage_by: { select: { id: true, name: true, username: true } },
          tasks: {
            select: {
              id: true,
              status: true,
              area: { select: { id: true, code: true, name: true } },
            },
          },
          _count: {
            select: {
              notices: true,
              tasks: true,
            },
          },
        },
      }),
    ]);

    res.setHeader('X-Total-Count', totalCount.toString());
    res.setHeader('X-Limit', (take ?? totalCount).toString());
    res.setHeader('X-Offset', (skip ?? 0).toString());

    res.json(incidents);
  } catch (error) {
    console.error('Error al listar incidentes:', error);
    res.status(500).json({ error: 'Error al consultar incidentes' });
  }
});

// Detalle de incidente con avisos asociados y tareas derivadas
incidentsRouter.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        created_by: { select: { id: true, name: true, username: true } },
        triage_by: { select: { id: true, name: true, username: true } },
        notices: {
          orderBy: { received_at: 'desc' },
          include: {
            created_by: { select: { id: true, name: true, username: true } },
          },
        },
        tasks: {
          orderBy: { created_at: 'asc' },
          include: {
            area: true,
            area_coordinator: { select: { id: true, name: true, username: true } },
            assignee: { select: { id: true, name: true, username: true } },
            verified_by: { select: { id: true, name: true, username: true } },
          },
        },
      },
    });

    if (!incident) {
      res.status(404).json({ error: 'Incidente no encontrado' });
      return;
    }

    res.json(incident);
  } catch (error) {
    console.error('Error al obtener detalle del incidente:', error);
    res.status(500).json({ error: 'Error al consultar incidente' });
  }
});

// Crear incidente directamente
incidentsRouter.post('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      event_id,
      title,
      type_code,
      description,
      location_text,
      lat,
      lng,
      location_pending,
      life_risk: lifeRiskVal,
      trend: trendVal,
      priority: prioVal,
    } = req.body;

    if (!event_id || !title || !description) {
      res.status(400).json({ error: 'Faltan campos requeridos (event_id, title, description)' });
      return;
    }

    const isLocationPending = location_pending === 'true' || location_pending === true;

    const incident = await withTransactionRetry(() =>
      prisma.$transaction(async (tx) => {
        const event = await tx.event.findUnique({ where: { id: event_id } });
        if (!event) {
          throw { status: 404, message: 'Evento no encontrado' };
        }

        const code = await generateNextIncidentCode(tx, event_id);

        const created = await tx.incident.create({
          data: {
            code,
            event_id,
            title,
            type_code: type_code || 'INUNDACION_ANEGAMIENTO',
            description,
            location_text: location_text || 'Ubicación a determinar',
            lat: lat ? parseFloat(lat) : null,
            lng: lng ? parseFloat(lng) : null,
            location_pending: isLocationPending,
            life_risk: lifeRiskVal || 'DESCONOCIDO',
            trend: trendVal || 'DESCONOCIDA',
            priority: prioVal || null,
            status: prioVal ? incident_status.PRIORIZADO : incident_status.RECIBIDO,
            created_by_id: req.user!.id,
            last_activity_at: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            actor_id: req.user!.id,
            action: 'CREAR_INCIDENTE',
            entity: 'INCIDENT',
            entity_id: created.id,
            details: { code, title, priority: prioVal },
          },
        });

        return created;
      })
    );

    res.status(201).json(incident);
  } catch (error: any) {
    if (error?.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Error al crear incidente:', error);
    res.status(500).json({ error: 'Error al registrar incidente' });
  }
});

// Clasificar prioridad (Triage P1-P4: Exclusivo can_triage = true)
incidentsRouter.patch('/:id/triage', authenticateToken, requireTriage, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { priority: newPriority } = req.body;

    if (!['P1', 'P2', 'P3', 'P4'].includes(newPriority)) {
      res.status(400).json({ error: 'Prioridad inválida. Debe ser P1, P2, P3 o P4' });
      return;
    }

    const incident = await prisma.incident.findUnique({ where: { id } });
    if (!incident) {
      res.status(404).json({ error: 'Incidente no encontrado' });
      return;
    }

    // Si el estado actual es RECIBIDO, pasa a PRIORIZADO
    const newStatus = incident.status === incident_status.RECIBIDO ? incident_status.PRIORIZADO : incident.status;

    const updated = await prisma.incident.update({
      where: { id },
      data: {
        priority: newPriority as priority,
        status: newStatus,
        triage_by_id: req.user!.id,
        triaged_at: new Date(),
        last_activity_at: new Date(),
      },
      include: {
        triage_by: { select: { id: true, name: true, username: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user!.id,
        action: 'TRIAGE_PRIORIDAD',
        entity: 'INCIDENT',
        entity_id: id,
        details: { priority: newPriority, previousPriority: incident.priority },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error en triage de incidente:', error);
    res.status(500).json({ error: 'Error al clasificar incidente' });
  }
});

// Actualizar estado / resolver / cerrar incidente (Exclusivo Coordinación General o Admin)
incidentsRouter.patch('/:id/status', authenticateToken, requireGeneralCoordOrAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, resolution_notes, closure_notes, force } = req.body;

    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        tasks: {
          where: {
            status: { notIn: [task_status.VERIFICADA, task_status.CANCELADA] },
          },
        },
      },
    });

    if (!incident) {
      res.status(404).json({ error: 'Incidente no encontrado' });
      return;
    }

    // Advertencia si quedan tareas no resueltas/verificadas al resolver o cerrar
    const openTasksCount = incident.tasks.length;
    if ((status === incident_status.RESUELTO || status === incident_status.CERRADO) && openTasksCount > 0 && !force) {
      res.status(409).json({
        error: `Existen ${openTasksCount} tarea(s) pendientes de verificación o resolución.`,
        openTasksCount,
        requiresConfirmation: true,
      });
      return;
    }

    const dataToUpdate: any = {
      status,
      last_activity_at: new Date(),
    };
    if (resolution_notes !== undefined) dataToUpdate.resolution_notes = resolution_notes;
    if (closure_notes !== undefined) dataToUpdate.closure_notes = closure_notes;

    const updated = await prisma.incident.update({
      where: { id },
      data: dataToUpdate,
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user!.id,
        action: 'ACTUALIZAR_ESTADO_INCIDENTE',
        entity: 'INCIDENT',
        entity_id: id,
        details: { newStatus: status, openTasksCount },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar estado del incidente:', error);
    res.status(500).json({ error: 'Error al cambiar estado del incidente' });
  }
});
