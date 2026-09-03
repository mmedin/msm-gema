import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { user_role, coordination_scope } from '@prisma/client';

export interface TokenPayload {
  id: string;
  username: string;
  name: string;
  role: user_role;
  coordination_scope?: coordination_scope | null;
  area_id?: string | null;
  can_triage: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Token de autenticación no proporcionado' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Token inválido o expirado' });
  }
};

export const requireRole = (...allowedRoles: user_role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Acceso no autorizado para este rol' });
      return;
    }

    next();
  };
};

export const requireGeneralCoordOrAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const isGeneral = req.user.role === user_role.COORDINACION && req.user.coordination_scope === coordination_scope.GENERAL;
  const isAdmin = req.user.role === user_role.ADMINISTRADOR;

  if (!isGeneral && !isAdmin) {
    res.status(403).json({ error: 'Acceso restringido a Coordinación General o Administrador' });
    return;
  }

  next();
};

export const requireTriage = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  if (req.user.role !== user_role.COORDINACION || !req.user.can_triage) {
    res.status(403).json({ error: 'Solo personal de Coordinación autorizado (can_triage) puede clasificar prioridad' });
    return;
  }

  next();
};
