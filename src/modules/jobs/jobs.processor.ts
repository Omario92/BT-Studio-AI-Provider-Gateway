import { Worker, Job } from 'bullmq';
import { redisConnection } from './jobs.queue';
import { prisma } from '../../lib/db';
import { logger } from '../../lib/logger';
import { ProviderFactory } from '../providers/provider.factory';
import { CallbacksService } from '../callbacks/callbacks.service';
import { GatewayJobStatus, GatewayJob } from '@prisma/client';
import { env } from '../../config/env';
import axios from 'axios';

function getDirectDownloadUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.includes('drive.google.com')) {
    const match = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
  }
  return trimmed;
}

/**
 * Log message helper to store DB logs for Gateway Jobs
 */
async function addJobLog(jobId: string, level: 'info' | 'warn' | 'error', message: string, data?: any) {
  logger.info({ jobId, message, data }, `[Job Log] ${message}`);
  try {
    await prisma.gatewayJobLog.create({
      data: {
        jobId,
        level,
        message,
        data: data ? JSON.parse(JSON.stringify(data)) : undefined,
      },
    });
  } catch (err: any) {
    logger.error({ jobId, err: err.message }, 'Failed to write GatewayJobLog');
  }
}

export const jobsWorker = new Worker(
  'ai-gateway-jobs',
  async (job: Job) => {
    const { gatewayJobId } = job.data;
    await addJobLog(gatewayJobId, 'info', 'Worker picked up job from queue');

    // 1. Load GatewayJob
    const gatewayJob = await prisma.gatewayJob.findUnique({
      where: { id: gatewayJobId },
    });

    if (!gatewayJob) {
      logger.error({ gatewayJobId }, 'Job not found in database');
      return;
    }

    try {
      // 2. Set to RUNNING
      await prisma.gatewayJob.update({
        where: { id: gatewayJobId },
        data: { status: GatewayJobStatus.RUNNING, progress: 10 },
      });
      await addJobLog(gatewayJobId, 'info', 'Job status updated to RUNNING');

      // 3. Resolve active workflow config
      let workflowConfig: any = undefined;
      let bindings: any = undefined;

      if (gatewayJob.workflowSlug) {
        await addJobLog(gatewayJobId, 'info', `Loading workflow config for: ${gatewayJob.workflowSlug}`);

        // Dynamic workflow URL check (Google Drive / public URL)
        if (gatewayJob.workflowSlug === 'comfyui_image_upscale_default' && env.COMFYUI_UPSCALE_WORKFLOW_URL) {
          try {
            const dlUrl = getDirectDownloadUrl(env.COMFYUI_UPSCALE_WORKFLOW_URL);
            await addJobLog(gatewayJobId, 'info', `Downloading dynamic upscale workflow from URL: ${dlUrl}`);
            const workflowRes = await axios.get(dlUrl, { timeout: 10000 });
            workflowConfig = workflowRes.data;
            bindings = {
              sourceImage: { nodeId: '236', path: 'image' },
              filenamePrefix: { nodeId: '252', path: 'filename_prefix' },
              scale: { nodeId: '237', path: 'value' },
              denoise: { nodeId: '266', path: 'value' }
            };
            await addJobLog(gatewayJobId, 'info', 'Successfully resolved workflow config dynamically from URL');
          } catch (urlErr: any) {
            await addJobLog(gatewayJobId, 'warn', `Failed to download dynamic workflow: ${urlErr.message}. Falling back to db lookup.`);
          }
        }

        if (!workflowConfig) {
          const workflow = await prisma.aIWorkflow.findUnique({
            where: { slug: gatewayJob.workflowSlug },
          });

          if (!workflow) {
            throw new Error(`AIWorkflow slug '${gatewayJob.workflowSlug}' not found`);
          }

          let versionId = workflow.activeVersionId;
          if (gatewayJob.workflowVersion && gatewayJob.workflowVersion !== 0) {
            const specific = await prisma.aIWorkflowVersion.findUnique({
              where: {
                workflowId_version: {
                  workflowId: workflow.id,
                  version: gatewayJob.workflowVersion,
                },
              },
            });
            if (specific) {
              versionId = specific.id;
            }
          }

          if (!versionId) {
            throw new Error(`No active or specific version found for workflow '${gatewayJob.workflowSlug}'`);
          }

          const version = await prisma.aIWorkflowVersion.findUnique({
            where: { id: versionId },
          });

          if (!version) {
            throw new Error(`AIWorkflowVersion not found for ID: ${versionId}`);
          }

          workflowConfig = version.config;
          bindings = version.bindings;
        }
      }

      // 4. Resolve provider
      const provider = ProviderFactory.getProvider(gatewayJob.provider);
      await addJobLog(gatewayJobId, 'info', `Initialized provider instance: ${provider.name}`);

      const providerRunInput = {
        gatewayJobId,
        externalJobId: gatewayJob.externalJobId || undefined,
        toolType: gatewayJob.toolType,
        workflow: workflowConfig
          ? {
              slug: gatewayJob.workflowSlug || undefined,
              version: gatewayJob.workflowVersion || undefined,
              config: workflowConfig,
              bindings,
            }
          : undefined,
        inputs: (gatewayJob.input as any).inputs || {},
      };

      // 5. Run Provider
      await addJobLog(gatewayJobId, 'info', 'Invoking provider run method');
      const runResult = await provider.run(providerRunInput);

      if (runResult.status === 'COMPLETED') {
        await handleJobCompleted(gatewayJob, runResult.outputs || []);
      } else if (runResult.status === 'FAILED') {
        throw new Error(runResult.error?.message || 'Provider execution failed');
      } else if (runResult.status === 'PENDING') {
        const providerJobId = runResult.providerJobId!;
        await prisma.gatewayJob.update({
          where: { id: gatewayJobId },
          data: { providerJobId, progress: 30 },
        });
        await addJobLog(gatewayJobId, 'info', `Provider enqueued job asynchronously. ID: ${providerJobId}`);

        if (!provider.poll) {
          throw new Error(`Provider ${gatewayJob.provider} enqueued async task but does not implement poll`);
        }

        // 6. Polling loop
        await addJobLog(gatewayJobId, 'info', 'Entering active status polling cycle');
        let isDone = false;
        const startTime = Date.now();
        const timeoutMs = env.COMFYUI_TIMEOUT_MS;

        while (!isDone) {
          if (Date.now() - startTime > timeoutMs) {
            throw new Error(`Job execution timed out after ${timeoutMs}ms`);
          }

          // Wait 3 seconds
          await new Promise((resolve) => setTimeout(resolve, 3000));

          logger.debug({ gatewayJobId, providerJobId }, 'Polling provider status...');
          const pollResult = await provider.poll(providerJobId, providerRunInput);

          if (pollResult.status === 'COMPLETED') {
            await handleJobCompleted(gatewayJob, pollResult.outputs || []);
            isDone = true;
          } else if (pollResult.status === 'FAILED') {
            throw new Error(pollResult.error?.message || 'Provider polling reported job failure');
          } else {
            // Log progress update if any
            if (pollResult.progress) {
              await prisma.gatewayJob.update({
                where: { id: gatewayJobId },
                data: { progress: Math.min(95, 30 + Math.round(pollResult.progress * 0.6)) },
              });
            }
          }
        }
      }
    } catch (err: any) {
      await handleJobFailed(gatewayJob, err);
    }
  },
  {
    connection: redisConnection as any,
    concurrency: 5,
  }
);

jobsWorker.on('completed', (job) => {
  logger.info({ jobId: job.data.gatewayJobId }, 'Background job worker completed processing');
});

jobsWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.data?.gatewayJobId, err: err.message }, 'Background job worker failed');
});

/**
 * Handle job completion lifecycle
 */
async function handleJobCompleted(job: GatewayJob, outputs: any[]) {
  await prisma.gatewayJob.update({
    where: { id: job.id },
    data: {
      status: GatewayJobStatus.COMPLETED,
      progress: 100,
      output: outputs,
      completedAt: new Date(),
    },
  });

  await addJobLog(job.id, 'info', 'Job completed successfully', { outputs });

  // Fire callback
  const input = job.input as any;
  if (input.callback?.url && input.callback?.secret) {
    await CallbacksService.sendCallback(input.callback.url, input.callback.secret, {
      externalJobId: job.externalJobId,
      gatewayJobId: job.id,
      status: GatewayJobStatus.COMPLETED,
      provider: job.provider,
      toolType: job.toolType,
      outputs,
    });
  }
}

/**
 * Handle job failure lifecycle
 */
async function handleJobFailed(job: GatewayJob, err: any) {
  const errMsg = err.message || 'Unknown gateway execution failure';
  const errorObj = { message: errMsg, stack: err.stack };

  await prisma.gatewayJob.update({
    where: { id: job.id },
    data: {
      status: GatewayJobStatus.FAILED,
      error: errorObj,
      completedAt: new Date(),
    },
  });

  await addJobLog(job.id, 'error', `Job execution failed: ${errMsg}`, errorObj);

  // Fire callback
  const input = job.input as any;
  if (input.callback?.url && input.callback?.secret) {
    await CallbacksService.sendCallback(input.callback.url, input.callback.secret, {
      externalJobId: job.externalJobId,
      gatewayJobId: job.id,
      status: GatewayJobStatus.FAILED,
      provider: job.provider,
      toolType: job.toolType,
      error: errorObj,
    });
  }
}
