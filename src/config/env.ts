import * as dotenv from 'dotenv';
import { z } from 'zod';
import * as path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  AI_GATEWAY_API_KEY: z.string().min(1, 'AI_GATEWAY_API_KEY is required'),
  AI_GATEWAY_CALLBACK_SECRET: z.string().min(1, 'AI_GATEWAY_CALLBACK_SECRET is required'),

  COMFYUI_BASE_URL: z.string().min(1, 'COMFYUI_BASE_URL is required'),
  COMFYUI_AUTH_HEADER: z.string().optional().default(''),
  COMFYUI_AUTH_HEADER_2: z.string().optional().default(''),
  COMFYUI_TIMEOUT_MS: z.coerce.number().default(600000),

  RUNPOD_API_KEY: z.string().optional().default(''),
  RUNPOD_BASE_URL: z.string().optional().default('https://api.runpod.ai/v2'),
  RUNPOD_ENDPOINT_ID: z.string().optional().default(''),

  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_IMAGE_MODEL: z.string().default('gpt-image-1'),

  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_IMAGE_MODEL: z.string().default('imagen-4.0-generate-preview-06-06'),

  WORKFLOW_STORAGE_MODE: z.enum(['database', 'file', 'url']).default('database'),
  DISABLE_MOCK_PROVIDER: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean()
  ).default(false),

  LOG_LEVEL: z.string().default('info'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Environment validation failed:', JSON.stringify(_env.error.format(), null, 2));
  process.exit(1);
}

export const env = _env.data;
