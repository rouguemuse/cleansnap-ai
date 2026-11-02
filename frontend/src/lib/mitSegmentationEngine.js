/**
 * CleanSnap AI — 100% Permissive (MIT / Apache-2.0) Segmentation & Vector Contour Engine
 * Replaces the AGPLv3 `@imgly/background-removal` package completely.
 *
 * Execution Hierarchy:
 * 1. Server-Side Commercial Endpoint (`/api/segment`) -> Uses BRIA RMBG-2.0 Commercial API
 *    (when BRIA_API_KEY is configured) or local FastAPI `birefnet-general` (MIT) / `u2net` (Apache-2.0).
 * 2. Direct `onnxruntime-web` (MIT) Fallback -> Runs `/models/u2netp.onnx` (Apache-2.0 U²-Net architecture)
 *    with High-Resolution Edge-Guided Alpha Matting Refinement.
 */
import * as ort from 'onnxruntime-web';

// Point ONNX Runtime Web to official CDN WASM binaries so Vite builds stay fast and clean
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/';
ort.env.wasm.numThreads = 1;

let cachedOrtSession = null;

async function getOrtSession(onProgress) {
  if (cachedOrtSession) return cachedOrtSession;
  if (onProgress) onProgress('Loading MIT ONNX Segmentation Model...', 15, 100);
  cachedOrtSession = await ort.InferenceSession.create('/models/u2netp.onnx', {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all'
  });
  if (onProgress) onProgress('Model Ready', 45, 100);
  return cachedOrtSession;
}

/**
 * Edge-Guided Alpha Refinement:
 * Upsamples the 320x320 saliency probability field to full (w, h) resolution and snaps
 * soft transition boundaries to the high-resolution RGB color gradients of the original image.
 */
function refineAlphaWithHighResEdges(prob320, origRgba, w, h) {
  // 1. Bilinear upsample 320x320 probability map to w x h
  const alphaOut = new Uint8ClampedArray(w * h);
  const scaleX = 320 / w;
  const scaleY = 320 / h;

  for (let y = 0; y < h; y++) {
    const sy = y * scaleY;
    const y0 = Math.min(319, Math.max(0, Math.floor(sy)));
    const y1 = Math.min(319, y0 + 1);
    const fy = sy - y0;

    for (let x = 0; x < w; x++) {
      const sx = x * scaleX;
      const x0 = Math.min(319, Math.max(0, Math.floor(sx)));
      const x1 = Math.min(319, x0 + 1);
      const fx = sx - x0;

      const p00 = prob320[y0 * 320 + x0];
      const p10 = prob320[y0 * 320 + x1];
      const p01 = prob320[y1 * 320 + x0];
      const p11 = prob320[y1 * 320 + x1];

      const p0 = p00 + fx * (p10 - p00);
      const p1 = p01 + fx * (p11 - p01);
      let p = p0 + fy * (p1 - p0);

      // Contrast S-curve on boundary probabilities to eliminate 320x320 upsampling blur
      if (p <= 0.14) {
        p = 0;
      } else if (p >= 0.84) {
        p = 1;
      } else {
        p = (p - 0.14) / 0.70;
        p = p * p * (3 - 2 * p); // smoothstep edge sharpening
      }
      alphaOut[y * w + x] = Math.round(p * 255);
    }
  }

  // 2. Local RGB-guided boundary snap pass on uncertain transition pixels (16 < alpha < 240)
  const refined = new Uint8ClampedArray(alphaOut);
  const radius = Math.max(2, Math.min(6, Math.round(Math.max(w, h) / 400)));

  for (let y = radius; y < h - radius; y++) {
    for (let x = radius; x < w - radius; x++) {
      const idx = y * w + x;
      const aCenter = alphaOut[idx];
      if (aCenter <= 16 || aCenter >= 240) continue;

      const pIdx = idx * 4;
      const rC = origRgba[pIdx];
      const gC = origRgba[pIdx + 1];
      const bC = origRgba[pIdx + 2];

      let weightSum = 0;
      let alphaSum = 0;

      // Sample 5-point cross neighborhood at radius
      const offsets = [
        [0, 0],
        [-radius, 0],
        [radius, 0],
        [0, -radius],
        [0, radius],
        [-radius, -radius],
        [radius, radius]
      ];
      for (let k = 0; k < offsets.length; k++) {
        const nx = x + offsets[k][0];
        const ny = y + offsets[k][1];
        const nIdx = ny * w + nx;
        const npIdx = nIdx * 4;
        const distRgb =
          Math.abs(rC - origRgba[npIdx]) +
          Math.abs(gC - origRgba[npIdx + 1]) +
          Math.abs(bC - origRgba[npIdx + 2]);
        const wColor = 1.0 / (1.0 + distRgb * 0.18);
        weightSum += wColor;
        alphaSum += alphaOut[nIdx] * wColor;
      }
      refined[idx] = Math.round(alphaSum / weightSum);
    }
  }

  return refined;
}

/**
 * Remove background from an image File/Blob:
 * 1. Attempts server-side `/api/segment` (BRIA Commercial API or local FastAPI `birefnet-general` / `u2net`)
 * 2. Falls back seamlessly to direct MIT `onnxruntime-web` inference on `/models/u2netp.onnx`.
 */
export async function segmentSubjectPermissive(fileOrBlob, onProgress) {
  // 1. Try server-side commercial / FastAPI endpoint first
  try {
    const formData = new FormData();
    formData.append('file', fileOrBlob);
    const resp = await fetch('/api/segment', {
      method: 'POST',
      body: formData
    });
    if (resp.ok && resp.headers.get('content-type')?.includes('image/png')) {
      return await resp.blob();
    }
  } catch (_) {
    // Server endpoint not active or in static mode -> proceed to MIT onnxruntime-web
  }

  // 2. Run MIT onnxruntime-web directly in browser
  const session = await getOrtSession(onProgress);

  const imgUrl = URL.createObjectURL(fileOrBlob);
  const img = await new Promise((res, rej) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => res(el);
    el.onerror = rej;
    el.src = imgUrl;
  });
  URL.revokeObjectURL(imgUrl);

  const w = img.width;
  const h = img.height;

  // Prepare 320x320 input tensor [1, 3, 320, 320] with ImageNet normalization
  const netSize = 320;
  const resizeCanvas = document.createElement('canvas');
  resizeCanvas.width = netSize;
  resizeCanvas.height = netSize;
  const resizeCtx = resizeCanvas.getContext('2d');
  resizeCtx.drawImage(img, 0, 0, netSize, netSize);
  const resizedData = resizeCtx.getImageData(0, 0, netSize, netSize).data;

  const floatData = new Float32Array(3 * netSize * netSize);
  const planeSize = netSize * netSize;

  // Find max pixel value for normalization matching rembg u2net preprocessing
  let maxVal = 1.0;
  for (let i = 0; i < resizedData.length; i += 4) {
    if (resizedData[i] > maxVal) maxVal = resizedData[i];
    if (resizedData[i + 1] > maxVal) maxVal = resizedData[i + 1];
    if (resizedData[i + 2] > maxVal) maxVal = resizedData[i + 2];
  }

  for (let i = 0; i < planeSize; i++) {
    const r = resizedData[i * 4] / maxVal;
    const g = resizedData[i * 4 + 1] / maxVal;
    const b = resizedData[i * 4 + 2] / maxVal;

    floatData[i] = (r - 0.485) / 0.229;
    floatData[planeSize + i] = (g - 0.456) / 0.224;
    floatData[2 * planeSize + i] = (b - 0.406) / 0.225;
  }

  if (onProgress) onProgress('Running Neural Segmentation...', 65, 100);
  const inputName = session.inputNames[0];
  const tensor = new ort.Tensor('float32', floatData, [1, 3, netSize, netSize]);
  const results = await session.run({ [inputName]: tensor });
  const outputName = session.outputNames[0];
  const rawPred = results[outputName].data;

  // Min-max normalize prediction map
  let minP = Infinity;
  let maxP = -Infinity;
  for (let i = 0; i < rawPred.length; i++) {
    if (rawPred[i] < minP) minP = rawPred[i];
    if (rawPred[i] > maxP) maxP = rawPred[i];
  }
  const rangeP = Math.max(1e-6, maxP - minP);
  const prob320 = new Float32Array(planeSize);
  for (let i = 0; i < planeSize; i++) {
    prob320[i] = (rawPred[i] - minP) / rangeP;
  }

  if (onProgress) onProgress('Refining High-Res Alpha Edges...', 90, 100);
  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d');
  outCtx.drawImage(img, 0, 0, w, h);
  const fullImgData = outCtx.getImageData(0, 0, w, h);
  const rgba = fullImgData.data;

  const refinedAlpha = refineAlphaWithHighResEdges(prob320, rgba, w, h);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4 + 3] = refinedAlpha[i];
  }
  outCtx.putImageData(fullImgData, 0, 0);

  return await new Promise((resolve) => outCanvas.toBlob(resolve, 'image/png', 1.0));
}

/**
 * Ramer-Douglas-Peucker (RDP) 2D Polyline Simplification
 */
function simplifyPolygonRDP(points, epsilon = 1.6) {
  if (points.length <= 3) return points;

  let dmax = 0;
  let index = 0;
  const end = points.length - 1;
  const [x1, y1] = points[0];
  const [x2, y2] = points[end];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  for (let i = 1; i < end; i++) {
    const [px, py] = points[i];
    let d;
    if (lenSq === 0) {
      d = Math.hypot(px - x1, py - y1);
    } else {
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
      d = Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const left = simplifyPolygonRDP(points.slice(0, index + 1), epsilon);
    const right = simplifyPolygonRDP(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  }
  return [points[0], points[end]];
}

/**
 * True 2D Marching Squares Multi-Contour & Hole Vector Path Tracer
 * Replaces the defective star-convex radial raycaster identified in Audit Section 7.
 * Accurately traces concavities, L-shaped slides, castle turrets, and internal holes!
 */
export function traceMarchingSquaresSvgPath(ctx, width, height) {
  const gridW = Math.min(240, Math.max(64, Math.round(width / 5)));
  const gridH = Math.min(240, Math.max(64, Math.round(height / 5)));

  const smallCanvas = document.createElement('canvas');
  smallCanvas.width = gridW;
  smallCanvas.height = gridH;
  const smallCtx = smallCanvas.getContext('2d');
  smallCtx.drawImage(ctx.canvas, 0, 0, gridW, gridH);
  const alphaData = smallCtx.getImageData(0, 0, gridW, gridH).data;

  // Build binary occupancy grid with 1-cell zero padding border
  const gw = gridW + 2;
  const gh = gridH + 2;
  const bin = new Uint8Array(gw * gh);
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (alphaData[(y * gridW + x) * 4 + 3] > 28) {
        bin[(y + 1) * gw + (x + 1)] = 1;
      }
    }
  }

  // Extract directed boundary segments on the dual grid
  // Each cell (x, y) has 4 corners: TL=(x,y), TR=(x+1,y), BR=(x+1,y+1), BL=(x,y+1)
  const adj = new Map();
  const addEdge = (x1, y1, x2, y2) => {
    const k1 = `${x1},${y1}`;
    const k2 = `${x2},${y2}`;
    if (!adj.has(k1)) adj.set(k1, []);
    adj.get(k1).push({ key: k2, x: x2, y: y2 });
  };

  for (let y = 0; y < gh - 1; y++) {
    for (let x = 0; x < gw - 1; x++) {
      const tl = bin[y * gw + x];
      const tr = bin[y * gw + (x + 1)];
      const br = bin[(y + 1) * gw + (x + 1)];
      const bl = bin[(y + 1) * gw + x];
      const state = (tl << 3) | (tr << 2) | (br << 1) | bl;
      if (state === 0 || state === 15) continue;

      const top = [x + 0.5, y];
      const right = [x + 1, y + 0.5];
      const bottom = [x + 0.5, y + 1];
      const left = [x, y + 0.5];

      switch (state) {
        case 1:
          addEdge(left[0], left[1], bottom[0], bottom[1]);
          break;
        case 2:
          addEdge(bottom[0], bottom[1], right[0], right[1]);
          break;
        case 3:
          addEdge(left[0], left[1], right[0], right[1]);
          break;
        case 4:
          addEdge(top[0], top[1], right[0], right[1]);
          break;
        case 5:
          addEdge(left[0], left[1], top[0], top[1]);
          addEdge(bottom[0], bottom[1], right[0], right[1]);
          break;
        case 6:
          addEdge(top[0], top[1], bottom[0], bottom[1]);
          break;
        case 7:
          addEdge(left[0], left[1], top[0], top[1]);
          break;
        case 8:
          addEdge(top[0], top[1], left[0], left[1]);
          break;
        case 9:
          addEdge(top[0], top[1], bottom[0], bottom[1]);
          break;
        case 10:
          addEdge(top[0], top[1], right[0], right[1]);
          addEdge(bottom[0], bottom[1], left[0], left[1]);
          break;
        case 11:
          addEdge(top[0], top[1], right[0], right[1]);
          break;
        case 12:
          addEdge(right[0], right[1], left[0], left[1]);
          break;
        case 13:
          addEdge(right[0], right[1], bottom[0], bottom[1]);
          break;
        case 14:
          addEdge(bottom[0], bottom[1], left[0], left[1]);
          break;
        default:
          break;
      }
    }
  }

  // Stitch directed segments into closed polygon loops (outer boundaries + internal holes)
  const scaleX = width / gridW;
  const scaleY = height / gridH;
  const subPaths = [];

  for (const [startKey, neighbors] of adj.entries()) {
    while (neighbors.length > 0) {
      const [sx, sy] = startKey.split(',').map(Number);
      const ring = [[(sx - 1) * scaleX, (sy - 1) * scaleY]];
      let curr = neighbors.pop();

      let guard = 0;
      while (curr && curr.key !== startKey && guard < 10000) {
        guard++;
        ring.push([(curr.x - 1) * scaleX, (curr.y - 1) * scaleY]);
        const nextList = adj.get(curr.key);
        if (!nextList || nextList.length === 0) break;
        curr = nextList.pop();
      }

      if (ring.length >= 6) {
        const simplified = simplifyPolygonRDP(ring, Math.max(1.2, Math.min(width, height) * 0.0025));
        if (simplified.length >= 3) {
          const coords = simplified.map(
            ([px, py]) =>
              `${Math.max(0, Math.min(width, Math.round(px)))},${Math.max(0, Math.min(height, Math.round(py)))}`
          );
          subPaths.push(`M ${coords.join(' L ')} Z`);
        }
      }
    }
  }

  if (subPaths.length === 0) {
    return `M 0,0 L ${width},0 L ${width},${height} L 0,${height} Z`;
  }
  return subPaths.join(' ');
}
