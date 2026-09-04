import { z } from 'zod';
import { priority, task_status } from '@prisma/client';

export const createTaskSchema = z.object({
  incident_id: z.string({ required_error: 'El ID del incidente es requerido' }).min(1, 'El ID del incidente es requerido'),
  area_id: z.string({ required_error: 'El ID del área es requerido' }).min(1, 'El ID del área es requerido'),
  action: z.string({ required_error: 'La acción a realizar es requerida' }).min(1, 'La acción a realizar es requerida'),
  priority: z.nativeEnum(priority).optional(),
});

export const assignTaskSchema = z.object({
  assignee_id: z.string({ required_error: 'Debe especificar el ejecutor asignado (assignee_id)' }).min(1, 'Debe especificar el ejecutor asignado (assignee_id)'),
});

export const transitionTaskSchema = z
  .object({
    status: z.nativeEnum(task_status, {
      errorMap: () => ({ message: 'Estado de transición no válido' }),
    }),
    result_notes: z.string().optional().nullable(),
    impediment_reason: z.string().optional().nullable(),
    impediment_next_action: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.status === task_status.RESUELTA && (!data.result_notes || data.result_notes.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe detallar el resultado de la tarea para darla por resuelta',
        path: ['result_notes'],
      });
    }
    if (data.status === task_status.IMPEDIDA) {
      if (!data.impediment_reason || data.impediment_reason.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Debe ingresar el motivo del impedimento',
          path: ['impediment_reason'],
        });
      }
      if (!data.impediment_next_action || data.impediment_next_action.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Debe ingresar la próxima acción requerida ante el impedimento',
          path: ['impediment_next_action'],
        });
      }
    }
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;
export type TransitionTaskInput = z.infer<typeof transitionTaskSchema>;
