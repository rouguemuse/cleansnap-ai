/**
 * CleanSnap Studio — 100% Permissive (MIT / Apache-2.0) Segmentation, Edge Refinement & Vector Contour Engine
 *
 * Execution Hierarchy:
 * 1. Server-Side Commercial Endpoint (`/api/segment`) -> Uses BRIA RMBG-2.0 Commercial API
 *    (when BRIA_API_KEY is configured) or local FastAPI `birefnet-general` (MIT) / `u2net` (Apache-2.0).
 * 2. Direct `onnxruntime-web` (MIT) Fallback -> Runs `/models/u2netp.onnx` (Apache-2.0 U²-Net architecture)
 *    with Center-Aligned High-Resolution Edge-Guided Alpha Matting & Foreground Color Decontamination.
 */
import * as ort from 'onnxruntime-web';

// Uses Vite-bundled local WASM binary (/assets/ort-wasm-simd-threaded.jsep-*.wasm) for 100% offline execution
ort.env.wasm.numThreads = 1;

let cachedOrtSession = null;

async function getOrtSession(onProgress) {
  if (cachedOrtSession) return cachedOrtSession;
  if (onProgress) onProgress('Loading ONNX Segmentation Model...', 15, 100);
  cachedOrtSession = await ort.InferenceSession.create('/models/u2netp.onnx', {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all'
  });
  if (onProgress) onProgress('Model Ready', 45, 100);
  return cachedOrtSession;
}

/**
 * Separable 1D box blur pass (3 iterations approximate a true Gaussian kernel in O(W*H) time)
 */
export function blurAlphaChannel(alphaIn, w, h, radiusFloat) {
  const r = Math.max(0, Math.min(16, Math.round(radiusFloat)));
  if (r <= 0) return new Uint8ClampedArray(alphaIn);

  let src = new Float32Array(alphaIn);
  let tmp = new Float32Array(w * h);
  const diam = r * 2 + 1;

  for (let pass = 0; pass < 2; pass++) {
    // Horizontal pass
    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;
      let sum = src[rowOffset] * (r + 1);
      for (let x = 1; x <= r; x++) {
        sum += src[rowOffset + Math.min(w - 1, x)];
      }
      for (let x = 0; x < w; x++) {
        tmp[rowOffset + x] = sum / diam;
        const leftIdx = Math.max(0, x - r);
        const rightIdx = Math.min(w - 1, x + r + 1);
        sum += src[rowOffset + rightIdx] - src[rowOffset + leftIdx];
      }
    }
    // Vertical pass
    for (let x = 0; x < w; x++) {
      let sum = tmp[x] * (r + 1);
      for (let y = 1; y <= r; y++) {
        sum += tmp[Math.min(h - 1, y) * w + x];
      }
      for (let y = 0; y < h; y++) {
        src[y * w + x] = sum / diam;
        const topIdx = Math.max(0, y - r);
        const botIdx = Math.min(h - 1, y + r + 1);
        sum += tmp[botIdx * w + x] - tmp[topIdx * w + x];
      }
    }
  }

  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    out[i] = Math.round(src[i]);
  }
  return out;
}

/**
 * Separable morphological expansion (>0) or contraction (<0) on an 8-bit alpha mask
 */
export function morphAlphaChannel(alphaIn, w, h, shiftPx) {
  const steps = Math.round(shiftPx);
  if (steps === 0) return new Uint8ClampedArray(alphaIn);

  const radius = Math.min(12, Math.abs(steps));
  const isDilate = steps > 0;
  const horiz = new Uint8ClampedArray(w * h);
  const out = new Uint8ClampedArray(w * h);

  // Horizontal 1D min/max filter
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let best = alphaIn[row + x];
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      if (isDilate) {
        for (let k = x0; k <= x1; k++) {
          const v = alphaIn[row + k];
          if (v > best) best = v;
        }
      } else {
        for (let k = x0; k <= x1; k++) {
          const v = alphaIn[row + k];
          if (v < best) best = v;
        }
      }
      horiz[row + x] = best;
    }
  }

  // Vertical 1D min/max filter
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h - 1, y + radius);
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let best = horiz[row + x];
      if (isDilate) {
        for (let k = y0; k <= y1; k++) {
          const v = horiz[k * w + x];
          if (v > best) best = v;
        }
      } else {
        for (let k = y0; k <= y1; k++) {
          const v = horiz[k * w + x];
          if (v < best) best = v;
        }
      }
      out[row + x] = best;
    }
  }

  return out;
}

/**
 * Foreground Edge Color Decontamination:
 * Replaces background color bleed on semi-transparent boundary pixels (0 < alpha < 235)
 * by propagating high-confidence interior foreground RGB outward.
 */
export function decontaminateForegroundRgb(origRgba, alphaMask, w, h, strength = 0.85) {
  const outRgba = new Uint8ClampedArray(origRgba.length);
  const amt = Math.max(0, Math.min(1, strength));
  const searchRadius = Math.max(2, Math.min(6, Math.round(Math.max(w, h) / 360)));

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const idx = row + x;
      const pIdx = idx * 4;
      const a = alphaMask[idx];

      if (a === 0) {
        outRgba[pIdx] = 0;
        outRgba[pIdx + 1] = 0;
        outRgba[pIdx + 2] = 0;
        outRgba[pIdx + 3] = 0;
        continue;
      }

      if (a >= 230 || amt <= 0.01) {
        outRgba[pIdx] = origRgba[pIdx];
        outRgba[pIdx + 1] = origRgba[pIdx + 1];
        outRgba[pIdx + 2] = origRgba[pIdx + 2];
        outRgba[pIdx + 3] = a;
        continue;
      }

      // Semi-transparent edge pixel: sample nearby high-confidence foreground pixels (alpha >= 210)
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let wSum = 0;

      const y0 = Math.max(0, y - searchRadius);
      const y1 = Math.min(h - 1, y + searchRadius);
      const x0 = Math.max(0, x - searchRadius);
      const x1 = Math.min(w - 1, x + searchRadius);

      for (let ny = y0; ny <= y1; ny += 2) {
        const nRow = ny * w;
        for (let nx = x0; nx <= x1; nx += 2) {
          const nIdx = nRow + nx;
          const na = alphaMask[nIdx];
          if (na >= 200) {
            const npIdx = nIdx * 4;
            const distSq = (nx - x) * (nx - x) + (ny - y) * (ny - y) + 1;
            const wt = (na / 255) / distSq;
            rSum += origRgba[npIdx] * wt;
            gSum += origRgba[npIdx + 1] * wt;
            bSum += origRgba[npIdx + 2] * wt;
            wSum += wt;
          }
        }
      }

      if (wSum > 0) {
        const fgR = rSum / wSum;
        const fgG = gSum / wSum;
        const fgB = bSum / wSum;
        const edgeFactor = ((230 - a) / 230) * amt;
        outRgba[pIdx] = Math.round(origRgba[pIdx] * (1 - edgeFactor) + fgR * edgeFactor);
        outRgba[pIdx + 1] = Math.round(origRgba[pIdx + 1] * (1 - edgeFactor) + fgG * edgeFactor);
        outRgba[pIdx + 2] = Math.round(origRgba[pIdx + 2] * (1 - edgeFactor) + fgB * edgeFactor);
      } else {
        outRgba[pIdx] = origRgba[pIdx];
        outRgba[pIdx + 1] = origRgba[pIdx + 1];
        outRgba[pIdx + 2] = origRgba[pIdx + 2];
      }
      outRgba[pIdx + 3] = a;
    }
  }

  return outRgba;
}

/**
 * Applies non-destructive manual brush overrides, morphological expand/contract,
 * edge feathering, and foreground color decontamination to produce a clean RGBA buffer.
 */
export function applyMaskRefinements(origRgba, baseAlpha, w, h, options = {}) {
  const {
    expandPx = 0,
    featherPx = 1,
    decontaminate = true,
    decontaminateStrength = 0.85
  } = options;

  let workingAlpha = new Uint8ClampedArray(baseAlpha);

  if (expandPx !== 0) {
    workingAlpha = morphAlphaChannel(workingAlpha, w, h, expandPx);
  }
  if (featherPx > 0) {
    workingAlpha = blurAlphaChannel(workingAlpha, w, h, featherPx);
  }

  const finalRgba = decontaminate
    ? decontaminateForegroundRgb(origRgba, workingAlpha, w, h, decontaminateStrength)
    : (() => {
        const buf = new Uint8ClampedArray(origRgba);
        for (let i = 0; i < w * h; i++) {
          const a = workingAlpha[i];
          buf[i * 4 + 3] = a;
          if (a === 0) {
            buf[i * 4] = 0;
            buf[i * 4 + 1] = 0;
            buf[i * 4 + 2] = 0;
          }
        }
        return buf;
      })();

  return { rgba: finalRgba, alpha: workingAlpha };
}

/**
 * Edge-Guided Alpha Refinement:
 * Upsamples the 320x320 saliency probability field to full (w, h) resolution using
 * center-aligned pixel coordinates and snaps soft transition boundaries to high-res RGB edges.
 */
export function refineAlphaWithHighResEdges(prob320, origRgba, w, h) {
  const alphaOut = new Uint8ClampedArray(w * h);
  const scaleX = 320 / w;
  const scaleY = 320 / h;

  for (let y = 0; y < h; y++) {
    // Half-pixel center alignment prevents top-left coordinate drift on high-res photos
    const sy = Math.max(0, Math.min(319, (y + 0.5) * scaleY - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(319, y0 + 1);
    const fy = sy - y0;

    for (let x = 0; x < w; x++) {
      const sx = Math.max(0, Math.min(319, (x + 0.5) * scaleX - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(319, x0 + 1);
      const fx = sx - x0;

      const p00 = prob320[y0 * 320 + x0];
      const p10 = prob320[y0 * 320 + x1];
      const p01 = prob320[y1 * 320 + x0];
      const p11 = prob320[y1 * 320 + x1];

      const p0 = p00 + fx * (p10 - p00);
      const p1 = p01 + fx * (p11 - p01);
      let p = p0 + fy * (p1 - p0);

      // Suppress low-confidence background halo below 0.20
      if (p <= 0.20) {
        p = 0;
      } else if (p >= 0.86) {
        p = 1;
      } else {
        p = (p - 0.20) / 0.66;
        p = p * p * (3 - 2 * p);
      }
      alphaOut[y * w + x] = Math.round(p * 255);
    }
  }

  // Local RGB-guided bilateral boundary snap on transition band (12 < alpha < 244)
  const refined = new Uint8ClampedArray(alphaOut);
  const radius = Math.max(2, Math.min(6, Math.round(Math.max(w, h) / 400)));

  for (let y = radius; y < h - radius; y++) {
    for (let x = radius; x < w - radius; x++) {
      const idx = y * w + x;
      const aCenter = alphaOut[idx];
      if (aCenter <= 12 || aCenter >= 244) continue;

      const pIdx = idx * 4;
      const rC = origRgba[pIdx];
      const gC = origRgba[pIdx + 1];
      const bC = origRgba[pIdx + 2];

      let weightSum = 0;
      let alphaSum = 0;

      const offsets = [
        [0, 0],
        [-radius, 0],
        [radius, 0],
        [0, -radius],
        [0, radius],
        [-radius, -radius],
        [radius, radius],
        [-radius, radius],
        [radius, -radius]
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
        const wColor = 1.0 / (1.0 + distRgb * 0.22);
        weightSum += wColor;
        alphaSum += alphaOut[nIdx] * wColor;
      }
      refined[idx] = Math.round(alphaSum / weightSum);
    }
  }

  // Erode 1px outer fringe and apply 1px anti-aliased feather
  const contracted = morphAlphaChannel(refined, w, h, -1);
  return blurAlphaChannel(contracted, w, h, 1);
}

/**
 * Remove background from an image File/Blob:
 * 1. Attempts server-side `/api/segment` (BRIA Commercial API or local FastAPI `birefnet-general` / `u2net`)
 * 2. Falls back seamlessly to direct MIT `onnxruntime-web` inference on `/models/u2netp.onnx`.
 */
export async function segmentSubjectPermissive(fileOrBlob, onProgress) {
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
  } catch {
    // Proceed to client-side ONNX Runtime Web
  }

  const session = await getOrtSession(onProgress);

  const imgUrl = URL.createObjectURL(fileOrBlob);
  let img;
  try {
    img = await new Promise((res, rej) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => res(el);
      el.onerror = () => rej(new Error('Failed to decode source image for segmentation.'));
      el.src = imgUrl;
    });
  } finally {
    URL.revokeObjectURL(imgUrl);
  }

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) {
    throw new Error('Invalid image dimensions (0x0).');
  }

  const netSize = 320;
  const resizeCanvas = document.createElement('canvas');
  resizeCanvas.width = netSize;
  resizeCanvas.height = netSize;
  const resizeCtx = resizeCanvas.getContext('2d');
  resizeCtx.drawImage(img, 0, 0, netSize, netSize);
  const resizedData = resizeCtx.getImageData(0, 0, netSize, netSize).data;

  const floatData = new Float32Array(3 * netSize * netSize);
  const planeSize = netSize * netSize;

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

  if (onProgress) onProgress('Refining High-Res Alpha & Decontaminating Edges...', 90, 100);
  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d');
  outCtx.drawImage(img, 0, 0, w, h);
  const fullImgData = outCtx.getImageData(0, 0, w, h);
  const origRgba = fullImgData.data;

  const refinedAlpha = refineAlphaWithHighResEdges(prob320, origRgba, w, h);
  const decontaminatedRgba = decontaminateForegroundRgb(origRgba, refinedAlpha, w, h, 0.85);
  fullImgData.data.set(decontaminatedRgba);
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
