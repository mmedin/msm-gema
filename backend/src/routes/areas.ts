import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticateToken } from '../middleware/auth';

export const areasRouter = Router();

// Listar áreas operativas
areasRouter.get('/', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const areas = await prisma.area.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });

    res.json(areas);
  } catch (error) {
    console.error('Error al listar áreas:', error);
    res.status(500).json({ error: 'Error al consultar áreas operativas' });
  }
});
