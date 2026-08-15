import pino from 'pino';
import { IS_PRODUCTION, IS_TEST } from '../config/env';

const level = IS_TEST ? 'silent' : IS_PRODUCTION ? 'info' : 'debug';

export const logger = pino({
  level,
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(IS_PRODUCTION
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
});