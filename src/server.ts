import { app } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/db';
import { redisConnection } from './modules/jobs/jobs.queue';
import { jobsWorker } from './modules/jobs/jobs.processor';

async function start() {
  logger.info({ nodeEnv: env.NODE_ENV, port: env.PORT }, 'Initializing AI Provider Gateway Server');

  try {
    // 1. Verify DB Connection
    await prisma.$connect();
    logger.info('Database connection established successfully');

    // 2. Start fastify server
    const host = '0.0.0.0';
    await app.listen({ port: env.PORT, host });
    logger.info(`🚀 Server listening at http://localhost:${env.PORT}`);

    // Log the active jobsWorker status
    logger.info(`BullMQ background worker is active and listening to queue`);
  } catch (err: any) {
    logger.fatal({ err: err.message }, 'Failed to start AI Gateway server');
    process.exit(1);
  }
}

// Graceful Shutdown Handler
async function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Graceful shutdown signal received. Terminating connections.');

  try {
    // Stop server listening
    await app.close();
    logger.info('Fastify server closed');

    // Stop BullMQ Worker
    await jobsWorker.close();
    logger.info('BullMQ Background Worker closed');

    // Close Redis
    await redisConnection.quit();
    logger.info('Redis connection closed');

    // Close DB
    await prisma.$disconnect();
    logger.info('Database connection disconnected');

    logger.info('Shutdown complete. Exiting.');
    process.exit(0);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Error occurred during graceful shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
