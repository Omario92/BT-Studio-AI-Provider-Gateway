import { prisma } from '../../lib/db';
import { AIProviderType, AIToolType } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../lib/errors';

export class WorkflowsService {
  static async listWorkflows() {
    return prisma.aIWorkflow.findMany({
      include: {
        versions: {
          select: {
            id: true,
            version: true,
            isActive: true,
            notes: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  static async getWorkflowBySlug(slug: string) {
    const workflow = await prisma.aIWorkflow.findUnique({
      where: { slug },
      include: {
        versions: {
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundError(`Workflow not found with slug: ${slug}`);
    }

    return workflow;
  }

  static async getActiveWorkflow(slug: string) {
    const workflow = await prisma.aIWorkflow.findUnique({
      where: { slug },
    });

    if (!workflow) {
      throw new NotFoundError(`Workflow not found with slug: ${slug}`);
    }

    if (!workflow.activeVersionId) {
      throw new NotFoundError(`Workflow ${slug} has no active version`);
    }

    const version = await prisma.aIWorkflowVersion.findUnique({
      where: { id: workflow.activeVersionId },
    });

    if (!version) {
      throw new NotFoundError(`Active version config not found for workflow ${slug}`);
    }

    return {
      workflow,
      version,
    };
  }

  static async createWorkflow(data: {
    slug: string;
    name: string;
    provider: AIProviderType;
    toolType: AIToolType;
    description?: string;
  }) {
    // Check if duplicate slug
    const existing = await prisma.aIWorkflow.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      throw new BadRequestError(`Workflow with slug ${data.slug} already exists`);
    }

    return prisma.aIWorkflow.create({
      data: {
        slug: data.slug,
        name: data.name,
        provider: data.provider,
        toolType: data.toolType,
        description: data.description,
      },
    });
  }

  static async addWorkflowVersion(
    slug: string,
    data: {
      config: any;
      bindings?: any;
      inputSchema?: any;
      outputSchema?: any;
      notes?: string;
      isActive?: boolean;
    }
  ) {
    const workflow = await prisma.aIWorkflow.findUnique({
      where: { slug },
      include: { versions: true },
    });

    if (!workflow) {
      throw new NotFoundError(`Workflow not found with slug: ${slug}`);
    }

    // Determine next version number
    const maxVersion = workflow.versions.reduce((max, v) => (v.version > max ? v.version : max), 0);
    const nextVersion = maxVersion + 1;

    // Validate ComfyUI API JSON format if ComfyUI
    if (workflow.provider === AIProviderType.COMFYUI) {
      if (typeof data.config !== 'object' || Array.isArray(data.config)) {
        throw new BadRequestError('ComfyUI workflow config must be a JSON object');
      }
    }

    const isActive = data.isActive ?? (workflow.versions.length === 0);

    const version = await prisma.$transaction(async (tx) => {
      // If setting this as active, deactivate other versions first
      if (isActive) {
        await tx.aIWorkflowVersion.updateMany({
          where: { workflowId: workflow.id },
          data: { isActive: false },
        });
      }

      const newVersion = await tx.aIWorkflowVersion.create({
        data: {
          workflowId: workflow.id,
          version: nextVersion,
          config: data.config,
          bindings: data.bindings || {},
          inputSchema: data.inputSchema || {},
          outputSchema: data.outputSchema || {},
          notes: data.notes,
          isActive,
        },
      });

      if (isActive) {
        await tx.aIWorkflow.update({
          where: { id: workflow.id },
          data: { activeVersionId: newVersion.id },
        });
      }

      return newVersion;
    });

    return version;
  }

  static async activateWorkflowVersion(slug: string, versionNumber: number) {
    const workflow = await prisma.aIWorkflow.findUnique({
      where: { slug },
    });

    if (!workflow) {
      throw new NotFoundError(`Workflow not found with slug: ${slug}`);
    }

    const version = await prisma.aIWorkflowVersion.findUnique({
      where: {
        workflowId_version: {
          workflowId: workflow.id,
          version: versionNumber,
        },
      },
    });

    if (!version) {
      throw new NotFoundError(`Workflow version ${versionNumber} not found for ${slug}`);
    }

    await prisma.$transaction([
      prisma.aIWorkflowVersion.updateMany({
        where: { workflowId: workflow.id },
        data: { isActive: false },
      }),
      prisma.aIWorkflowVersion.update({
        where: { id: version.id },
        data: { isActive: true },
      }),
      prisma.aIWorkflow.update({
        where: { id: workflow.id },
        data: { activeVersionId: version.id },
      }),
    ]);

    return {
      message: `Version ${versionNumber} activated successfully`,
      workflowSlug: slug,
      activeVersionId: version.id,
    };
  }
}
