import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createTaskSchema, assignTaskSchema, transitionTaskSchema } from '../schemas/tasks.schema';
import { TaskService } from '../services/task.service';
import { task_status } from '@prisma/client';

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

    const result = await TaskService.listTasks(
      {
        event_id: event_id as string,
        area_id: area_id as string,
        assignee_id: assignee_id as string,
        incident_id: incident_id as string,
        status: status as task_status,
        my_tasks: my_tasks as string,
        for_distribution: for_distribution as string,
        for_verification: for_verification as string,
        limit: limit as string,
        offset: offset as string,
        cursor: cursor as string,
      },
      req.user!
    );

    res.setHeader('X-Total-Count', result.totalCount.toString());
    res.setHeader('X-Limit', result.take.toString());
    res.setHeader('X-Offset', result.skip.toString());

    res.json(result.tasks);
  } catch (error: unknown) {
    console.error('Error al listar tareas:', error);
    res.status(500).json({ error: 'Error al consultar tareas' });
  }
});

// Etapa 1: Crear tarea dentro de un incidente y derivar a Área
tasksRouter.post(
  '/',
  authenticateToken,
  validateBody(createTaskSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const task = await TaskService.createTask(req.body, req.user!);
      res.status(201).json(task);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'status' in error && 'message' in error) {
        const customErr = error as { status: number; message: string };
        res.status(customErr.status).json({ error: customErr.message });
        return;
      }
      console.error('Error al crear tarea:', error);
      res.status(500).json({ error: 'Error al registrar tarea' });
    }
  }
);

// Etapa 2: Coordinador de Área asigna operario o se autoasigna
tasksRouter.patch(
  '/:id/assign',
  authenticateToken,
  validateBody(assignTaskSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { assignee_id } = req.body;
      const updated = await TaskService.assignTask(id, assignee_id, req.user!);
      res.json(updated);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'status' in error && 'message' in error) {
        const customErr = error as { status: number; message: string };
        res.status(customErr.status).json({ error: customErr.message });
        return;
      }
      console.error('Error al asignar ejecutor a tarea:', error);
      res.status(500).json({ error: 'Error al asignar ejecutor' });
    }
  }
);

// Transiciones de ejecución por el Operario
tasksRouter.patch(
  '/:id/transition',
  authenticateToken,
  validateBody(transitionTaskSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updated = await TaskService.transitionTask(id, req.body, req.user!);
      res.json(updated);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'status' in error && 'message' in error) {
        const customErr = error as { status: number; message: string };
        res.status(customErr.status).json({ error: customErr.message });
        return;
      }
      console.error('Error en transición de tarea:', error);
      res.status(500).json({ error: 'Error al cambiar estado de la tarea' });
    }
  }
);

// Verificación cruzada de tareas (Regla estricta de autoasignación)
tasksRouter.patch('/:id/verify', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updated = await TaskService.verifyTask(id, req.user!);
    res.json(updated);
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'status' in error && 'message' in error) {
      const customErr = error as { status: number; message: string };
      res.status(customErr.status).json({ error: customErr.message });
      return;
    }
    console.error('Error al verificar tarea:', error);
    res.status(500).json({ error: 'Error al verificar tarea' });
  }
});
