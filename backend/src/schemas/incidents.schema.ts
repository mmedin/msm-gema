import { z } from 'zod';
import { priority, incident_status, life_risk, trend } from '@prisma/client';

export const createIncidentSchema = z.object({
  event_id: z.string({ required_error: 'El ID del evento es requerido' }).min(1, 'El ID del evento es requerido'),
  title: z.string({ required_error: 'El título es requerido' }).min(3, 'El título debe tener al menos 3 caracteres'),
  type_code: z.string().optional().default('INUNDACION_ANEGAMIENTO'),
  description: z.string({ required_error: 'La descripción es requerida' }).min(1, 'La descripción es requerida'),
  location_text: z.string().optional().nullable().default('Ubicación a determinar'),
  lat: z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]).optional().nullable(),
  lng: z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]).optional().nullable(),
  location_pending: z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]).optional().default(false),
  life_risk: z.nativeEnum(life_risk).optional().default(life_risk.DESCONOCIDO),
  trend: z.nativeEnum(trend).optional().default(trend.DESCONOCIDA),
  priority: z.nativeEnum(priority).optional().nullable(),
});

export const triageIncidentSchema = z.object({
  priority: z.nativeEnum(priority, {
    errorMap: () => ({ message: 'Prioridad inválida. Debe ser P1, P2, P3 o P4' }),
  }),
});

export const updateIncidentStatusSchema = z.object({
  status: z.nativeEnum(incident_status, {
    errorMap: () => ({ message: 'Estado de incidente inválido' }),
  }),
  resolution_notes: z.string().optional().nullable(),
  closure_notes: z.string().optional().nullable(),
  force: z.boolean().optional().default(false),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type TriageIncidentInput = z.infer<typeof triageIncidentSchema>;
export type UpdateIncidentStatusInput = z.infer<typeof updateIncidentStatusSchema>;
