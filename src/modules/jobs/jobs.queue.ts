import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

const redisUrl = env.REDIS_URL;

// Parse redis credentials or pass raw URL
export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  connectTimeout: 10000,
  enableReadyCheck: true,
});

redisConnection.on('connecting', () => {
  logger.info({ redisUrl }, 'Redis is connecting for task queues...');
});

redisConnection.on('connect', () => {
  logger.info({ redisUrl }, 'Redis connected successfully for task queues');
});

redisConnection.on('ready', () => {
  logger.info({ redisUrl }, 'Redis is ready and check passed for task queues');
});

redisConnection.on('error', (err) => {
  logger.error({ redisUrl, err: err.message }, 'Redis connection error');
});

redisConnection.on('close', () => {
  logger.warn({ redisUrl }, 'Redis connection closed for task queues');
});

redisConnection.on('reconnecting', (delay: number) => {
  logger.info({ redisUrl, delay }, 'Redis is reconnecting for task queues...');
});

export const jobsQueue = new Queue('ai-gateway-jobs', {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export async function addJobToQueue(gatewayJobId: string) {
  logger.info({ gatewayJobId }, 'Enqueuing AI gateway job in task queue');
  return jobsQueue.add('execute-job', { gatewayJobId });
}
