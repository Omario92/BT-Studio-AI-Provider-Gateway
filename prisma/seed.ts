import { PrismaClient, AIProviderType, AIToolType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Start seeding...');

  // 1. Seed Provider Configs
  const comfyuiConfig = await prisma.providerConfig.upsert({
    where: { provider: AIProviderType.COMFYUI },
    update: {},
    create: {
      provider: AIProviderType.COMFYUI,
      name: 'ComfyUI Local / Cloudflared Gateway',
      baseUrl: 'https://comfyui.luonghuynh.org',
      isEnabled: true,
      config: {},
    },
  });

  const mockConfig = await prisma.providerConfig.upsert({
    where: { provider: AIProviderType.MOCK },
    update: {},
    create: {
      provider: AIProviderType.MOCK,
      name: 'Mock Testing Provider',
      baseUrl: 'http://mock-ai-provider.local',
      isEnabled: true,
      config: {},
    },
  });

  console.log(`Seeded provider configs: ${comfyuiConfig.provider}, ${mockConfig.provider}`);

  // 2. Resolve Upscale Workflow JSON
  let comfyWorkflowJson: any = {
    "9": {
      "inputs": {
        "filename_prefix": "bt_upscale",
        "images": ["8", 0]
      },
      "class_type": "SaveImage"
    },
    "12": {
      "inputs": {
        "image": "placeholder.png"
      },
      "class_type": "LoadImage"
    }
  };

  const defaultWorkflowPath = path.resolve(
    __dirname,
    '../../backend/ComfyUI_workflows/IMAGE/UPSCALE_ZIMAGE_PID_API.json'
  );

  try {
    if (fs.existsSync(defaultWorkflowPath)) {
      const raw = fs.readFileSync(defaultWorkflowPath, 'utf8');
      comfyWorkflowJson = JSON.parse(raw);
      console.log('✅ Loaded upscale workflow JSON from workspace files');
    } else {
      console.log('⚠️ Upscale workflow JSON not found at workspace files. Using minimal fallback.');
    }
  } catch (err: any) {
    console.error('❌ Failed to load upscale workflow JSON:', err.message);
  }

  // 3. Seed AIWorkflow
  const upscaleSlug = 'comfyui_image_upscale_default';
  
  let workflow = await prisma.aIWorkflow.findUnique({
    where: { slug: upscaleSlug },
  });

  if (!workflow) {
    workflow = await prisma.aIWorkflow.create({
      data: {
        slug: upscaleSlug,
        name: 'ComfyUI Image Upscale Default Workflow',
        provider: AIProviderType.COMFYUI,
        toolType: AIToolType.IMAGE_UPSCALE,
        description: 'Standard ComfyUI image upscaler using workflow node mapping',
      },
    });
  }

  // 4. Seed AIWorkflowVersion
  const bindings = {
    sourceImage: { nodeId: '236', path: 'image' },
    filenamePrefix: { nodeId: '252', path: 'filename_prefix' },
    scale: { nodeId: '237', path: 'value' },
    denoise: { nodeId: '266', path: 'value' }
  };

  const versionNum = 1;
  const workflowVersion = await prisma.aIWorkflowVersion.upsert({
    where: {
      workflowId_version: {
        workflowId: workflow.id,
        version: versionNum,
      },
    },
    update: {
      config: comfyWorkflowJson,
      bindings,
      isActive: true,
    },
    create: {
      workflowId: workflow.id,
      version: versionNum,
      config: comfyWorkflowJson,
      bindings,
      isActive: true,
      notes: 'Initial seeded version',
    },
  });

  // Activate version in workflow
  await prisma.aIWorkflow.update({
    where: { id: workflow.id },
    data: { activeVersionId: workflowVersion.id },
  });

  console.log(`✅ Seeded workflow '${workflow.slug}' with active version ${workflowVersion.version}`);
  console.log('🌱 Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
