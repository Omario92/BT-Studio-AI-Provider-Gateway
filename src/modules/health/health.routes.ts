import { FastifyInstance } from 'fastify';
import { HealthService } from './health.service';
import { AIProviderType } from '@prisma/client';

export async function healthRoutes(app: FastifyInstance) {
  // Public check
  app.get('/', async () => {
    return HealthService.checkGeneralHealth();
  });

  // DB check
  app.get('/db', async () => {
    return HealthService.checkDbHealth();
  });

  // Redis check
  app.get('/redis', async () => {
    return HealthService.checkRedisHealth();
  });

  // Providers list check
  app.get('/providers', async () => {
    return HealthService.listProviders();
  });

  // Provider health check details
  app.get('/providers/:provider/health', async (request, reply) => {
    const { provider } = request.params as any;
    const providerEnum = provider.toUpperCase() as AIProviderType;

    if (!Object.values(AIProviderType).includes(providerEnum)) {
      return reply.code(400).send({ error: `Invalid AIProviderType: ${provider}` });
    }

    try {
      return await HealthService.checkProviderHealth(providerEnum);
    } catch (err: any) {
      reply.code(err.statusCode || 500).send({ error: err.message, code: err.code });
    }
  });
}
