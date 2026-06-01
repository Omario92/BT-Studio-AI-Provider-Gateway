# ComfyUI Workflow Registry & Bindings Map

This document explains how ComfyUI JSON workflows are versioned, updated, and parameterized dynamically in the AI Gateway without rebuilding Docker containers.

## 1. Exporting ComfyUI API JSON

To use a ComfyUI workflow inside the AI Gateway, you must export it in **API Format** (which is a raw node prompt mapping, NOT the standard editor JSON layout).

### Export Steps in ComfyUI:
1. Open ComfyUI Web UI.
2. In Settings, enable **"Enable Dev mode Options"**.
3. On the menu panel, click the **"Save (API Format)"** button.
4. This downloads a JSON file containing the raw execution node mapping.

---

## 2. Dynamic Input Parameter Mappings (Bindings)

Since ComfyUI workflows vary widely depending on the chosen model, upscale method, and node network, we use a flexible **Bindings Map** to bind standardized tool inputs to specific node parameters.

### Standardized Inputs for `IMAGE_UPSCALE`:
- `sourceFileUrl`: Public or pre-signed URL to download the original image asset.
- `scale`: Upscale multiplier (e.g. `2` for 2x, `4` for 4x).
- `denoise`: Latent sampler denoise factor (from `0` to `100`).

### Binding Schema:
```json
{
  "sourceImage": { "nodeId": "236", "path": "image" },
  "filenamePrefix": { "nodeId": "252", "path": "filename_prefix" },
  "scale": { "nodeId": "237", "path": "value" },
  "denoise": { "nodeId": "266", "path": "value" }
}
```

### Parameter Injections in Gateway:
1. **Source Image Upload**:
   - The Gateway downloads `sourceFileUrl` temporarily.
   - It uploads it to ComfyUI `/upload/image` REST endpoint.
   - The returned filename is injected into the node mapped to `sourceImage` (e.g., node `"236"`, parameter `"image"`).
2. **Filename Prefix**:
   - Inject job-scoped prefixes into `SaveImage` node to ensure outputs are organized and don't overwrite each other.
3. **Scale Value**:
   - Standard scale (e.g. `2.0`) is multiplied by 1024 to get target pixels (e.g. `2048`) and injected into the scale node (`"237"`, parameter `"value"`).
4. **Denoise Value**:
   - Denoise percentage (e.g., `45`) is normalized to a float (e.g., `0.45`) and injected into denoise node (`"266"`, parameter `"value"`).

---

## 3. Fallback Auto-Detection

If a workflow version is created **without** a bindings map, the ComfyUI Provider falls back to best-effort auto-detection:
- Scans workflow node configs to locate nodes with `class_type === "LoadImage"` and injects the filename into `image`.
- Scans workflow node configs to locate nodes with `class_type === "SaveImage"` and injects prefix into `filename_prefix`.
- Scans `class_type === "KSampler"` to set denoise parameter if present.
- Scans nodes matching `Upscale` word to set scale parameters.
- Setting explicit nodeId/path in bindings is highly recommended to guarantee absolute predictability.
