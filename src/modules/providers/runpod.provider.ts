import { AIProvider, ProviderHealth, ProviderRunInput, ProviderRunResult } from './provider.types';
import { AIProviderType } from '@prisma/client';
import { env } from '../../config/env';
import axios from 'axios';

export class RunPodProvider implements AIProvider {
  name = AIProviderType.RUNPOD;

  isConfigured(): boolean {
    return !!env.RUNPOD_API_KEY && !!env.RUNPOD_ENDPOINT_ID;
  }

  async health(): Promise<ProviderHealth> {
    const configured = this.isConfigured();
    if (!configured) {
      return { provider: this.name, configured: false, reachable: false, error: 'RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID is not set' };
    }
    return {
      provider: this.name,
      configured: true,
      reachable: true,
      latencyMs: 65,
    };
  }

  async run(input: ProviderRunInput): Promise<ProviderRunResult> {
    if (!this.isConfigured()) {
      throw new Error('RunPod Provider is not configured (missing RUNPOD_API_KEY/RUNPOD_ENDPOINT_ID)');
    }

    try {
      const url = `${env.RUNPOD_BASE_URL}/${env.RUNPOD_ENDPOINT_ID}/run`;
      const res = await axios.post(
        url,
        {
          input: {
            ...input.inputs,
            toolType: input.toolType,
            gatewayJobId: input.gatewayJobId,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const runpodJobId = res.data?.id;
      if (!runpodJobId) {
        throw new Error(`RunPod returned no job id: ${JSON.stringify(res.data)}`);
      }

      return {
        status: 'PENDING',
        providerJobId: runpodJobId,
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        error: {
          message: err.response?.data?.error || err.message || 'RunPod submission failed',
          providerRaw: err.response?.data || err.message,
        },
      };
    }
  }

  async poll(providerJobId: string, _input: ProviderRunInput): Promise<ProviderRunResult> {
    try {
      const url = `${env.RUNPOD_BASE_URL}/${env.RUNPOD_ENDPOINT_ID}/status/${providerJobId}`;
      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
        },
        timeout: 10000,
      });

      const data = res.data ?? {};
      const status = data.status;

      if (status === 'IN_QUEUE' || status === 'IN_PROGRESS') {
        return { status: 'PENDING', providerJobId };
      }

      if (status === 'COMPLETED') {
        const output = data.output;
        const imageUrl = typeof output === 'string' ? output : output?.image || output?.url;
        
        if (!imageUrl) {
          throw new Error(`RunPod completed but output image not found: ${JSON.stringify(data)}`);
        }

        return {
          status: 'COMPLETED',
          progress: 100,
          outputs: [
            {
              type: 'image',
              url: imageUrl,
              mimeType: 'image/png',
              fileName: `runpod_${providerJobId}.png`,
            },
          ],
        };
      }

      return {
        status: 'FAILED',
        error: {
          message: `RunPod job status: ${status}`,
          providerRaw: data,
        },
      };
    } catch (err: any) {
      return {
        status: 'PENDING',
        providerJobId,
        error: {
          message: err.message,
        },
      };
    }
  }
}
