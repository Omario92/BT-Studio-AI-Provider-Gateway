import { FastifyInstance } from 'fastify';
import { WorkflowsService } from './workflows.service';
import { z } from 'zod';
import { env } from '../../config/env';
import { AIProviderType, AIToolType } from '@prisma/client';

export async function workflowsRoutes(app: FastifyInstance) {
  // Pre-handler hook to authenticate all incoming workflow requests
  app.addHook('preHandler', async (request, reply) => {
    const key = request.headers['x-ai-gateway-key'];
    if (key !== env.AI_GATEWAY_API_KEY) {
      reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
  });

  // GET /workflows
  app.get('/', async () => {
    return WorkflowsService.listWorkflows();
  });

  // GET /workflows/:slug
  app.get('/:slug', async (request, reply) => {
    const { slug } = request.params as any;
    try {
      return await WorkflowsService.getWorkflowBySlug(slug);
    } catch (err: any) {
      reply.code(err.statusCode || 500).send({ error: err.message, code: err.code });
    }
  });

  // GET /workflows/:slug/active
  app.get('/:slug/active', async (request, reply) => {
    const { slug } = request.params as any;
    try {
      return await WorkflowsService.getActiveWorkflow(slug);
    } catch (err: any) {
      reply.code(err.statusCode || 500).send({ error: err.message, code: err.code });
    }
  });

  // POST /workflows
  app.post('/', async (request, reply) => {
    const bodySchema = z.object({
      slug: z.string().min(1),
      name: z.string().min(1),
      provider: z.nativeEnum(AIProviderType),
      toolType: z.nativeEnum(AIToolType),
      description: z.string().optional(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.format() });
    }

    try {
      const workflow = await WorkflowsService.createWorkflow(parsed.data);
      reply.code(201).send(workflow);
    } catch (err: any) {
      reply.code(err.statusCode || 500).send({ error: err.message, code: err.code });
    }
  });

  // POST /workflows/:slug/versions
  app.post('/:slug/versions', async (request, reply) => {
    const { slug } = request.params as any;

    const bodySchema = z.object({
      config: z.any(),
      bindings: z.any().optional(),
      inputSchema: z.any().optional(),
      outputSchema: z.any().optional(),
      notes: z.string().optional(),
      isActive: z.boolean().optional(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.format() });
    }

    try {
      const version = await WorkflowsService.addWorkflowVersion(slug, {
        config: parsed.data.config,
        bindings: parsed.data.bindings,
        inputSchema: parsed.data.inputSchema,
        outputSchema: parsed.data.outputSchema,
        notes: parsed.data.notes,
        isActive: parsed.data.isActive,
      });
      reply.code(201).send(version);
    } catch (err: any) {
      reply.code(err.statusCode || 500).send({ error: err.message, code: err.code });
    }
  });

  // PATCH /workflows/:slug/versions/:version/activate
  app.patch('/:slug/versions/:version/activate', async (request, reply) => {
    const { slug, version } = request.params as any;
    const versionNum = parseInt(version, 10);

    if (isNaN(versionNum)) {
      return reply.code(400).send({ error: 'Invalid version number' });
    }

    try {
      const res = await WorkflowsService.activateWorkflowVersion(slug, versionNum);
      reply.send(res);
    } catch (err: any) {
      reply.code(err.statusCode || 500).send({ error: err.message, code: err.code });
    }
  });
}
