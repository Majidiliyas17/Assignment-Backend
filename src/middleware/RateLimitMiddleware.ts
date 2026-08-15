import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { AppError } from '../utils';

const tooManyRequestsHandler: RequestHandler = (_req, _res, next) => {
  next(AppError.tooManyRequests('Too many requests, please try again later'));
};

export class RateLimitMiddleware {
  static globalLimiter: RequestHandler = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: tooManyRequestsHandler,
  });

  static authLimiter: RequestHandler = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: tooManyRequestsHandler,
  });

  static shareLimiter: RequestHandler = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: tooManyRequestsHandler,
  });
}