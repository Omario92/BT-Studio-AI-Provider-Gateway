import { FastifyInstance } from 'fastify';
import { JobsService } from './jobs.service';
import { z } from 'zod';
import { env } from '../../config/env';
import { AIProviderType, AIToolType } from '@prisma/client';

export async function jobsRoutes(app: FastifyInstance) {
  // Pre-handler hook to authenticate all incoming job requests
  app.addHook('preHandler', async (request, reply) => {
    const key = request.headers['x-ai-gateway-key'];
    if (key !== env.AI_GATEWAY_API_KEY) {
      return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
  });

  // POST /jobs/test-accept
  app.post('/test-accept', async (request, reply) => {
    try {
      const job = await JobsService.createJob({
        externalJobId: 'test-accept-' + Date.now(),
        provider: AIProviderType.MOCK,
        toolType: AIToolType.IMAGE_UPSCALE,
        inputs: { sourceFileUrl: 'https://example.com/a.png', scale: 2 },
      });
      return reply.code(202).send({ job });
    } catch (err: any) {
      return reply.code(err.statusCode || 500).send({ error: err.message, code: err.code });
    }
  });

  // POST /jobs
  app.post('/', async (request, reply) => {
    const bodySchema = z.object({
      externalJobId: z.string().optional(),
      provider: z.nativeEnum(AIProviderType),
      toolType: z.nativeEnum(AIToolType),
      workflowSlug: z.string().optional(),
      workflowVersion: z.string().optional().default('active'),
      inputs: z.record(z.any()),
      callback: z.object({
        url: z.string().url(),
        secret: z.string().min(1),
      }).optional(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.format() });
    }

    try {
      const job = await JobsService.createJob(parsed.data);
      reply.code(202).send({ job });
    } catch (err: any) {
      reply.code(err.statusCode || 500).send({ error: err.message, code: err.code });
    }
  });

  // GET /jobs/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as any;
    try {
      return await JobsService.getJob(id);
    } catch (err: any) {
      reply.code(err.statusCode || 500).send({ error: err.message, code: err.code });
    }
  });

  // POST /jobs/:id/cancel
  app.post('/:id/cancel', async (request, reply) => {
    const { id } = request.params as any;
    try {
      const job = await JobsService.cancelJob(id);
      reply.send({ message: 'Job cancellation requested', job });
    } catch (err: any) {
      reply.code(err.statusCode || 500).send({ error: err.message, code: err.code });
    }
  });

  // POST /jobs/:id/retry
  app.post('/:id/retry', async (request, reply) => {
    const { id } = request.params as any;
    try {
      const job = await JobsService.retryJob(id);
      reply.send({ message: 'Job retry scheduled successfully', job });
    } catch (err: any) {
      reply.code(err.statusCode || 500).send({ error: err.message, code: err.code });
    }
  });
}
