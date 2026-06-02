# BT-Studio-AI-Provider-Gateway

High-performance, isolated AI provider execution gateway for BT Studio. It manages provider connections (ComfyUI, RunPod, OpenAI, Gemini), runs background jobs via BullMQ/Redis, stores versioned AI workflows, and routes normalized JSON callback payloads back to the Product Backend using HMAC security signatures.

## Tech Stack
- **Runtime**: Node.js v20+
- **Language**: TypeScript
- **Web Engine**: Fastify
- **Database ORM**: Prisma + PostgreSQL
- **Task Queue**: BullMQ + Redis
- **HttpClient**: Axios
- **Logger**: Pino

## Getting Started

### 1. Configure Environment variables
Copy `.env.example` into `.env` and configure secrets:
```bash
cp .env.example .env
```

### 2. Startup Local Infrastructure
Spin up local Redis and PostgreSQL containers via Docker Compose:
```bash
docker-compose up -d postgres redis
```

### 3. Install Dependencies & Generate Client
```bash
npm install
npx prisma generate
```

### 4. Run Migrations & Seed Default Workflow
```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```

The gateway should start on [http://localhost:8080](http://localhost:8080).

## Diagnostic Commands & APIs

The gateway exposes robust diagnostic routes for status probes, environment validation, and integration smoke testing.

### 1. General Gateway Status Probe (Unauthenticated)
```bash
curl -i http://localhost:8080/health
```
* **Status**: `200 OK`
* **Response Body**:
  ```json
  {
    "status": "ok",
    "service": "ai-provider-gateway",
    "uptime": 234.56,
    "timestamp": "2026-06-02T14:20:00.000Z"
  }
  ```

### 2. Isolate DB & Redis Health
* **Database Check**:
  ```bash
  curl -i http://localhost:8080/health/db
  ```
* **Redis Check**:
  ```bash
  curl -i http://localhost:8080/health/redis
  ```

### 3. Safe Environment Dashboard (Authenticated)
```bash
curl -i http://localhost:8080/debug/env-safe \
  -H "x-ai-gateway-key: <your_api_key>"
```

### 4. Fast Accept Test Route (Authenticated, MOCK Provider)
Submit a mock upscale job that does not require ComfyUI or any external providers to verify BullMQ + Redis + DB connectivity:
```bash
curl -i -X POST http://localhost:8080/jobs/test-accept \
  -H "x-ai-gateway-key: <your_api_key>"
```

### 5. Submit Production Upscale Job (Authenticated, COMFYUI)
```bash
curl -i -X POST http://localhost:8080/jobs \
  -H "Content-Type: application/json" \
  -H "x-ai-gateway-key: <your_api_key>" \
  -d '{
    "externalJobId": "manual_test_001",
    "provider": "COMFYUI",
    "toolType": "IMAGE_UPSCALE",
    "inputs": {
      "sourceFileUrl": "https://picsum.photos/500/500",
      "scale": 2,
      "detailEnhancement": 72,
      "denoise": 45,
      "faceEnhance": true
    }
  }'
```

### Expected Gateway Logs Tracing
When a request is submitted, the console will trace its lifecycle with standard request UUID logs:
```text
{"level":30,"time":1773030300,"msg":"[Request] Incoming Request","requestId":"a4f912c7-0dbf-47ba-8230-e7fa602a11b6","method":"POST","url":"/jobs/test-accept","userAgent":"curl/8.4.0","remoteAddress":"127.0.0.1"}
{"level":30,"time":1773030300,"msg":"[Job Log] Job initialized in gateway database. External ID: test-accept-1773030300"}
{"level":30,"time":1773030300,"msg":"[Job Log] Enqueuing AI gateway job in task queue","gatewayJobId":"5f7e7d6c-134a-4a24-9b2f-3d8438b4df56"}
{"level":30,"time":1773030300,"msg":"[Request] Request Processed","requestId":"a4f912c7-0dbf-47ba-8230-e7fa602a11b6","method":"POST","url":"/jobs/test-accept","statusCode":202,"timeMs":45}
{"level":30,"time":1773030301,"msg":"[Job Log] Worker picked up job from queue","gatewayJobId":"5f7e7d6c-134a-4a24-9b2f-3d8438b4df56"}
{"level":30,"time":1773030301,"msg":"[Job Log] Job status updated to RUNNING","gatewayJobId":"5f7e7d6c-134a-4a24-9b2f-3d8438b4df56"}
{"level":30,"time":1773030301,"msg":"[Job Log] Job completed successfully","gatewayJobId":"5f7e7d6c-134a-4a24-9b2f-3d8438b4df56"}
```

