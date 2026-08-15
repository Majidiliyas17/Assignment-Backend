import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import './config/cloudinary';
import { env } from './config/env';
import { ErrorMiddleware, RateLimitMiddleware } from './middleware';
import routes from './routes';
import { httpLogger } from './utils';

export const createApp = (): Express => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  const corsOrigin = env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(httpLogger);

  app.use('/api/auth', RateLimitMiddleware.authLimiter);
  app.use('/api/share', RateLimitMiddleware.shareLimiter);
  app.use('/api', RateLimitMiddleware.globalLimiter);

  app.use('/api', routes);

  app.use(ErrorMiddleware.notFound);
  app.use(ErrorMiddleware.handle);

  return app;
};