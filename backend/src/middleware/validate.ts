import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const error: ZodError = result.error;
      res.status(400).json({
        error: 'Datos de entrada inválidos',
        details: error.flatten().fieldErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const error: ZodError = result.error;
      res.status(400).json({
        error: 'Parámetros de consulta inválidos',
        details: error.flatten().fieldErrors,
      });
      return;
    }
    req.query = result.data as unknown as Request['query'];
    next();
  };
};
