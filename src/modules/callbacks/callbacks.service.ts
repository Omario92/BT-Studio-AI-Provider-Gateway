import axios from 'axios';
import { logger } from '../../lib/logger';
import { signPayload } from '../../lib/crypto';
import { AIProviderType, AIToolType, GatewayJobStatus } from '@prisma/client';

export type CallbackPayload = {
  externalJobId?: string | null;
  gatewayJobId: string;
  status: GatewayJobStatus;
  provider: AIProviderType;
  toolType: AIToolType;
  outputs?: any[] | null;
  error?: any | null;
};

export class CallbacksService {
  /**
   * Fire callback payload back to Product Backend with secure signature
   */
  static async sendCallback(url: string, secret: string, payload: CallbackPayload): Promise<boolean> {
    logger.info({ url, jobId: payload.gatewayJobId, status: payload.status }, 'Sending callback to Product Backend');

    try {
      const bodyStr = JSON.stringify(payload);
      const signature = signPayload(bodyStr, secret);

      const res = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-BT-AI-Signature': signature,
        },
        timeout: 10000,
      });

      logger.info({ jobId: payload.gatewayJobId, status: res.status }, 'Callback delivered successfully');
      return true;
    } catch (err: any) {
      logger.error(
        { jobId: payload.gatewayJobId, url, err: err.response?.data || err.message },
        'Failed to deliver callback'
      );
      return false;
    }
  }
}
