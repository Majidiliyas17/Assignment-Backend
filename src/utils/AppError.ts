export interface AppErrorOptions {
  isOperational?: boolean;
  details?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code: string, options?: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = options?.isOperational ?? true;
    this.details = options?.details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', code = 'BAD_REQUEST', details?: unknown): AppError {
    return new AppError(400, message, code, { details });
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED', details?: unknown): AppError {
    return new AppError(401, message, code, { details });
  }

  static forbidden(message = 'Access denied', code = 'FORBIDDEN', details?: unknown): AppError {
    return new AppError(403, message, code, { details });
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND', details?: unknown): AppError {
    return new AppError(404, message, code, { details });
  }

  static conflict(message = 'Conflict', code = 'CONFLICT', details?: unknown): AppError {
    return new AppError(409, message, code, { details });
  }

  static payloadTooLarge(message = 'Payload too large', code = 'PAYLOAD_TOO_LARGE', details?: unknown): AppError {
    return new AppError(413, message, code, { details });
  }

  static validationError(message = 'Validation failed', code = 'VALIDATION_ERROR', details?: unknown): AppError {
    return new AppError(422, message, code, { details });
  }

  static tooManyRequests(message = 'Too many requests', code = 'TOO_MANY_REQUESTS', details?: unknown): AppError {
    return new AppError(429, message, code, { details });
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR', details?: unknown): AppError {
    return new AppError(500, message, code, { isOperational: false, details });
  }

  static badGateway(message = 'Upstream service error', code = 'BAD_GATEWAY', details?: unknown): AppError {
    return new AppError(502, message, code, { details });
  }
}