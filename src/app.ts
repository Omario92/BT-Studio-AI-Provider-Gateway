import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './modules/health/health.routes';
import { workflowsRoutes } from './modules/workflows/workflows.routes';
import { jobsRoutes } from './modules/jobs/jobs.routes';
import { HttpError } from './lib/errors';
import { logger } from './lib/logger';

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
  logger.info({ method: request.method, url: request.url }, 'Incoming Request');
});

// Response logging hook
app.addHook('onResponse', async (request, reply) => {
  logger.info({ method: request.method, url: request.url, statusCode: reply.statusCode, time: `${reply.getResponseTime()}ms` }, 'Request Processed');
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
