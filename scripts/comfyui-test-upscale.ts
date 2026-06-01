import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL || 'https://comfyui.luonghuynh.org';
const COMFYUI_AUTH_HEADER = process.env.COMFYUI_AUTH_HEADER || '';
const COMFYUI_AUTH_HEADER_2 = process.env.COMFYUI_AUTH_HEADER_2 || '';

function comfyuiAuthHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (COMFYUI_AUTH_HEADER) {
    const [k, ...rest] = COMFYUI_AUTH_HEADER.split(':');
    if (k && rest.length) h[k.trim()] = rest.join(':').trim();
  }
  if (COMFYUI_AUTH_HEADER_2) {
    const [k, ...rest] = COMFYUI_AUTH_HEADER_2.split(':');
    if (k && rest.length) h[k.trim()] = rest.join(':').trim();
  }
  return h;
}

async function runUpscaleTest() {
  const cleanUrl = COMFYUI_BASE_URL.replace(/\/$/, '');
  console.log(`🚀 Starting manual ComfyUI Upscale smoke test on: ${cleanUrl}`);

  try {
    // 1. Download a mock source image
    const sourceUrl = 'https://picsum.photos/512/512';
    console.log(`Downloading source image from: ${sourceUrl}`);
    const imgRes = await axios.get<ArrayBuffer>(sourceUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(imgRes.data);

    // 2. Upload image to ComfyUI
    const localName = `smoke_test_${Date.now()}.png`;
    console.log(`Uploading buffer as ${localName} to ComfyUI...`);
    
    const G = globalThis as any;
    const blob = new G.Blob([buffer], { type: 'image/png' });
    const form = new G.FormData();
    form.append('image', blob, localName);
    form.append('overwrite', 'true');

    const uploadRes = await axios.post(`${cleanUrl}/upload/image`, form, {
      headers: comfyuiAuthHeaders(),
    });
    
    const uploadedFilename = uploadRes.data?.name || uploadRes.data?.filename;
    console.log(`✅ Upload complete. Server filename: ${uploadedFilename}`);

    // 3. Define fallback upscale workflow prompt (node map API)
    const workflow = {
      "3": {
        "inputs": {
          "seed": 456789,
          "steps": 10,
          "cfg": 7,
          "sampler_name": "euler",
          "scheduler": "normal",
          "denoise": 0.35,
          "model": ["4", 0],
          "positive": ["6", 0],
          "negative": ["7", 0],
          "latent_image": ["5", 0]
        },
        "class_type": "KSampler"
      },
      "4": {
        "inputs": {
          "ckpt_name": "v1-5-pruned-emaonly.ckpt"
        },
        "class_type": "CheckpointLoaderSimple"
      },
      "5": {
        "inputs": {
          "width": 768,
          "height": 768,
          "batch_size": 1
        },
        "class_type": "EmptyLatentImage"
      },
      "6": {
        "inputs": {
          "text": "photorealistic high detailed output upscale image",
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "7": {
        "inputs": {
          "text": "low quality, blurry, deformed",
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "8": {
        "inputs": {
          "samples": ["3", 0],
          "vae": ["4", 2]
        },
        "class_type": "VAEDecode"
      },
      "9": {
        "inputs": {
          "filename_prefix": `bt_smoke_${Date.now()}`,
          "images": ["8", 0]
        },
        "class_type": "SaveImage"
      }
    };

    // 4. Submit prompt
    console.log('Submitting upscale prompt flow to ComfyUI /prompt...');
    const promptRes = await axios.post(
      `${cleanUrl}/prompt`,
      { prompt: workflow, client_id: `smoke_test_client` },
      { headers: { 'Content-Type': 'application/json', ...comfyuiAuthHeaders() } }
    );

    const promptId = promptRes.data?.prompt_id;
    console.log(`✅ Prompt enqueued. prompt_id: ${promptId}`);

    // 5. Active Polling history
    console.log('Polling history to check execution status...');
    let complete = false;
    let attempts = 0;

    while (!complete && attempts < 20) {
      attempts++;
      await new Promise((r) => setTimeout(r, 4000));
      
      const historyRes = await axios.get(`${cleanUrl}/history/${promptId}`, {
        headers: comfyuiAuthHeaders(),
      });

      const history = historyRes.data?.[promptId];
      if (history) {
        complete = true;
        console.log('🎉 Execution completed on ComfyUI side!');
        
        const outputs = history.outputs || {};
        let outName = '';
        for (const k of Object.keys(outputs)) {
          if (outputs[k]?.images?.[0]?.filename) {
            outName = outputs[k].images[0].filename;
            break;
          }
        }
        
        const outputUrl = `${cleanUrl}/view?filename=${encodeURIComponent(outName)}&type=output`;
        console.log(`\n🌟 Upscaled image result URL:\n${outputUrl}\n`);
      } else {
        console.log(`Attempt ${attempts}: Still executing / pending...`);
      }
    }

    if (!complete) {
      console.log('⚠️ Polling timed out. Check ComfyUI server logs.');
    }
  } catch (err: any) {
    console.error('❌ Upscale smoke test failed!');
    console.error('Error:', err.response?.data || err.message);
  }
}

runUpscaleTest();
