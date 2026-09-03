import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireGeneralCoordOrAdmin } from '../middleware/auth';
import { event_status, smn_alert } from '@prisma/client';

export const eventsRouter = Router();

// Listar eventos
eventsRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { opened_at: 'desc' },
      include: {
        opened_by: {
          select: { id: true, name: true, username: true },
        },
        _count: {
          select: {
            incidents: true,
            notices: true,
            tasks: true,
          },
        },
      },
    });

    res.json(events);
  } catch (error) {
    console.error('Error al listar eventos:', error);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

// Obtener evento activo
eventsRouter.get('/active', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    let event = await prisma.event.findFirst({
      where: {
        status: { in: [event_status.PREPARACION, event_status.RESPUESTA, event_status.RECUPERACION] },
      },
      orderBy: { opened_at: 'desc' },
      include: {
        opened_by: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    if (!event) {
      event = await prisma.event.findFirst({
        orderBy: { opened_at: 'desc' },
        include: {
          opened_by: {
            select: { id: true, name: true, username: true },
          },
        },
      });
    }

    if (!event) {
      res.status(404).json({ error: 'No hay eventos registrados' });
      return;
    }

    res.json(event);
  } catch (error) {
    console.error('Error al obtener evento activo:', error);
    res.status(500).json({ error: 'Error al obtener evento activo' });
  }
});

// Crear nuevo evento
eventsRouter.post('/', authenticateToken, requireGeneralCoordOrAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { description, smn_alert: alertLevel, status } = req.body;

    if (!description) {
      res.status(400).json({ error: 'La descripción del evento es requerida' });
      return;
    }

    const year = new Date().getFullYear();
    const countThisYear = await prisma.event.count({
      where: {
        code: { startsWith: `${year}-` },
      },
    });

    const code = `${year}-${String(countThisYear + 1).padStart(3, '0')}`;

    const newEvent = await prisma.event.create({
      data: {
        code,
        description,
        status: status || event_status.RESPUESTA,
        smn_alert: alertLevel || smn_alert.AMARILLA,
        opened_by_id: req.user!.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user!.id,
        action: 'CREAR_EVENTO',
        entity: 'EVENT',
        entity_id: newEvent.id,
        details: { code, description, status: newEvent.status, smn_alert: newEvent.smn_alert },
      },
    });

    res.status(201).json(newEvent);
  } catch (error) {
    console.error('Error al crear evento:', error);
    res.status(500).json({ error: 'Error al crear evento' });
  }
});

// Actualizar evento (fases, alerta SMN, cierre)
eventsRouter.patch('/:id', authenticateToken, requireGeneralCoordOrAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { description, status, smn_alert: alertLevel } = req.body;

    const current = await prisma.event.findUnique({ where: { id } });
    if (!current) {
      res.status(404).json({ error: 'Evento no encontrado' });
      return;
    }

    const dataToUpdate: any = {};
    if (description !== undefined) dataToUpdate.description = description;
    if (status !== undefined) {
      dataToUpdate.status = status;
      if (status === event_status.CERRADO && !current.closed_at) {
        dataToUpdate.closed_at = new Date();
      } else if (status !== event_status.CERRADO) {
        dataToUpdate.closed_at = null;
      }
    }
    if (alertLevel !== undefined) dataToUpdate.smn_alert = alertLevel;

    const updated = await prisma.event.update({
      where: { id },
      data: dataToUpdate,
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user!.id,
        action: 'ACTUALIZAR_EVENTO',
        entity: 'EVENT',
        entity_id: id,
        details: dataToUpdate,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar evento:', error);
    res.status(500).json({ error: 'Error al actualizar evento' });
  }
});
