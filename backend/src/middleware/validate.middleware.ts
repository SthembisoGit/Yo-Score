import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { z } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

const fromError = (error: z.ZodError): string => {
  const first = error.issues[0];
  if (!first) return 'Invalid request payload';
  const path = first.path.join('.');
  return path ? `Invalid ${path}` : 'Invalid request payload';
};

const validate =
  (schema: z.ZodTypeAny, target: ValidationTarget): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req[target]);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: fromError(parsed.error),
        error: 'VALIDATION_FAILED',
      });
    }
    (req as unknown as Record<ValidationTarget, unknown>)[target] = parsed.data;
    return next();
  };

export const validateBody = (schema: z.ZodTypeAny) => validate(schema, 'body');
export const validateQuery = (schema: z.ZodTypeAny) => validate(schema, 'query');
export const validateParams = (schema: z.ZodTypeAny) => validate(schema, 'params');
