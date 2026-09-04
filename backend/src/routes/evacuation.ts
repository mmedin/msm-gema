import { Router, Request, Response } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { registerOccupancySchema, createCenterSchema, updateCenterSchema } from '../schemas/evacuation.schema';
import { EvacuationService } from '../services/evacuation.service';
import { user_role } from '@prisma/client';

export const evacuationRouter = Router();

// Listar centros de evacuados con cálculo de ocupación actual
evacuationRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { event_id } = req.query;
    const enrichedCenters = await EvacuationService.listCentersWithOccupancy(event_id as string);
    res.json(enrichedCenters);
  } catch (error: unknown) {
    console.error('Error al listar centros de evacuados:', error);
    res.status(500).json({ error: 'Error al consultar centros de evacuados' });
  }
});

// Registrar movimiento de ocupación (+ Ingreso / - Egreso)
evacuationRouter.post(
  '/:id/occupancy',
  authenticateToken,
  validateBody(registerOccupancySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await EvacuationService.registerOccupancy(id, req.body, req.user!);
      res.status(201).json(result);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'status' in error && 'message' in error) {
        const customErr = error as { status: number; message: string };
        res.status(customErr.status).json({ error: customErr.message });
        return;
      }
      console.error('Error al registrar ocupación:', error);
      res.status(500).json({ error: 'Error al registrar movimiento de ocupación' });
    }
  }
);

// Historial de movimientos de un centro
evacuationRouter.get('/:id/logs', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { event_id } = req.query;
    const logs = await EvacuationService.getCenterLogs(id, event_id as string);
    res.json(logs);
  } catch (error: unknown) {
    console.error('Error al consultar historial de ocupación:', error);
    res.status(500).json({ error: 'Error al obtener historial de ocupación' });
  }
});

// ABM de Centros (Solo Administrador)
evacuationRouter.post(
  '/',
  authenticateToken,
  requireRole(user_role.ADMINISTRADOR),
  validateBody(createCenterSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const center = await EvacuationService.createCenter(req.body);
      res.status(201).json(center);
    } catch (error: unknown) {
      console.error('Error al crear centro de evacuados:', error);
      res.status(500).json({ error: 'Error al crear centro' });
    }
  }
);

evacuationRouter.patch(
  '/:id',
  authenticateToken,
  requireRole(user_role.ADMINISTRADOR),
  validateBody(updateCenterSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updated = await EvacuationService.updateCenter(id, req.body);
      res.json(updated);
    } catch (error: unknown) {
      console.error('Error al actualizar centro:', error);
      res.status(500).json({ error: 'Error al actualizar centro' });
    }
  }
);
