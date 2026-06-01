# API Contract: BT-Studio-AI-Provider-Gateway

This document defines the REST API endpoints, authorization headers, payload schemas, and HMAC-SHA256 signature verification contract for callbacks.

## Authentication Headers

All API requests sent from the Product Backend to the AI Gateway must include the authentication token in the headers:

```http
x-ai-gateway-key: <AI_GATEWAY_API_KEY>
Content-Type: application/json
```

---

## 1. Workflows Registry APIs

### POST `/workflows`
Register a new workflow tool category.

**Request Payload:**
```json
{
  "slug": "comfyui_image_upscale_default",
  "name": "ComfyUI Image Upscale Default Workflow",
  "provider": "COMFYUI",
  "toolType": "IMAGE_UPSCALE",
  "description": "Standard ComfyUI image upscaler using workflow node mapping"
}
```

---

### POST `/workflows/:slug/versions`
Add a new ComfyUI API JSON workflow version configuration to a registered slug.

**Request Payload:**
```json
{
  "config": {
    "3": {
      "inputs": {
        "seed": 456789,
        "denoise": 0.35
      },
      "class_type": "KSampler"
    }
  },
  "bindings": {
    "sourceImage": { "nodeId": "236", "path": "image" },
    "scale": { "nodeId": "237", "path": "value" },
    "denoise": { "nodeId": "266", "path": "value" }
  },
  "notes": "Added denoise and scale bindings mappings",
  "isActive": true
}
```

---

### PATCH `/workflows/:slug/versions/:version/activate`
Mark a specific version as the active configuration for the workflow.

**Request Endpoint:**
`PATCH /workflows/comfyui_image_upscale_default/versions/1/activate`

---

## 2. Gateway Jobs APIs

### POST `/jobs`
Enqueue a new asynchronous job payload to the gateway queue.

**Request Payload:**
```json
{
  "externalJobId": "test_product_job_12345",
  "provider": "COMFYUI",
  "toolType": "IMAGE_UPSCALE",
  "workflowSlug": "comfyui_image_upscale_default",
  "workflowVersion": "active",
  "inputs": {
    "sourceFileUrl": "https://signed-r2-download-link.com/source.jpg",
    "scale": 2,
    "denoise": 40
  },
  "callback": {
    "url": "https://bt-studio-backend.com/api/ai/gateway-callback",
    "secret": "callback-signing-secret-key-2026"
  }
}
```

**Response (202 Accepted):**
```json
{
  "job": {
    "id": "gateway_job_uuid_1111",
    "externalJobId": "test_product_job_12345",
    "status": "QUEUED",
    "provider": "COMFYUI",
    "toolType": "IMAGE_UPSCALE"
  }
}
```

---

### GET `/jobs/:id`
Retrieve detailed status progress, execution output, error stack, and log records.

**Response:**
```json
{
  "id": "gateway_job_uuid_1111",
  "externalJobId": "test_product_job_12345",
  "status": "COMPLETED",
  "progress": 100,
  "output": [
    {
      "type": "image",
      "url": "https://comfyui.luonghuynh.org/view?filename=upscale_1111.png&type=output",
      "mimeType": "image/png",
      "fileName": "upscale_1111.png"
    }
  ],
  "logs": [
    {
      "level": "info",
      "message": "Worker picked up job from queue",
      "timestamp": "2026-06-01T12:00:00.000Z"
    }
  ]
}
```

---

## 3. Secure Callbacks Payload & Signatures

When a GatewayJob finishes with a terminal status (`COMPLETED` or `FAILED`), the Gateway background worker POSTs a JSON status back to the configured `callback.url`.

### HMAC Verification Headers

To prevent spoofing or unauthorized payload injections, the callback payload is signed with HMAC-SHA256 using the configured `callback.secret`. The signature is transmitted in the header:

```http
X-BT-AI-Signature: <hex_encoded_hmac_hash>
Content-Type: application/json
```

**Payload Schema:**
```json
{
  "externalJobId": "test_product_job_12345",
  "gatewayJobId": "gateway_job_uuid_1111",
  "status": "COMPLETED",
  "provider": "COMFYUI",
  "toolType": "IMAGE_UPSCALE",
  "outputs": [
    {
      "type": "image",
      "url": "https://comfyui.luonghuynh.org/view?filename=upscale_1111.png&type=output",
      "mimeType": "image/png",
      "fileName": "upscale_1111.png"
    }
  ],
  "error": null
}
```

### Signature Verification Algorithm (Product Backend Side Node.js)
```javascript
import * as crypto from 'crypto';

function verifyCallback(req) {
  const signature = req.headers['x-bt-ai-signature'];
  const secret = process.env.AI_GATEWAY_CALLBACK_SECRET;
  
  const bodyStr = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
  
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```
