import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodTypeAny } from 'zod';
import { AppError } from '../utils';

type ValidationSource = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodTypeAny, source: ValidationSource = 'body'): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.errors.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      next(AppError.validationError('Validation failed', 'VALIDATION_ERROR', details));
      return;
    }
    const target = req[source] as Record<string, unknown>;
    Object.assign(target, result.data);
    next();
  };