# System Architecture: AI Provider Gateway

This document outlines the high-level system architecture and execution pipelines for the isolated `BT-Studio-AI-Provider-Gateway` service.

## Core Objective
Decouple AI provider configuration, API JSON workflow bindings, retry logic, active polling threads, and gateway credentials from the main BT Studio product backend and PostgreSQL database.

## System Topology Diagram

```mermaid
graph TD
    %% Clients
    FE[BT Studio Frontend]
    
    %% Workspace Backend Services
    subgraph Workspace Product Cloud
        BE[BT Product Backend]
        DB[(Product PostgreSQL)]
        R2[(Cloudflare R2 Storage)]
    end
    
    %% AI Provider Gateway Services
    subgraph AI Gateway Cloud
        GW[AI Provider Gateway API]
        GW_DB[(Gateway PostgreSQL)]
        Redis[(BullMQ Redis Task Queue)]
        Worker[BullMQ Worker Thread]
    end
    
    %% AI Provider Adapters
    subgraph AI Providers
        ComfyUI[ComfyUI Cloudflared]
        RunPod[RunPod serverless]
        OpenAI[OpenAI DALL-E]
        Gemini[Gemini Imagen]
    end

    %% Interactions
    FE -->|GraphQL / REST| BE
    BE -->|REST POST /jobs| GW
    GW -->|Prisma Read/Write| GW_DB
    GW -->|Enqueue task| Redis
    Redis -->|Dequeue task| Worker
    Worker -->|Invoke Run| ComfyUI
    Worker -->|Invoke Run| RunPod
    Worker -->|Invoke Run| OpenAI
    Worker -->|Invoke Run| Gemini
    Worker -->|Callback POST + HMAC Signature| BE
    BE -->|Copy temp output| R2
    BE -->|Create AssetVersion| DB
```

## Data Lifecycle Isolation

### Product Backend
Owns core application tables:
- `User`
- `Project`
- `Folder`
- `Asset`
- `AssetVersion`
- `Comment`
- `ActivityLog`
- Final asset storage credentials (Cloudflare R2)

### AI Provider Gateway
Owns AI execution tables:
- `ProviderConfig`
- `AIWorkflow` (slug, activeVersionId)
- `AIWorkflowVersion` (ComfyUI API JSON configs)
- `GatewayJob` (temporary enqueued status, inputs, progress)
- `GatewayJobLog` (real-time diagnostics)

The gateway **never** queries the Product Backend database, nor does it write files directly to Cloudflare R2. Instead, it uploads images temporarily to the AI Provider, performs processing, returns a signed JSON callback with a temporary output URL, and relies on the Product Backend to fetch and copy the final output asset to its permanent R2 bucket.
