import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_KEY = process.env.AI_GATEWAY_API_KEY || 'studio-gateway-secret-key-2026';
const PORT = process.env.PORT || '8080';
const BASE_URL = `http://localhost:${PORT}`;

async function runGatewayJobTest() {
  console.log('🏁 Starting Gateway Job Integration Smoke Test...');
  console.log(`Connecting to local server: ${BASE_URL}`);

  const headers = {
    'x-ai-gateway-key': API_KEY,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Verify health
    console.log('Sending GET /health request...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health status:', health.data?.status);

    // 2. Fetch workflows
    console.log('Fetching active workflows...');
    const workflows = await axios.get(`${BASE_URL}/workflows`, { headers });
    console.log(`✅ Loaded ${workflows.data?.length} workflow definitions from database`);

    const targetSlug = 'comfyui_image_upscale_default';
    const upscaleWorkflow = workflows.data?.find((w: any) => w.slug === targetSlug);

    if (!upscaleWorkflow) {
      console.warn('⚠️ Default upscale workflow not seeded. Seed database first.');
    }

    // 3. Post a mock upscale GatewayJob
    console.log('Submitting new job to POST /jobs...');
    const jobPayload = {
      externalJobId: `test_product_job_${Date.now()}`,
      provider: 'MOCK', // Using MOCK provider for safety during local testing
      toolType: 'IMAGE_UPSCALE',
      workflowSlug: upscaleWorkflow ? targetSlug : undefined,
      inputs: {
        sourceFileUrl: 'https://picsum.photos/512/512',
        scale: 2,
        denoise: 40,
      },
      callback: {
        url: 'https://httpbin.org/post', // Mock callback endpoint that echoes payload
        secret: 'mock-signing-secret-key-2026',
      },
    };

    const jobRes = await axios.post(`${BASE_URL}/jobs`, jobPayload, { headers });
    const gatewayJobId = jobRes.data?.job?.id;
    console.log(`✅ Job created successfully! gatewayJobId: ${gatewayJobId}`);

    // 4. Poll status
    console.log('Polling job status...');
    let done = false;
    let attempts = 0;

    while (!done && attempts < 10) {
      attempts++;
      await new Promise((r) => setTimeout(r, 2000));

      const statusRes = await axios.get(`${BASE_URL}/jobs/${gatewayJobId}`, { headers });
      const status = statusRes.data?.status;
      const progress = statusRes.data?.progress;

      console.log(`Poll ${attempts}: Status = ${status}, Progress = ${progress}%`);

      if (status === 'COMPLETED') {
        done = true;
        console.log('🎉 Job COMPLETED successfully through gateway!');
        console.log('Outputs:', JSON.stringify(statusRes.data?.output, null, 2));
      } else if (status === 'FAILED') {
        done = true;
        console.error('❌ Job failed inside gateway!');
        console.error('Error Details:', statusRes.data?.error);
      }
    }

    if (!done) {
      console.log('⚠️ Polling timed out. Check fastify server logs.');
    }
  } catch (err: any) {
    console.error('❌ Gateway job integration test failed!');
    console.error('Error:', err.response?.data || err.message);
    console.error('Ensure that the server is running locally (npm run dev) before running this test.');
  }
}

runGatewayJobTest();
