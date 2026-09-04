import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../db';
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

// ---------------------------------------------------------------------------
// Caché en memoria del estado "active" del usuario (TTL configurable, default 60s)
// Evita una consulta a la DB en cada request, pero garantiza que un usuario
// desactivado deje de operar en un máximo de ACTIVE_CACHE_TTL_MS milisegundos.
// ---------------------------------------------------------------------------
interface ActiveCacheEntry {
  active: boolean;
  cachedAt: number;
}

const activeStatusCache = new Map<string, ActiveCacheEntry>();
const ACTIVE_CACHE_TTL_MS = 60_000; // 60 segundos

/**
 * Invalida la entrada de caché para un usuario específico.
 * Llamar al desactivar o modificar el estado de un usuario para efecto inmediato.
 */
export function invalidateActiveStatusCache(userId: string): void {
  activeStatusCache.delete(userId);
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Token de autenticación no proporcionado' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;

    // Verificar que el usuario siga activo en la DB (con caché de 60s)
    const now = Date.now();
    const cached = activeStatusCache.get(decoded.id);

    if (!cached || (now - cached.cachedAt) > ACTIVE_CACHE_TTL_MS) {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { active: true },
      });
      const isActive = user?.active ?? false;
      activeStatusCache.set(decoded.id, { active: isActive, cachedAt: now });

      if (!isActive) {
        res.status(401).json({ error: 'Usuario desactivado. Contacte al administrador' });
        return;
      }
    } else if (!cached.active) {
      res.status(401).json({ error: 'Usuario desactivado. Contacte al administrador' });
      return;
    }

    req.user = decoded;
    next();
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expirado. Inicie sesión nuevamente' });
      return;
    }
    res.status(401).json({ error: 'Token inválido o malformado' });
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

