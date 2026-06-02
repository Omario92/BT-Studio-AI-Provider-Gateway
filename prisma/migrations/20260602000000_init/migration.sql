-- CreateEnum
CREATE TYPE "AIProviderType" AS ENUM ('COMFYUI', 'RUNPOD', 'OPENAI_IMAGE', 'GEMINI_IMAGE', 'MOCK');

-- CreateEnum
CREATE TYPE "AIToolType" AS ENUM ('IMAGE_GENERATION', 'IMAGE_UPSCALE', 'IMAGE_EDIT', 'IMAGE_VARIATION', 'REMOVE_BACKGROUND', 'RELIGHT', 'VIDEO_GENERATION', 'VIDEO_UPSCALE', 'AUDIO_GENERATION', 'TRANSCRIBE');

-- CreateEnum
CREATE TYPE "GatewayJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- CreateTable
CREATE TABLE "ProviderConfig" (
    "id" TEXT NOT NULL,
    "provider" "AIProviderType" NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIWorkflow" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "AIProviderType" NOT NULL,
    "toolType" "AIToolType" NOT NULL,
    "activeVersionId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIWorkflowVersion" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "bindings" JSONB,
    "inputSchema" JSONB,
    "outputSchema" JSONB,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIWorkflowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayJob" (
    "id" TEXT NOT NULL,
    "externalJobId" TEXT,
    "provider" "AIProviderType" NOT NULL,
    "toolType" "AIToolType" NOT NULL,
    "workflowSlug" TEXT,
    "workflowVersion" INTEGER,
    "status" "GatewayJobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" JSONB,
    "providerJobId" TEXT,
    "callbackUrl" TEXT,
    "callbackSecretHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GatewayJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayJobLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatewayJobLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfig_provider_key" ON "ProviderConfig"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "AIWorkflow_slug_key" ON "AIWorkflow"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AIWorkflowVersion_workflowId_version_key" ON "AIWorkflowVersion"("workflowId", "version");

-- AddForeignKey
ALTER TABLE "AIWorkflowVersion" ADD CONSTRAINT "AIWorkflowVersion_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "AIWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
