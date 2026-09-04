import { z } from 'zod';
import { event_status, smn_alert } from '@prisma/client';

export const createEventSchema = z.object({
  description: z.string({ required_error: 'La descripción del evento es requerida' }).min(3, 'La descripción debe tener al menos 3 caracteres'),
  smn_alert: z.nativeEnum(smn_alert).optional(),
  status: z.nativeEnum(event_status).optional(),
});

export const updateEventSchema = z.object({
  description: z.string().min(3, 'La descripción debe tener al menos 3 caracteres').optional(),
  smn_alert: z.nativeEnum(smn_alert).optional(),
  status: z.nativeEnum(event_status).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
