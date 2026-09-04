import { prisma } from '../db';
import { Prisma, task_status, user_role, coordination_scope, priority, incident_status } from '@prisma/client';
import { generateNextTaskCode, withTransactionRetry } from '../utils/atomicSequence';

export interface AuthenticatedUser {
  id: string;
  username: string;
  name: string;
  role: user_role;
  coordination_scope?: coordination_scope | null;
  area_id?: string | null;
  can_triage?: boolean;
}

export interface ListTasksFilters {
  event_id?: string;
  area_id?: string;
  assignee_id?: string;
  incident_id?: string;
  status?: task_status;
  my_tasks?: string;
  for_distribution?: string;
  for_verification?: string;
  limit?: string;
  offset?: string;
  cursor?: string;
}

export interface CreateTaskData {
  incident_id: string;
  area_id: string;
  action: string;
  priority?: priority;
}

export interface TransitionTaskData {
  status: task_status;
  result_notes?: string | null;
  impediment_reason?: string | null;
  impediment_next_action?: string | null;
}

export class TaskService {
  static async listTasks(filters: ListTasksFilters, user: AuthenticatedUser) {
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
    } = filters;

    const whereClause: Prisma.TaskWhereInput = {};
    if (event_id) whereClause.event_id = String(event_id);
    if (area_id) whereClause.area_id = String(area_id);
    if (assignee_id) whereClause.assignee_id = String(assignee_id);
    if (incident_id) whereClause.incident_id = String(incident_id);
    if (status) whereClause.status = status;

    if (my_tasks === 'true') {
      whereClause.assignee_id = user.id;
      whereClause.status = { notIn: [task_status.VERIFICADA, task_status.CANCELADA] };
    }

    if (for_distribution === 'true') {
      if (user.area_id) {
        whereClause.area_id = user.area_id;
      }
      whereClause.assignee_id = null;
      whereClause.status = { in: [task_status.CREADA, task_status.ASIGNADA] };
    }

    if (for_verification === 'true') {
      if (user.area_id && user.coordination_scope !== coordination_scope.GENERAL) {
        whereClause.area_id = user.area_id;
      }
      whereClause.status = task_status.RESUELTA;
    }

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
          { priority: 'asc' },
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

    return { totalCount, take: take ?? totalCount, skip: skip ?? 0, tasks };
  }

  static async createTask(data: CreateTaskData, user: AuthenticatedUser) {
    const { incident_id, area_id, action, priority: taskPrio } = data;

    return await withTransactionRetry(() =>
      prisma.$transaction(async (tx) => {
        const incident = await tx.incident.findUnique({ where: { id: incident_id } });
        if (!incident) {
          throw { status: 404, message: 'Incidente no encontrado' };
        }

        const areaCoord = await tx.user.findFirst({
          where: {
            area_id,
            role: user_role.COORDINACION,
            active: true,
          },
        });

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
            actor_id: user.id,
            action: 'CREAR_TAREA_ETAPA_1',
            entity: 'TASK',
            entity_id: createdTask.id,
            details: { code, area_id, incident_id },
          },
        });

        return createdTask;
      })
    );
  }

  static async assignTask(id: string, assignee_id: string, user: AuthenticatedUser) {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw { status: 404, message: 'Tarea no encontrada' };
    }

    const isGeneral = user.role === user_role.COORDINACION && user.coordination_scope === coordination_scope.GENERAL;
    const isAdmin = user.role === user_role.ADMINISTRADOR;
    const isAreaCoord = user.role === user_role.COORDINACION && user.area_id === task.area_id;

    if (!isGeneral && !isAdmin && !isAreaCoord) {
      throw { status: 403, message: 'Solo el Coordinador del Área o la Coordinación General pueden distribuir esta tarea' };
    }

    const assignee = await prisma.user.findUnique({ where: { id: assignee_id } });
    if (!assignee || !assignee.active) {
      throw { status: 404, message: 'Usuario ejecutor no encontrado o inactivo' };
    }

    const now = new Date();
    const updated = await prisma.task.update({
      where: { id },
      data: {
        assignee_id,
        area_coordinator_id: user.id,
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
        actor_id: user.id,
        action: 'DISTRIBUIR_TAREA_ETAPA_2',
        entity: 'TASK',
        entity_id: id,
        details: { assignee_id, assignee_name: assignee.name },
      },
    });

    return updated;
  }

  static async transitionTask(id: string, data: TransitionTaskData, user: AuthenticatedUser) {
    const { status: targetStatus, result_notes, impediment_reason, impediment_next_action } = data;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { incident: true },
    });

    if (!task) {
      throw { status: 404, message: 'Tarea no encontrada' };
    }

    const isAssignee = task.assignee_id === user.id;
    const isAreaCoord = user.role === user_role.COORDINACION && user.area_id === task.area_id;
    const isGeneral = user.role === user_role.COORDINACION && user.coordination_scope === coordination_scope.GENERAL;
    const isAdmin = user.role === user_role.ADMINISTRADOR;

    if (!isAssignee && !isAreaCoord && !isGeneral && !isAdmin) {
      throw { status: 403, message: 'No está autorizado a modificar el estado de esta tarea' };
    }

    const now = new Date();
    const updateData: Prisma.TaskUpdateInput = {
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
        if (task.incident.status === incident_status.ASIGNADO || task.incident.status === incident_status.PRIORIZADO) {
          await prisma.incident.update({
            where: { id: task.incident_id },
            data: { status: incident_status.EN_ATENCION, last_activity_at: now },
          });
        }
        break;
      case task_status.RESUELTA:
        if (!result_notes) {
          throw { status: 400, message: 'Debe detallar el resultado de la tarea para darla por resuelta' };
        }
        updateData.resolved_at = now;
        updateData.result_notes = result_notes;
        break;
      case task_status.IMPEDIDA:
        if (!impediment_reason || !impediment_next_action) {
          throw { status: 400, message: 'Debe ingresar el motivo del impedimento y la próxima acción requerida' };
        }
        updateData.impediment_reason = impediment_reason;
        updateData.impediment_next_action = impediment_next_action;
        break;
      default:
        throw { status: 400, message: 'Estado de transición no válido' };
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
        actor_id: user.id,
        action: `TRANSICION_TAREA_${targetStatus}`,
        entity: 'TASK',
        entity_id: id,
        details: { from: task.status, to: targetStatus, notes: result_notes || impediment_reason },
      },
    });

    return updated;
  }

  static async verifyTask(id: string, user: AuthenticatedUser) {
    const task = await prisma.task.findUnique({ where: { id } });

    if (!task) {
      throw { status: 404, message: 'Tarea no encontrada' };
    }

    if (task.status !== task_status.RESUELTA) {
      throw { status: 400, message: 'Solo se pueden verificar tareas que se encuentren en estado RESUELTA' };
    }

    const isGeneral = user.role === user_role.COORDINACION && user.coordination_scope === coordination_scope.GENERAL;
    const isAdmin = user.role === user_role.ADMINISTRADOR;
    const isAreaCoord = user.role === user_role.COORDINACION && user.area_id === task.area_id;

    // Regla estricta de autoasignación
    const wasSelfAssigned = task.area_coordinator_id && task.assignee_id && task.area_coordinator_id === task.assignee_id;

    if (wasSelfAssigned) {
      if (!isGeneral && !isAdmin) {
        throw {
          status: 403,
          message: 'Esta tarea fue autoasignada y resuelta por el Coordinador de Área. Únicamente el Coordinador General puede verificarla.',
        };
      }
    } else {
      if (!isAreaCoord && !isGeneral && !isAdmin) {
        throw { status: 403, message: 'Solo el Coordinador de Área responsable o el Coordinador General pueden verificar esta tarea' };
      }
    }

    const now = new Date();
    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: task_status.VERIFICADA,
        verified_at: now,
        verified_by_id: user.id,
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
        actor_id: user.id,
        action: 'VERIFICAR_TAREA',
        entity: 'TASK',
        entity_id: id,
        details: { wasSelfAssigned, verified_by: user.username },
      },
    });

    return updated;
  }
}
