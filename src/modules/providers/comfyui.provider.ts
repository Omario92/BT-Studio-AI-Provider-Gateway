import axios from 'axios';
import { env } from '../../config/env';
import { AIProvider, ProviderHealth, ProviderRunInput, ProviderRunResult } from './provider.types';
import logger from '../../lib/logger';
import { AIProviderType } from '@prisma/client';

export function normalizeComfyUIBaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.replace(/\/$/, '');
  if (url.includes('#')) {
    url = url.split('#')[0];
  }
  return url.replace(/\/$/, '');
}

export function comfyuiAuthHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (env.COMFYUI_AUTH_HEADER) {
    const [k, ...rest] = env.COMFYUI_AUTH_HEADER.split(':');
    if (k && rest.length) h[k.trim()] = rest.join(':').trim();
  }
  if (env.COMFYUI_AUTH_HEADER_2) {
    const [k, ...rest] = env.COMFYUI_AUTH_HEADER_2.split(':');
    if (k && rest.length) h[k.trim()] = rest.join(':').trim();
  }
  return h;
}

function extensionFromContentType(ct: string): { ext: string; mime: string } {
  const v = (ct || '').toLowerCase().split(';')[0].trim();
  if (v === 'image/png') return { ext: 'png', mime: 'image/png' };
  if (v === 'image/jpeg' || v === 'image/jpg') return { ext: 'jpg', mime: 'image/jpeg' };
  if (v === 'image/webp') return { ext: 'webp', mime: 'image/webp' };
  if (v === 'image/gif') return { ext: 'gif', mime: 'image/gif' };
  return { ext: 'png', mime: 'image/png' };
}

export async function downloadImageAsBuffer(url: string): Promise<{
  buffer: Buffer; mimeType: string; extension: string;
}> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: env.COMFYUI_TIMEOUT_MS,
    maxContentLength: 200 * 1024 * 1024,
    maxBodyLength: 200 * 1024 * 1024,
  });
  const ct = (res.headers['content-type'] || res.headers['Content-Type'] || 'image/png') as string;
  const { ext, mime } = extensionFromContentType(ct);
  return { buffer: Buffer.from(res.data as ArrayBuffer), mimeType: mime, extension: ext };
}

export async function uploadImageToComfyUI(
  baseUrl: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const G = globalThis as any;
  const blob = new G.Blob([buffer], { type: mimeType });
  const form = new G.FormData();
  form.append('image', blob, filename);
  form.append('overwrite', 'true');

  const headers = comfyuiAuthHeaders();
  const normalizedUrl = normalizeComfyUIBaseUrl(baseUrl);

  const res = await axios.post(
    `${normalizedUrl}/upload/image`,
    form,
    { headers, timeout: env.COMFYUI_TIMEOUT_MS },
  );
  const data = res.data ?? {};
  const uploaded = data.name || data.filename;
  if (!uploaded) {
    throw new Error(`ComfyUI /upload/image returned no filename: ${JSON.stringify(data)}`);
  }
  return uploaded as string;
}

export function injectLoadImage(
  workflow: any,
  uploadedFilename: string,
  bindings?: any
): any {
  // Try mapping via custom bindings first
  const boundNodeId = bindings?.sourceImage?.nodeId;
  const boundPath = bindings?.sourceImage?.path || 'image';
  if (boundNodeId && workflow[boundNodeId]?.inputs) {
    workflow[boundNodeId].inputs[boundPath] = uploadedFilename;
    return workflow;
  }

  // Fallback to auto-detection
  for (const nodeId of Object.keys(workflow)) {
    const node = workflow[nodeId];
    if (node?.class_type === 'LoadImage' && node?.inputs && 'image' in node.inputs) {
      node.inputs.image = uploadedFilename;
      return workflow;
    }
  }
  throw new Error('No LoadImage node found in ComfyUI upscale workflow config.');
}

export function injectSaveImagePrefix(
  workflow: any, 
  gatewayJobId: string,
  bindings?: any
): any {
  const prefix = `bt_upscale_${gatewayJobId}`;
  
  // Try mapping via custom bindings first
  const boundNodeId = bindings?.filenamePrefix?.nodeId;
  const boundPath = bindings?.filenamePrefix?.path || 'filename_prefix';
  if (boundNodeId && workflow[boundNodeId]?.inputs) {
    workflow[boundNodeId].inputs[boundPath] = prefix;
    return workflow;
  }

  // Fallback to auto-detection
  for (const nodeId of Object.keys(workflow)) {
    const node = workflow[nodeId];
    if (node?.class_type === 'SaveImage' && node?.inputs) {
      node.inputs.filename_prefix = prefix;
    }
  }
  return workflow;
}

export function setNumericInput(
  workflow: any,
  nodeId: string,
  value: number,
  preferredKeys: string[]
): void {
  const node = workflow[nodeId];
  if (!node) {
    logger.warn({ nodeId }, 'setNumericInput: Node not found in workflow');
    return;
  }
  if (!node.inputs) {
    node.inputs = {};
  }
  
  for (const key of preferredKeys) {
    if (key in node.inputs) {
      node.inputs[key] = value;
      return;
    }
  }

  const firstKey = preferredKeys[0] || 'value';
  node.inputs[firstKey] = value;
}

function injectUpscaleParams(workflow: any, inputs: Record<string, any>, bindings?: any): any {
  const scale = typeof inputs.scale === 'number' ? inputs.scale : undefined;
  
  let normalizedDenoise: number | undefined;
  if (typeof inputs.denoise === 'number') {
    let d = inputs.denoise;
    if (d > 1) {
      d = d / 100;
    }
    normalizedDenoise = Math.max(0, Math.min(1, d));
  }

  // 1. Inject Scale via bindings or defaults
  if (scale !== undefined) {
    const boundNodeId = bindings?.scale?.nodeId || '237';
    const boundPath = bindings?.scale?.path || 'value';
    const targetSizeValue = scale * 1024;

    logger.info({ boundNodeId, targetSizeValue }, 'Injecting scale Target Size');
    setNumericInput(
      workflow,
      boundNodeId,
      targetSizeValue,
      [boundPath, 'value', 'number', 'size', 'target_size', 'width', 'height', 'int']
    );
  }

  // 2. Inject Denoise via bindings or defaults
  if (normalizedDenoise !== undefined) {
    const boundNodeId = bindings?.denoise?.nodeId || '266';
    const boundPath = bindings?.denoise?.path || 'value';

    logger.info({ boundNodeId, normalizedDenoise }, 'Injecting denoise');
    setNumericInput(
      workflow,
      boundNodeId,
      normalizedDenoise,
      [boundPath, 'value', 'denoise', 'float', 'number']
    );
  }

  // Generic fallback loops to catch residual nodes
  for (const nodeId of Object.keys(workflow)) {
    const node = workflow[nodeId];
    if (!node || !node.inputs || !node.class_type) continue;
    const cls = String(node.class_type);
    if (/Upscale/i.test(cls)) {
      if (scale !== undefined && typeof node.inputs.scale_by === 'number') node.inputs.scale_by = scale;
    }
    if (cls === 'KSampler' && normalizedDenoise !== undefined && typeof node.inputs.denoise === 'number') {
      node.inputs.denoise = normalizedDenoise;
    }
  }
  return workflow;
}

export class ComfyUIProvider implements AIProvider {
  name = AIProviderType.COMFYUI;
  private baseUrl: string;

  constructor() {
    this.baseUrl = normalizeComfyUIBaseUrl(env.COMFYUI_BASE_URL);
  }

  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  private authHeaders(): Record<string, string> {
    return comfyuiAuthHeaders();
  }

  async health(): Promise<ProviderHealth> {
    if (!this.isConfigured()) {
      return { provider: this.name, configured: false, reachable: false, error: 'COMFYUI_BASE_URL is not set' };
    }

    const start = Date.now();
    try {
      // Check /system_stats
      await axios.get(`${this.baseUrl}/system_stats`, {
        headers: this.authHeaders(),
        timeout: 5000,
      });

      return {
        provider: this.name,
        configured: true,
        reachable: true,
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        provider: this.name,
        configured: true,
        reachable: false,
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  async run(input: ProviderRunInput): Promise<ProviderRunResult> {
    if (!this.isConfigured()) {
      throw new Error('ComfyUI Provider is not configured (missing COMFYUI_BASE_URL)');
    }

    const workflowConfig = input.workflow?.config;
    if (!workflowConfig || typeof workflowConfig !== 'object') {
      throw new Error('ComfyUI requires a valid workflow configuration object');
    }

    // Deep clone workflow config so we do not mutate state
    const workflow = JSON.parse(JSON.stringify(workflowConfig));
    const bindings = input.workflow?.bindings;

    logger.info({ jobId: input.gatewayJobId }, 'ComfyUI run started');

    try {
      // 1. Resolve Source Image
      const sourceUrl =
        input.inputs.sourceFileUrl ||
        input.inputs.sourceImageUrl ||
        input.inputs.imageUrl ||
        input.inputs.fileUrl;

      if (!sourceUrl) {
        throw new Error('ComfyUI run requires sourceFileUrl, sourceImageUrl, or imageUrl');
      }

      logger.info({ jobId: input.gatewayJobId, sourceUrl }, 'Downloading source image');
      const { buffer, mimeType, extension } = await downloadImageAsBuffer(sourceUrl);
      
      const localName = `src_${input.gatewayJobId}.${extension}`;
      logger.info({ jobId: input.gatewayJobId, localName }, 'Uploading source image to ComfyUI');
      const uploadedName = await uploadImageToComfyUI(this.baseUrl, buffer, localName, mimeType);

      // 2. Inject inputs
      injectLoadImage(workflow, uploadedName, bindings);
      injectSaveImagePrefix(workflow, input.gatewayJobId, bindings);
      injectUpscaleParams(workflow, input.inputs, bindings);

      logger.info({ jobId: input.gatewayJobId, uploadedName }, 'Submitting prompt to ComfyUI');
      const res = await axios.post(
        `${this.baseUrl}/prompt`,
        { prompt: workflow, client_id: `gateway_${input.gatewayJobId}` },
        {
          headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
          timeout: env.COMFYUI_TIMEOUT_MS,
        }
      );

      const promptId = res.data?.prompt_id;
      if (!promptId) {
        throw new Error(`ComfyUI /prompt returned no prompt_id: ${JSON.stringify(res.data)}`);
      }

      logger.info({ jobId: input.gatewayJobId, promptId }, 'ComfyUI prompt submitted successfully');

      return {
        status: 'PENDING',
        providerJobId: promptId,
      };
    } catch (err: any) {
      logger.error({ jobId: input.gatewayJobId, err: err.message }, 'ComfyUI invocation failed');
      return {
        status: 'FAILED',
        error: {
          message: err.response?.data?.error?.message || err.response?.data?.error || err.message || 'ComfyUI submission failed',
          providerRaw: err.response?.data || err.message,
        },
      };
    }
  }

  async poll(providerJobId: string, _input?: ProviderRunInput): Promise<ProviderRunResult> {
    try {
      const res = await axios.get(
        `${this.baseUrl}/history/${providerJobId}`,
        { headers: this.authHeaders(), timeout: 10000 }
      );

      const history = res.data?.[providerJobId];
      if (!history) {
        return { status: 'PENDING', providerJobId };
      }

      const outputs = history.outputs || {};
      let filename = '';
      let subfolder = '';
      let foundType = '';

      for (const nodeId of Object.keys(outputs)) {
        const nodeOutput = outputs[nodeId];
        if (!nodeOutput?.images || nodeOutput.images.length === 0) continue;
        const preferred = nodeOutput.images.find((img: any) => (img.type || '').toLowerCase() === 'output');
        const img = preferred || nodeOutput.images[0];
        filename = img.filename;
        subfolder = img.subfolder || '';
        foundType = img.type || 'output';
        if (preferred) break;
      }

      if (!filename) {
        return {
          status: 'FAILED',
          error: {
            message: 'ComfyUI job completed but no output image filename was found in history',
            providerRaw: history,
          },
        };
      }

      const fileUrl = `${this.baseUrl}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(foundType || 'output')}`;
      
      logger.info({ providerJobId, fileUrl }, 'ComfyUI output file found');

      return {
        status: 'COMPLETED',
        progress: 100,
        outputs: [
          {
            type: 'image',
            url: fileUrl,
            mimeType: extensionFromContentType(filename.split('.').pop() || '').mime,
            fileName: filename,
          },
        ],
      };
    } catch (err: any) {
      logger.warn({ providerJobId, err: err.message }, 'ComfyUI poll error (will retry)');
      return {
        status: 'PENDING',
        providerJobId,
      };
    }
  }
}
