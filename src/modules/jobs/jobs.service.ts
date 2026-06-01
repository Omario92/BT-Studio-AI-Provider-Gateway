import { prisma } from '../../lib/db';
import { addJobToQueue } from './jobs.queue';
import { AIProviderType, AIToolType, GatewayJobStatus, Prisma } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../lib/errors';

export class JobsService {
  static async createJob(data: {
    externalJobId?: string;
    provider: AIProviderType;
    toolType: AIToolType;
    workflowSlug?: string;
    workflowVersion?: string;
    inputs: Record<string, any>;
    callback?: {
      url: string;
      secret: string;
    };
  }) {
    // Validate toolType and provider
    if (!data.provider || !data.toolType) {
      throw new BadRequestError('Both provider and toolType are required fields');
    }

    // Determine workflow version
    let versionNum: number | undefined = undefined;
    if (data.workflowVersion && data.workflowVersion !== 'active') {
      versionNum = parseInt(data.workflowVersion, 10);
      if (isNaN(versionNum)) {
        throw new BadRequestError(`Invalid workflowVersion integer value: ${data.workflowVersion}`);
      }
    }

    // Create the GatewayJob DB record
    const job = await prisma.gatewayJob.create({
      data: {
        externalJobId: data.externalJobId || null,
        provider: data.provider,
        toolType: data.toolType,
        workflowSlug: data.workflowSlug || null,
        workflowVersion: versionNum,
        status: GatewayJobStatus.QUEUED,
        progress: 0,
        input: {
          inputs: data.inputs,
          callback: data.callback,
        },
      },
    });

    // Write initial log
    await prisma.gatewayJobLog.create({
      data: {
        jobId: job.id,
        level: 'info',
        message: `Job initialized in gateway database. External ID: ${data.externalJobId || 'none'}`,
      },
    });

    // Enqueue in BullMQ task queue
    await addJobToQueue(job.id);

    return job;
  }

  static async getJob(id: string) {
    const job = await prisma.gatewayJob.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundError(`Gateway Job not found for ID: ${id}`);
    }

    const logs = await prisma.gatewayJobLog.findMany({
      where: { jobId: id },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    return {
      ...job,
      logs: logs.map((l) => ({
        level: l.level,
        message: l.message,
        timestamp: l.createdAt,
        data: l.data,
      })),
    };
  }

  static async cancelJob(id: string) {
    const job = await prisma.gatewayJob.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundError(`Gateway Job not found for ID: ${id}`);
    }

    if (job.status === GatewayJobStatus.COMPLETED || job.status === GatewayJobStatus.FAILED) {
      throw new BadRequestError(`Cannot cancel a job that is already in terminal state: ${job.status}`);
    }

    const updated = await prisma.gatewayJob.update({
      where: { id },
      data: {
        status: GatewayJobStatus.CANCELLED,
        completedAt: new Date(),
      },
    });

    await prisma.gatewayJobLog.create({
      data: {
        jobId: id,
        level: 'warn',
        message: 'Job cancellation requested by client API',
      },
    });

    return updated;
  }

  static async retryJob(id: string) {
    const job = await prisma.gatewayJob.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundError(`Gateway Job not found for ID: ${id}`);
    }

    const updated = await prisma.gatewayJob.update({
      where: { id },
      data: {
        status: GatewayJobStatus.QUEUED,
        progress: 0,
        output: Prisma.DbNull,
        error: Prisma.DbNull,
        completedAt: null,
      },
    });

    await prisma.gatewayJobLog.create({
      data: {
        jobId: id,
        level: 'info',
        message: 'Job retry requested. Re-enqueuing task in queue.',
      },
    });

    await addJobToQueue(id);

    return updated;
  }
}
