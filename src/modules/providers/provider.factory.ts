import { AIProviderType } from '@prisma/client';
import { AIProvider } from './provider.types';
import { ComfyUIProvider } from './comfyui.provider';
import { RunPodProvider } from './runpod.provider';
import { OpenAIImageProvider } from './openai-image.provider';
import { GeminiImageProvider } from './gemini-image.provider';
import { MockProvider } from './mock.provider';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

export class ProviderFactory {
  private static providers: Map<AIProviderType, AIProvider> = new Map<AIProviderType, AIProvider>([
    [AIProviderType.COMFYUI, new ComfyUIProvider()],
    [AIProviderType.RUNPOD, new RunPodProvider()],
    [AIProviderType.OPENAI_IMAGE, new OpenAIImageProvider()],
    [AIProviderType.GEMINI_IMAGE, new GeminiImageProvider()],
    [AIProviderType.MOCK, new MockProvider()],
  ]);

  /**
   * Get provider instance by type. Handles fallback to MockProvider when not configured.
   */
  static getProvider(providerType: AIProviderType): AIProvider {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Unsupported provider type: ${providerType}`);
    }

    if (!provider.isConfigured()) {
      const disableMock = env.DISABLE_MOCK_PROVIDER;
      if (disableMock) {
        logger.warn({ provider: providerType }, 'Requested provider is not configured and mock fallback is disabled');
        throw new Error(`Provider ${providerType} is not configured and mock fallback is disabled`);
      } else {
        logger.warn({ requested: providerType, fallback: 'MOCK' }, 'Requested provider not configured. Falling back to MockProvider.');
        return this.providers.get(AIProviderType.MOCK)!;
      }
    }

    return provider;
  }

  static getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }
}
