# AGENTS.md - Agent Instructions & Workspace Rules

Welcome! This file guides AI coding agents in maintaining a clean, high-performance, and secure codebase for the BT Studio AI Provider Gateway.

## Rules

1. **Keep Code Clean**: Follow clean code principles, keep components/modules focused, and avoid mixing concerns.
2. **Provider Isolation**: Ensure that providers (e.g., ComfyUI, RunPod, OpenAI, Gemini) remain isolated and separate. Use clean abstractions and interfaces.
3. **TypeScript Excellence**: Maintain strict type safety. Avoid using `any` unless absolutely necessary and justified.
4. **Security First**: Ensure HMAC signature verification is active and payloads are validated. Never commit `.env` or other sensitive configuration files.
5. **No Deploy/Kill RunPod Logs**: When updating recent changes, focus on code-level changes, refactoring, features, or bugs. Do not add deployment status or credentials.

## Commands

- **Local Development**: `npm run dev`
- **Build Project**: `npm run build`
- **Check Types**: `npm run type-check`
- **Database Migrations**: `npm run db:migrate`
- **Database Seed**: `npm run db:seed`
- **Smoke Tests**:
  - Check ComfyUI Health: `npm run smoke:comfyui-health`
  - ComfyUI Local Upscale: `npm run smoke:comfyui-upscale`
  - Gateway Job Pipeline: `npm run smoke:gateway-job`

## Recent Changes

- **2026-06-02**: Installed OpenSSL in the Alpine runner stage of the `Dockerfile` to prevent Prisma native engine failures during database migrations and server startup.
- **2026-06-01**: Initial repository audit, created `AGENTS.md` to define workspace guidelines, and prepared to push code.
