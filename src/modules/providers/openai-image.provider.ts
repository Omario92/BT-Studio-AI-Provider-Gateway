import { AIProvider, ProviderHealth, ProviderRunInput, ProviderRunResult } from './provider.types';
import { AIProviderType } from '@prisma/client';
import { env } from '../../config/env';
import axios from 'axios';

export class OpenAIImageProvider implements AIProvider {
  name = AIProviderType.OPENAI_IMAGE;

  isConfigured(): boolean {
    return !!env.OPENAI_API_KEY;
  }

  async health(): Promise<ProviderHealth> {
    const configured = this.isConfigured();
    if (!configured) {
      return { provider: this.name, configured: false, reachable: false, error: 'OPENAI_API_KEY is not set' };
    }
    return {
      provider: this.name,
      configured: true,
      reachable: true,
      latencyMs: 50,
    };
  }

  async run(input: ProviderRunInput): Promise<ProviderRunResult> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI Provider is not configured (missing OPENAI_API_KEY)');
    }

    try {
      const prompt = input.inputs.prompt || 'cyberpunk artwork';
      const size = input.inputs.size || '1024x1024';

      const res = await axios.post(
        'https://api.openai.com/v1/images/generations',
        {
          model: env.OPENAI_IMAGE_MODEL || 'dall-e-3',
          prompt,
          n: 1,
          size,
        },
        {
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const url = res.data?.data?.[0]?.url;
      if (!url) {
        throw new Error('OpenAI Image Generation did not return an image URL');
      }

      return {
        status: 'COMPLETED',
        progress: 100,
        outputs: [
          {
            type: 'image',
            url,
            mimeType: 'image/png',
            fileName: `openai_${input.gatewayJobId}.png`,
          },
        ],
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        error: {
          message: err.response?.data?.error?.message || err.message || 'OpenAI request failed',
          providerRaw: err.response?.data || err.message,
        },
      };
    }
  }
}
