import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireRole } from '../middleware/auth';
import { occupancy_direction, user_role } from '@prisma/client';
import { withTransactionRetry } from '../utils/atomicSequence';

export const evacuationRouter = Router();

// Factor de capacidad extrema máxima permitida (200% de la capacidad nominal del centro)
const MAX_EXTREME_CAPACITY_FACTOR = 2.0;

// Listar centros de evacuados con cálculo de ocupación actual
evacuationRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { event_id } = req.query;

    let targetEventId = event_id as string;
    if (!targetEventId) {
      const activeEvent = await prisma.event.findFirst({
        where: { status: { not: 'CERRADO' } },
        orderBy: { opened_at: 'desc' },
      });
      if (activeEvent) targetEventId = activeEvent.id;
    }

    type CenterWithOccupancy = {
      id: string;
      name: string;
      address: string;
      lat: number | null;
      lng: number | null;
      stay_kind: any;
      capacity: number;
      equipment_notes: string;
      active: boolean;
      current_occupied: number;
    };

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

    const enrichedCenters = centersWithOccupancy.map((center) => ({
      ...center,
      available_capacity: Math.max(0, center.capacity - center.current_occupied),
      capacity_exceeded: center.current_occupied > center.capacity,
      percentage: center.capacity > 0 ? Math.round((center.current_occupied / center.capacity) * 100) : 0,
    }));

    res.json(enrichedCenters);
  } catch (error) {
    console.error('Error al listar centros de evacuados:', error);
    res.status(500).json({ error: 'Error al consultar centros de evacuados' });
  }
});

// Registrar movimiento de ocupación (+ Ingreso / - Egreso)
evacuationRouter.post('/:id/occupancy', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { event_id, direction, people_count, notes } = req.body;

    const count = parseInt(people_count, 10);
    if (isNaN(count) || count <= 0) {
      res.status(400).json({ error: 'La cantidad de personas debe ser un número entero mayor a 0' });
      return;
    }

    if (!['INGRESO', 'EGRESO'].includes(direction)) {
      res.status(400).json({ error: 'Dirección inválida. Debe ser INGRESO o EGRESO' });
      return;
    }

    let targetEventId = event_id;
    if (!targetEventId) {
      const activeEvent = await prisma.event.findFirst({
        where: { status: { not: 'CERRADO' } },
        orderBy: { opened_at: 'desc' },
      });
      if (!activeEvent) {
        res.status(400).json({ error: 'No se encontró un evento activo para registrar la ocupación' });
        return;
      }
      targetEventId = activeEvent.id;
    }

    const result = await withTransactionRetry(() =>
      prisma.$transaction(async (tx) => {
        // Bloqueo pesimista a nivel de fila sobre el centro de evacuados
        const [center] = await tx.$queryRaw<
          Array<{ id: string; name: string; capacity: number; active: boolean }>
        >`
          SELECT id, name, capacity, active
          FROM evacuation_centers
          WHERE id = ${id}
          FOR UPDATE
        `;

        if (!center || !center.active) {
          throw { status: 404, message: 'Centro de evacuados no encontrado o inactivo' };
        }

        // Obtener última ocupación registrada dentro de la fila bloqueada
        const lastLog = await tx.evacuationOccupancyLog.findFirst({
          where: {
            center_id: center.id,
            event_id: targetEventId,
          },
          orderBy: { created_at: 'desc' },
        });

        const currentOccupied = lastLog ? lastLog.occupied_after : 0;
        const newOccupied = direction === 'INGRESO' ? currentOccupied + count : currentOccupied - count;

        // Regla 1: Un egreso nunca puede dejar la ocupación total en valores negativos (< 0)
        if (newOccupied < 0) {
          throw {
            status: 400,
            message: `El egreso de ${count} persona(s) dejaría la ocupación en valores negativos (ocupación actual: ${currentOccupied})`,
          };
        }

        // Regla 2: Límite de capacidad extrema permitida (200% de la capacidad nominal)
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
            direction: direction as occupancy_direction,
            people_count: count,
            occupied_after: newOccupied,
            notes: notes || null,
            created_by_id: req.user!.id,
          },
          include: {
            created_by: { select: { id: true, name: true, username: true } },
          },
        });

        await tx.auditLog.create({
          data: {
            actor_id: req.user!.id,
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

    res.status(201).json(result);
  } catch (error: any) {
    if (error?.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Error al registrar ocupación:', error);
    res.status(500).json({ error: 'Error al registrar movimiento de ocupación' });
  }
});

// Historial de movimientos de un centro
evacuationRouter.get('/:id/logs', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { event_id } = req.query;

    const whereClause: any = { center_id: id };
    if (event_id) whereClause.event_id = String(event_id);

    const logs = await prisma.evacuationOccupancyLog.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      take: 50,
      include: {
        created_by: { select: { id: true, name: true, username: true } },
      },
    });

    res.json(logs);
  } catch (error) {
    console.error('Error al consultar historial de ocupación:', error);
    res.status(500).json({ error: 'Error al obtener historial de ocupación' });
  }
});

// ABM de Centros (Solo Administrador)
evacuationRouter.post('/', authenticateToken, requireRole(user_role.ADMINISTRADOR), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, address, lat, lng, stay_kind: stayKindVal, capacity, equipment_notes } = req.body;

    if (!name || !address || !capacity) {
      res.status(400).json({ error: 'Nombre, dirección y capacidad son requeridos' });
      return;
    }

    const center = await prisma.evacuationCenter.create({
      data: {
        name,
        address,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        stay_kind: stayKindVal || 'PERNOCTA',
        capacity: parseInt(capacity, 10),
        equipment_notes: equipment_notes || '',
      },
    });

    res.status(201).json(center);
  } catch (error) {
    console.error('Error al crear centro de evacuados:', error);
    res.status(500).json({ error: 'Error al crear centro' });
  }
});

evacuationRouter.patch('/:id', authenticateToken, requireRole(user_role.ADMINISTRADOR), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, address, lat, lng, stay_kind: stayKindVal, capacity, equipment_notes, active } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (lat !== undefined) updateData.lat = lat ? parseFloat(lat) : null;
    if (lng !== undefined) updateData.lng = lng ? parseFloat(lng) : null;
    if (stayKindVal !== undefined) updateData.stay_kind = stayKindVal;
    if (capacity !== undefined) updateData.capacity = parseInt(capacity, 10);
    if (equipment_notes !== undefined) updateData.equipment_notes = equipment_notes;
    if (active !== undefined) updateData.active = active;

    const updated = await prisma.evacuationCenter.update({
      where: { id },
      data: updateData,
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar centro:', error);
    res.status(500).json({ error: 'Error al actualizar centro' });
  }
});
