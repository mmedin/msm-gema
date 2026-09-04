import { prisma } from '../db';
import { Prisma, occupancy_direction, stay_kind } from '@prisma/client';
import { withTransactionRetry } from '../utils/atomicSequence';
import { AuthenticatedUser } from './task.service';

const MAX_EXTREME_CAPACITY_FACTOR = 2.0;

export interface CenterWithOccupancy {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  stay_kind: stay_kind;
  capacity: number;
  equipment_notes: string;
  active: boolean;
  current_occupied: number;
}

export interface RegisterOccupancyData {
  direction: occupancy_direction;
  people_count: number;
  event_id?: string | null;
  notes?: string | null;
}

export interface CreateCenterData {
  name: string;
  address: string;
  capacity: number;
  lat?: number | null;
  lng?: number | null;
  stay_kind?: stay_kind;
  equipment_notes?: string | null;
}

export interface UpdateCenterData {
  name?: string;
  address?: string;
  capacity?: number;
  lat?: number | null;
  lng?: number | null;
  stay_kind?: stay_kind;
  equipment_notes?: string | null;
  active?: boolean;
}

export class EvacuationService {
  static async listCentersWithOccupancy(eventId?: string) {
    let targetEventId = eventId;
    if (!targetEventId) {
      const activeEvent = await prisma.event.findFirst({
        where: { status: { not: 'CERRADO' } },
        orderBy: { opened_at: 'desc' },
      });
      if (activeEvent) targetEventId = activeEvent.id;
    }

    let centersWithOccupancy: CenterWithOccupancy[];

    if (targetEventId) {
      centersWithOccupancy = await prisma.$queryRaw<CenterWithOccupancy[]>`
        SELECT 
          c.id,
          c.name,
          c.address,
          c.lat,
          c.lng,
          c.stay_kind,
          c.capacity,
          c.equipment_notes,
          c.active,
          COALESCE(l.occupied_after, 0)::int AS current_occupied
        FROM evacuation_centers c
        LEFT JOIN (
          SELECT DISTINCT ON (center_id) center_id, occupied_after
          FROM evacuation_occupancy_logs
          WHERE event_id = ${targetEventId}
          ORDER BY center_id, created_at DESC
        ) l ON l.center_id = c.id
        WHERE c.active = true
        ORDER BY c.name ASC
      `;
    } else {
      centersWithOccupancy = await prisma.$queryRaw<CenterWithOccupancy[]>`
        SELECT 
          c.id,
          c.name,
          c.address,
          c.lat,
          c.lng,
          c.stay_kind,
          c.capacity,
          c.equipment_notes,
          c.active,
          0::int AS current_occupied
        FROM evacuation_centers c
        WHERE c.active = true
        ORDER BY c.name ASC
      `;
    }

    return centersWithOccupancy.map((center) => ({
      ...center,
      available_capacity: Math.max(0, center.capacity - center.current_occupied),
      capacity_exceeded: center.current_occupied > center.capacity,
      percentage: center.capacity > 0 ? Math.round((center.current_occupied / center.capacity) * 100) : 0,
    }));
  }

  static async registerOccupancy(centerId: string, data: RegisterOccupancyData, user: AuthenticatedUser) {
    const { direction, people_count: count, event_id, notes } = data;

    let targetEventId = event_id;
    if (!targetEventId) {
      const activeEvent = await prisma.event.findFirst({
        where: { status: { not: 'CERRADO' } },
        orderBy: { opened_at: 'desc' },
      });
      if (!activeEvent) {
        throw { status: 400, message: 'No se encontró un evento activo para registrar la ocupación' };
      }
      targetEventId = activeEvent.id;
    }

    return await withTransactionRetry(() =>
      prisma.$transaction(async (tx) => {
        const [center] = await tx.$queryRaw<
          Array<{ id: string; name: string; capacity: number; active: boolean }>
        >`
          SELECT id, name, capacity, active
          FROM evacuation_centers
          WHERE id = ${centerId}
          FOR UPDATE
        `;

        if (!center || !center.active) {
          throw { status: 404, message: 'Centro de evacuados no encontrado o inactivo' };
        }

        const lastLog = await tx.evacuationOccupancyLog.findFirst({
          where: {
            center_id: center.id,
            event_id: targetEventId,
          },
          orderBy: { created_at: 'desc' },
        });

        const currentOccupied = lastLog ? lastLog.occupied_after : 0;
        const newOccupied = direction === 'INGRESO' ? currentOccupied + count : currentOccupied - count;

        if (newOccupied < 0) {
          throw {
            status: 400,
            message: `El egreso de ${count} persona(s) dejaría la ocupación en valores negativos (ocupación actual: ${currentOccupied})`,
          };
        }

        const maxExtremeCapacity = Math.floor(center.capacity * MAX_EXTREME_CAPACITY_FACTOR);
        if (newOccupied > maxExtremeCapacity) {
          throw {
            status: 400,
            message: `El ingreso solicitado de ${count} personas llevaría la ocupación a ${newOccupied}, superando la capacidad extrema permitida de ${maxExtremeCapacity} plazas (${MAX_EXTREME_CAPACITY_FACTOR * 100}% de la capacidad nominal de ${center.capacity}).`,
          };
        }

        const log = await tx.evacuationOccupancyLog.create({
          data: {
            event_id: targetEventId,
            center_id: center.id,
            direction,
            people_count: count,
            occupied_after: newOccupied,
            notes: notes || null,
            created_by_id: user.id,
          },
          include: {
            created_by: { select: { id: true, name: true, username: true } },
          },
        });

        await tx.auditLog.create({
          data: {
            actor_id: user.id,
            action: `OCUPACION_${direction}`,
            entity: 'EVACUATION_CENTER',
            entity_id: center.id,
            details: { count, previous: currentOccupied, newOccupied, capacity: center.capacity },
          },
        });

        return {
          log,
          current_occupied: newOccupied,
          capacity: center.capacity,
          capacity_exceeded: newOccupied > center.capacity,
        };
      })
    );
  }

  static async getCenterLogs(centerId: string, eventId?: string) {
    const whereClause: Prisma.EvacuationOccupancyLogWhereInput = { center_id: centerId };
    if (eventId) whereClause.event_id = String(eventId);

    return await prisma.evacuationOccupancyLog.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      take: 50,
      include: {
        created_by: { select: { id: true, name: true, username: true } },
      },
    });
  }

  static async createCenter(data: CreateCenterData) {
    return await prisma.evacuationCenter.create({
      data: {
        name: data.name,
        address: data.address,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        stay_kind: data.stay_kind || stay_kind.PERNOCTA,
        capacity: data.capacity,
        equipment_notes: data.equipment_notes || '',
      },
    });
  }

  static async updateCenter(id: string, data: UpdateCenterData) {
    const updateData: Prisma.EvacuationCenterUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.lat !== undefined) updateData.lat = data.lat;
    if (data.lng !== undefined) updateData.lng = data.lng;
    if (data.stay_kind !== undefined) updateData.stay_kind = data.stay_kind;
    if (data.capacity !== undefined) updateData.capacity = data.capacity;
    if (data.equipment_notes !== undefined) updateData.equipment_notes = data.equipment_notes ?? '';
    if (data.active !== undefined) updateData.active = data.active;

    return await prisma.evacuationCenter.update({
      where: { id },
      data: updateData,
    });
  }
}
