import { prisma } from '../db';
import { Prisma, priority, incident_status, task_status, life_risk, trend } from '@prisma/client';
import { generateNextIncidentCode, withTransactionRetry } from '../utils/atomicSequence';
import { AuthenticatedUser } from './task.service';

export interface ListIncidentsFilters {
  event_id?: string;
  status?: incident_status;
  priority?: priority;
  limit?: string;
  offset?: string;
  cursor?: string;
}

export interface CreateIncidentData {
  event_id: string;
  title: string;
  type_code?: string;
  description: string;
  location_text?: string | null;
  lat?: number | null;
  lng?: number | null;
  location_pending?: boolean;
  life_risk?: life_risk;
  trend?: trend;
  priority?: priority | null;
}

export interface UpdateIncidentStatusData {
  status: incident_status;
  resolution_notes?: string | null;
  closure_notes?: string | null;
  force?: boolean;
}

export class IncidentService {
  static async listIncidents(filters: ListIncidentsFilters) {
    const { event_id, status, priority: prioFilter, limit, offset, cursor } = filters;

    const whereClause: Prisma.IncidentWhereInput = {};
    if (event_id) whereClause.event_id = String(event_id);
    if (status) whereClause.status = status;
    if (prioFilter) whereClause.priority = prioFilter;

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
          { priority: 'asc' },
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

    return { totalCount, take: take ?? totalCount, skip: skip ?? 0, incidents };
  }

  static async getIncidentById(id: string) {
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
      throw { status: 404, message: 'Incidente no encontrado' };
    }

    return incident;
  }

  static async createIncident(data: CreateIncidentData, user: AuthenticatedUser) {
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
    } = data;

    return await withTransactionRetry(() =>
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
            lat: lat ?? null,
            lng: lng ?? null,
            location_pending: !!location_pending,
            life_risk: lifeRiskVal || life_risk.DESCONOCIDO,
            trend: trendVal || trend.DESCONOCIDA,
            priority: prioVal || null,
            status: prioVal ? incident_status.PRIORIZADO : incident_status.RECIBIDO,
            created_by_id: user.id,
            last_activity_at: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            actor_id: user.id,
            action: 'CREAR_INCIDENTE',
            entity: 'INCIDENT',
            entity_id: created.id,
            details: { code, title, priority: prioVal },
          },
        });

        return created;
      })
    );
  }

  static async triageIncident(id: string, newPriority: priority, user: AuthenticatedUser) {
    const incident = await prisma.incident.findUnique({ where: { id } });
    if (!incident) {
      throw { status: 404, message: 'Incidente no encontrado' };
    }

    const newStatus = incident.status === incident_status.RECIBIDO ? incident_status.PRIORIZADO : incident.status;

    const updated = await prisma.incident.update({
      where: { id },
      data: {
        priority: newPriority,
        status: newStatus,
        triage_by_id: user.id,
        triaged_at: new Date(),
        last_activity_at: new Date(),
      },
      include: {
        triage_by: { select: { id: true, name: true, username: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: user.id,
        action: 'TRIAGE_PRIORIDAD',
        entity: 'INCIDENT',
        entity_id: id,
        details: { priority: newPriority, previousPriority: incident.priority },
      },
    });

    return updated;
  }

  static async updateIncidentStatus(id: string, data: UpdateIncidentStatusData, user: AuthenticatedUser) {
    const { status, resolution_notes, closure_notes, force } = data;

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
      throw { status: 404, message: 'Incidente no encontrado' };
    }

    const openTasksCount = incident.tasks.length;
    if ((status === incident_status.RESUELTO || status === incident_status.CERRADO) && openTasksCount > 0 && !force) {
      throw {
        status: 409,
        message: `Existen ${openTasksCount} tarea(s) pendientes de verificación o resolución.`,
        openTasksCount,
        requiresConfirmation: true,
      };
    }

    const dataToUpdate: Prisma.IncidentUpdateInput = {
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
        actor_id: user.id,
        action: 'ACTUALIZAR_ESTADO_INCIDENTE',
        entity: 'INCIDENT',
        entity_id: id,
        details: { newStatus: status, openTasksCount },
      },
    });

    return updated;
  }
}
