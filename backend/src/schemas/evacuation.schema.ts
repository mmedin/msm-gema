import { z } from 'zod';
import { occupancy_direction, stay_kind } from '@prisma/client';

export const registerOccupancySchema = z.object({
  direction: z.nativeEnum(occupancy_direction, {
    errorMap: () => ({ message: 'Dirección inválida. Debe ser INGRESO o EGRESO' }),
  }),
  people_count: z.union([z.number().int(), z.string().regex(/^\d+$/).transform(Number)]).pipe(
    z.number().int().positive('La cantidad de personas debe ser un número entero mayor a 0')
  ),
  event_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const createCenterSchema = z.object({
  name: z.string({ required_error: 'El nombre es requerido' }).min(1, 'El nombre es requerido'),
  address: z.string({ required_error: 'La dirección es requerida' }).min(1, 'La dirección es requerida'),
  capacity: z.union([z.number().int(), z.string().regex(/^\d+$/).transform(Number)]).pipe(
    z.number().int().positive('La capacidad debe ser un número entero mayor a 0')
  ),
  lat: z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]).optional().nullable(),
  lng: z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]).optional().nullable(),
  stay_kind: z.nativeEnum(stay_kind).optional().default(stay_kind.PERNOCTA),
  equipment_notes: z.string().optional().nullable(),
});

export const updateCenterSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  capacity: z.union([z.number().int(), z.string().regex(/^\d+$/).transform(Number)]).pipe(
    z.number().int().positive()
  ).optional(),
  lat: z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]).optional().nullable(),
  lng: z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]).optional().nullable(),
  stay_kind: z.nativeEnum(stay_kind).optional(),
  equipment_notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export type RegisterOccupancyInput = z.infer<typeof registerOccupancySchema>;
export type CreateCenterInput = z.infer<typeof createCenterSchema>;
export type UpdateCenterInput = z.infer<typeof updateCenterSchema>;
