import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Folder,
  Upload,
  Download,
  Sparkles,
  Image as ImageIcon,
  Archive,
  Sliders,
  Trash2,
  Package,
  FileCode,
  RotateCcw,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Brush,
  Eraser,
  Hand,
  XCircle,
  RefreshCw,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import JSZip from 'jszip';
import {
  segmentSubjectPermissive,
  traceMarchingSquaresSvgPath,
  applyMaskRefinements
} from './lib/mitSegmentationEngine';
import './App.css';

// The 5 Official Studio Backdrops
const FIVE_BACKDROP_OPTIONS = [
  {
    id: 'green_screen',
    index: '01',
    label: 'Figure on Green Screen',
    shortLabel: 'Green Screen',
    swatchBg: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
    description: 'Studio chroma-key green screen cyclorama with key-light falloff & floor contact shadow'
  },
  {
    id: 'corkboard',
    index: '02',
    label: 'Cork Bulletin Board',
    shortLabel: 'Corkboard',
    swatchBg: 'linear-gradient(135deg, #d99b66 0%, #9a5b2c 100%)',
    description: 'Natural fine-grain honey cork bulletin board with warm oak hardwood frame'
  },
  {
    id: 'chalkboard',
    index: '03',
    label: 'Belgian Slate Chalkboard',
    shortLabel: 'Chalkboard',
    swatchBg: 'linear-gradient(135deg, #27272a 0%, #090d10 100%)',
    description: 'Museum-grade dark mineral slate with organic chalk-dust patina & American walnut frame'
  },
  {
    id: 'grass_yard',
    index: '04',
    label: 'Sunny Grass Yard',
    shortLabel: 'Grass Yard',
    swatchBg: 'linear-gradient(180deg, #38bdf8 0%, #4d7c0f 100%)',
    description: 'Photorealistic manicured park turf, summer tree canopy & natural ground occlusion shadow'
  },
  {
    id: 'transparent',
    index: '05',
    label: 'Alpha Cutout (.SVG / .PNG)',
    shortLabel: 'Alpha Cutout',
    swatchBg: 'repeating-conic-gradient(#cbd5e1 0% 25%, #f8fafc 0% 50%) 50% / 8px 8px',
    description: 'Zero-background transparent alpha cutout for full-res .PNG & vector-clipped .SVG export'
  }
];

// Pre-loaded Showcase Pairs — all 6 use dynamic 5-backdrop compositing & shared 4:3 coordinate alignment
const EDR_SHOWCASE_SAMPLES = [
  {
    job_id: 'vs_figure_greenscreen',
    original_filename: 'Explorer_Figure_GreenScreen.png',
    title: 'Figure on Green Screen',
    dimensions: 'STUDIO 4:3',
    subtitle: 'Raw studio C-stands, softboxes, floor tape & green screen keyed out → Clean figure cutout',
    before_url: '/samples/figure_greenscreen_before.jpg',
    after_park_url: '/samples/figure_greenscreen_after.jpg',
    cutout_url: '/samples/figure_greenscreen_cutout.webp',
    is_showcase: true,
    use_dynamic_backdrops: true
  },
  {
    job_id: 'edr_tropical_slide',
    original_filename: 'Tropical_Water_Slide_28x14.png',
    title: 'Tropical Water Slide',
    dimensions: '28×14 FT',
    subtitle: 'Wet concrete driveway, yellow bucket, fence & red badges removed → Vinyl polished & graded',
    before_url: '/samples/tropical_slide_before.jpg',
    after_park_url: '/samples/tropical_slide_after.jpg',
    cutout_url: '/samples/tropical_slide_cutout.webp',
    is_showcase: true,
    use_dynamic_backdrops: true
  },
  {
    job_id: 'user_wax_letter',
    original_filename: 'Wax_Sealed_Parchment_Letter.png',
    title: 'Wax-Sealed Parchment Letter',
    dimensions: 'CONCEPT ART',
    subtitle: 'Dark wood desk, antique brass key, leather tome & dried rose removed → Clean deckled parchment cutout',
    before_url: '/samples/wax_letter_before.jpg',
    after_park_url: '/samples/wax_letter_after.jpg',
    cutout_url: '/samples/wax_letter_cutout.webp',
    is_showcase: true,
    use_dynamic_backdrops: true
  },
  {
    job_id: 'user_red_coat',
    original_filename: 'Crimson_Wool_Trench_Coat.png',
    title: 'Crimson Wool Trench Coat',
    dimensions: 'CONCEPT ART',
    subtitle: 'Weathered timber bench, stone wall & candle lantern removed → Clean crimson wool garment cutout',
    before_url: '/samples/red_coat_before.jpg',
    after_park_url: '/samples/red_coat_after.jpg',
    cutout_url: '/samples/red_coat_cutout.webp',
    is_showcase: true,
    use_dynamic_backdrops: true
  },
  {
    job_id: 'user_graphic_umbrella',
    original_filename: 'Graphic_Novel_Umbrella_Forest.png',
    title: 'Graphic Novel Umbrella Forest',
    dimensions: 'GRAPHIC NOVEL',
    subtitle: 'Dark twilight forest canopy & undergrowth removed → Girl with umbrella & rain-cloud figure isolated',
    before_url: '/samples/graphic_umbrella_before.jpg',
    after_park_url: '/samples/graphic_umbrella_after.jpg',
    cutout_url: '/samples/graphic_umbrella_cutout.webp',
    is_showcase: true,
    use_dynamic_backdrops: true
  },
  {
    job_id: 'user_sports_coupe',
    original_filename: 'Obsidian_Studio_Sports_Coupe.png',
    title: 'Obsidian Studio Sports Coupe',
    dimensions: 'STUDIO 4:3',
    subtitle: 'Dark cyclorama floor & red neon light bars removed → Rain-beaded gloss black coupe isolated',
    before_url: '/samples/sports_coupe_before.jpg',
    after_park_url: '/samples/sports_coupe_after.jpg',
    cutout_url: '/samples/sports_coupe_cutout.webp',
    is_showcase: true,
    use_dynamic_backdrops: true
  }
];

const yieldToMain = () =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });

async function hashArrayBuffer(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getTransparentBoundingBox(ctx, width, height) {
  const imgData = ctx.getImageData(0, 0, width, height).data;
  let minX = width,
    minY = height,
    maxX = 0,
    maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = imgData[(y * width + x) * 4 + 3];
      if (alpha > 15) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }
  if (!found) return { x: 0, y: 0, w: width, h: height, empty: true };
  return {
    x: minX,
    y: minY,
    w: Math.max(1, maxX - minX + 1),
    h: Math.max(1, maxY - minY + 1),
    empty: false
  };
}

/**
 * Build a standalone Vector-Clipped .SVG containing:
 * - Scalable viewBox matching the trimmed cutout dimensions
 * - True 2D Marching Squares + Douglas-Peucker multi-contour & hole <path id="element_cutline_contour">
 * - Applied <clipPath id="element_clip"> on the high-resolution transparent PNG cutout
 */
function createStandaloneSvgMarkup(stickerCanvas, pngDataUrl) {
  const w = stickerCanvas.width;
  const h = stickerCanvas.height;
  const ctx = stickerCanvas.getContext('2d');
  const contourPath = traceMarchingSquaresSvgPath(ctx, w, h);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <path id="element_cutline_contour" d="${contourPath}" fill-rule="evenodd" clip-rule="evenodd" />
    <clipPath id="element_clip">
      <use href="#element_cutline_contour" />
    </clipPath>
  </defs>
  <g id="visual_sentence_element" clip-path="url(#element_clip)">
    <image width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" href="${pngDataUrl}" />
  </g>
</svg>`;
}

const cachedBackdrops = {
  greenScreen: null,
  corkboard: null,
  chalkboard: null,
  grass: null
};

async function loadImageSafe(src) {
  if (!src) return null;
  return await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadAllStudioBackdrops() {
  if (!cachedBackdrops.corkboard) {
    const [gs, cork, cb, g] = await Promise.all([
      loadImageSafe('/backdrops/green_screen_studio.jpg'),
      loadImageSafe('/backdrops/cork_bulletin_board.jpg'),
      loadImageSafe('/backdrops/slate_chalkboard.jpg'),
      loadImageSafe('/backdrops/sunny_park_lawn.jpg')
    ]);
    cachedBackdrops.greenScreen = gs;
    cachedBackdrops.corkboard = cork;
    cachedBackdrops.chalkboard = cb;
    cachedBackdrops.grass = g;
  }
  return cachedBackdrops;
}

/**
 * Generates a fast, lightweight 320px thumbnail before full-resolution segmentation
 */
async function generateLightweightThumbnail(file) {
  const tempUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageSafe(tempUrl);
    if (!img || !(img.naturalWidth || img.width)) {
      throw new Error('Unsupported or corrupt image file.');
    }
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const scale = Math.min(1, 320 / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, tw, th);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
    return {
      thumbUrl: blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/jpeg', 0.82),
      width: w,
      height: h
    };
  } finally {
    URL.revokeObjectURL(tempUrl);
  }
}

function createWatermarkedPreviewDataUrl(sourceCanvas, watermarkText = 'EDR PARTY RENTALS • PREVIEW ONLY') {
  const prevW = 1040;
  const prevH = Math.round((sourceCanvas.height / sourceCanvas.width) * prevW);
  const c = document.createElement('canvas');
  c.width = prevW;
  c.height = prevH;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#0d0f17';
  ctx.fillRect(0, 0, prevW, prevH);
  const tile = 22;
  ctx.fillStyle = '#151926';
  for (let y = 0; y < prevH; y += tile) {
    for (let x = 0; x < prevW; x += tile) {
      if (((x / tile) + (y / tile)) % 2 === 0) {
        ctx.fillRect(x, y, tile, tile);
      }
    }
  }

  ctx.drawImage(sourceCanvas, 0, 0, prevW, prevH);

  if (watermarkText && watermarkText.trim()) {
    ctx.save();
    ctx.translate(prevW / 2, prevH / 2);
    ctx.rotate((-24 * Math.PI) / 180);
    ctx.font = '600 15px "Geist Mono", "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';

    for (let y = -prevH; y <= prevH; y += 118) {
      for (let x = -prevW; x <= prevW; x += 380) {
        ctx.strokeStyle = 'rgba(7, 8, 12, 0.28)';
        ctx.lineWidth = 2.5;
        ctx.strokeText(watermarkText, x, y);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.30)';
        ctx.fillText(watermarkText, x, y);
      }
    }
    ctx.restore();
  }

  return c.toDataURL('image/jpeg', 0.88);
}

/**
 * Multi-Stage Vinyl Polish & Surface Grading Engine with Clean Alpha Cutout Support
 * (Fixed: Never forces opaque background when subject is small; preserves genuine alpha channel)
 */
function buildPolishedSubjectFromRgba(origImg, rgbaBuffer, alphaMask, w, h, polishIntensity = 'high') {
  const subjectCanvas = document.createElement('canvas');
  subjectCanvas.width = w;
  subjectCanvas.height = h;
  const ctx = subjectCanvas.getContext('2d');

  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;
  data.set(rgbaBuffer);

  let smoothData = null;
  if (polishIntensity !== 'off' && origImg) {
    const smoothCanvas = document.createElement('canvas');
    smoothCanvas.width = w;
    smoothCanvas.height = h;
    const smoothCtx = smoothCanvas.getContext('2d');
    smoothCtx.filter = 'blur(2.0px)';
    smoothCtx.drawImage(origImg, 0, 0, w, h);
    smoothData = smoothCtx.getImageData(0, 0, w, h).data;
  }

  const shadowLiftGamma = polishIntensity === 'high' ? 0.76 : polishIntensity === 'medium' ? 0.86 : 1.0;
  const contrastGain = polishIntensity === 'high' ? 1.14 : polishIntensity === 'medium' ? 1.08 : 1.0;
  const vibranceBoost = polishIntensity === 'high' ? 0.34 : polishIntensity === 'medium' ? 0.18 : 0.0;
  const vinylSheen = polishIntensity === 'high' ? 11 : polishIntensity === 'medium' ? 6 : 0;

  const lutR = new Uint8Array(256);
  const lutG = new Uint8Array(256);
  const lutB = new Uint8Array(256);

  for (let v = 0; v < 256; v++) {
    const norm = v / 255.0;
    const lifted = Math.pow(norm, shadowLiftGamma);
    const contrasted = (lifted - 0.46) * contrastGain + 0.48;
    const baseOut = contrasted * 255.0 + vinylSheen * Math.pow(lifted, 2.2);

    const warmShift =
      polishIntensity === 'high'
        ? 4.5 * Math.sin(norm * Math.PI)
        : polishIntensity === 'medium'
        ? 2.5 * Math.sin(norm * Math.PI)
        : 0;
    lutR[v] = Math.max(0, Math.min(255, Math.round(baseOut + warmShift * 1.1)));
    lutG[v] = Math.max(0, Math.min(255, Math.round(baseOut + warmShift * 0.4)));
    lutB[v] = Math.max(0, Math.min(255, Math.round(baseOut - warmShift * 0.6)));
  }

  for (let i = 0; i < data.length; i += 4) {
    const a = alphaMask ? alphaMask[i >> 2] : data[i + 3];
    if (a < 8) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
      continue;
    }
    data[i + 3] = a;

    if (polishIntensity === 'off') continue;

    let rOrig = data[i];
    let gOrig = data[i + 1];
    let bOrig = data[i + 2];

    if (smoothData) {
      const diff =
        Math.abs(rOrig - smoothData[i]) +
        Math.abs(gOrig - smoothData[i + 1]) +
        Math.abs(bOrig - smoothData[i + 2]);
      if (diff < 40) {
        const smoothWeight = (1.0 - diff / 40.0) * 0.32;
        rOrig = Math.round(rOrig * (1 - smoothWeight) + smoothData[i] * smoothWeight);
        gOrig = Math.round(gOrig * (1 - smoothWeight) + smoothData[i + 1] * smoothWeight);
        bOrig = Math.round(bOrig * (1 - smoothWeight) + smoothData[i + 2] * smoothWeight);
      }
    }

    let r = lutR[rOrig];
    let g = lutG[gOrig];
    let b = lutB[bOrig];

    if (vibranceBoost > 0) {
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const chroma = maxC - minC;
      const sat = maxC > 0 ? chroma / maxC : 0;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;

      if (chroma > 14) {
        const dynVib = vibranceBoost * (1.15 - sat * 0.55);
        r = Math.max(0, Math.min(255, Math.round(r + (r - luma) * dynVib)));
        g = Math.max(0, Math.min(255, Math.round(g + (g - luma) * dynVib)));
        b = Math.max(0, Math.min(255, Math.round(b + (b - luma) * dynVib)));
      }
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  ctx.putImageData(imgData, 0, 0);
  return subjectCanvas;
}

/**
 * Renders a single requested studio backdrop environment on demand (1448x1086 4:3)
 */
async function renderSingleEnvironmentComposite(engineCache, styleId, watermarkText) {
  const backdrops = await loadAllStudioBackdrops();
  const { subjectCanvas, tightBbox, sceneW, sceneH, drawX, drawY, drawW, drawH } = engineCache;

  const canvas = document.createElement('canvas');
  canvas.width = sceneW;
  canvas.height = sceneH;
  const ctx = canvas.getContext('2d');

  if (styleId === 'green_screen') {
    if (backdrops.greenScreen) {
      ctx.drawImage(backdrops.greenScreen, 0, 0, sceneW, sceneH);
    } else {
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(0, 0, sceneW, sceneH);
    }
    ctx.save();
    ctx.shadowColor = 'rgba(5, 46, 22, 0.42)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 14;
    ctx.drawImage(subjectCanvas, tightBbox.x, tightBbox.y, tightBbox.w, tightBbox.h, drawX, drawY, drawW, drawH);
    ctx.restore();
  } else if (styleId === 'corkboard') {
    if (backdrops.corkboard) {
      ctx.drawImage(backdrops.corkboard, 0, 0, sceneW, sceneH);
    } else {
      ctx.fillStyle = '#c88d55';
      ctx.fillRect(0, 0, sceneW, sceneH);
    }
    ctx.save();
    ctx.shadowColor = 'rgba(42, 22, 8, 0.44)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 12;
    ctx.drawImage(subjectCanvas, tightBbox.x, tightBbox.y, tightBbox.w, tightBbox.h, drawX, drawY, drawW, drawH);
    ctx.restore();
  } else if (styleId === 'chalkboard') {
    if (backdrops.chalkboard) {
      ctx.drawImage(backdrops.chalkboard, 0, 0, sceneW, sceneH);
    } else {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, sceneW, sceneH);
    }
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.62)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 14;
    ctx.drawImage(subjectCanvas, tightBbox.x, tightBbox.y, tightBbox.w, tightBbox.h, drawX, drawY, drawW, drawH);
    ctx.restore();
  } else if (styleId === 'grass_yard') {
    if (backdrops.grass) {
      ctx.drawImage(backdrops.grass, 0, 0, sceneW, sceneH);
    } else {
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(0, 0, sceneW, sceneH * 0.58);
      ctx.fillStyle = '#4d7c0f';
      ctx.fillRect(0, sceneH * 0.58, sceneW, sceneH * 0.42);
    }
    ctx.save();
    const shadowCenterX = drawX + Math.floor(drawW * 0.52);
    const shadowCenterY = drawY + drawH - Math.floor(drawH * 0.02);
    const shadowRx = Math.max(12, Math.floor(drawW * 0.48));
    const shadowRy = Math.max(18, Math.floor(drawH * 0.055));
    const ambientGrad = ctx.createRadialGradient(
      shadowCenterX,
      shadowCenterY,
      10,
      shadowCenterX,
      shadowCenterY,
      shadowRx
    );
    ambientGrad.addColorStop(0, 'rgba(15, 35, 10, 0.58)');
    ambientGrad.addColorStop(0.6, 'rgba(15, 35, 10, 0.28)');
    ambientGrad.addColorStop(1, 'rgba(15, 35, 10, 0)');
    ctx.translate(shadowCenterX, shadowCenterY);
    ctx.scale(1, shadowRy / shadowRx);
    ctx.beginPath();
    ctx.arc(0, 0, shadowRx, 0, Math.PI * 2);
    ctx.fillStyle = ambientGrad;
    ctx.fill();
    ctx.restore();

    ctx.drawImage(subjectCanvas, tightBbox.x, tightBbox.y, tightBbox.w, tightBbox.h, drawX, drawY, drawW, drawH);
  } else {
    // transparent
    ctx.drawImage(subjectCanvas, tightBbox.x, tightBbox.y, tightBbox.w, tightBbox.h, drawX, drawY, drawW, drawH);
  }

  const cleanUrl =
    styleId === 'transparent'
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.94);
  const previewUrl = createWatermarkedPreviewDataUrl(canvas, watermarkText);
  return { cleanUrl, previewUrl };
}

/**
 * Prepares the Subject Cutout Engine Cache + Aligned Before Image + Active Environment Composite.
 * Other environments are rendered lazily on demand when selected or exported.
 */
async function buildSubjectAndActiveBackdrop(
  originalFileOrUrl,
  cutoutBlobOrUrl,
  polishIntensity = 'high',
  watermarkText = 'EDR PARTY RENTALS • PREVIEW ONLY',
  activeStyleId = 'corkboard',
  existingEngineCache = null,
  refineOptions = null
) {
  let w, h, origImg, origRgba, autoAlphaMask, userAlphaMask;

  if (existingEngineCache) {
    ({ w, h, origImg, origRgba, autoAlphaMask, userAlphaMask } = existingEngineCache);
  } else {
    const origUrl =
      typeof originalFileOrUrl === 'string'
        ? originalFileOrUrl
        : URL.createObjectURL(originalFileOrUrl);
    const cutUrl =
      !cutoutBlobOrUrl
        ? null
        : typeof cutoutBlobOrUrl === 'string'
        ? cutoutBlobOrUrl
        : URL.createObjectURL(cutoutBlobOrUrl);

    try {
      origImg = await loadImageSafe(origUrl);
      const cutImg = cutUrl ? await loadImageSafe(cutUrl) : null;
      if (!origImg && !cutImg) {
        throw new Error('Could not decode image data.');
      }

      const refImg = cutImg || origImg;
      w = refImg.naturalWidth || refImg.width;
      h = refImg.naturalHeight || refImg.height;

      // Extract original RGB pixels
      const rawCanvas = document.createElement('canvas');
      rawCanvas.width = w;
      rawCanvas.height = h;
      const rawCtx = rawCanvas.getContext('2d');
      rawCtx.drawImage(origImg || cutImg, 0, 0, w, h);
      origRgba = new Uint8ClampedArray(rawCtx.getImageData(0, 0, w, h).data);

      // Extract cutout alpha mask (and if cutout has pre-cleaned RGB, blend it in)
      autoAlphaMask = new Uint8ClampedArray(w * h);
      if (cutImg) {
        const cutCanvas = document.createElement('canvas');
        cutCanvas.width = w;
        cutCanvas.height = h;
        const cutCtx = cutCanvas.getContext('2d');
        cutCtx.drawImage(cutImg, 0, 0, w, h);
        const cutData = cutCtx.getImageData(0, 0, w, h).data;
        let nonZero = 0;
        for (let i = 0; i < w * h; i++) {
          const a = cutData[i * 4 + 3];
          autoAlphaMask[i] = a;
          if (a > 15) nonZero++;
          // Use decontaminated RGB from cutout on visible pixels
          if (a > 0) {
            origRgba[i * 4] = cutData[i * 4];
            origRgba[i * 4 + 1] = cutData[i * 4 + 1];
            origRgba[i * 4 + 2] = cutData[i * 4 + 2];
          }
        }
        if (nonZero === 0) {
          throw new Error('Automatic cutout returned an empty subject mask.');
        }
      } else {
        autoAlphaMask.fill(255);
      }
      userAlphaMask = new Uint8ClampedArray(autoAlphaMask);
    } finally {
      if (typeof originalFileOrUrl !== 'string') URL.revokeObjectURL(origUrl);
      if (cutoutBlobOrUrl && typeof cutoutBlobOrUrl !== 'string') URL.revokeObjectURL(cutUrl);
    }
  }

  const effectiveRefine = refineOptions || {
    expandPx: 0,
    featherPx: 0,
    decontaminate: true,
    decontaminateStrength: 0.85
  };

  const { rgba: refinedRgba, alpha: finalAlpha } = applyMaskRefinements(
    origRgba,
    userAlphaMask,
    w,
    h,
    effectiveRefine
  );

  const subjectCanvas = buildPolishedSubjectFromRgba(
    origImg,
    refinedRgba,
    finalAlpha,
    w,
    h,
    polishIntensity
  );
  const subjectCtx = subjectCanvas.getContext('2d');

  // Full-resolution transparent PNG URL for direct export
  const fullResAlphaPngUrl = subjectCanvas.toDataURL('image/png');

  // Tightly cropped Sticker PNG + Marching Squares Vector-Clipped SVG
  const tightBbox = getTransparentBoundingBox(subjectCtx, w, h);
  const stickerCanvas = document.createElement('canvas');
  stickerCanvas.width = tightBbox.w;
  stickerCanvas.height = tightBbox.h;
  const stickerCtx = stickerCanvas.getContext('2d');
  stickerCtx.drawImage(
    subjectCanvas,
    tightBbox.x,
    tightBbox.y,
    tightBbox.w,
    tightBbox.h,
    0,
    0,
    tightBbox.w,
    tightBbox.h
  );
  const trimmedStickerUrl = stickerCanvas.toDataURL('image/png');
  const svgMarkup = createStandaloneSvgMarkup(stickerCanvas, trimmedStickerUrl);

  const sceneW = 1448;
  const sceneH = 1086;
  const maxOccW = Math.floor(sceneW * 0.74);
  const maxOccH = Math.floor(sceneH * 0.74);
  const sceneScale = Math.min(maxOccW / tightBbox.w, maxOccH / tightBbox.h);
  const drawW = Math.max(1, Math.floor(tightBbox.w * sceneScale));
  const drawH = Math.max(1, Math.floor(tightBbox.h * sceneScale));
  const drawX = Math.floor((sceneW - drawW) / 2);
  const drawY = Math.floor((sceneH - drawH) * 0.5);

  // Aligned Before Image (1448x1086 4:3) — always uses the exact same coordinate transform as the subject!
  let alignedBeforeUrl = existingEngineCache?.alignedBeforeUrl || null;
  if (!alignedBeforeUrl && origImg) {
    const beforeCanvas = document.createElement('canvas');
    beforeCanvas.width = sceneW;
    beforeCanvas.height = sceneH;
    const beforeCtx = beforeCanvas.getContext('2d');
    beforeCtx.fillStyle = '#07080c';
    beforeCtx.fillRect(0, 0, sceneW, sceneH);

    const origW = origImg.naturalWidth || origImg.width;
    const origH = origImg.naturalHeight || origImg.height;
    const scaleRatioX = w / origW;
    const scaleRatioY = h / origH;

    const fullOrigW = Math.round(w * sceneScale);
    const fullOrigH = Math.round(h * sceneScale);
    const fullOrigX = Math.round(drawX - tightBbox.x * sceneScale);
    const fullOrigY = Math.round(drawY - tightBbox.y * sceneScale);
    beforeCtx.drawImage(
      origImg,
      0,
      0,
      origW,
      origH,
      fullOrigX,
      fullOrigY,
      fullOrigW / (scaleRatioX || 1) * (scaleRatioX || 1),
      fullOrigH / (scaleRatioY || 1) * (scaleRatioY || 1)
    );
    alignedBeforeUrl = beforeCanvas.toDataURL('image/jpeg', 0.90);
  }

  const engineCache = {
    w,
    h,
    origImg,
    origRgba,
    autoAlphaMask,
    userAlphaMask,
    subjectCanvas,
    tightBbox,
    sceneW,
    sceneH,
    drawX,
    drawY,
    drawW,
    drawH,
    alignedBeforeUrl,
    refineOptions: effectiveRefine
  };

  // Render the active environment immediately; other environments render on demand when selected
  const activeRendered = await renderSingleEnvironmentComposite(
    engineCache,
    activeStyleId,
    watermarkText
  );

  const cleanByStyle = {
    [activeStyleId]: activeRendered.cleanUrl
  };
  const previewByStyle = {
    [activeStyleId]: activeRendered.previewUrl
  };

  if (activeStyleId !== 'transparent') {
    cleanByStyle.transparent = fullResAlphaPngUrl;
  }

  return {
    engineCache,
    alignedBeforeUrl,
    trimmedStickerUrl,
    fullResAlphaPngUrl,
    svgMarkup,
    cleanByStyle,
    previewByStyle
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('cleaner'); // 'cleaner' | 'vault'
  const [stageMode, setStageMode] = useState('compare'); // 'compare' | 'refine'
  const [filmstripFilter, setFilmstripFilter] = useState('all'); // 'all' | 'uploads' | 'samples'

  const [backdropStyle, setBackdropStyle] = useState('corkboard');
  const [polishIntensity, setPolishIntensity] = useState('high');
  const [watermarkText, setWatermarkText] = useState('EDR PARTY RENTALS • PREVIEW ONLY');

  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [batchStats, setBatchStats] = useState(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [packCategory, setPackCategory] = useState('CleanSnap_Studio_SVG_Pack');

  // Manual Edge Refinement Workspace State
  const [brushMode, setBrushMode] = useState('erase'); // 'add' | 'erase' | 'pan'
  const [brushSize, setBrushSize] = useState(28);
  const [brushHardness, setBrushHardness] = useState(75);
  const [edgeExpandPx, setEdgeExpandPx] = useState(0);
  const [edgeFeatherPx, setEdgeFeatherPx] = useState(1);
  const [edgeDecontam, setEdgeDecontam] = useState(true);
  const [edgeDecontamStrength, setEdgeDecontamStrength] = useState(85);
  const [refinerBgMode, setRefinerBgMode] = useState('checkerboard'); // 'checkerboard' | 'mask' | 'dark' | 'light' | 'environment'
  const [refinerZoom, setRefinerZoom] = useState(1);
  const [refinerPan, setRefinerPan] = useState({ x: 0, y: 0 });
  const [maskHistoryInfo, setMaskHistoryInfo] = useState({ canUndo: false, canRedo: false, dirty: false });
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const sliderRef = useRef(null);
  const seenHashesRef = useRef(new Map());
  const batchCancelRef = useRef(false);
  const objectUrlsRef = useRef(new Set());

  // Refiner Canvas & History Refs
  const refinerCanvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPtRef = useRef(null);
  const maskUndoStackRef = useRef([]);
  const maskRedoStackRef = useRef([]);

  const trackUrl = useCallback((url) => {
    if (url && url.startsWith('blob:')) {
      objectUrlsRef.current.add(url);
    }
    return url;
  }, []);

  useEffect(() => {
    const tracked = objectUrlsRef.current;
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      tracked.forEach((url) => URL.revokeObjectURL(url));
      tracked.clear();
    };
  }, []);

  // Initialize the 6 Showcase items on mount
  useEffect(() => {
    let mounted = true;
    async function initShowcase() {
      const placeholderJobs = EDR_SHOWCASE_SAMPLES.map((s) => ({
        job_id: s.job_id,
        original_filename: s.original_filename,
        title: s.title,
        dimensions: s.dimensions,
        subtitle: s.subtitle,
        pack_name: 'CleanSnap_Studio_SVG_Pack',
        original_url: s.before_url,
        thumb_url: s.after_park_url,
        aligned_before_url: s.before_url,
        trimmed_sticker_url: s.cutout_url,
        full_res_alpha_url: s.cutout_url,
        svg_markup: null,
        cleanByStyle: {
          corkboard: s.after_park_url,
          transparent: s.cutout_url
        },
        previewByStyle: {
          corkboard: s.after_park_url,
          transparent: s.cutout_url
        },
        status: 'completed',
        is_showcase: true,
        model_used: 'Permissive MIT/Apache-2.0 Engine + 5-Backdrop Studio',
        processing_time: '0.42'
      }));

      setJobs(placeholderJobs);
      setSelectedJob(placeholderJobs[0]);

      for (const sample of EDR_SHOWCASE_SAMPLES) {
        if (!mounted) return;
        await yieldToMain();
        try {
          const built = await buildSubjectAndActiveBackdrop(
            sample.before_url,
            sample.cutout_url,
            'high',
            'EDR PARTY RENTALS • PREVIEW ONLY',
            'corkboard'
          );
          if (!mounted) return;
          setJobs((prev) =>
            prev.map((j) =>
              j.job_id === sample.job_id
                ? {
                    ...j,
                    _engineCache: built.engineCache,
                    aligned_before_url: built.alignedBeforeUrl,
                    trimmed_sticker_url: built.trimmedStickerUrl,
                    full_res_alpha_url: built.fullResAlphaPngUrl,
                    svg_markup: built.svgMarkup,
                    cleanByStyle: built.cleanByStyle,
                    previewByStyle: built.previewByStyle
                  }
                : j
            )
          );
          setSelectedJob((prev) =>
            prev && prev.job_id === sample.job_id
              ? {
                  ...prev,
                  _engineCache: built.engineCache,
                  aligned_before_url: built.alignedBeforeUrl,
                  trimmed_sticker_url: built.trimmedStickerUrl,
                  full_res_alpha_url: built.fullResAlphaPngUrl,
                  svg_markup: built.svgMarkup,
                  cleanByStyle: built.cleanByStyle,
                  previewByStyle: built.previewByStyle
                }
              : prev
          );
        } catch (err) {
          console.warn('Showcase init warning:', err);
        }
      }
    }
    initShowcase();
    return () => {
      mounted = false;
    };
  }, []);

  // On-demand environment rendering whenever selectedJob or backdropStyle changes
  useEffect(() => {
    let active = true;
    async function ensureStyleReady() {
      if (!selectedJob || selectedJob.status !== 'completed') return;
      if (selectedJob.previewByStyle?.[backdropStyle] && selectedJob.cleanByStyle?.[backdropStyle]) {
        return;
      }
      if (!selectedJob._engineCache) return;

      const rendered = await renderSingleEnvironmentComposite(
        selectedJob._engineCache,
        backdropStyle,
        watermarkText
      );
      if (!active) return;

      setJobs((prev) =>
        prev.map((j) =>
          j.job_id === selectedJob.job_id
            ? {
                ...j,
                cleanByStyle: { ...j.cleanByStyle, [backdropStyle]: rendered.cleanUrl },
                previewByStyle: { ...j.previewByStyle, [backdropStyle]: rendered.previewUrl }
              }
            : j
        )
      );
      setSelectedJob((prev) =>
        prev && prev.job_id === selectedJob.job_id
          ? {
              ...prev,
              cleanByStyle: { ...prev.cleanByStyle, [backdropStyle]: rendered.cleanUrl },
              previewByStyle: { ...prev.previewByStyle, [backdropStyle]: rendered.previewUrl }
            }
          : prev
      );
    }
    ensureStyleReady();
    return () => {
      active = false;
    };
  }, [selectedJob, backdropStyle, watermarkText]);

  // Sync Manual Edge Refiner Canvas whenever in 'refine' mode or parameters change
  const renderRefinerPreviewCanvas = useCallback(() => {
    const canvas = refinerCanvasRef.current;
    const cache = selectedJob?._engineCache;
    if (!canvas || !cache) return;

    const { w, h, origRgba, userAlphaMask } = cache;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    const { rgba } = applyMaskRefinements(origRgba, userAlphaMask, w, h, {
      expandPx: edgeExpandPx,
      featherPx: edgeFeatherPx,
      decontaminate: edgeDecontam,
      decontaminateStrength: edgeDecontamStrength / 100
    });

    if (refinerBgMode === 'mask') {
      // Before/After Ruby Mask Overlay inspection mode: shows original image with ruby tint over removed background
      const overlay = new Uint8ClampedArray(origRgba.length);
      for (let i = 0; i < w * h; i++) {
        const p = i * 4;
        const a = rgba[p + 3] / 255;
        const bgWeight = 1 - a;
        overlay[p] = Math.round(origRgba[p] * (0.35 + 0.65 * a) + 244 * bgWeight * 0.55);
        overlay[p + 1] = Math.round(origRgba[p + 1] * (0.25 + 0.75 * a) + 32 * bgWeight * 0.15);
        overlay[p + 2] = Math.round(origRgba[p + 2] * (0.25 + 0.75 * a) + 68 * bgWeight * 0.25);
        overlay[p + 3] = 255;
      }
      ctx.putImageData(new ImageData(overlay, w, h), 0, 0);
    } else {
      ctx.putImageData(new ImageData(rgba, w, h), 0, 0);
    }
  }, [selectedJob, edgeExpandPx, edgeFeatherPx, edgeDecontam, edgeDecontamStrength, refinerBgMode]);

  useEffect(() => {
    if (stageMode === 'refine' && selectedJob?._engineCache) {
      renderRefinerPreviewCanvas();
    }
  }, [stageMode, selectedJob, renderRefinerPreviewCanvas]);

  // Reset Undo/Redo stacks when switching selectedJob
  const selectedRefineOpts = selectedJob?._engineCache?.refineOptions;
  useEffect(() => {
    maskUndoStackRef.current = [];
    maskRedoStackRef.current = [];
    if (selectedRefineOpts) {
      setEdgeExpandPx(selectedRefineOpts.expandPx || 0);
      setEdgeFeatherPx(selectedRefineOpts.featherPx ?? 1);
      setEdgeDecontam(selectedRefineOpts.decontaminate ?? true);
      setEdgeDecontamStrength(Math.round((selectedRefineOpts.decontaminateStrength ?? 0.85) * 100));
    } else {
      setEdgeExpandPx(0);
      setEdgeFeatherPx(1);
      setEdgeDecontam(true);
      setEdgeDecontamStrength(85);
    }
    setMaskHistoryInfo({ canUndo: false, canRedo: false, dirty: false });
  }, [selectedJob?.job_id, selectedRefineOpts]);

  // Paint brush stroke onto userAlphaMask
  const paintMaskAtPoint = (xNorm, yNorm, prevNorm = null) => {
    const cache = selectedJob?._engineCache;
    if (!cache) return;
    const { w, h, userAlphaMask } = cache;
    const targetX = xNorm * w;
    const targetY = yNorm * h;
    const startX = prevNorm ? prevNorm.x * w : targetX;
    const startY = prevNorm ? prevNorm.y * h : targetY;

    const scaleFactor = Math.max(w, h) / 900;
    const radius = Math.max(2, brushSize * scaleFactor);
    const hardFrac = Math.max(0.05, Math.min(0.99, brushHardness / 100));
    const innerR = radius * hardFrac;
    const targetVal = brushMode === 'add' ? 255 : 0;

    const dist = Math.hypot(targetX - startX, targetY - startY);
    const steps = Math.max(1, Math.ceil(dist / Math.max(1, radius * 0.25)));

    for (let s = 0; s <= steps; s++) {
      const cx = startX + ((targetX - startX) * s) / steps;
      const cy = startY + ((targetY - startY) * s) / steps;
      const x0 = Math.max(0, Math.floor(cx - radius));
      const x1 = Math.min(w - 1, Math.ceil(cx + radius));
      const y0 = Math.max(0, Math.floor(cy - radius));
      const y1 = Math.min(h - 1, Math.ceil(cy + radius));

      for (let py = y0; py <= y1; py++) {
        const dy = py - cy;
        const row = py * w;
        for (let px = x0; px <= x1; px++) {
          const dx = px - cx;
          const d = Math.hypot(dx, dy);
          if (d > radius) continue;
          let strength = 1.0;
          if (d > innerR) {
            strength = 1.0 - (d - innerR) / Math.max(1e-4, radius - innerR);
          }
          const idx = row + px;
          const cur = userAlphaMask[idx];
          userAlphaMask[idx] = Math.round(cur + (targetVal - cur) * strength);
        }
      }
    }
    renderRefinerPreviewCanvas();
  };

  const handleRefinerPointerDown = (e) => {
    if (!selectedJob?._engineCache || !refinerCanvasRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (brushMode === 'pan') {
      isDrawingRef.current = true;
      lastPtRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    // Push current mask to undo stack before modifying
    const snapshot = new Uint8ClampedArray(selectedJob._engineCache.userAlphaMask);
    maskUndoStackRef.current.push(snapshot);
    if (maskUndoStackRef.current.length > 20) maskUndoStackRef.current.shift();
    maskRedoStackRef.current = [];
    setMaskHistoryInfo({
      canUndo: maskUndoStackRef.current.length > 0,
      canRedo: false,
      dirty: true
    });

    const rect = refinerCanvasRef.current.getBoundingClientRect();
    const xNorm = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const yNorm = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    isDrawingRef.current = true;
    lastPtRef.current = { x: xNorm, y: yNorm };
    paintMaskAtPoint(xNorm, yNorm, null);
  };

  const handleRefinerPointerMove = (e) => {
    if (!isDrawingRef.current || !selectedJob?._engineCache || !refinerCanvasRef.current) return;
    if (brushMode === 'pan') {
      const dx = e.clientX - lastPtRef.current.x;
      const dy = e.clientY - lastPtRef.current.y;
      lastPtRef.current = { x: e.clientX, y: e.clientY };
      setRefinerPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      return;
    }
    const rect = refinerCanvasRef.current.getBoundingClientRect();
    const xNorm = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const yNorm = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    paintMaskAtPoint(xNorm, yNorm, lastPtRef.current);
    lastPtRef.current = { x: xNorm, y: yNorm };
  };

  const handleRefinerPointerUp = () => {
    isDrawingRef.current = false;
    lastPtRef.current = null;
  };

  const handleUndoMask = () => {
    const cache = selectedJob?._engineCache;
    if (!cache || maskUndoStackRef.current.length === 0) return;
    maskRedoStackRef.current.push(new Uint8ClampedArray(cache.userAlphaMask));
    const prev = maskUndoStackRef.current.pop();
    cache.userAlphaMask.set(prev);
    setMaskHistoryInfo({
      canUndo: maskUndoStackRef.current.length > 0,
      canRedo: maskRedoStackRef.current.length > 0,
      dirty: true
    });
    renderRefinerPreviewCanvas();
  };

  const handleRedoMask = () => {
    const cache = selectedJob?._engineCache;
    if (!cache || maskRedoStackRef.current.length === 0) return;
    maskUndoStackRef.current.push(new Uint8ClampedArray(cache.userAlphaMask));
    const next = maskRedoStackRef.current.pop();
    cache.userAlphaMask.set(next);
    setMaskHistoryInfo({
      canUndo: maskUndoStackRef.current.length > 0,
      canRedo: maskRedoStackRef.current.length > 0,
      dirty: true
    });
    renderRefinerPreviewCanvas();
  };

  const handleResetMaskToAuto = () => {
    const cache = selectedJob?._engineCache;
    if (!cache) return;
    maskUndoStackRef.current.push(new Uint8ClampedArray(cache.userAlphaMask));
    cache.userAlphaMask.set(cache.autoAlphaMask);
    setEdgeExpandPx(0);
    setEdgeFeatherPx(1);
    setEdgeDecontam(true);
    setEdgeDecontamStrength(85);
    setMaskHistoryInfo({
      canUndo: maskUndoStackRef.current.length > 0,
      canRedo: false,
      dirty: true
    });
    renderRefinerPreviewCanvas();
  };

  const applyRefinementToActiveJob = async () => {
    if (!selectedJob?._engineCache) return;
    const built = await buildSubjectAndActiveBackdrop(
      null,
      null,
      polishIntensity,
      watermarkText,
      backdropStyle,
      selectedJob._engineCache,
      {
        expandPx: edgeExpandPx,
        featherPx: edgeFeatherPx,
        decontaminate: edgeDecontam,
        decontaminateStrength: edgeDecontamStrength / 100
      }
    );

    const updatedJob = {
      ...selectedJob,
      _engineCache: built.engineCache,
      trimmed_sticker_url: built.trimmedStickerUrl,
      full_res_alpha_url: built.fullResAlphaPngUrl,
      svg_markup: built.svgMarkup,
      cleanByStyle: built.cleanByStyle,
      previewByStyle: built.previewByStyle
    };

    setJobs((prev) => prev.map((j) => (j.job_id === updatedJob.job_id ? updatedJob : j)));
    setSelectedJob(updatedJob);
    setMaskHistoryInfo((info) => ({ ...info, dirty: false }));
    setStageMode('compare');
  };

  // Process a single uploaded entry (used by both batch loop and single-item retry)
  const processSingleJobEntry = async (entry, idxLabel = '') => {
    const t0 = performance.now();
    setJobs((prev) =>
      prev.map((j) =>
        j.job_id === entry.job_id ? { ...j, status: 'processing', error_reason: null } : j
      )
    );
    await yieldToMain();

    const file = entry.file;
    if (!file || file.size === 0) {
      throw new Error('Empty or unreadable file (0 bytes).');
    }
    if (!/\.(png|jpe?g|webp|bmp|gif|avif|heic|heif)$/i.test(file.name)) {
      throw new Error(`Unsupported file format (${file.name.split('.').pop() || 'unknown'}).`);
    }

    const buffer = await file.arrayBuffer();
    const sha256 = `${polishIntensity}_${await hashArrayBuffer(buffer)}`;

    if (seenHashesRef.current.has(sha256)) {
      const canon = seenHashesRef.current.get(sha256);
      const skippedJob = {
        ...entry,
        status: 'completed',
        is_duplicate: true,
        _engineCache: canon._engineCache,
        model_used: `Cached SHA-256 Match (${canon.original_filename})`,
        aligned_before_url: canon.aligned_before_url,
        trimmed_sticker_url: canon.trimmed_sticker_url,
        full_res_alpha_url: canon.full_res_alpha_url,
        svg_markup: canon.svg_markup,
        cleanByStyle: { ...canon.cleanByStyle },
        previewByStyle: { ...canon.previewByStyle },
        processing_time: '0.01'
      };
      setJobs((prev) => prev.map((j) => (j.job_id === entry.job_id ? skippedJob : j)));
      return skippedJob;
    }

    const cutoutBlob = await segmentSubjectPermissive(file, (stage, current, total) => {
      const pct = total > 0 ? Math.round((current / total) * 100) : 50;
      setProgressMsg(`${stage} ${idxLabel} ${entry.original_filename} — ${pct}%`);
    });

    const built = await buildSubjectAndActiveBackdrop(
      file,
      cutoutBlob,
      polishIntensity,
      watermarkText,
      backdropStyle
    );

    const elapsedSec = ((performance.now() - t0) / 1000).toFixed(2);
    const completedJob = {
      ...entry,
      status: 'completed',
      _engineCache: built.engineCache,
      aligned_before_url: built.alignedBeforeUrl,
      trimmed_sticker_url: built.trimmedStickerUrl,
      full_res_alpha_url: built.fullResAlphaPngUrl,
      svg_markup: built.svgMarkup,
      cleanByStyle: built.cleanByStyle,
      previewByStyle: built.previewByStyle,
      processing_time: elapsedSec
    };

    seenHashesRef.current.set(sha256, completedJob);
    setJobs((prev) => prev.map((j) => (j.job_id === entry.job_id ? completedJob : j)));
    return completedJob;
  };

  // Priority 1: Responsive Batch Ingestion with Lightweight Thumbnails, Bounded Concurrency & Stable Usable Preview
  const handleFilesSelected = async (fileList) => {
    const rawFiles = Array.from(fileList || []);
    if (rawFiles.length === 0) return;

    const tBatchStart = performance.now();
    batchCancelRef.current = false;
    setIsProcessingBatch(true);

    // 1. Immediate local batch acknowledgement (<5ms) — do NOT overwrite selectedJob yet!
    const batchId = Date.now();
    const initialEntries = rawFiles.map((file, idx) => {
      const origUrl = trackUrl(URL.createObjectURL(file));
      return {
        job_id: `job_${batchId}_${idx}`,
        file,
        original_filename: file.name,
        title: file.name.replace(/\.[^/.]+$/, ''),
        dimensions: 'QUEUED',
        subtitle: 'Queued for background removal & studio environment compositing',
        pack_name: packCategory,
        original_url: origUrl,
        thumb_url: origUrl,
        aligned_before_url: null,
        trimmed_sticker_url: null,
        full_res_alpha_url: null,
        svg_markup: null,
        cleanByStyle: null,
        previewByStyle: null,
        status: 'queued',
        is_showcase: false,
        model_used: 'Permissive MIT ONNX Engine',
        processing_time: null
      };
    });

    setJobs((prev) => [...initialEntries, ...prev]);
    const ingestionLatencyMs = Math.round(performance.now() - tBatchStart);
    setProgressMsg(`Acknowledged ${initialEntries.length} file(s) in ${ingestionLatencyMs}ms — generating thumbnails...`);
    await yieldToMain();

    // 2. Generate lightweight 320px thumbnails & validate headers before heavy ONNX segmentation
    let firstThumbnailMs = null;
    const validQueue = [];
    let failedCount = 0;

    for (let i = 0; i < initialEntries.length; i++) {
      const entry = initialEntries[i];
      try {
        if (!/\.(png|jpe?g|webp|bmp|gif|avif|heic|heif)$/i.test(entry.file.name)) {
          throw new Error('Unsupported file extension.');
        }
        const { thumbUrl, width, height } = await generateLightweightThumbnail(entry.file);
        trackUrl(thumbUrl);
        if (firstThumbnailMs === null) {
          firstThumbnailMs = Math.round(performance.now() - tBatchStart);
        }
        const updatedEntry = {
          ...entry,
          thumb_url: thumbUrl,
          dimensions: `${width}×${height}`
        };
        validQueue.push(updatedEntry);
        setJobs((prev) => prev.map((j) => (j.job_id === entry.job_id ? updatedEntry : j)));
      } catch (thumbErr) {
        failedCount++;
        const failedEntry = {
          ...entry,
          status: 'failed',
          dimensions: 'INVALID',
          error_reason: thumbErr.message || 'Corrupt or unsupported image'
        };
        setJobs((prev) => prev.map((j) => (j.job_id === entry.job_id ? failedEntry : j)));
      }
    }

    // 3. Process valid queue sequentially (bounded concurrency = 1 for WASM ONNX stability)
    let firstCompletedSelected = false;
    let completedCount = 0;

    for (let i = 0; i < validQueue.length; i++) {
      const entry = validQueue[i];
      if (batchCancelRef.current) {
        setJobs((prev) =>
          prev.map((j) =>
            j.job_id === entry.job_id && j.status === 'queued'
              ? { ...j, status: 'cancelled', error_reason: 'Cancelled by user' }
              : j
          )
        );
        continue;
      }

      try {
        const doneJob = await processSingleJobEntry(entry, `(${i + 1}/${validQueue.length})`);
        completedCount++;
        // Only switch selectedJob once the FIRST valid uploaded image is ready!
        if (!firstCompletedSelected && doneJob) {
          firstCompletedSelected = true;
          setSelectedJob(doneJob);
        }
      } catch (err) {
        failedCount++;
        console.error('Batch item processing error:', err);
        setJobs((prev) =>
          prev.map((j) =>
            j.job_id === entry.job_id
              ? { ...j, status: 'failed', error_reason: err.message || 'Processing failed' }
              : j
          )
        );
      }
    }

    const totalProcessingMs = Math.round(performance.now() - tBatchStart);
    const heapMB =
      typeof performance !== 'undefined' && performance.memory
        ? Math.round(performance.memory.usedJSHeapSize / (1024 * 1024))
        : null;

    const metrics = {
      batchSize: rawFiles.length,
      completedCount,
      failedCount,
      ingestionLatencyMs,
      firstThumbnailMs: firstThumbnailMs ?? ingestionLatencyMs,
      totalProcessingMs,
      avgPerImageMs: completedCount > 0 ? Math.round(totalProcessingMs / completedCount) : 0,
      heapMB
    };

    setBatchStats(metrics);
    if (typeof window !== 'undefined') {
      window.__CLEANSNAP_METRICS__ = metrics;
    }

    setProgressMsg('');
    setIsProcessingBatch(false);
  };

  const handleCancelBatch = () => {
    batchCancelRef.current = true;
    setProgressMsg('Cancelling remaining queued images...');
  };

  const handleRetryJob = async (job, e) => {
    if (e) e.stopPropagation();
    if (!job?.file) return;
    setIsProcessingBatch(true);
    try {
      const doneJob = await processSingleJobEntry(job, '(Retry)');
      if (doneJob) setSelectedJob(doneJob);
    } catch (err) {
      setJobs((prev) =>
        prev.map((j) =>
          j.job_id === job.job_id
            ? { ...j, status: 'failed', error_reason: err.message || 'Retry failed' }
            : j
        )
      );
    } finally {
      setProgressMsg('');
      setIsProcessingBatch(false);
    }
  };

  const handleRemoveJob = (job, e) => {
    if (e) e.stopPropagation();
    setJobs((prev) => {
      const next = prev.filter((j) => j.job_id !== job.job_id);
      if (selectedJob?.job_id === job.job_id) {
        const nextReady = next.find((j) => j.status === 'completed');
        setSelectedJob(nextReady || next[0] || null);
      }
      return next;
    });
  };

  const downloadImage = (dataUrl, filename) => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadSingleSvg = (job) => {
    if (!job?.svg_markup) return;
    const base = job.original_filename.replace(/\.[^/.]+$/, '');
    const blob = new Blob([job.svg_markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    downloadImage(url, `${base}_vector_clipped.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const downloadSvgPackZip = async () => {
    const completed = jobs.filter((j) => j.status === 'completed' && j.svg_markup);
    if (completed.length === 0) return;

    const zip = new JSZip();
    const packFolderName = (packCategory || 'CleanSnap_Studio_Pack').replace(/[^a-z0-9_-]/gi, '_');

    completed.forEach((job, idx) => {
      const base = job.original_filename.replace(/\.[^/.]+$/, '');
      zip.file(`${packFolderName}/${base}_${String(idx + 1).padStart(2, '0')}.svg`, job.svg_markup);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    downloadImage(url, `${packFolderName}_${completed.length}_Assets.zip`);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const updateSliderFromPointer = (clientX) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  };

  const handleSliderKeyDown = (e) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSliderPos((p) => Math.max(0, p - step));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSliderPos((p) => Math.min(100, p + step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSliderPos(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSliderPos(100);
    }
  };

  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const uploadedJobsCount = jobs.filter((j) => !j.is_showcase).length;

  const visibleFilmstripJobs = jobs.filter((j) => {
    if (filmstripFilter === 'uploads') return !j.is_showcase;
    if (filmstripFilter === 'samples') return j.is_showcase;
    return true;
  });

  const activePreviewUrl = selectedJob?.previewByStyle?.[backdropStyle] || null;
  const activeCleanDownloadUrl = selectedJob?.cleanByStyle?.[backdropStyle] || null;
  const activeBackdropInfo =
    FIVE_BACKDROP_OPTIONS.find((b) => b.id === backdropStyle) || FIVE_BACKDROP_OPTIONS[0];

  const handleInstallAppClick = async () => {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      await installPromptEvent.userChoice.catch(() => {});
      setInstallPromptEvent(null);
      return;
    }
    setShowInstallModal(true);
  };

  return (
    <div className="app-container">
      {/* ==================== TOP STUDIO HEADER ==================== */}
      <header className="studio-header">
        <div className="brand-lockup">
          <div className="brand-eyebrow">
            <span className="brand-eyebrow-dot" />
            <span>CONTEXT &amp; MUSE · COMMERCIAL ASSET LAB · 100% ON-DEVICE</span>
          </div>
          <h1 className="brand-title">
            <span>CleanSnap</span>
            <span className="brand-title-serif">Studio</span>
          </h1>
          <p className="brand-subtitle">
            Automated Subject Cutout, Edge Refinement, 5 Studio Environments &amp; Vector-Clipped .SVG Export
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <nav className="nav-pill-group" aria-label="Workspace Mode">
            <button
              type="button"
              className={`nav-pill ${activeTab === 'cleaner' ? 'active' : ''}`}
              onClick={() => setActiveTab('cleaner')}
            >
              <span className="nav-pill-index">01</span>
              <Sparkles size={15} />
              <span>Studio Workspace</span>
            </button>
            <button
              type="button"
              className={`nav-pill ${activeTab === 'vault' ? 'active' : ''}`}
              onClick={() => setActiveTab('vault')}
            >
              <span className="nav-pill-index">02</span>
              <Package size={15} />
              <span>Export Vault ({completedJobs.length})</span>
            </button>
          </nav>

          <button
            type="button"
            data-testid="install-app-btn"
            className="btn-gold"
            onClick={handleInstallAppClick}
            style={{ padding: '9px 14px', fontSize: '12.5px' }}
          >
            <Download size={14} />
            <span>Install App (Windows / Android)</span>
          </button>
        </div>
      </header>

      {showInstallModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install CleanSnap Studio"
          style={{
            background: 'var(--surface-panel)',
            border: '1px solid var(--border-gold)',
            borderRadius: 'var(--radius-xl)',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.75)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div>
              <span className="card-step-label">100% OFFLINE-READY NATIVE APP</span>
              <h2 className="card-title">Install CleanSnap Studio on Windows or Android ($0)</h2>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowInstallModal(false)}
              style={{ padding: '6px 12px' }}
            >
              Close
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '12px',
              fontSize: '12.5px',
              color: 'var(--text-secondary)'
            }}
          >
            <div className="workflow-section">
              <strong style={{ color: 'var(--text-primary)' }}>1. Direct Desktop / Android Install</strong>
              <span>
                In Chrome or Microsoft Edge, click the <strong>Install App</strong> icon in the address bar (or browser menu → <em>Install CleanSnap Studio</em>) to add it to your Windows Start Menu or Android Home Screen with full offline support.
              </span>
            </div>
            <div className="workflow-section">
              <strong style={{ color: 'var(--gold)' }}>2. Microsoft Store (.MSIX) &amp; Android (.APK)</strong>
              <span>
                This site includes a store-certified <code>/manifest.webmanifest</code> and offline Service Worker (<code>/sw.js</code>). Paste <code>https://bold-oppenheimer.vercel.app</code> into <strong>PWABuilder.com</strong> to download your signed Windows <code>.msix</code> and Android <code>.apk</code> packages for $0.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 1: STUDIO WORKSPACE ==================== */}
      {activeTab === 'cleaner' && (
        <>
          {/* Contact Sheet Filmstrip */}
          <section className="filmstrip-panel" aria-label="Asset Contact Sheet">
            <div className="filmstrip-header">
              <div className="filmstrip-title-row">
                <span className="filmstrip-tag">CONTACT SHEET ({visibleFilmstripJobs.length})</span>
                <h2 className="filmstrip-title">
                  Select an Asset to Compare Environments or Refine Cutout Edges
                </h2>
              </div>
              <div className="filmstrip-controls">
                <button
                  type="button"
                  className={`filter-chip ${filmstripFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setFilmstripFilter('all')}
                >
                  All ({jobs.length})
                </button>
                <button
                  type="button"
                  className={`filter-chip ${filmstripFilter === 'uploads' ? 'active' : ''}`}
                  onClick={() => setFilmstripFilter('uploads')}
                >
                  Uploaded ({uploadedJobsCount})
                </button>
                <button
                  type="button"
                  className={`filter-chip ${filmstripFilter === 'samples' ? 'active' : ''}`}
                  onClick={() => setFilmstripFilter('samples')}
                >
                  Studio Samples ({EDR_SHOWCASE_SAMPLES.length})
                </button>
              </div>
            </div>

            <div className="filmstrip-grid">
              {visibleFilmstripJobs.map((job, idx) => {
                const isSelected = selectedJob?.job_id === job.job_id;
                const thumbSrc =
                  job.cleanByStyle?.[backdropStyle] ||
                  job.cleanByStyle?.corkboard ||
                  job.thumb_url ||
                  job.original_url;
                return (
                  <div
                    key={job.job_id}
                    data-testid={`contact-card-${job.job_id}`}
                    onClick={() => {
                      if (job.status === 'completed') {
                        setSelectedJob(job);
                      }
                    }}
                    className={`contact-card ${isSelected ? 'selected' : ''} status-${job.status}`}
                  >
                    <div className="contact-thumb-wrap">
                      <img
                        src={thumbSrc}
                        alt={job.title || job.original_filename}
                        loading="lazy"
                      />
                      <span className="contact-badge">{job.dimensions || `0${idx + 1}`}</span>
                      <span className={`contact-status-pill ${job.status}`}>
                        {job.status === 'completed'
                          ? job.processing_time
                            ? `${job.processing_time}s`
                            : 'READY'
                          : job.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="contact-meta">
                      <span className="contact-name" title={job.original_filename}>
                        {job.title || job.original_filename}
                      </span>
                      <span className="contact-index">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                    </div>
                    {(job.status === 'failed' || job.status === 'cancelled') && (
                      <div className="contact-error-bar">
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {job.error_reason || 'Failed'}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                            onClick={(e) => handleRetryJob(job, e)}
                            title="Retry Processing"
                          >
                            <RefreshCw size={10} /> Retry
                          </button>
                          <button
                            type="button"
                            className="btn-danger"
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                            onClick={(e) => handleRemoveJob(job, e)}
                            title="Remove Item"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid-layout">
            {/* ==================== LEFT COLUMN: SIMPLIFIED 4-STEP WORKFLOW SIDEBAR ==================== */}
            <aside className="card" aria-label="4-Step Workflow Controls">
              <div className="card-header">
                <div className="card-title-group">
                  <span className="card-step-label">GUIDED WORKFLOW</span>
                  <h2 className="card-title">Clean, Refine &amp; Export</h2>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                data-testid="file-upload-input"
                style={{ display: 'none' }}
                onChange={(e) => {
                  handleFilesSelected(e.target.files);
                  e.target.value = '';
                }}
              />
              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory="true"
                directory="true"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  handleFilesSelected(e.target.files);
                  e.target.value = '';
                }}
              />

              {/* STEP 1: ADD IMAGES */}
              <div className="workflow-section">
                <div className="workflow-section-header">
                  <h3 className="workflow-step-title">
                    <span className="workflow-step-num">1</span>
                    <span>Add Images</span>
                  </h3>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn-gold"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessingBatch}
                      style={{ padding: '6px 11px', fontSize: '12px' }}
                    >
                      <Upload size={13} /> Add Photos
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => folderInputRef.current?.click()}
                      disabled={isProcessingBatch}
                      style={{ padding: '6px 10px', fontSize: '12px' }}
                    >
                      <Folder size={13} /> Folder
                    </button>
                  </div>
                </div>

                <div
                  className="studio-dropzone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.length) {
                      handleFilesSelected(e.dataTransfer.files);
                    }
                  }}
                  onClick={() => !isProcessingBatch && fileInputRef.current?.click()}
                >
                  <div className="dropzone-icon-ring">
                    <Sparkles size={18} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                    {isProcessingBatch
                      ? progressMsg || 'Processing Batch...'
                      : 'Drop Photos Here or Click to Browse'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Supports single or batch uploads (.PNG, .JPG, .WEBP) with instant thumbnails
                  </div>
                </div>

                {isProcessingBatch && (
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={handleCancelBatch}
                    style={{ width: '100%', padding: '7px 12px', fontSize: '12px' }}
                  >
                    <XCircle size={14} /> Cancel Remaining Batch
                  </button>
                )}

                {batchStats && (
                  <div
                    data-testid="batch-telemetry-bar"
                    className="mono-num"
                    style={{
                      fontSize: '11px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.28)',
                      color: '#a7f3d0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '6px'
                    }}
                  >
                    <span>
                      Batch: {batchStats.completedCount}/{batchStats.batchSize} ready
                      {batchStats.failedCount > 0 ? ` (${batchStats.failedCount} failed)` : ''}
                    </span>
                    <span>
                      Ack: {batchStats.ingestionLatencyMs}ms · 1st Thumb: {batchStats.firstThumbnailMs}ms · Avg: {batchStats.avgPerImageMs}ms
                    </span>
                  </div>
                )}
              </div>

              {/* STEP 2: CHOOSE BACKGROUND */}
              <div className="workflow-section">
                <div className="workflow-section-header">
                  <h3 className="workflow-step-title">
                    <span className="workflow-step-num">2</span>
                    <span>Choose Background</span>
                  </h3>
                  <span className="mono-num" style={{ fontSize: '11px', color: 'var(--gold)' }}>
                    {activeBackdropInfo.index} / 05
                  </span>
                </div>
                <div className="form-group">
                  <label htmlFor="backdrop-select">Active Studio Environment</label>
                  <select
                    id="backdrop-select"
                    value={backdropStyle}
                    onChange={(e) => setBackdropStyle(e.target.value)}
                  >
                    {FIVE_BACKDROP_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.index} — {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="workflow-step-desc">{activeBackdropInfo.description}</p>
              </div>

              {/* STEP 3: REFINE EDGES */}
              <div className="workflow-section">
                <div className="workflow-section-header">
                  <h3 className="workflow-step-title">
                    <span className="workflow-step-num">3</span>
                    <span>Refine Edges</span>
                  </h3>
                  <button
                    type="button"
                    data-testid="toggle-refine-mode-btn"
                    className={stageMode === 'refine' ? 'btn-gold' : 'btn-secondary'}
                    onClick={() => setStageMode((m) => (m === 'refine' ? 'compare' : 'refine'))}
                    style={{ padding: '6px 11px', fontSize: '12px' }}
                  >
                    <Brush size={13} />
                    {stageMode === 'refine' ? 'Return to Split View' : 'Open Edge Refiner'}
                  </button>
                </div>
                <p className="workflow-step-desc">
                  Touch up fine hair, clothing boundaries, or missed corners with Add/Remove brushes, edge feathering, and foreground color decontamination.
                </p>
              </div>

              {/* STEP 4: EXPORT */}
              <div className="workflow-section">
                <div className="workflow-section-header">
                  <h3 className="workflow-step-title">
                    <span className="workflow-step-num">4</span>
                    <span>Export</span>
                  </h3>
                  <span className="mono-num" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    WATERMARK-FREE
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-gold"
                    disabled={!selectedJob || !activeCleanDownloadUrl}
                    onClick={() => {
                      const base = selectedJob.original_filename.replace(/\.[^/.]+$/, '');
                      const ext = backdropStyle === 'transparent' ? 'png' : 'jpg';
                      downloadImage(activeCleanDownloadUrl, `${base}_${backdropStyle}.${ext}`);
                    }}
                  >
                    <Download size={14} />
                    Download {activeBackdropInfo.shortLabel} ({backdropStyle === 'transparent' ? '.PNG' : '.JPG'})
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={!selectedJob}
                    onClick={() => {
                      const base = selectedJob.original_filename.replace(/\.[^/.]+$/, '');
                      const pngUrl =
                        selectedJob.full_res_alpha_url ||
                        selectedJob.cleanByStyle?.transparent ||
                        selectedJob.trimmed_sticker_url;
                      downloadImage(pngUrl, `${base}_alpha_cutout.png`);
                    }}
                  >
                    <ImageIcon size={14} />
                    Download Transparent Cutout (.PNG — Full Res)
                  </button>

                  <button
                    type="button"
                    className="btn-accent"
                    disabled={!selectedJob?.svg_markup}
                    onClick={() => downloadSingleSvg(selectedJob)}
                  >
                    <FileCode size={14} />
                    Download Vector-Clipped Cutout (.SVG)
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={completedJobs.length === 0}
                    onClick={downloadSvgPackZip}
                  >
                    <Archive size={14} />
                    Export Batch Archive ({completedJobs.length} .SVG in .ZIP)
                  </button>
                </div>
              </div>

              {/* COLLAPSIBLE ADVANCED SETTINGS */}
              <details className="advanced-details">
                <summary className="advanced-summary">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                    <Sliders size={13} style={{ color: 'var(--gold)' }} />
                    <span>Advanced Settings (Polish, Watermark &amp; Archive Naming)</span>
                  </span>
                  <ChevronDown size={14} />
                </summary>
                <div className="advanced-body">
                  <div className="form-group">
                    <label htmlFor="polish-select">Subject Surface Polish</label>
                    <select
                      id="polish-select"
                      value={polishIntensity}
                      onChange={(e) => setPolishIntensity(e.target.value)}
                    >
                      <option value="high">Studio Polish (Shadow Lift + Warmth + Crisp Detail)</option>
                      <option value="medium">Balanced Natural (Subtle Shadow Recovery)</option>
                      <option value="off">Off (Unmodified Original Subject Colors)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="watermark-input">Preview Watermark Text (Preview Only)</label>
                    <input
                      id="watermark-input"
                      type="text"
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      placeholder="EDR PARTY RENTALS • PREVIEW ONLY"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="pack-input">Batch .ZIP Folder Name</label>
                    <input
                      id="pack-input"
                      type="text"
                      value={packCategory}
                      onChange={(e) => setPackCategory(e.target.value)}
                      placeholder="CleanSnap_Studio_SVG_Pack"
                    />
                  </div>
                </div>
              </details>
            </aside>

            {/* ==================== RIGHT COLUMN: 5-ENVIRONMENT STAGE & EDGE REFINER ==================== */}
            <main className="card" aria-label="Inspection and Refinement Stage">
              <div className="card-header">
                <div className="card-title-group">
                  <span className="card-step-label">
                    {stageMode === 'refine'
                      ? 'MANUAL EDGE REFINEMENT WORKSPACE'
                      : `ENVIRONMENT COMPOSITOR (${activeBackdropInfo.index} / 05)`}
                  </span>
                  <h2 className="card-title">
                    {selectedJob?.title || 'Select an Asset'} —{' '}
                    <span style={{ color: 'var(--gold)' }}>
                      {stageMode === 'refine' ? 'Refine Cutout Mask' : activeBackdropInfo.label}
                    </span>
                  </h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div className="nav-pill-group" role="tablist" aria-label="Stage View Mode">
                    <button
                      type="button"
                      className={`nav-pill ${stageMode === 'compare' ? 'active' : ''}`}
                      onClick={() => setStageMode('compare')}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Before / After Split
                    </button>
                    <button
                      type="button"
                      className={`nav-pill ${stageMode === 'refine' ? 'active' : ''}`}
                      onClick={() => setStageMode('refine')}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      <Brush size={13} /> Refine Edges
                    </button>
                  </div>
                </div>
              </div>

              {/* 5 Tactile Material Swatch Buttons */}
              <div className="backdrop-swatch-bar" role="radiogroup" aria-label="5 Studio Backdrops">
                {FIVE_BACKDROP_OPTIONS.map((opt) => {
                  const active = backdropStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      data-testid={`swatch-${opt.id}`}
                      onClick={() => setBackdropStyle(opt.id)}
                      className={`backdrop-swatch-btn ${active ? 'active' : ''}`}
                    >
                      <div className="swatch-top-row">
                        <span className="swatch-dot" style={{ background: opt.swatchBg }} />
                        <span className="swatch-index">{opt.index}</span>
                      </div>
                      <span className="swatch-name">{opt.shortLabel}</span>
                    </button>
                  );
                })}
              </div>

              {/* MODE A: MANUAL EDGE REFINEMENT WORKSPACE */}
              {stageMode === 'refine' && selectedJob?._engineCache ? (
                <div className="refiner-workspace" data-testid="edge-refiner-workspace">
                  <div className="refiner-toolbar">
                    <div className="refiner-tool-group" role="group" aria-label="Brush Tools">
                      <button
                        type="button"
                        data-testid="brush-add-btn"
                        className={brushMode === 'add' ? 'btn-gold' : 'btn-secondary'}
                        onClick={() => setBrushMode('add')}
                      >
                        <Brush size={13} /> Add to Subject (+)
                      </button>
                      <button
                        type="button"
                        data-testid="brush-erase-btn"
                        className={brushMode === 'erase' ? 'btn-gold' : 'btn-secondary'}
                        onClick={() => setBrushMode('erase')}
                      >
                        <Eraser size={13} /> Remove Background (−)
                      </button>
                      <button
                        type="button"
                        className={brushMode === 'pan' ? 'btn-gold' : 'btn-secondary'}
                        onClick={() => setBrushMode('pan')}
                      >
                        <Hand size={13} /> Pan
                      </button>
                    </div>

                    <div className="refiner-tool-group" role="group" aria-label="History and Zoom">
                      <button
                        type="button"
                        data-testid="mask-undo-btn"
                        className="btn-secondary"
                        onClick={handleUndoMask}
                        disabled={!maskHistoryInfo.canUndo}
                        title="Undo Brush Stroke"
                      >
                        <Undo2 size={13} /> Undo
                      </button>
                      <button
                        type="button"
                        data-testid="mask-redo-btn"
                        className="btn-secondary"
                        onClick={handleRedoMask}
                        disabled={!maskHistoryInfo.canRedo}
                        title="Redo Brush Stroke"
                      >
                        <Redo2 size={13} /> Redo
                      </button>
                      <button
                        type="button"
                        data-testid="mask-reset-btn"
                        className="btn-secondary"
                        onClick={handleResetMaskToAuto}
                        title="Reset to Automatic Cutout Mask"
                      >
                        <RotateCcw size={13} /> Reset to Auto
                      </button>

                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setRefinerZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                        title="Zoom Out"
                      >
                        <ZoomOut size={13} />
                      </button>
                      <span className="mono-num" style={{ fontSize: '11.5px', minWidth: '44px', textAlign: 'center' }}>
                        {Math.round(refinerZoom * 100)}%
                      </span>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setRefinerZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                        title="Zoom In"
                      >
                        <ZoomIn size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setRefinerZoom(1);
                          setRefinerPan({ x: 0, y: 0 });
                        }}
                      >
                        <Maximize2 size={12} /> Fit
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setRefinerZoom(2);
                          setRefinerPan({ x: 0, y: 0 });
                        }}
                      >
                        100%
                      </button>
                    </div>
                  </div>

                  {/* Preview Backdrop Selector inside Edge Refiner */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginRight: '4px' }}>
                        Inspection Backdrop:
                      </span>
                      {[
                        { id: 'checkerboard', label: 'Checkerboard' },
                        { id: 'mask', label: 'Before/After Mask Overlay' },
                        { id: 'dark', label: 'Solid Dark' },
                        { id: 'light', label: 'Solid Light' }
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`filter-chip ${refinerBgMode === m.id ? 'active' : ''}`}
                          onClick={() => setRefinerBgMode(m.id)}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    className={`refiner-stage-viewport bg-${refinerBgMode}`}
                    onPointerDown={handleRefinerPointerDown}
                    onPointerMove={handleRefinerPointerMove}
                    onPointerUp={handleRefinerPointerUp}
                    onPointerCancel={handleRefinerPointerUp}
                    style={{
                      cursor: brushMode === 'pan' ? 'grab' : 'crosshair'
                    }}
                  >
                    <canvas
                      ref={refinerCanvasRef}
                      data-testid="refiner-canvas"
                      className="refiner-canvas"
                      style={{
                        transform: `translate(${refinerPan.x}px, ${refinerPan.y}px) scale(${refinerZoom})`
                      }}
                    />
                  </div>

                  <div className="refiner-controls-grid">
                    <div className="refiner-slider-box">
                      <label htmlFor="brush-size-range">
                        <span>Brush Size</span>
                        <span className="val">{brushSize}px</span>
                      </label>
                      <input
                        id="brush-size-range"
                        type="range"
                        min="4"
                        max="120"
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                      />
                    </div>

                    <div className="refiner-slider-box">
                      <label htmlFor="brush-hardness-range">
                        <span>Brush Hardness</span>
                        <span className="val">{brushHardness}%</span>
                      </label>
                      <input
                        id="brush-hardness-range"
                        type="range"
                        min="10"
                        max="100"
                        value={brushHardness}
                        onChange={(e) => setBrushHardness(Number(e.target.value))}
                      />
                    </div>

                    <div className="refiner-slider-box">
                      <label htmlFor="edge-expand-range">
                        <span>Mask Expand / Contract</span>
                        <span className="val">{edgeExpandPx > 0 ? `+${edgeExpandPx}` : edgeExpandPx}px</span>
                      </label>
                      <input
                        id="edge-expand-range"
                        type="range"
                        min="-10"
                        max="10"
                        step="1"
                        value={edgeExpandPx}
                        onChange={(e) => setEdgeExpandPx(Number(e.target.value))}
                      />
                    </div>

                    <div className="refiner-slider-box">
                      <label htmlFor="edge-feather-range">
                        <span>Edge Feathering</span>
                        <span className="val">{edgeFeatherPx}px</span>
                      </label>
                      <input
                        id="edge-feather-range"
                        type="range"
                        min="0"
                        max="10"
                        step="1"
                        value={edgeFeatherPx}
                        onChange={(e) => setEdgeFeatherPx(Number(e.target.value))}
                      />
                    </div>

                    <div className="refiner-slider-box">
                      <label htmlFor="edge-decontam-range">
                        <span>Color Decontamination</span>
                        <span className="val">{edgeDecontam ? `${edgeDecontamStrength}%` : 'OFF'}</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={edgeDecontam}
                          onChange={(e) => setEdgeDecontam(e.target.checked)}
                          aria-label="Enable Edge Color Decontamination"
                        />
                        <input
                          id="edge-decontam-range"
                          type="range"
                          min="0"
                          max="100"
                          disabled={!edgeDecontam}
                          value={edgeDecontamStrength}
                          onChange={(e) => setEdgeDecontamStrength(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setStageMode('compare')}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      data-testid="apply-refinement-btn"
                      className="btn-gold"
                      onClick={applyRefinementToActiveJob}
                    >
                      <CheckCircle2 size={14} /> Apply Edge Refinement to Scene
                    </button>
                  </div>
                </div>
              ) : selectedJob && activePreviewUrl ? (
                /* MODE B: BEFORE / AFTER SPLIT COMPARISON STAGE */
                <>
                  <div className="slider-stage-frame">
                    <div
                      className="slider-container"
                      ref={sliderRef}
                      data-testid="before-after-slider"
                      role="slider"
                      tabIndex={0}
                      aria-label="Before and After Comparison Split Slider"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(sliderPos)}
                      onKeyDown={handleSliderKeyDown}
                      onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture(e.pointerId);
                        updateSliderFromPointer(e.clientX);
                      }}
                      onPointerMove={(e) => {
                        if (e.buttons === 1) {
                          updateSliderFromPointer(e.clientX);
                        }
                      }}
                      onPointerUp={(e) => {
                        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                          e.currentTarget.releasePointerCapture(e.pointerId);
                        }
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      {/* AFTER Layer */}
                      <img
                        src={activePreviewUrl}
                        alt={`AFTER: ${activeBackdropInfo.label}`}
                        className="slider-img"
                        draggable={false}
                      />

                      {/* BEFORE Layer: Identical 1448x1086 4:3 coordinate space clipped at sliderPos% */}
                      <img
                        src={selectedJob.aligned_before_url || selectedJob.original_url}
                        alt="BEFORE: Original Source"
                        className="slider-img"
                        draggable={false}
                        style={{
                          clipPath: `inset(0 ${100 - sliderPos}% 0 0)`
                        }}
                      />

                      <span className="stage-pill before">ORIGINAL SOURCE</span>
                      <span className="stage-pill after">
                        {activeBackdropInfo.index} · {activeBackdropInfo.shortLabel}
                      </span>

                      <div
                        className="slider-handle"
                        style={{ left: `${sliderPos}%`, zIndex: 10, pointerEvents: 'none' }}
                      >
                        <div className="slider-handle-circle">↔</div>
                      </div>
                    </div>
                  </div>

                  {/* Precision Scrubber Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '2px 4px' }}>
                    <span className="mono-num" style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '88px' }}>
                      ORIGINAL ({Math.round(sliderPos)}%)
                    </span>
                    <input
                      type="range"
                      aria-label="Comparison split percentage"
                      min="0"
                      max="100"
                      step="0.5"
                      value={sliderPos}
                      onChange={(e) => setSliderPos(Number(e.target.value))}
                      style={{ flex: 1, cursor: 'pointer' }}
                    />
                    <span className="mono-num" style={{ fontSize: '11px', color: 'var(--gold)', minWidth: '100px', textAlign: 'right' }}>
                      {activeBackdropInfo.shortLabel.toUpperCase()}
                    </span>
                  </div>

                  {/* Quick Export Action Bar */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
                    <button
                      type="button"
                      className="btn-gold"
                      style={{ flex: 1.4 }}
                      onClick={() => {
                        const base = selectedJob.original_filename.replace(/\.[^/.]+$/, '');
                        const ext = backdropStyle === 'transparent' ? 'png' : 'jpg';
                        downloadImage(activeCleanDownloadUrl, `${base}_${backdropStyle}_master.${ext}`);
                      }}
                    >
                      <Download size={15} /> Download {activeBackdropInfo.shortLabel} ({backdropStyle === 'transparent' ? '.PNG' : '.JPG'})
                    </button>
                    <button
                      type="button"
                      className="btn-accent"
                      style={{ flex: 1 }}
                      onClick={() => downloadSingleSvg(selectedJob)}
                      disabled={!selectedJob.svg_markup}
                    >
                      <FileCode size={15} /> Vector-Clipped .SVG
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => setStageMode('refine')}
                    >
                      <Brush size={15} /> Refine Edges
                    </button>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    height: '380px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    color: 'var(--text-secondary)',
                    background: 'rgba(7, 8, 12, 0.5)',
                    borderRadius: '12px',
                    border: '1px dashed var(--border-subtle)',
                    padding: '24px',
                    textAlign: 'center'
                  }}
                >
                  <ImageIcon size={36} style={{ color: 'var(--gold)' }} />
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Select a Completed Asset Above or Add Photos on the Left
                  </div>
                </div>
              )}
            </main>
          </div>
        </>
      )}

      {/* ==================== TAB 2: EXPORT VAULT ==================== */}
      {activeTab === 'vault' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <span className="card-step-label">READY FOR EXPORT</span>
              <h2 className="card-title">
                Processed Cutout &amp; Vector-Clipped .SVG Vault — "{packCategory}" ({completedJobs.length} Assets)
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-gold"
                onClick={downloadSvgPackZip}
                disabled={completedJobs.length === 0}
              >
                <FileCode size={15} /> Export Batch Archive (.ZIP)
              </button>
            </div>
          </div>

          {completedJobs.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '16px',
                marginTop: '6px'
              }}
            >
              {completedJobs.map((job, idx) => (
                <div
                  key={job.job_id}
                  style={{
                    background: 'rgba(10, 12, 18, 0.78)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      aspectRatio: '4 / 3',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      background: '#050609'
                    }}
                  >
                    <img
                      src={job.previewByStyle?.[backdropStyle] || job.trimmed_sticker_url}
                      alt={job.original_filename}
                      draggable={false}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <span className="contact-badge">{String(idx + 1).padStart(2, '0')}</span>
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {job.title || job.original_filename}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ flex: 1, padding: '8px 10px', fontSize: '12px' }}
                      onClick={() => {
                        const base = job.original_filename.replace(/\.[^/.]+$/, '');
                        downloadImage(job.full_res_alpha_url || job.trimmed_sticker_url, `${base}_alpha.png`);
                      }}
                    >
                      <Download size={13} /> Alpha .PNG
                    </button>
                    <button
                      type="button"
                      className="btn-gold"
                      style={{ flex: 1, padding: '8px 10px', fontSize: '12px' }}
                      onClick={() => downloadSingleSvg(job)}
                    >
                      <FileCode size={13} /> Cutline .SVG
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No completed assets yet. Add photos in the Studio Workspace to generate cutouts.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
