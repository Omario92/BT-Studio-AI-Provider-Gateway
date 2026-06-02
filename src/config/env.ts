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

  AI_GATEWAY_API_KEY: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().default('default-gateway-api-key')
  ),
  AI_GATEWAY_CALLBACK_SECRET: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().default('default-gateway-callback-secret')
  ),

  COMFYUI_BASE_URL: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().default('http://localhost:8188')
  ),
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
  COMFYUI_UPSCALE_WORKFLOW_URL: z.string().optional().default(''),
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

if (_env.data.NODE_ENV === 'production') {
  if (_env.data.AI_GATEWAY_API_KEY === 'default-gateway-api-key') {
    console.warn('⚠️ WARNING: Using default AI_GATEWAY_API_KEY in production! Please configure a secure key.');
  }
  if (_env.data.AI_GATEWAY_CALLBACK_SECRET === 'default-gateway-callback-secret') {
    console.warn('⚠️ WARNING: Using default AI_GATEWAY_CALLBACK_SECRET in production! Please configure a secure secret.');
  }
}

export const env = _env.data;
