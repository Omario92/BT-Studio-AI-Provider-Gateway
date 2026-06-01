import { AIProvider, ProviderHealth, ProviderRunInput, ProviderRunResult } from './provider.types';
import { AIProviderType } from '@prisma/client';

export class MockProvider implements AIProvider {
  name = AIProviderType.MOCK;

  isConfigured(): boolean {
    return true;
  }

  async health(): Promise<ProviderHealth> {
    return {
      provider: this.name,
      configured: true,
      reachable: true,
      latencyMs: 12,
      metadata: { mock: true },
    };
  }

  async run(input: ProviderRunInput): Promise<ProviderRunResult> {
    // Generate a placeholder mock URL
    const seed = Math.floor(Math.random() * 1000000);
    const mockOutputUrl = `https://picsum.photos/seed/${seed}/1024/1024`;

    return {
      status: 'COMPLETED',
      progress: 100,
      outputs: [
        {
          type: 'image',
          url: mockOutputUrl,
          mimeType: 'image/jpeg',
          fileName: `mock_upscale_${input.gatewayJobId}.jpg`,
          width: 1024,
          height: 1024,
          metadata: { mock: true, gatewayJobId: input.gatewayJobId },
        },
      ],
    };
  }
}
