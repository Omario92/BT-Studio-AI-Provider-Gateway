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

## Diagnostic Commands
- **Check ComfyUI Health**:
  ```bash
  npm run smoke:comfyui-health
  ```
- **Run ComfyUI Local Upscale**:
  ```bash
  npm run smoke:comfyui-upscale -- ./sample.jpg
  ```
- **Smoke test standard gateway job pipeline**:
  ```bash
  npm run smoke:gateway-job
  ```
