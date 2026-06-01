# Hướng dẫn Setup Backend Service

BT-Studio AI Provider Gateway — Fastify + Prisma (PostgreSQL) + BullMQ (Redis) + TypeScript.

---

## 1. Yêu cầu hệ thống

| Thành phần | Phiên bản tối thiểu | Ghi chú |
|---|---|---|
| Node.js | 20.x LTS | Khuyến nghị 20.11+ |
| npm | 10.x | Đi kèm Node 20 |
| Docker Desktop | 24.x | Cần cho PostgreSQL + Redis local |
| Git | 2.40+ | Để push code |

Kiểm tra nhanh:
```powershell
node -v
npm -v
docker -v
git --version
```

---

## 2. Clone & cài dependencies

```powershell
git clone https://github.com/Omario92/BT-Studio-AI-Provider-Gateway.git
cd BT-Studio-AI-Provider-Gateway
npm install
```

---

## 3. Tạo file `.env`

Copy từ template:
```powershell
Copy-Item .env.example .env
```

Sửa các biến trong `.env` cho phù hợp môi trường:

| Biến | Bắt buộc | Mặc định / Ghi chú |
|---|---|---|
| `PORT` | không | `8080` |
| `NODE_ENV` | không | `development` |
| `DATABASE_URL` | **có** | Postgres connection string — port 5435 nếu dùng docker-compose kèm repo |
| `REDIS_URL` | **có** | `redis://localhost:6379` |
| `AI_GATEWAY_API_KEY` | **có** | Key client gửi qua header `x-ai-gateway-key` |
| `AI_GATEWAY_CALLBACK_SECRET` | **có** | HMAC-SHA256 ký payload callback gửi về Product Backend |
| `COMFYUI_BASE_URL` | **có** | URL ComfyUI (mặc định `https://comfyui.luonghuynh.org`) |
| `COMFYUI_AUTH_HEADER` / `_2` | không | Nếu ComfyUI bảo vệ bằng Cloudflare Access |
| `RUNPOD_API_KEY` / `RUNPOD_ENDPOINT_ID` | không | Bật khi muốn dùng RunPod |
| `OPENAI_API_KEY` | không | Bật khi muốn dùng OpenAI image |
| `GEMINI_API_KEY` | không | Bật khi muốn dùng Gemini image |
| `DISABLE_MOCK_PROVIDER` | không | `false` — provider chưa cấu hình sẽ fallback về Mock |
| `LOG_LEVEL` | không | `info` |

> **Lưu ý**: thay `AI_GATEWAY_API_KEY` và `AI_GATEWAY_CALLBACK_SECRET` trong production. Không commit `.env`.

---

## 4. Khởi động Postgres + Redis (Docker)

```powershell
docker compose up -d postgres redis
```

Kiểm tra:
```powershell
docker compose ps
```

- Postgres: `localhost:5435` (host) → `5432` (container)
- Redis: `localhost:6379`

---

## 5. Tạo Prisma client + migrate + seed

```powershell
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
```

Sau lệnh trên DB sẽ có:
- Bảng `ProviderConfig`, `AIWorkflow`, `AIWorkflowVersion`, `GatewayJob`, `GatewayJobLog`.
- 2 provider mặc định: `COMFYUI`, `MOCK`.
- 1 workflow mẫu: `comfyui_image_upscale_default` (version 1, active).

> Seed sẽ thử nạp file workflow ComfyUI từ `../../backend/ComfyUI_workflows/IMAGE/UPSCALE_ZIMAGE_PID_API.json`. Nếu không có, nó dùng workflow tối giản — vẫn chạy được.

---

## 6. Chạy dev server

```powershell
npm run dev
```

Mặc định lắng nghe ở `http://localhost:8080`. Log dạng `pino-pretty` (màu sắc) trong dev.

Smoke test nhanh:
```powershell
curl http://localhost:8080/health
curl http://localhost:8080/health/db
curl http://localhost:8080/health/redis
curl http://localhost:8080/health/providers
```

---

## 7. Endpoints chính (cần header `x-ai-gateway-key`)

### Workflows
- `GET    /workflows` — danh sách
- `GET    /workflows/:slug` — chi tiết
- `GET    /workflows/:slug/active` — version đang active
- `POST   /workflows` — tạo workflow mới
- `POST   /workflows/:slug/versions` — thêm version
- `PATCH  /workflows/:slug/versions/:version/activate` — kích hoạt version

### Jobs
- `POST   /jobs` — submit job mới (trả `202 Accepted`)
- `GET    /jobs/:id` — trạng thái + 50 dòng log gần nhất
- `POST   /jobs/:id/cancel`
- `POST   /jobs/:id/retry`

### Health
- `GET /health`, `/health/db`, `/health/redis`, `/health/providers`, `/health/providers/:provider/health`

Ví dụ submit job:
```powershell
curl -X POST http://localhost:8080/jobs `
  -H "Content-Type: application/json" `
  -H "x-ai-gateway-key: studio-gateway-secret-key-2026" `
  -d '{
    "provider": "COMFYUI",
    "toolType": "IMAGE_UPSCALE",
    "workflowSlug": "comfyui_image_upscale_default",
    "inputs": { "sourceImage": "https://example.com/in.jpg", "scale": 2 },
    "callback": {
      "url": "https://product-backend.example.com/ai/callback",
      "secret": "shared-secret-with-product-backend"
    }
  }'
```

Callback gửi về có header `X-BT-AI-Signature` = HMAC-SHA256(body, secret).

---

## 8. Smoke scripts có sẵn

```powershell
npm run smoke:comfyui-health     # ping ComfyUI provider
npm run smoke:comfyui-upscale -- ./sample.jpg
npm run smoke:gateway-job        # job pipeline end-to-end
```

---

## 9. Chạy bằng Docker (toàn bộ)

```powershell
docker compose up -d --build
```

Toàn bộ app + postgres + redis sẽ chạy. Logs:
```powershell
docker compose logs -f app
```

Dừng:
```powershell
docker compose down              # giữ data
docker compose down -v           # xoá volumes
```

---

## 10. Build production

```powershell
npm run build      # tsc → dist/
npm start          # node dist/server.js
```

Lưu ý production:
- Đặt `NODE_ENV=production`.
- Đặt `DISABLE_MOCK_PROVIDER=true` để tránh fallback Mock im lặng.
- Cấu hình CORS chặt hơn trong `src/app.ts` (hiện `origin: true`).
- Đặt `AI_GATEWAY_API_KEY` và `AI_GATEWAY_CALLBACK_SECRET` mạnh (≥ 32 ký tự ngẫu nhiên).
- Postgres + Redis chạy managed/clustered, không dùng container local.

---

## 11. Troubleshooting

| Triệu chứng | Nguyên nhân thường gặp | Fix |
|---|---|---|
| `Environment validation failed` khi start | Thiếu biến trong `.env` | Đối chiếu mục 3, đặt đủ biến bắt buộc |
| `Database connection error` | Postgres chưa lên / sai port | `docker compose ps`, kiểm tra `DATABASE_URL` (port 5435) |
| `Redis connection error` | Redis chưa lên | `docker compose up -d redis` |
| Job kẹt ở `QUEUED` | Worker chưa start | Đảm bảo `npm run dev` đang chạy — worker khởi cùng server |
| `Provider X is not configured` | Thiếu API key trong `.env` | Hoặc set key, hoặc để `DISABLE_MOCK_PROVIDER=false` để fallback Mock |
| Prisma client lệch schema | Quên `prisma generate` sau khi sửa schema | `npx prisma generate` |

---

## 12. Push code lên GitHub lần đầu

Đã có sẵn script PowerShell:
```powershell
cd F:\App\BT-Studio-AI-Provider-Gateway
powershell -ExecutionPolicy Bypass -File .\scripts\git-push.ps1
```

Hoặc làm tay:
```powershell
git init
git branch -M main
git add -A
git commit -m "chore: initial commit - BT Studio AI Provider Gateway"
git remote add origin https://github.com/Omario92/BT-Studio-AI-Provider-Gateway.git
git push -u origin main
```

GitHub sẽ hỏi token nếu chưa cấu hình credential — dùng [Personal Access Token](https://github.com/settings/tokens) (scope `repo`).
