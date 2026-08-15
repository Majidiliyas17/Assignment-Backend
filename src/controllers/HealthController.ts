import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { env } from '../config/env';
import { ApiResponse } from '../utils';
import { asyncHandler } from '../utils';
import { logger } from '../utils';

export class HealthController {
  static check = asyncHandler(async (_req: Request, res: Response) => {
    const start = process.hrtime.bigint();

    let database: 'connected' | 'disconnected' | 'not_configured' = 'not_configured';

    if (env.DATABASE_URL) {
      database = 'disconnected';
      try {
        if (!AppDataSource.isInitialized) {
          await AppDataSource.initialize();
        }
        await AppDataSource.query('SELECT 1');
        database = 'connected';
      } catch (err) {
        logger.warn({ err }, 'Health check database probe failed');
      }
    }

    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

    res.status(200).json(
      ApiResponse.success(
        {
          status: 'ok',
          environment: env.NODE_ENV,
          uptime: Math.round(process.uptime()),
          timestamp: new Date().toISOString(),
          database,
          responseTimeMs: Math.round(durationMs),
        },
        'Service is healthy',
      ),
    );
  });
}