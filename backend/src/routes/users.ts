import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { authenticateToken, requireRole, invalidateActiveStatusCache } from '../middleware/auth';
import { user_role, coordination_scope, Prisma } from '@prisma/client';
import { validatePassword } from '../utils/passwordValidation';

export const usersRouter = Router();

// Listar miembros asignables (para coordinadores de área y coord general)
usersRouter.get('/assignable', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { area_id } = req.query;

    const whereClause: Prisma.UserWhereInput = { active: true };
    if (area_id) {
      whereClause.area_id = String(area_id);
    } else if (req.user!.area_id) {
      whereClause.area_id = req.user!.area_id;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        coordination_scope: true,
        area_id: true,
        area: { select: { id: true, code: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Error al listar usuarios asignables:', error);
    res.status(500).json({ error: 'Error al consultar usuarios asignables' });
  }
});

// ABM de Usuarios (Exclusivo Administrador)
usersRouter.get('/', authenticateToken, requireRole(user_role.ADMINISTRADOR), async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        coordination_scope: true,
        area_id: true,
        can_triage: true,
        active: true,
        created_at: true,
        area: { select: { id: true, code: true, name: true } },
      },
      orderBy: { username: 'asc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ error: 'Error al consultar usuarios' });
  }
});

usersRouter.post('/', authenticateToken, requireRole(user_role.ADMINISTRADOR), async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, name, role, coordination_scope: scope, area_id, can_triage } = req.body;

    if (!username || !password || !name || !role) {
      res.status(400).json({ error: 'Faltan campos requeridos (username, password, name, role)' });
      return;
    }

    const cleanUsername = username.toLowerCase().trim();
    if (!cleanUsername.includes('.')) {
      res.status(400).json({ error: 'El nombre de usuario debe seguir el formato nombre.apellido' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { username: cleanUsername } });
    if (existing) {
      res.status(400).json({ error: 'El nombre de usuario ya existe' });
      return;
    }

    const pwResult = validatePassword(password);
    if (!pwResult.valid) {
      res.status(400).json({ error: pwResult.message });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username: cleanUsername,
        password_hash: passwordHash,
        name,
        role: role as user_role,
        coordination_scope: scope ? (scope as coordination_scope) : null,
        area_id: area_id || null,
        can_triage: !!can_triage,
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        coordination_scope: true,
        area_id: true,
        can_triage: true,
        active: true,
        created_at: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user!.id,
        action: 'CREAR_USUARIO',
        entity: 'USER',
        entity_id: newUser.id,
        details: { username: newUser.username, role: newUser.role },
      },
    });

    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

usersRouter.patch('/:id', authenticateToken, requireRole(user_role.ADMINISTRADOR), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, role, coordination_scope: scope, area_id, can_triage, active, password } = req.body;

    const dataToUpdate: Prisma.UserUncheckedUpdateInput = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (role !== undefined) dataToUpdate.role = role as user_role;
    if (scope !== undefined) dataToUpdate.coordination_scope = scope as coordination_scope;
    if (area_id !== undefined) dataToUpdate.area_id = area_id;
    if (can_triage !== undefined) dataToUpdate.can_triage = !!can_triage;
    if (active !== undefined) dataToUpdate.active = active;
    if (password) {
      const pwResult = validatePassword(password);
      if (!pwResult.valid) {
        res.status(400).json({ error: pwResult.message });
        return;
      }
      dataToUpdate.password_hash = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        coordination_scope: true,
        area_id: true,
        can_triage: true,
        active: true,
        created_at: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user!.id,
        action: 'ACTUALIZAR_USUARIO',
        entity: 'USER',
        entity_id: id,
        details: { updatedFields: Object.keys(dataToUpdate) },
      },
    });

    // Invalidar caché de estado activo para efecto inmediato al desactivar usuarios
    invalidateActiveStatusCache(id);

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});
