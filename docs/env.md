# Environment Variables: AI Provider Gateway

Detailed documentation of all environment variables supported by the `BT-Studio-AI-Provider-Gateway` service.

## 1. Server Configuration
- `PORT` (default: `8080`): Port Fastify listens on.
- `NODE_ENV` (default: `development`): Environment mode. Valid values: `development`, `production`, `test`.
- `LOG_LEVEL` (default: `info`): Log verbosity level for Pino. Valid values: `debug`, `info`, `warn`, `error`, `fatal`.

## 2. Databases & Queues
- `DATABASE_URL` (Required): PostgreSQL connection URL.
  Example: `postgresql://gateway:gateway123@localhost:5435/ai_gateway?schema=public`
- `REDIS_URL` (Required): Redis connection URL used by BullMQ task queue.
  Example: `redis://localhost:6379`

## 3. Gateway Security
- `AI_GATEWAY_API_KEY` (Required): Secret API key expected in `x-ai-gateway-key` headers to authorize requests.
- `AI_GATEWAY_CALLBACK_SECRET` (Required): HMAC key used to generate sha256 checksum signatures in outbound callbacks.

## 4. ComfyUI Provider Config
- `COMFYUI_BASE_URL` (Required): Endpoint where ComfyUI API is exposed.
  Example: `https://comfyui.luonghuynh.org`
- `COMFYUI_AUTH_HEADER` (Optional): Authentication header injected into all ComfyUI REST requests. Format: `Header-Name:Header-Value`
- `COMFYUI_AUTH_HEADER_2` (Optional): Secondary authentication header (e.g. for bypassing Cloudflare Access Service Token checks). Format: `Header-Name:Header-Value`
- `COMFYUI_TIMEOUT_MS` (default: `600000` = 10 minutes): Axios request/polling timeout for ComfyUI execution.

## 5. OpenAI Config
- `OPENAI_API_KEY` (Optional): API key for OpenAI generation.
- `OPENAI_IMAGE_MODEL` (default: `gpt-image-1`): Model name target.

## 6. Gemini Config
- `GEMINI_API_KEY` (Optional): API key for Gemini Imagen generation.
- `GEMINI_IMAGE_MODEL` (default: `imagen-4.0-generate-preview-06-06`): Model name target.

## 7. RunPod Config
- `RUNPOD_API_KEY` (Optional): RunPod authentication bearer key.
- `RUNPOD_BASE_URL` (default: `https://api.runpod.ai/v2`): RunPod API base endpoint.
- `RUNPOD_ENDPOINT_ID` (Optional): Target serverless endpoint ID.

## 8. Development & Diagnostics
- `DISABLE_MOCK_PROVIDER` (default: `false`): When set to `true`, disables mock fallbacks and forces jobs to fail visibly if their target provider is not configured. Useful for debugging ComfyUI connectivity on Railway containers.
- `WORKFLOW_STORAGE_MODE` (default: `database`): Mode to fetch workflows. Allowed values: `database`, `file`, `url`.
