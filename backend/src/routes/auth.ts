import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db';
import { config } from '../config';
import { authenticateToken } from '../middleware/auth';

export const authRouter = Router();

// Limitador de intentos en login configurable: valores por defecto 10 intentos por minuto por IP
const loginLimiter = rateLimit({
  windowMs: config.rateLimit.loginWindowMs,
  max: config.rateLimit.loginMax,
  standardHeaders: true, // Devuelve headers estándar `RateLimit-*`
  legacyHeaders: false, // Deshabilita headers `X-RateLimit-*`
  message: {
    error: `Demasiados intentos de inicio de sesión. Por favor intente nuevamente más tarde.`,
  },
});

authRouter.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() },
      include: { area: true },
    });

    if (!user || !user.active) {
      res.status(401).json({ error: 'Credenciales inválidas o usuario inactivo' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Credenciales inválidas o usuario inactivo' });
      return;
    }

    const payload = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      coordination_scope: user.coordination_scope,
      area_id: user.area_id,
      can_triage: user.can_triage,
    };

    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '2h' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        coordination_scope: user.coordination_scope,
        area_id: user.area_id,
        area: user.area ? { id: user.area.id, code: user.area.code, name: user.area.name } : null,
        can_triage: user.can_triage,
      },
    });
  } catch (error) {
    console.error('Error en /auth/login:', error);
    res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

authRouter.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { area: true },
    });

    if (!user || !user.active) {
      res.status(401).json({ error: 'Usuario inactivo o no encontrado' });
      return;
    }

    res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      coordination_scope: user.coordination_scope,
      area_id: user.area_id,
      area: user.area ? { id: user.area.id, code: user.area.code, name: user.area.name } : null,
      can_triage: user.can_triage,
    });
  } catch (error) {
    console.error('Error en /auth/me:', error);
    res.status(500).json({ error: 'Error interno al consultar usuario' });
  }
});

// Endpoint de refresh: emite un nuevo token si el actual es válido y el usuario sigue activo.
// El frontend llama a este endpoint periódicamente (~50 min) para mantener la sesión sin reloguear.
authRouter.post('/refresh', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { area: true },
    });

    if (!user || !user.active) {
      res.status(401).json({ error: 'Usuario inactivo o no encontrado' });
      return;
    }

    const payload = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      coordination_scope: user.coordination_scope,
      area_id: user.area_id,
      can_triage: user.can_triage,
    };

    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '2h' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        coordination_scope: user.coordination_scope,
        area_id: user.area_id,
        area: user.area ? { id: user.area.id, code: user.area.code, name: user.area.name } : null,
        can_triage: user.can_triage,
      },
    });
  } catch (error) {
    console.error('Error en /auth/refresh:', error);
    res.status(500).json({ error: 'Error interno al refrescar token' });
  }
});
