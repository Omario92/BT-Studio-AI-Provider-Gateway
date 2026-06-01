import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

const redisUrl = env.REDIS_URL;

// Parse redis credentials or pass raw URL
export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

redisConnection.on('connect', () => {
  logger.info({ redisUrl }, 'Redis connected successfully for task queues');
});

redisConnection.on('error', (err) => {
  logger.error({ redisUrl, err: err.message }, 'Redis connection error');
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
