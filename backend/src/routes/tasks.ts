import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticateToken } from '../middleware/auth';
import { task_status, user_role, coordination_scope, priority, incident_status } from '@prisma/client';
import { generateNextTaskCode, withTransactionRetry } from '../utils/atomicSequence';

export const tasksRouter = Router();

// Listar tareas
tasksRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      event_id,
      area_id,
      assignee_id,
      incident_id,
      status,
      my_tasks,
      for_distribution,
      for_verification,
      limit,
      offset,
      cursor,
    } = req.query;

    const whereClause: any = {};
    if (event_id) whereClause.event_id = String(event_id);
    if (area_id) whereClause.area_id = String(area_id);
    if (assignee_id) whereClause.assignee_id = String(assignee_id);
    if (incident_id) whereClause.incident_id = String(incident_id);
    if (status) whereClause.status = status as task_status;

    // Filtros rápidos para el flujo operativo
    if (my_tasks === 'true') {
      whereClause.assignee_id = req.user!.id;
      whereClause.status = { notIn: [task_status.VERIFICADA, task_status.CANCELADA] };
    }

    if (for_distribution === 'true') {
      // Tareas de mi área que aún no tienen persona asignada
      if (req.user!.area_id) {
        whereClause.area_id = req.user!.area_id;
      }
      whereClause.assignee_id = null;
      whereClause.status = { in: [task_status.CREADA, task_status.ASIGNADA] };
    }

    if (for_verification === 'true') {
      // Tareas resueltas pendientes de verificación
      if (req.user!.area_id && req.user!.coordination_scope !== coordination_scope.GENERAL) {
        whereClause.area_id = req.user!.area_id;
      }
      whereClause.status = task_status.RESUELTA;
    }

    // Paginación con límite por defecto razonable de 50
    const take = limit === 'all' ? undefined : limit ? Math.min(Math.max(1, parseInt(String(limit), 10)), 500) : 50;
    const skip = offset ? Math.max(0, parseInt(String(offset), 10)) : cursor ? 1 : undefined;
    const cursorObj = cursor ? { id: String(cursor) } : undefined;

    const [totalCount, tasks] = await Promise.all([
      prisma.task.count({ where: whereClause }),
      prisma.task.findMany({
        where: whereClause,
        take,
        skip,
        cursor: cursorObj,
        orderBy: [
          { priority: 'asc' }, // P1 primero
          { last_activity_at: 'desc' },
        ],
        include: {
          incident: {
            select: {
              id: true,
              code: true,
              title: true,
              priority: true,
              location_text: true,
              lat: true,
              lng: true,
              status: true,
            },
          },
          area: true,
          area_coordinator: { select: { id: true, name: true, username: true } },
          assignee: { select: { id: true, name: true, username: true } },
          verified_by: { select: { id: true, name: true, username: true } },
        },
      }),
    ]);

    res.setHeader('X-Total-Count', totalCount.toString());
    res.setHeader('X-Limit', (take ?? totalCount).toString());
    res.setHeader('X-Offset', (skip ?? 0).toString());

    res.json(tasks);
  } catch (error) {
    console.error('Error al listar tareas:', error);
    res.status(500).json({ error: 'Error al consultar tareas' });
  }
});

// Etapa 1: Crear tarea dentro de un incidente y derivar a Área
tasksRouter.post('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { incident_id, area_id, action, priority: taskPrio } = req.body;

    if (!incident_id || !area_id || !action) {
      res.status(400).json({ error: 'Faltan campos requeridos (incident_id, area_id, action)' });
      return;
    }

    const task = await withTransactionRetry(() =>
      prisma.$transaction(async (tx) => {
        const incident = await tx.incident.findUnique({ where: { id: incident_id } });
        if (!incident) {
          throw { status: 404, message: 'Incidente no encontrado' };
        }

        // Buscar coordinador del área si existe
        const areaCoord = await tx.user.findFirst({
          where: {
            area_id,
            role: user_role.COORDINACION,
            active: true,
          },
        });

        // Generar código correlativo de tarea bloqueando el evento con FOR UPDATE
        const code = await generateNextTaskCode(tx, incident.event_id);

        const createdTask = await tx.task.create({
          data: {
            code,
            incident_id,
            event_id: incident.event_id,
            action,
            priority: taskPrio || incident.priority || priority.P2,
            status: task_status.ASIGNADA,
            area_id,
            area_coordinator_id: areaCoord ? areaCoord.id : null,
            assigned_area_at: new Date(),
            last_activity_at: new Date(),
          },
          include: {
            area: true,
            area_coordinator: { select: { id: true, name: true, username: true } },
          },
        });

        // Actualizar estado del incidente si correspondiera
        if (incident.status === incident_status.RECIBIDO || incident.status === incident_status.PRIORIZADO) {
          await tx.incident.update({
            where: { id: incident.id },
            data: {
              status: incident_status.ASIGNADO,
              last_activity_at: new Date(),
            },
          });
        }

        await tx.auditLog.create({
          data: {
            actor_id: req.user!.id,
            action: 'CREAR_TAREA_ETAPA_1',
            entity: 'TASK',
            entity_id: createdTask.id,
            details: { code, area_id, incident_id },
          },
        });

        return createdTask;
      })
    );

    res.status(201).json(task);
  } catch (error: any) {
    if (error?.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Error al crear tarea:', error);
    res.status(500).json({ error: 'Error al registrar tarea' });
  }
});

// Etapa 2: Coordinador de Área asigna operario o se autoasigna
tasksRouter.patch('/:id/assign', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { assignee_id } = req.body;

    if (!assignee_id) {
      res.status(400).json({ error: 'Debe especificar el ejecutor asignado (assignee_id)' });
      return;
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      res.status(404).json({ error: 'Tarea no encontrada' });
      return;
    }

    // Verificar permisos: Coordinador de Área de esa área, o Coordinación General, o Admin
    const isGeneral = req.user!.role === user_role.COORDINACION && req.user!.coordination_scope === coordination_scope.GENERAL;
    const isAdmin = req.user!.role === user_role.ADMINISTRADOR;
    const isAreaCoord = req.user!.role === user_role.COORDINACION && req.user!.area_id === task.area_id;

    if (!isGeneral && !isAdmin && !isAreaCoord) {
      res.status(403).json({ error: 'Solo el Coordinador del Área o la Coordinación General pueden distribuir esta tarea' });
      return;
    }

    const assignee = await prisma.user.findUnique({ where: { id: assignee_id } });
    if (!assignee || !assignee.active) {
      res.status(404).json({ error: 'Usuario ejecutor no encontrado o inactivo' });
      return;
    }

    const now = new Date();
    const updated = await prisma.task.update({
      where: { id },
      data: {
        assignee_id,
        area_coordinator_id: req.user!.id,
        assigned_person_at: now,
        status: task.status === task_status.CREADA ? task_status.ASIGNADA : task.status,
        last_activity_at: now,
      },
      include: {
        area: true,
        assignee: { select: { id: true, name: true, username: true } },
        area_coordinator: { select: { id: true, name: true, username: true } },
      },
    });

    await prisma.incident.update({
      where: { id: task.incident_id },
      data: { last_activity_at: now },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user!.id,
        action: 'DISTRIBUIR_TAREA_ETAPA_2',
        entity: 'TASK',
        entity_id: id,
        details: { assignee_id, assignee_name: assignee.name },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al asignar ejecutor a tarea:', error);
    res.status(500).json({ error: 'Error al asignar ejecutor' });
  }
});

// Transiciones de ejecución por el Operario (Aceptar, En desplazamiento, En ejecución, Resolver, Impedimento)
tasksRouter.patch('/:id/transition', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status: targetStatus, result_notes, impediment_reason, impediment_next_action } = req.body;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { incident: true },
    });

    if (!task) {
      res.status(404).json({ error: 'Tarea no encontrada' });
      return;
    }

    // Validar que el usuario sea el asignado, o el coordinador del área, o coord general, o admin
    const isAssignee = task.assignee_id === req.user!.id;
    const isAreaCoord = req.user!.role === user_role.COORDINACION && req.user!.area_id === task.area_id;
    const isGeneral = req.user!.role === user_role.COORDINACION && req.user!.coordination_scope === coordination_scope.GENERAL;
    const isAdmin = req.user!.role === user_role.ADMINISTRADOR;

    if (!isAssignee && !isAreaCoord && !isGeneral && !isAdmin) {
      res.status(403).json({ error: 'No está autorizado a modificar el estado de esta tarea' });
      return;
    }

    const now = new Date();
    const updateData: any = {
      status: targetStatus,
      last_activity_at: now,
    };

    switch (targetStatus) {
      case task_status.ACEPTADA:
        updateData.accepted_at = now;
        break;
      case task_status.EN_DESPLAZAMIENTO:
        updateData.dispatched_at = now;
        break;
      case task_status.EN_EJECUCION:
        updateData.started_at = now;
        // Si el incidente estaba en ASIGNADO, poner EN_ATENCION
        if (task.incident.status === incident_status.ASIGNADO || task.incident.status === incident_status.PRIORIZADO) {
          await prisma.incident.update({
            where: { id: task.incident_id },
            data: { status: incident_status.EN_ATENCION, last_activity_at: now },
          });
        }
        break;
      case task_status.RESUELTA:
        if (!result_notes) {
          res.status(400).json({ error: 'Debe detallar el resultado de la tarea para darla por resuelta' });
          return;
        }
        updateData.resolved_at = now;
        updateData.result_notes = result_notes;
        break;
      case task_status.IMPEDIDA:
        if (!impediment_reason || !impediment_next_action) {
          res.status(400).json({ error: 'Debe ingresar el motivo del impedimento y la próxima acción requerida' });
          return;
        }
        updateData.impediment_reason = impediment_reason;
        updateData.impediment_next_action = impediment_next_action;
        break;
      default:
        res.status(400).json({ error: 'Estado de transición no válido' });
        return;
    }

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        area: true,
        assignee: { select: { id: true, name: true, username: true } },
      },
    });

    await prisma.incident.update({
      where: { id: task.incident_id },
      data: { last_activity_at: now },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user!.id,
        action: `TRANSICION_TAREA_${targetStatus}`,
        entity: 'TASK',
        entity_id: id,
        details: { from: task.status, to: targetStatus, notes: result_notes || impediment_reason },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error en transición de tarea:', error);
    res.status(500).json({ error: 'Error al cambiar estado de la tarea' });
  }
});

// Verificación cruzada de tareas (Regla estricta de autoasignación)
tasksRouter.patch('/:id/verify', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      res.status(404).json({ error: 'Tarea no encontrada' });
      return;
    }

    if (task.status !== task_status.RESUELTA) {
      res.status(400).json({ error: 'Solo se pueden verificar tareas que se encuentren en estado RESUELTA' });
      return;
    }

    const isGeneral = req.user!.role === user_role.COORDINACION && req.user!.coordination_scope === coordination_scope.GENERAL;
    const isAdmin = req.user!.role === user_role.ADMINISTRADOR;
    const isAreaCoord = req.user!.role === user_role.COORDINACION && req.user!.area_id === task.area_id;

    // Regla estricta de autoasignación:
    // "Si el Coordinador de Área se autoasignó la tarea y la resolvió, únicamente el Coordinador General puede verificarla."
    const wasSelfAssigned = task.area_coordinator_id && task.assignee_id && task.area_coordinator_id === task.assignee_id;

    if (wasSelfAssigned) {
      if (!isGeneral && !isAdmin) {
        res.status(403).json({
          error: 'Esta tarea fue autoasignada y resuelta por el Coordinador de Área. Únicamente el Coordinador General puede verificarla.',
        });
        return;
      }
    } else {
      // Si no fue autoasignada, la puede verificar el Coordinador de Área, o Coordinador General, o Admin
      if (!isAreaCoord && !isGeneral && !isAdmin) {
        res.status(403).json({ error: 'Solo el Coordinador de Área responsable o el Coordinador General pueden verificar esta tarea' });
        return;
      }
    }

    const now = new Date();
    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: task_status.VERIFICADA,
        verified_at: now,
        verified_by_id: req.user!.id,
        last_activity_at: now,
      },
      include: {
        area: true,
        assignee: { select: { id: true, name: true, username: true } },
        verified_by: { select: { id: true, name: true, username: true } },
      },
    });

    await prisma.incident.update({
      where: { id: task.incident_id },
      data: { last_activity_at: now },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user!.id,
        action: 'VERIFICAR_TAREA',
        entity: 'TASK',
        entity_id: id,
        details: { wasSelfAssigned, verified_by: req.user!.username },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al verificar tarea:', error);
    res.status(500).json({ error: 'Error al verificar tarea' });
  }
});
