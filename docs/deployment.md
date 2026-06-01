# Deployment Guide: BT-Studio-AI-Provider-Gateway

This guide details how to deploy the AI Gateway service locally using Docker Compose, or to production clouds (like Railway, AWS, or GCP), and how to tunnel a local ComfyUI instance safely to the cloud.

## 1. Local Deployment (Docker Compose)

The repository provides a complete local stack configured via `docker-compose.yml` including:
- Fastify App Service (built from local Dockerfile)
- PostgreSQL database
- Redis cache/BullMQ store

To spin up the entire stack locally:
```bash
docker-compose up -d --build
```

---

## 2. Production Deployment (Railway)

Railway is highly recommended because of its native support for Fastify, Redis, and PostgreSQL out of the box.

### Deployment steps:
1. Push `BT-Studio-AI-Provider-Gateway` to a new GitHub repository.
2. In Railway, click **"New Project"** and select **"Deploy from GitHub repo"**.
3. Add a **PostgreSQL Database** database module.
4. Add a **Redis Cache** database module.
5. In your Gateway service's settings, add the required environment variables:
   - `PORT=8080`
   - `DATABASE_URL` (Bind from Postgres instance, e.g. `${{Postgres.DATABASE_URL}}`)
   - `REDIS_URL` (Bind from Redis instance, e.g. `${{Redis.REDIS_URL}}`)
   - `AI_GATEWAY_API_KEY` (Generate a secure token)
   - `AI_GATEWAY_CALLBACK_SECRET` (Generate a secure secret)
   - `COMFYUI_BASE_URL` (Cloudflared base URL)
6. Railway automatically builds from the multi-stage `Dockerfile` and deploys. Add `/health` as the Railway Healthcheck path.

---

## 3. Tunneling Local ComfyUI (Cloudflared)

If you are running ComfyUI on a local server with a GPU, you can expose it safely to your production AI Gateway using Cloudflare Tunnels (`cloudflared`).

### Steps:
1. Download and install `cloudflared` on your GPU machine.
2. Login to Cloudflare:
   ```bash
   cloudflared tunnel login
   ```
3. Create a tunnel:
   ```bash
   cloudflared tunnel create bt-comfyui-tunnel
   ```
4. Configure local port forwarding in `~/.cloudflare/config.yml` (pointing to ComfyUI, default `8188`):
   ```yaml
   tunnel: <tunnel-uuid>
   credentials-file: /root/.cloudflare/<tunnel-uuid>.json
   
   ingress:
     - hostname: comfyui.luonghuynh.org
       service: http://localhost:8188
     - service: http_status:404
   ```
5. Route tunnel domain:
   ```bash
   cloudflared tunnel route dns bt-comfyui-tunnel comfyui.luonghuynh.org
   ```
6. Run tunnel daemon:
   ```bash
   cloudflared tunnel run bt-comfyui-tunnel
   ```
7. Configure `COMFYUI_BASE_URL=https://comfyui.luonghuynh.org` in the Gateway environment.
