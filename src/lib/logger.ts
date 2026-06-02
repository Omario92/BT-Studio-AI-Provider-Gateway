import pino from 'pino';
import { env } from '../config/env';

let canUsePretty = false;
try {
  require.resolve('pino-pretty');
  canUsePretty = true;
} catch {
  // pino-pretty is not available in production environments
}

const isDev = env.NODE_ENV === 'development' && canUsePretty;

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'yyyy-mm-dd HH:MM:ss.l',
        },
      }
    : undefined,
});

export default logger;
