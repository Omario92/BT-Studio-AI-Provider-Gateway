import { AIProviderType, AIToolType } from '@prisma/client';

export type ProviderRunInput = {
  gatewayJobId: string;
  externalJobId?: string;
  toolType: AIToolType;
  workflow?: {
    slug?: string;
    version?: number | "active";
    config?: any;
    bindings?: any;
  };
  inputs: Record<string, any>;
};

export type ProviderRunResult = {
  status: "PENDING" | "COMPLETED" | "FAILED";
  providerJobId?: string;
  progress?: number;
  outputs?: Array<{
    type: "image" | "video" | "audio" | "json";
    url?: string;
    bufferBase64?: string;
    mimeType?: string;
    fileName?: string;
    width?: number;
    height?: number;
    metadata?: Record<string, any>;
  }>;
  error?: {
    message: string;
    code?: string;
    providerRaw?: any;
  };
};

export type ProviderHealth = {
  provider: AIProviderType;
  configured: boolean;
  reachable: boolean;
  latencyMs?: number;
  error?: string;
  metadata?: Record<string, any>;
};

export interface AIProvider {
  name: AIProviderType;
  isConfigured(): boolean;
  health(): Promise<ProviderHealth>;
  run(input: ProviderRunInput): Promise<ProviderRunResult>;
  poll?(providerJobId: string, input?: ProviderRunInput): Promise<ProviderRunResult>;
  cancel?(providerJobId: string): Promise<void>;
}
