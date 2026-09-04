import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticateToken } from '../middleware/auth';
import { upload, cleanupUploadedFile } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { createNoticeSchema, convertNoticeSchema, linkNoticeSchema } from '../schemas/notices.schema';
import { Prisma, notice_status, life_risk, trend, incident_status } from '@prisma/client';
import { generateNextIncidentCode, withTransactionRetry } from '../utils/atomicSequence';

export const noticesRouter = Router();

// Listar avisos
noticesRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { event_id, status, limit, offset, cursor } = req.query;

    const whereClause: Prisma.NoticeWhereInput = {};
    if (event_id) whereClause.event_id = String(event_id);
    if (status) whereClause.status = status as notice_status;

    // Paginación con límite por defecto razonable de 50
    const take = limit === 'all' ? undefined : limit ? Math.min(Math.max(1, parseInt(String(limit), 10)), 500) : 50;
    const skip = offset ? Math.max(0, parseInt(String(offset), 10)) : cursor ? 1 : undefined;
    const cursorObj = cursor ? { id: String(cursor) } : undefined;

    const [totalCount, notices] = await Promise.all([
      prisma.notice.count({ where: whereClause }),
      prisma.notice.findMany({
        where: whereClause,
        take,
        skip,
        cursor: cursorObj,
        orderBy: { received_at: 'desc' },
        include: {
          incident: {
            select: {
              id: true,
              code: true,
              title: true,
              priority: true,
              status: true,
            },
          },
          created_by: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
      }),
    ]);

    res.setHeader('X-Total-Count', totalCount.toString());
    res.setHeader('X-Limit', (take ?? totalCount).toString());
    res.setHeader('X-Offset', (skip ?? 0).toString());

    res.json(notices);
  } catch (error: unknown) {
    console.error('Error al listar avisos:', error);
    res.status(500).json({ error: 'Error al consultar avisos' });
  }
});

// Crear nuevo aviso (+ evidencia opcional)
noticesRouter.post(
  '/',
  authenticateToken,
  upload.single('photo'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parseResult = createNoticeSchema.safeParse(req.body);
      if (!parseResult.success) {
        cleanupUploadedFile(req.file);
        res.status(400).json({
          error: 'Datos de entrada inválidos',
          details: parseResult.error.flatten().fieldErrors,
        });
        return;
      }

      const {
        event_id,
        channel,
        source,
        contact,
        location_text,
        lat,
        lng,
        location_pending,
        description,
        life_risk: lifeRiskVal,
        trend: trendVal,
      } = parseResult.data;

      const evidenceFilename = req.file ? req.file.filename : null;

      const notice = await prisma.notice.create({
        data: {
          event_id,
          channel,
          source,
          contact: contact || null,
          location_text: location_text || 'Ubicación a determinar',
          lat: lat ?? null,
          lng: lng ?? null,
          location_pending: !!location_pending,
          description,
          life_risk: lifeRiskVal,
          trend: trendVal,
          status: notice_status.RECIBIDO,
          evidence_filename: evidenceFilename,
          created_by_id: req.user!.id,
        },
        include: {
          created_by: {
            select: { id: true, name: true, username: true },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          actor_id: req.user!.id,
          action: 'REGISTRAR_AVISO',
          entity: 'NOTICE',
          entity_id: notice.id,
          details: { channel, source, location_text, life_risk: notice.life_risk },
        },
      });

      res.status(201).json(notice);
    } catch (error: unknown) {
      cleanupUploadedFile(req.file);
      console.error('Error al crear aviso:', error);
      res.status(500).json({ error: 'Error al registrar aviso' });
    }
  }
);

// Convertir aviso en un nuevo incidente
noticesRouter.patch(
  '/:id/convert',
  authenticateToken,
  validateBody(convertNoticeSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { title, type_code } = req.body;

      const result = await withTransactionRetry(() =>
        prisma.$transaction(async (tx) => {
          // Bloquear aviso FOR UPDATE para evitar conversiones duplicadas concurrentes
          const [notice] = await tx.$queryRaw<
            Array<{
              id: string;
              event_id: string;
              status: notice_status;
              description: string;
              location_text: string;
              lat: number | null;
              lng: number | null;
              location_pending: boolean;
              life_risk: life_risk;
              trend: trend;
            }>
          >`
            SELECT id, event_id, status, description, location_text, lat, lng, location_pending, life_risk, trend
            FROM notices
            WHERE id = ${id}
            FOR UPDATE
          `;

          if (!notice) {
            throw { status: 404, message: 'Aviso no encontrado' };
          }

          if (notice.status === notice_status.CONVERTIDO || notice.status === notice_status.VINCULADO) {
            throw { status: 400, message: 'Este aviso ya fue procesado o vinculado previamente' };
          }

          // Generar código único correlativo atómico dentro del evento bloqueando el evento
          const code = await generateNextIncidentCode(tx, notice.event_id);

          // Crear nuevo incidente con datos del aviso
          const incident = await tx.incident.create({
            data: {
              code,
              event_id: notice.event_id,
              title: title || `Incidente: ${notice.description.slice(0, 50)}...`,
              type_code: type_code || 'INUNDACION_ANEGAMIENTO',
              description: notice.description,
              location_text: notice.location_text,
              lat: notice.lat,
              lng: notice.lng,
              location_pending: notice.location_pending,
              life_risk: notice.life_risk,
              trend: notice.trend,
              status: incident_status.RECIBIDO,
              created_by_id: req.user!.id,
              last_activity_at: new Date(),
            },
          });

          // Actualizar aviso
          const updatedNotice = await tx.notice.update({
            where: { id },
            data: {
              status: notice_status.CONVERTIDO,
              incident_id: incident.id,
            },
            include: {
              incident: true,
            },
          });

          await tx.auditLog.create({
            data: {
              actor_id: req.user!.id,
              action: 'CONVERTIR_AVISO_A_INCIDENTE',
              entity: 'NOTICE',
              entity_id: notice.id,
              details: { incident_id: incident.id, incident_code: incident.code },
            },
          });

          return { notice: updatedNotice, incident };
        })
      );

      res.json(result);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'status' in error && 'message' in error) {
        const customErr = error as { status: number; message: string };
        res.status(customErr.status).json({ error: customErr.message });
        return;
      }
      console.error('Error al convertir aviso:', error);
      res.status(500).json({ error: 'Error al convertir aviso a incidente' });
    }
  }
);

// Vincular aviso a un incidente existente
noticesRouter.patch(
  '/:id/link',
  authenticateToken,
  validateBody(linkNoticeSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { incident_id } = req.body;

      const notice = await prisma.notice.findUnique({ where: { id } });
      if (!notice) {
        res.status(404).json({ error: 'Aviso no encontrado' });
        return;
      }

      const incident = await prisma.incident.findUnique({ where: { id: incident_id } });
      if (!incident) {
        res.status(404).json({ error: 'Incidente destino no encontrado' });
        return;
      }

      const updatedNotice = await prisma.notice.update({
        where: { id },
        data: {
          status: notice_status.VINCULADO,
          incident_id: incident.id,
        },
        include: {
          incident: true,
        },
      });

      // Actualizar última actividad del incidente
      await prisma.incident.update({
        where: { id: incident.id },
        data: { last_activity_at: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          actor_id: req.user!.id,
          action: 'VINCULAR_AVISO_A_INCIDENTE',
          entity: 'NOTICE',
          entity_id: notice.id,
          details: { incident_id: incident.id, incident_code: incident.code },
        },
      });

      res.json(updatedNotice);
    } catch (error: unknown) {
      console.error('Error al vincular aviso:', error);
      res.status(500).json({ error: 'Error al vincular aviso' });
    }
  }
);

// Descartar aviso
noticesRouter.patch('/:id/discard', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const notice = await prisma.notice.update({
      where: { id },
      data: {
        status: notice_status.DESCARTADO,
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user!.id,
        action: 'DESCARTAR_AVISO',
        entity: 'NOTICE',
        entity_id: notice.id,
      },
    });

    res.json(notice);
  } catch (error: unknown) {
    console.error('Error al descartar aviso:', error);
    res.status(500).json({ error: 'Error al descartar aviso' });
  }
});
