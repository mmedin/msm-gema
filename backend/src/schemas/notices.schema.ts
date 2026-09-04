import { z } from 'zod';
import { life_risk, trend } from '@prisma/client';

export const createNoticeSchema = z
  .object({
    event_id: z.string({ required_error: 'El ID del evento es requerido' }).min(1, 'El ID del evento es requerido'),
    channel: z.string({ required_error: 'El canal de recepción es requerido' }).min(1, 'El canal de recepción es requerido'),
    source: z.string({ required_error: 'La fuente del aviso es requerida' }).min(1, 'La fuente del aviso es requerida'),
    contact: z.string().optional().nullable(),
    location_text: z.string().optional().nullable(),
    lat: z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]).optional().nullable(),
    lng: z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]).optional().nullable(),
    location_pending: z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]).optional().default(false),
    description: z.string({ required_error: 'La descripción es requerida' }).min(1, 'La descripción es requerida'),
    life_risk: z.nativeEnum(life_risk).optional().default(life_risk.DESCONOCIDO),
    trend: z.nativeEnum(trend).optional().default(trend.DESCONOCIDA),
  })
  .refine(
    (data) => data.location_pending || (data.location_text && data.location_text.trim().length > 0),
    {
      message: 'Debe ingresar una ubicación o marcar ubicación pendiente',
      path: ['location_text'],
    }
  );

export const convertNoticeSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres').optional(),
  type_code: z.string().optional(),
});

export const linkNoticeSchema = z.object({
  incident_id: z.string({ required_error: 'El ID del incidente es requerido' }).min(1, 'El ID del incidente es requerido'),
});

export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;
export type ConvertNoticeInput = z.infer<typeof convertNoticeSchema>;
export type LinkNoticeInput = z.infer<typeof linkNoticeSchema>;
