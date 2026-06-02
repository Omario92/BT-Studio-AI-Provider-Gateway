import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './modules/health/health.routes';
import { workflowsRoutes } from './modules/workflows/workflows.routes';
import { jobsRoutes } from './modules/jobs/jobs.routes';
import { HttpError } from './lib/errors';
import { logger } from './lib/logger';
import { env } from './config/env';

import * as crypto from 'crypto';

export const app: FastifyInstance = fastify({
  logger: false, // Use our own custom logger
  bodyLimit: 10 * 1024 * 1024, // 10MB limit
});

// Configure CORS
app.register(cors, {
  origin: true, // Allow all origins in dev
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-ai-gateway-key'],
});

// Request logging hook
app.addHook('onRequest', async (request) => {
  const rawId = request.headers['x-request-id'];
  const requestId = typeof rawId === 'string' && rawId ? rawId : crypto.randomUUID();
  (request as any).requestId = requestId;

  logger.info({
    requestId,
    method: request.method,
    url: request.url,
    userAgent: request.headers['user-agent'],
    remoteAddress: request.ip,
  }, 'Incoming Request');
});

// Response logging hook
app.addHook('onResponse', async (request, reply) => {
  const requestId = (request as any).requestId;
  logger.info({
    requestId,
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
    timeMs: reply.getResponseTime(),
  }, 'Request Processed');
});

// Root Route
app.get('/', async () => {
  return {
    name: 'BT Studio AI Provider Gateway',
    status: 'ok',
    routes: ['/health', '/jobs', '/workflows'],
  };
});

// Safe Environment Debug Route
app.get('/debug/env-safe', async (request, reply) => {
  const key = request.headers['x-ai-gateway-key'];
  if (key !== env.AI_GATEWAY_API_KEY) {
    return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  let comfyBaseUrlHost = 'N/A';
  try {
    if (env.COMFYUI_BASE_URL) {
      comfyBaseUrlHost = new URL(env.COMFYUI_BASE_URL).host;
    }
  } catch (e) {}

  return {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    hasDatabaseUrl: !!env.DATABASE_URL,
    hasRedisUrl: !!env.REDIS_URL,
    hasComfyBaseUrl: !!env.COMFYUI_BASE_URL,
    comfyBaseUrlHost,
    workflowStorageMode: env.WORKFLOW_STORAGE_MODE,
    disableMockProvider: env.DISABLE_MOCK_PROVIDER,
  };
});

// Register Routers
app.register(healthRoutes, { prefix: '/health' });
app.register(workflowsRoutes, { prefix: '/workflows' });
app.register(jobsRoutes, { prefix: '/jobs' });

// Global Error Handler
app.setErrorHandler((error, request, reply) => {
  logger.error({ err: error.message, stack: error.stack, url: request.url }, 'Server Error Handler Catch');

  if (error instanceof HttpError) {
    return reply.code(error.statusCode).send({
      error: error.message,
      code: error.code,
      details: error.details,
    });
  }

  // Handle standard fastify errors
  if (error.statusCode) {
    return reply.code(error.statusCode).send({
      error: error.message,
      code: 'FASTIFY_ERROR',
    });
  }

  return reply.code(500).send({
    error: 'An internal server error occurred',
    code: 'INTERNAL_SERVER_ERROR',
  });
});
