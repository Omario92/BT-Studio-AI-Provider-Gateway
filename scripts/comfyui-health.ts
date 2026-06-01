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

async function checkHealth() {
  const cleanUrl = COMFYUI_BASE_URL.replace(/\/$/, '');
  console.log(`🔌 Verifying ComfyUI connectivity on: ${cleanUrl}`);

  try {
    const start = Date.now();
    const headers = comfyuiAuthHeaders();

    console.log('Sending GET /system_stats request...');
    const statsRes = await axios.get(`${cleanUrl}/system_stats`, { headers, timeout: 10000 });
    
    console.log('✅ /system_stats response OK! Latency:', `${Date.now() - start}ms`);
    console.log('System Status Stats:', JSON.stringify(statsRes.data, null, 2));

    console.log('Sending GET /object_info request...');
    const infoRes = await axios.get(`${cleanUrl}/object_info`, { headers, timeout: 10000 });
    const keysCount = Object.keys(infoRes.data || {}).length;
    console.log(`✅ /object_info response OK! Found ${keysCount} loaded workflow node definitions.`);

    console.log('\n🌟 ComfyUI connection verified successfully! Reachable = TRUE.');
  } catch (err: any) {
    console.error('❌ ComfyUI reachability check failed!');
    console.error('Error Details:', err.response?.data || err.message);
    process.exit(1);
  }
}

checkHealth();
