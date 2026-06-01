import { prisma } from '../../lib/db';
import { redisConnection } from '../jobs/jobs.queue';
import { ProviderFactory } from '../providers/provider.factory';
import { AIProviderType, AIToolType } from '@prisma/client';
import { NotFoundError } from '../../lib/errors';

export class HealthService {
  static async checkGeneralHealth() {
    return {
      status: 'OK',
      timestamp: new Date(),
      uptime: process.uptime(),
    };
  }

  static async checkDbHealth() {
    const start = Date.now();
    try {
      await prisma.$executeRaw`SELECT 1`;
      return {
        status: 'UP',
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        status: 'DOWN',
        error: err.message,
      };
    }
  }

  static async checkRedisHealth() {
    const start = Date.now();
    try {
      await redisConnection.ping();
      return {
        status: 'UP',
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        status: 'DOWN',
        error: err.message,
      };
    }
  }

  static async listProviders() {
    const providers = ProviderFactory.getAllProviders();
    const results = [];
    
    for (const p of providers) {
      const health = await p.health();
      results.push({
        provider: p.name,
        configured: p.isConfigured(),
        enabled: health.configured && health.reachable,
        reachable: health.reachable,
        latencyMs: health.latencyMs,
      });
    }

    return results;
  }

  static async checkProviderHealth(providerType: AIProviderType) {
    const providers = ProviderFactory.getAllProviders();
    const provider = providers.find((p) => p.name === providerType);
    
    if (!provider) {
      throw new NotFoundError(`AI Provider ${providerType} not found`);
    }

    const health = await provider.health();
    
    // Add mapping check for active upscale workflows if provider is ComfyUI
    if (providerType === AIProviderType.COMFYUI) {
      const activeWorkflow = await prisma.aIWorkflow.findUnique({
        where: { slug: 'comfyui_image_upscale_default' },
        include: { versions: { where: { isActive: true } } },
      });

      const activeVersion = activeWorkflow?.versions?.[0];
      return {
        ...health,
        diagnostics: {
          activeUpscaleWorkflowSeeded: !!activeWorkflow,
          activeWorkflowVersion: activeVersion?.version || null,
          hasLoadImageNode: activeVersion
            ? Object.values(activeVersion.config as any).some((n: any) => n.class_type === 'LoadImage')
            : false,
          hasSaveImageNode: activeVersion
            ? Object.values(activeVersion.config as any).some((n: any) => n.class_type === 'SaveImage')
            : false,
        },
      };
    }

    return health;
  }
}
