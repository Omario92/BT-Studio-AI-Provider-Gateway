# Deploy BT-Studio AI Provider Gateway lên Railway

Hướng dẫn end-to-end deploy backend lên [Railway](https://railway.app) — bao gồm Postgres, Redis, env, migrate, seed.

---

## 1. Chuẩn bị

- Tài khoản Railway (đăng ký bằng GitHub).
- Repo đã push: https://github.com/Omario92/BT-Studio-AI-Provider-Gateway
- File đã có sẵn trong repo:
  - `Dockerfile` — multi-stage build Node 20 alpine.
  - `railway.json` — Railway dùng Dockerfile + chạy `prisma migrate deploy` trước khi start.
  - `.env.example` — danh sách biến cần set.

> Railway tự inject `PORT`, `DATABASE_URL` (từ Postgres plugin), `REDIS_URL` (từ Redis plugin). App đã đọc đúng các tên này.

---

## 2. Tạo project trên Railway

### Cách A — qua Web UI (khuyên dùng lần đầu)

1. Vào https://railway.app/new → **Deploy from GitHub repo**.
2. Cho phép Railway truy cập repo `Omario92/BT-Studio-AI-Provider-Gateway`.
3. Chọn repo, Railway tự detect `Dockerfile` và `railway.json` → tạo service tên `BT-Studio-AI-Provider-Gateway`.
4. **Đừng deploy vội** — bấm vào service vừa tạo, qua tab **Variables**, để trống tạm thời (sẽ điền sau khi có DB/Redis).

### Cách B — qua Railway CLI

```powershell
npm i -g @railway/cli
railway login
railway init           # tạo project mới
railway link           # liên kết folder hiện tại với project
```

---

## 3. Thêm Postgres và Redis

Trong dashboard project:

1. Bấm **+ New** → **Database** → **PostgreSQL**. Đợi provision xong.
2. Bấm **+ New** → **Database** → **Redis**. Đợi provision xong.

Railway sẽ tự sinh các biến `DATABASE_URL` (Postgres) và `REDIS_URL` (Redis) — nằm trong tab **Variables** của từng plugin.

---

## 4. Liên kết biến từ DB sang service app

Vào service `BT-Studio-AI-Provider-Gateway` → tab **Variables** → bấm **+ New Variable** → **Reference**:

| Biến trong app | Reference đến |
|---|---|
| `DATABASE_URL` | `Postgres.DATABASE_URL` |
| `REDIS_URL` | `Redis.REDIS_URL` |

Cú pháp reference Railway: `${{ Postgres.DATABASE_URL }}` và `${{ Redis.REDIS_URL }}`.

---

## 5. Set các biến môi trường còn lại

Trong cùng tab Variables của service app, thêm raw values:

```env
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

AI_GATEWAY_API_KEY=<32+ ký tự ngẫu nhiên>
AI_GATEWAY_CALLBACK_SECRET=<32+ ký tự ngẫu nhiên>

COMFYUI_BASE_URL=https://comfyui.luonghuynh.org
COMFYUI_AUTH_HEADER=
COMFYUI_AUTH_HEADER_2=
COMFYUI_TIMEOUT_MS=600000

RUNPOD_API_KEY=
RUNPOD_BASE_URL=https://api.runpod.ai/v2
RUNPOD_ENDPOINT_ID=

OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-1

GEMINI_API_KEY=
GEMINI_IMAGE_MODEL=imagen-4.0-generate-preview-06-06

WORKFLOW_STORAGE_MODE=database
DISABLE_MOCK_PROVIDER=true
```

Sinh secret ngẫu nhiên trong PowerShell:
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 } | ForEach-Object { [byte]$_ }))
```

> **Lưu ý PORT**: Railway tự inject `PORT` cho service. Bạn có thể bỏ dòng `PORT=8080` nếu muốn để Railway tự quyết định, app đã đọc `env.PORT`.

---

## 6. Deploy

Sau khi đã có Postgres + Redis + đầy đủ biến:

- **Cách A**: Railway tự deploy ngay khi bạn push commit mới lên `main`. Trigger lần đầu bằng cách push lại bất kỳ commit, hoặc bấm **Deploy** trong UI.
- **Cách B (CLI)**:
  ```powershell
  railway up
  ```

Railway sẽ:
1. Build Dockerfile (`npm ci` → `prisma generate` → `tsc build`).
2. Chạy `npx prisma migrate deploy` (từ `railway.json` startCommand) — apply migrations Prisma.
3. Khởi động `node dist/server.js`.
4. Healthcheck `GET /health` (timeout 30s, retry tối đa 5 lần khi fail).

Xem logs realtime:
```powershell
railway logs
```

---

## 7. Expose public domain

Trong service settings → tab **Settings** → mục **Networking** → bấm **Generate Domain**.

Railway sẽ cấp domain dạng `bt-studio-ai-provider-gateway-production.up.railway.app`. Test:

```powershell
curl https://<your-domain>.up.railway.app/health
curl https://<your-domain>.up.railway.app/health/db
curl https://<your-domain>.up.railway.app/health/redis
curl https://<your-domain>.up.railway.app/health/providers
```

Hoặc gắn custom domain trong cùng panel.

---

## 8. Seed database lần đầu

Migrations đã chạy tự động qua `start:prod`. Nhưng seed thì chưa. Hai cách:

### Cách 1 — chạy 1 lần qua Railway shell
```powershell
railway run npm run db:seed
```
Lệnh `railway run` sẽ inject biến môi trường của Railway project vào shell local, rồi chạy seed script (kết nối tới Postgres trên Railway).

> Yêu cầu Node + npm + `tsx` cài local. Đã có sẵn vì `tsx` ở devDependencies.

### Cách 2 — temporary one-off command
Trong service Railway, **Settings → Custom Start Command** đổi tạm thành:
```
npx prisma migrate deploy && npm run db:seed && node dist/server.js
```
Deploy → đợi seed xong → đổi lại về `npx prisma migrate deploy && node dist/server.js`.

---

## 9. Cấu hình production cần kiểm tra

- [ ] `NODE_ENV=production`
- [ ] `DISABLE_MOCK_PROVIDER=true` (tránh fallback Mock im lặng nếu provider chưa set key)
- [ ] `AI_GATEWAY_API_KEY` và `AI_GATEWAY_CALLBACK_SECRET` là chuỗi mạnh
- [ ] CORS đã chỉnh trong `src/app.ts` từ `origin: true` → whitelist domain frontend (nếu có browser client)
- [ ] Postgres backup tự động bật (Railway plugin Postgres có scheduled backup ở plan trả phí)
- [ ] Healthcheck `/health` trả `200`

---

## 10. Worker BullMQ

Hiện tại worker (`jobs.processor.ts`) chạy **inline** trong cùng process với HTTP server (xem `server.ts`). Một dyno Railway là đủ cho khối lượng thấp.

Khi tải tăng, tách worker thành service riêng:
1. Tạo service Railway thứ 2 cùng repo.
2. Override **Start Command**: `node dist/worker.js` (cần thêm file `src/worker.ts` chỉ import `jobs.processor` mà không start fastify).
3. Reference cùng `DATABASE_URL` và `REDIS_URL`.

---

## 11. Troubleshooting

| Triệu chứng | Nguyên nhân | Fix |
|---|---|---|
| Build fail tại `tsc` | Type error | Chạy `npm run type-check` local trước khi push |
| Build OK, deploy crash với `Environment validation failed` | Thiếu biến trong tab Variables | Đối chiếu danh sách mục 5 |
| `Can't reach database server` | Quên reference `DATABASE_URL` từ Postgres plugin | Mục 4 |
| `ECONNREFUSED 127.0.0.1:6379` | `REDIS_URL` đang trỏ localhost | Reference `Redis.REDIS_URL`, không hardcode |
| Healthcheck timeout | App không bind `0.0.0.0` hoặc PORT sai | Code đã bind `0.0.0.0` và đọc `env.PORT`, chỉ cần để Railway tự inject PORT |
| `prisma migrate deploy` fail với "No migrations found" | Chưa generate migration file local | Local chạy `npx prisma migrate dev --name init` rồi commit folder `prisma/migrations/` |
| Job kẹt `QUEUED` | Worker không chạy / Redis sai | Check log service app, đảm bảo log có dòng "Redis connected successfully" |

---

## 12. Lệnh CLI hữu ích

```powershell
railway status                  # info project
railway logs                    # logs realtime
railway logs --deployment       # logs build
railway variables               # liệt kê env vars
railway run <cmd>               # chạy lệnh local với env Railway
railway open                    # mở dashboard
railway down                    # gỡ deployment hiện tại
```

---

## 13. Cost estimate (tham khảo)

- Hobby plan: $5/mo credit, đủ cho 1 service + Postgres + Redis nhỏ chạy 24/7 nếu RAM < 512MB.
- Pro plan: $20/mo + usage, có backup tự động Postgres.

Worker BullMQ + provider call có thể tốn CPU khi xử lý job — monitor ở tab **Metrics**.
