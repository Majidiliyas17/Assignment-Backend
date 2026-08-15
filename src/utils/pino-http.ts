import pinoHttp from 'pino-http';
import { logger } from './logger';

export const httpLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (err) return 'error';
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});