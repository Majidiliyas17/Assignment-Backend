import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils';
import { logger } from '../utils';
import { IS_PRODUCTION } from '../config/env';

export class ErrorMiddleware {
  static notFound(req: Request, _res: Response, next: NextFunction): void {
    next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
  }

  static handle(err: unknown, req: Request, res: Response, _next: NextFunction): void {
    const error = ErrorMiddleware.toAppError(err);

    if (error.statusCode >= 500) {
      logger.error({ code: error.code, path: `${req.method} ${req.originalUrl}` }, error.message);
    } else {
      logger.warn({ code: error.code, path: `${req.method} ${req.originalUrl}` }, error.message);
    }

    const errorBody: { code: string; details?: unknown; stack?: string } = { code: error.code };
    if (error.details !== undefined) {
      errorBody.details = error.details;
    }
    if (!IS_PRODUCTION && !error.isOperational) {
      errorBody.stack = error.stack;
    }

    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      error: errorBody,
    });
  }

  private static toAppError(err: unknown): AppError {
    if (err instanceof AppError) {
      return err;
    }

    if (err instanceof ZodError) {
      return AppError.validationError('Validation failed', 'VALIDATION_ERROR', err.errors);
    }

    if (err instanceof SyntaxError && err.message.includes('JSON')) {
      return AppError.badRequest('Invalid JSON payload', 'INVALID_JSON');
    }

    return AppError.internal();
  }
}