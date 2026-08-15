import 'reflect-metadata';
import { AppDataSource } from './config/database';
import { env } from './config/env';
import { createApp } from './app';
import { logger } from './utils/logger';

const startServer = async (): Promise<void> => {
  const app = createApp();

  if (env.DATABASE_URL) {
    try {
      await AppDataSource.initialize();
      logger.info('Database connection established');
    } catch (err) {
      logger.error({ err }, 'Failed to initialize database - starting without it');
    }
  } else {
    logger.warn('DATABASE_URL is not set - running without a database connection');
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error({ err }, `Port ${env.PORT} is already in use`);
    } else {
      logger.error({ err }, 'Failed to start HTTP server');
    }
    if (AppDataSource.isInitialized) {
      AppDataSource.destroy().finally(() => process.exit(1));
    } else {
      process.exit(1);
    }
  });

  const shutdown = (signal: string): void => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(() => {
      if (AppDataSource.isInitialized) {
        AppDataSource.destroy()
          .catch((err) => logger.error({ err }, 'Failed to close database connection'))
          .finally(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

void startServer();
