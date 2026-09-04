import { Router, Request, Response } from 'express';
import { authenticateToken, requireTriage, requireGeneralCoordOrAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createIncidentSchema, triageIncidentSchema, updateIncidentStatusSchema } from '../schemas/incidents.schema';
import { IncidentService } from '../services/incident.service';
import { priority, incident_status } from '@prisma/client';

export const incidentsRouter = Router();

// Listar incidentes
incidentsRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { event_id, status, priority: prioFilter, limit, offset, cursor } = req.query;

    const result = await IncidentService.listIncidents({
      event_id: event_id as string,
      status: status as incident_status,
      priority: prioFilter as priority,
      limit: limit as string,
      offset: offset as string,
      cursor: cursor as string,
    });

    res.setHeader('X-Total-Count', result.totalCount.toString());
    res.setHeader('X-Limit', result.take.toString());
    res.setHeader('X-Offset', result.skip.toString());

    res.json(result.incidents);
  } catch (error: unknown) {
    console.error('Error al listar incidentes:', error);
    res.status(500).json({ error: 'Error al consultar incidentes' });
  }
});

// Detalle de incidente con avisos asociados y tareas derivadas
incidentsRouter.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const incident = await IncidentService.getIncidentById(id);
    res.json(incident);
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'status' in error && 'message' in error) {
      const customErr = error as { status: number; message: string };
      res.status(customErr.status).json({ error: customErr.message });
      return;
    }
    console.error('Error al obtener detalle del incidente:', error);
    res.status(500).json({ error: 'Error al consultar incidente' });
  }
});

// Crear incidente directamente
incidentsRouter.post(
  '/',
  authenticateToken,
  validateBody(createIncidentSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const incident = await IncidentService.createIncident(req.body, req.user!);
      res.status(201).json(incident);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'status' in error && 'message' in error) {
        const customErr = error as { status: number; message: string };
        res.status(customErr.status).json({ error: customErr.message });
        return;
      }
      console.error('Error al crear incidente:', error);
      res.status(500).json({ error: 'Error al registrar incidente' });
    }
  }
);

// Clasificar prioridad (Triage P1-P4: Exclusivo can_triage = true)
incidentsRouter.patch(
  '/:id/triage',
  authenticateToken,
  requireTriage,
  validateBody(triageIncidentSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { priority: newPriority } = req.body;
      const updated = await IncidentService.triageIncident(id, newPriority, req.user!);
      res.json(updated);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'status' in error && 'message' in error) {
        const customErr = error as { status: number; message: string };
        res.status(customErr.status).json({ error: customErr.message });
        return;
      }
      console.error('Error en triage de incidente:', error);
      res.status(500).json({ error: 'Error al clasificar incidente' });
    }
  }
);

// Actualizar estado / resolver / cerrar incidente (Exclusivo Coordinación General o Admin)
incidentsRouter.patch(
  '/:id/status',
  authenticateToken,
  requireGeneralCoordOrAdmin,
  validateBody(updateIncidentStatusSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updated = await IncidentService.updateIncidentStatus(id, req.body, req.user!);
      res.json(updated);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'status' in error && 'message' in error) {
        const customErr = error as { status: number; message: string; openTasksCount?: number; requiresConfirmation?: boolean };
        res.status(customErr.status).json({
          error: customErr.message,
          openTasksCount: customErr.openTasksCount,
          requiresConfirmation: customErr.requiresConfirmation,
        });
        return;
      }
      console.error('Error al actualizar estado del incidente:', error);
      res.status(500).json({ error: 'Error al cambiar estado del incidente' });
    }
  }
);
