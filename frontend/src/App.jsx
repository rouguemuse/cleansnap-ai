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
import {
  COMMERCIAL_CONFIG,
  loadPersistedEntitlementState,
  loadTrialExportState,
  recordTrialExport,
  evaluateExportEntitlement,
  queryMicrosoftStoreBridgeEntitlement
} from './lib/entitlementEngine';
import {
  WELCOME_CONFIG,
  RICH_CONTROL_GUIDES,
  TECHNIQUE_LIBRARY,
  resolveContextualStatusBar,
  loadInstructionalState,
  saveInstructionalState,
  resetInstructionalProgress,
  resolveHintForEvent
} from './lib/instructionalEngine';
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

// Server-Gated Premium Industry Backdrop Packs (Delivered only by /api/pro-assets after HMAC Stripe verification)
const PREMIUM_BACKDROP_OPTIONS = [
  {
    id: 'rental_twilight_patio',
    index: '06',
    packId: 'pack_rental',
    packName: 'Event & Party Rental Pack ($9)',
    label: 'Twilight String-Lit Patio Turf',
    shortLabel: 'Twilight Patio',
    swatchBg: 'linear-gradient(135deg, #1c2541 0%, #2d6a4f 100%)',
    description: 'Warm bistro string lights over manicured evening event turf (Server-Gated Event Pack)'
  },
  {
    id: 'rental_event_pavilion',
    index: '07',
    packId: 'pack_rental',
    packName: 'Event & Party Rental Pack ($9)',
    label: 'Grand Hardwood Event Pavilion',
    shortLabel: 'Event Pavilion',
    swatchBg: 'linear-gradient(135deg, #f8fafc 0%, #b45309 100%)',
    description: 'Clean architectural reception hall with warm oak event flooring (Server-Gated Event Pack)'
  },
  {
    id: 'auto_obsidian_cyclorama',
    index: '08',
    packId: 'pack_auto',
    packName: 'Auto & Dealership Showroom Pack ($9)',
    label: 'Wet Obsidian Studio Cyclorama',
    shortLabel: 'Obsidian Auto',
    swatchBg: 'linear-gradient(135deg, #27272a 0%, #050609 100%)',
    description: 'Dark dealership reflection floor with overhead gold softbox strip (Server-Gated Auto Pack)'
  },
  {
    id: 'auto_led_bay',
    index: '09',
    packId: 'pack_auto',
    packName: 'Auto & Dealership Showroom Pack ($9)',
    label: 'Architectural LED Dealership Bay',
    shortLabel: 'LED Showroom',
    swatchBg: 'linear-gradient(135deg, #090d16 0%, #38bdf8 100%)',
    description: 'Modern luxury detailing bay with cyan & daylight LED light bars (Server-Gated Auto Pack)'
  },
  {
    id: 'ecom_travertine_podium',
    index: '10',
    packId: 'pack_ecom',
    packName: 'E-Commerce & Apparel Editorial Pack ($9)',
    label: 'Warm Travertine Limestone Studio',
    shortLabel: 'Travertine',
    swatchBg: 'linear-gradient(135deg, #f5f0e6 0%, #bca98e 100%)',
    description: 'Minimalist Mediterranean limestone studio for apparel & luxury goods (Server-Gated E-Com Pack)'
  },
  {
    id: 'ecom_brushed_linen',
    index: '11',
    packId: 'pack_ecom',
    packName: 'E-Commerce & Apparel Editorial Pack ($9)',
    label: 'Editorial Sand Linen Backdrop',
    shortLabel: 'Sand Linen',
    swatchBg: 'linear-gradient(135deg, #faf8f5 0%, #d6cbb9 100%)',
    description: 'Soft editorial sand linen gallery backdrop with natural studio falloff (Server-Gated E-Com Pack)'
  }
];

const ALL_BACKDROP_OPTIONS = [...FIVE_BACKDROP_OPTIONS, ...PREMIUM_BACKDROP_OPTIONS];
const SERVER_GATED_STYLE_MAP = new Map(PREMIUM_BACKDROP_OPTIONS.map((o) => [o.id, o]));

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
  } else if (SERVER_GATED_STYLE_MAP.has(styleId)) {
    // Cryptographically Server-Gated Premium Backdrop Pack (/api/pro-assets)
    let token = '';
    try {
      token = localStorage.getItem('cleansnap_pro_token') || '';
    } catch {
      token = '';
    }
    const resp = await fetch(
      `/api/pro-assets?style=${encodeURIComponent(styleId)}&token=${encodeURIComponent(token)}`
    );
    if (!resp.ok) {
      throw new Error('LOCKED_PREMIUM_PACK');
    }
    const assetData = await resp.json();
    const bgImg = await loadImageSafe(assetData.svgDataUrl);
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, sceneW, sceneH);
    }
    ctx.save();
    ctx.shadowColor = assetData.shadowColor || 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = assetData.shadowBlur || 28;
    ctx.shadowOffsetY = assetData.shadowOffsetY || 14;
    ctx.drawImage(subjectCanvas, tightBbox.x, tightBbox.y, tightBbox.w, tightBbox.h, drawX, drawY, drawW, drawH);
    ctx.restore();
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
  watermarkText = '',
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
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'studio' || params.get('stripe_session')) return 'cleaner';
      if (params.get('view') === 'landing') return 'landing';
      const isInstalledStandaloneApp =
        window.matchMedia?.('(display-mode: standalone)')?.matches ||
        window.matchMedia?.('(display-mode: window-controls-overlay)')?.matches ||
        window.navigator?.standalone === true ||
        /MSAppHost|PWABuilder/i.test(window.navigator?.userAgent || '');
      if (isInstalledStandaloneApp) return 'cleaner';
    } catch {
      // ignore
    }
    return 'landing'; // 'landing' | 'cleaner' | 'vault'
  });
  const [stageMode, setStageMode] = useState('compare'); // 'compare' | 'refine'
  const [filmstripFilter, setFilmstripFilter] = useState('all'); // 'all' | 'uploads' | 'samples'
  const [isAutoSweepHero, setIsAutoSweepHero] = useState(true);
  const [portalTransition, setPortalTransition] = useState({
    active: false,
    subjectTitle: '',
    backdropLabel: '',
    modeLabel: ''
  });
  const heroSliderRef = useRef(null);

  const [backdropStyle, setBackdropStyle] = useState('corkboard');
  const [polishIntensity, setPolishIntensity] = useState('high');
  // Defect Fix: Default watermarkText to empty string so previews and exported files match 1:1 without stock preview watermarks
  const [watermarkText, setWatermarkText] = useState('');

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

  // Centralized Cryptographic Entitlement & Configurable Trial Allowance State
  const initialEntitlement = loadPersistedEntitlementState();
  const [proLicenseKey, setProLicenseKey] = useState(initialEntitlement.licenseKey);
  const [unlockedPacks, setUnlockedPacks] = useState(initialEntitlement.entitlements);
  const [isProUnlocked, setIsProUnlocked] = useState(initialEntitlement.isProValid);
  const [trialState, setTrialState] = useState(() => loadTrialExportState());
  const [upgradeDialogBanner, setUpgradeDialogBanner] = useState(null);

  // 5-Layer Intelligent Instructional & Feature Discovery State
  const [instructionalState, setInstructionalState] = useState(() => loadInstructionalState());
  const [showWelcomeModal, setShowWelcomeModal] = useState(() => {
    const st = loadInstructionalState();
    return !st.welcomeCompleted;
  });
  const [activeHintKey, setActiveHintKey] = useState(null);
  const [hoveredControlKey, setHoveredControlKey] = useState(null);
  const [selectedGuideControlKey, setSelectedGuideControlKey] = useState('color_decontam');
  const [showTechniqueModal, setShowTechniqueModal] = useState(false);

  const [showProModal, setShowProModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [proModalTab, setProModalTab] = useState('packs'); // 'packs' | 'b2b'
  const [proInputVal, setProInputVal] = useState('');
  const [proStatusMsg, setProStatusMsg] = useState('');
  const [isCheckingOutStripe, setIsCheckingOutStripe] = useState(false);

  // B2B 100-500 Photo Folder Intake State
  const [b2bForm, setB2bForm] = useState({
    businessName: '',
    contactEmail: '',
    folderUrl: '',
    watermarkText: '',
    backdropPack: 'All Studio Backdrops + Alpha .PNG + Vector .SVG',
    photoCountEstimate: '100-200 Photos',
    notes: ''
  });
  const [b2bOrderReceipt, setB2bOrderReceipt] = useState(null);

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

  const triggerInstructionalEvent = useCallback((eventKey, markCompleted = false) => {
    setInstructionalState((prev) => {
      const next = {
        ...prev,
        lastEvent: eventKey,
        seenHints: { ...prev.seenHints, [eventKey]: true },
        completedActions: markCompleted
          ? { ...prev.completedActions, [eventKey]: true }
          : prev.completedActions
      };
      saveInstructionalState(next);
      const hint = resolveHintForEvent(eventKey, next);
      if (hint && !isDrawingRef.current) {
        setActiveHintKey(eventKey);
      }
      return next;
    });
  }, []);

  const dismissContextualHint = useCallback((hintKey, permanent = true) => {
    setActiveHintKey(null);
    if (!hintKey) return;
    setInstructionalState((prev) => {
      const next = {
        ...prev,
        seenHints: { ...prev.seenHints, [hintKey]: true },
        dismissedHints: permanent
          ? { ...prev.dismissedHints, [hintKey]: true }
          : prev.dismissedHints
      };
      return saveInstructionalState(next);
    });
  }, []);

  const completeWelcomeOnboarding = useCallback(() => {
    setShowWelcomeModal(false);
    setInstructionalState((prev) =>
      saveInstructionalState({
        ...prev,
        welcomeCompleted: true
      })
    );
  }, []);

  const toggleGuideMode = useCallback(() => {
    setInstructionalState((prev) =>
      saveInstructionalState({
        ...prev,
        guideModeEnabled: !prev.guideModeEnabled
      })
    );
  }, []);

  const toggleAutoHints = useCallback(() => {
    setInstructionalState((prev) => {
      const nextEnabled = !prev.autoHintsEnabled;
      if (!nextEnabled) setActiveHintKey(null);
      return saveInstructionalState({
        ...prev,
        autoHintsEnabled: nextEnabled
      });
    });
  }, []);

  const handleResetInstructionalProgress = useCallback(() => {
    const fresh = resetInstructionalProgress();
    setInstructionalState(fresh);
    setActiveHintKey('after_first_transform');
    setShowWelcomeModal(true);
  }, []);

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

    // Query Microsoft Store / Windows PWA Digital Goods Bridge if running in Store Host
    queryMicrosoftStoreBridgeEntitlement().then((storeRes) => {
      if (storeRes.entitled) {
        const storeKey = 'CSPRO-MUSE-VIP-2026';
        const ents = ['all', 'pack_rental', 'pack_auto', 'pack_ecom'];
        try {
          localStorage.setItem('cleansnap_pro_license', storeKey);
          localStorage.setItem('cleansnap_pro_entitlements', JSON.stringify(ents));
        } catch {
          // ignore
        }
        setProLicenseKey(storeKey);
        setUnlockedPacks(ents);
        setIsProUnlocked(true);
      }
    });

    // Auto-verify Stripe Checkout redirect (?stripe_session=cs_...) or canceled purchase
    const params = new URLSearchParams(window.location.search);
    const stripeSession = params.get('stripe_session');
    const returnedTier = params.get('tier');
    const checkoutCanceled = params.get('checkout_canceled');

    if (checkoutCanceled) {
      setProStatusMsg('Checkout was canceled — your active project and trial exports remain untouched.');
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (stripeSession) {
      fetch('/api/verify-stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', sessionId: stripeSession, tier: returnedTier })
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.valid && data.licenseKey) {
            const ents = data.entitlements || ['all'];
            try {
              localStorage.setItem('cleansnap_pro_license', data.licenseKey);
              if (data.accessToken) localStorage.setItem('cleansnap_pro_token', data.accessToken);
              localStorage.setItem('cleansnap_pro_entitlements', JSON.stringify(ents));
            } catch {
              // ignore
            }
            setProLicenseKey(data.licenseKey);
            setUnlockedPacks(ents);
            setIsProUnlocked(true);
            setUpgradeDialogBanner(null);
            if (data.email) {
              setB2bForm((f) => ({ ...f, contactEmail: data.email }));
            }
            if (returnedTier === 'b2b' || data.isB2bOrder) {
              setProModalTab('b2b');
              setProStatusMsg(`B2B Order Verified! Submit your photo folder link below. Complimentary Pro Key: ${data.licenseKey}`);
            } else {
              setProStatusMsg(`Activated via Stripe! Your Key: ${data.licenseKey}`);
            }
            setShowProModal(true);
            window.history.replaceState({}, '', window.location.pathname);
          } else {
            setProStatusMsg(data.error || 'Purchase verification could not be completed. Your active project is preserved.');
            setShowProModal(true);
          }
        })
        .catch(() => {
          setProStatusMsg('Network error verifying purchase session. Enter your receipt email or license key below.');
          setShowProModal(true);
        });
    }

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
            '',
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

    if (activeTab === 'landing') {
      setIsAutoSweepHero(false);
      setActiveTab('cleaner');
    }

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
    triggerInstructionalEvent('after_import', true);
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
          triggerInstructionalEvent('after_first_transform', true);
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

  const triggerRawBrowserDownload = (dataUrl, filename) => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Centralized Export Entitlement Gate:
   * Every export pathway (.JPG, .PNG, .SVG, Batch .ZIP, Keyboard Ctrl+S, Clipboard Copy)
   * passes through this single enforcement function.
   */
  const executeGuardedExport = ({
    format = 'png',
    isBatch = false,
    jobId = 'asset',
    filename = 'export.png',
    onApproved
  }) => {
    const liveEntitlement = loadPersistedEntitlementState();
    const liveTrial = loadTrialExportState();

    const gate = evaluateExportEntitlement({
      format,
      isBatch,
      entitlementState: {
        isProValid: isProUnlocked && liveEntitlement.isProValid
      },
      trialState: liveTrial,
      config: COMMERCIAL_CONFIG
    });

    if (!gate.allowed) {
      setUpgradeDialogBanner({
        title: gate.upgradeTitle || 'CleanSnap Studio Pro Required',
        message: gate.message,
        reason: gate.reason
      });
      setProModalTab('packs');
      setProStatusMsg(gate.message);
      setShowProModal(true);
      return false;
    }

    if (gate.consumeTrialCredit) {
      const nextTrial = recordTrialExport({ id: jobId, format, filename });
      setTrialState(nextTrial);
    }

    triggerInstructionalEvent('select_export_format', true);
    if (typeof onApproved === 'function') {
      onApproved();
    }
    return true;
  };

  const downloadImage = (dataUrl, filename, formatOverride = null) => {
    if (!dataUrl) return false;
    const extMatch = String(filename || '').match(/\.([a-z0-9]+)$/i);
    const fmt = formatOverride || (extMatch ? extMatch[1].toLowerCase() : 'png');
    return executeGuardedExport({
      format: fmt,
      isBatch: fmt === 'zip',
      jobId: selectedJob?.job_id || filename,
      filename,
      onApproved: () => triggerRawBrowserDownload(dataUrl, filename)
    });
  };

  const downloadSingleSvg = (job) => {
    if (!job?.svg_markup) return false;
    const base = job.original_filename.replace(/\.[^/.]+$/, '');
    const filename = `${base}_vector_clipped.svg`;
    return executeGuardedExport({
      format: 'svg',
      isBatch: false,
      jobId: job.job_id,
      filename,
      onApproved: () => {
        const blob = new Blob([job.svg_markup], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        triggerRawBrowserDownload(url, filename);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    });
  };

  const downloadSvgPackZip = async () => {
    const completed = jobs.filter((j) => j.status === 'completed' && j.svg_markup);
    if (completed.length === 0) return false;

    const packFolderName = (packCategory || 'CleanSnap_Studio_Pack').replace(/[^a-z0-9_-]/gi, '_');
    const filename = `${packFolderName}_${completed.length}_Assets.zip`;

    return executeGuardedExport({
      format: 'zip',
      isBatch: true,
      jobId: 'batch_zip_vault',
      filename,
      onApproved: async () => {
        const zip = new JSZip();
        completed.forEach((job, idx) => {
          const base = job.original_filename.replace(/\.[^/.]+$/, '');
          zip.file(`${packFolderName}/${base}_${String(idx + 1).padStart(2, '0')}.svg`, job.svg_markup);
        });
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        triggerRawBrowserDownload(url, filename);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    });
  };

  const handleCopyCutoutToClipboard = async (job = selectedJob) => {
    if (!job) return false;
    const pngUrl =
      job.full_res_alpha_url ||
      job.cleanByStyle?.transparent ||
      job.trimmed_sticker_url;
    if (!pngUrl) return false;
    const base = job.original_filename.replace(/\.[^/.]+$/, '');
    const filename = `${base}_clipboard.png`;

    return executeGuardedExport({
      format: 'png',
      isBatch: false,
      jobId: `${job.job_id}_clipboard`,
      filename,
      onApproved: async () => {
        try {
          const resp = await fetch(pngUrl);
          const blob = await resp.blob();
          if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
          }
        } catch {
          // Fallback if ClipboardItem permission denied in headless environment
        }
      }
    });
  };

  const handleSaveAsNativeDesktop = async (job = selectedJob) => {
    if (!job || !activeCleanDownloadUrl) return false;
    const base = job.original_filename.replace(/\.[^/.]+$/, '');
    const ext = backdropStyle === 'transparent' ? 'png' : 'jpg';
    const filename = `${base}_${backdropStyle}_master.${ext}`;

    return executeGuardedExport({
      format: ext,
      isBatch: false,
      jobId: `${job.job_id}_saveas`,
      filename,
      onApproved: async () => {
        if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
          try {
            const handle = await window.showSaveFilePicker({
              suggestedName: filename,
              types: [
                {
                  description: ext === 'png' ? 'PNG Transparent Cutout' : 'JPEG Studio Composite',
                  accept: { [ext === 'png' ? 'image/png' : 'image/jpeg']: [`.${ext}`] }
                }
              ]
            });
            const writable = await handle.createWritable();
            const resp = await fetch(activeCleanDownloadUrl);
            const blob = await resp.blob();
            await writable.write(blob);
            await writable.close();
            return;
          } catch (err) {
            if (err?.name === 'AbortError') return;
          }
        }
        triggerRawBrowserDownload(activeCleanDownloadUrl, filename);
      }
    });
  };

  const loadTechniqueSampleSafely = (tech) => {
    const hasUnsavedUserWork =
      maskHistoryInfo.dirty || jobs.some((j) => !j.is_showcase);
    if (hasUnsavedUserWork) {
      const confirmed = window.confirm(
        'Load this Technique Sample into the active stage? Your uploaded photos remain safely in your Contact Sheet, and any unapplied brush strokes on the current image will be reset.'
      );
      if (!confirmed) return;
    }
    const targetSample =
      jobs.find((j) => j.job_id === tech.sampleJobId) ||
      jobs.find((j) => j.is_showcase && j.status === 'completed') ||
      jobs[0];
    if (targetSample) {
      setSelectedJob(targetSample);
    }
    if (tech.recommendedBackdrop) {
      setBackdropStyle(tech.recommendedBackdrop);
    }
    if (tech.recommendedRefinerBg) {
      setRefinerBgMode(tech.recommendedRefinerBg);
    }
    setStageMode(tech.recommendedStageMode || 'compare');
    setActiveTab('cleaner');
    setShowTechniqueModal(false);
    if (tech.recommendedStageMode === 'refine') {
      triggerInstructionalEvent('enter_refine_mode');
    } else {
      triggerInstructionalEvent('after_first_transform');
    }
  };

  const updateSliderFromPointer = (clientX) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  };

  const updateHeroSliderFromPointer = (clientX) => {
    if (!heroSliderRef.current) return;
    setIsAutoSweepHero(false);
    const rect = heroSliderRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  };

  useEffect(() => {
    if (activeTab !== 'landing' || !isAutoSweepHero) return;
    let rafId = null;
    const t0 = performance.now();
    const tick = (now) => {
      const elapsed = (now - t0) / 1000;
      const pos = 50 + Math.sin(elapsed * 1.45) * 31;
      setSliderPos(pos);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [activeTab, isAutoSweepHero]);

  const launchStudioWithTransition = (opts = {}) => {
    const nextJob = opts.job || selectedJob || jobs[0];
    const nextBackdrop = opts.backdrop || backdropStyle;
    const nextStageMode = opts.stageMode || 'compare';
    const nextTab = opts.tab || 'cleaner';
    const bInfo = ALL_BACKDROP_OPTIONS.find((b) => b.id === nextBackdrop) || FIVE_BACKDROP_OPTIONS[0];

    setIsAutoSweepHero(false);
    if (opts.job) setSelectedJob(opts.job);
    if (opts.backdrop) setBackdropStyle(opts.backdrop);
    setStageMode(nextStageMode);

    setPortalTransition({
      active: true,
      subjectTitle: nextJob?.title || nextJob?.original_filename || 'Active Studio Cutout',
      backdropLabel: bInfo.label,
      modeLabel:
        nextTab === 'vault'
          ? 'Batch .PNG + Vector .SVG Export Vault'
          : nextStageMode === 'refine'
          ? 'Sub-Pixel Manual Edge Refiner & Halo Decontamination'
          : 'Full 3-Column Studio Environment & Cutline Workspace'
    });

    setTimeout(() => {
      setActiveTab(nextTab);
      setSliderPos(50);
      setPortalTransition((prev) => ({ ...prev, active: false }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 640);
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
    ALL_BACKDROP_OPTIONS.find((b) => b.id === backdropStyle) || FIVE_BACKDROP_OPTIONS[0];

  const isPackUnlocked = useCallback(
    (packId) => {
      if (!packId) return true;
      return unlockedPacks.includes('all') || unlockedPacks.includes(packId);
    },
    [unlockedPacks]
  );

  const handleSelectBackdropStyle = (styleId) => {
    const opt = ALL_BACKDROP_OPTIONS.find((b) => b.id === styleId);
    if (opt?.packId && !isPackUnlocked(opt.packId)) {
      setProModalTab('packs');
      setProStatusMsg(`"${opt.label}" is part of the ${opt.packName}. Unlock below or enter your key.`);
      setShowProModal(true);
      return;
    }
    setBackdropStyle(styleId);
  };

  const handleB2bIntakeSubmit = async (e) => {
    e.preventDefault();
    setProStatusMsg('Submitting your B2B bulk catalog folder...');
    try {
      const resp = await fetch('/api/b2b-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(b2bForm)
      });
      const data = await resp.json();
      if (resp.ok && data.ok) {
        setB2bOrderReceipt(data);
        setProStatusMsg(data.message);
      } else {
        setProStatusMsg(data.error || 'Please check your folder URL and email.');
      }
    } catch {
      setProStatusMsg('Network error submitting B2B order. Please try again.');
    }
  };

  const handleInstallAppClick = async () => {
    setShowInstallModal(true);
    if (installPromptEvent) {
      try {
        installPromptEvent.prompt();
        await installPromptEvent.userChoice;
      } catch {
        // Fallback to modal download buttons
      }
      setInstallPromptEvent(null);
    }
  };

  const handleStartStripeCheckout = async (tier = 'pro') => {
    const directLink =
      tier === 'b2b'
        ? import.meta.env.VITE_STRIPE_B2B_LINK
        : import.meta.env.VITE_STRIPE_PRO_LINK;
    if (directLink) {
      window.open(directLink, '_blank', 'noopener,noreferrer');
      return;
    }

    setIsCheckingOutStripe(true);
    setProStatusMsg('Connecting to Stripe Checkout...');
    try {
      const resp = await fetch('/api/verify-stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_checkout',
          tier,
          origin: window.location.origin
        })
      });
      const data = await resp.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setProStatusMsg(
        data.message ||
          data.error ||
          'Add STRIPE_SECRET_KEY in Vercel to enable 1-click live checkout, or enter your license key below.'
      );
    } catch {
      setProStatusMsg('Offline mode: enter your CSPRO license key below to unlock immediately.');
    } finally {
      setIsCheckingOutStripe(false);
    }
  };

  const handleVerifyStripeKeyOrEmail = async (e) => {
    if (e) e.preventDefault();
    const val = proInputVal.trim();
    if (!val) return;

    const upper = val.toUpperCase();
    setProStatusMsg('Verifying with Stripe & Server Token Authority...');
    try {
      const isEmail = val.includes('@');
      const resp = await fetch('/api/verify-stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          email: isEmail ? val : undefined,
          licenseKey: !isEmail ? upper : undefined
        })
      });
      const data = await resp.json();
      if (data.valid && data.licenseKey) {
        const ents = data.entitlements || ['all', 'pack_rental', 'pack_auto', 'pack_ecom'];
        try {
          localStorage.setItem('cleansnap_pro_license', data.licenseKey);
          if (data.accessToken) localStorage.setItem('cleansnap_pro_token', data.accessToken);
          localStorage.setItem('cleansnap_pro_entitlements', JSON.stringify(ents));
        } catch {
          // ignore
        }
        setProLicenseKey(data.licenseKey);
        setUnlockedPacks(ents);
        setIsProUnlocked(true);
        setUpgradeDialogBanner(null);
        setProStatusMsg(`Unlocked (${data.tier})! Server-Signed Key: ${data.licenseKey}`);
      } else {
        setProStatusMsg(data.error || 'Key or Stripe email not found.');
      }
    } catch {
      setProStatusMsg('Could not reach verification server. Check your key or connection.');
    }
  };

  // Global keyboard shortcuts (Ctrl+S guarded export, Escape hint dismissal, ? Guide Mode toggle) & unsaved-work protection
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

      if (e.key === 'Escape') {
        if (activeHintKey) {
          dismissContextualHint(activeHintKey, false);
        } else if (showWelcomeModal) {
          completeWelcomeOnboarding();
        } else if (showTechniqueModal) {
          setShowTechniqueModal(false);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (selectedJob && activeCleanDownloadUrl) {
          const base = selectedJob.original_filename.replace(/\.[^/.]+$/, '');
          const ext = backdropStyle === 'transparent' ? 'png' : 'jpg';
          downloadImage(activeCleanDownloadUrl, `${base}_${backdropStyle}_master.${ext}`, ext);
        }
        return;
      }

      if (!isInput && e.key === '?') {
        e.preventDefault();
        toggleGuideMode();
      }
    };

    const onBeforeUnload = (e) => {
      if (isProcessingBatch || maskHistoryInfo.dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const onGlobalCopy = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const liveEnt = loadPersistedEntitlementState();
      const liveTrial = loadTrialExportState();
      const gate = evaluateExportEntitlement({
        format: 'png',
        isBatch: false,
        entitlementState: { isProValid: isProUnlocked && liveEnt.isProValid },
        trialState: liveTrial,
        config: COMMERCIAL_CONFIG
      });
      if (!gate.allowed) {
        e.preventDefault();
        setUpgradeDialogBanner({
          title: gate.upgradeTitle || 'CleanSnap Studio Pro Required',
          message: gate.message,
          reason: gate.reason
        });
        setShowProModal(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('copy', onGlobalCopy);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('copy', onGlobalCopy);
    };
  });

  const activeStatusBar = resolveContextualStatusBar({
    isProcessingBatch,
    progressMsg,
    activeTab,
    stageMode,
    brushMode,
    refinerBgMode,
    hoveredControl: hoveredControlKey,
    backdropStyle,
    activeBackdropLabel: activeBackdropInfo.label,
    entitlementState: { isProValid: isProUnlocked },
    trialState
  });

  const activeHint = resolveHintForEvent(activeHintKey, instructionalState);
  const activeGuideDetail =
    RICH_CONTROL_GUIDES[selectedGuideControlKey] || RICH_CONTROL_GUIDES.color_decontam;

  return (
    <div className="app-container">
      {/* Global Hidden File & Folder Upload Inputs (Available on Landing Page & Studio Workspace) */}
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

      {/* ==================== ANIMATED STUDIO PORTAL TRANSITION OVERLAY ==================== */}
      {portalTransition.active && (
        <div
          className="studio-portal-overlay"
          role="status"
          aria-live="polite"
          data-testid="studio-portal-transition"
        >
          <div className="studio-portal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="hero-kicker-badge">
                <span className="prototype-live-dot" />
                <span>LAUNCHING CLEANSNAP STUDIO ENGINE</span>
              </span>
              <span className="mono-num" style={{ fontSize: '11px', color: 'var(--gold)' }}>
                U²-NET ONNX · LOCAL
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: '21px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Transitioning Prototype to Full Studio Workspace...
            </h2>
            <div className="portal-progress-track">
              <div className="portal-progress-fill" />
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '12.5px',
                color: 'var(--text-secondary)',
                background: 'rgba(6, 8, 14, 0.8)',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div>
                <strong style={{ color: 'var(--gold)' }}>01 · Subject Locked:</strong>{' '}
                {portalTransition.subjectTitle}
              </div>
              <div>
                <strong style={{ color: '#34d399' }}>02 · Studio Environment:</strong>{' '}
                {portalTransition.backdropLabel}
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>03 · Workspace Mode:</strong>{' '}
                {portalTransition.modeLabel}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TOP STUDIO HEADER ==================== */}
      <header className="studio-header">
        <div
          className="brand-lockup"
          onClick={() => setActiveTab('landing')}
          style={{ cursor: 'pointer' }}
          title="Return to CleanSnap Studio Overview & Interactive Prototype"
        >
          <div className="brand-eyebrow">
            <span className="brand-eyebrow-dot" />
            <a
              href="https://www.contextmuse.com"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ color: 'var(--gold)', textDecoration: 'none' }}
              title="Visit Context & Muse LLC (contextmuse.com)"
            >
              CONTEXTMUSE.COM ↗
            </a>
            <span>· CLEANSNAP.CONTEXTMUSE.COM · 100% ON-DEVICE</span>
          </div>
          <h1 className="brand-title">
            <span>CleanSnap</span>
            <span className="brand-title-serif">Studio</span>
          </h1>
          <p className="brand-subtitle">
            Automated Subject Cutout, Edge Refinement, 11 Studio Environments &amp; Vector-Clipped .SVG Export
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <nav className="nav-pill-group" aria-label="Workspace Mode">
            <button
              type="button"
              data-testid="nav-landing-btn"
              className={`nav-pill ${activeTab === 'landing' ? 'active' : ''}`}
              onClick={() => setActiveTab('landing')}
            >
              <span className="nav-pill-index">01</span>
              <ImageIcon size={15} />
              <span>Overview &amp; Demo</span>
            </button>
            <button
              type="button"
              data-testid="nav-studio-btn"
              className={`nav-pill ${activeTab === 'cleaner' ? 'active' : ''}`}
              onClick={() => {
                if (activeTab === 'landing') {
                  launchStudioWithTransition({ tab: 'cleaner' });
                } else {
                  setActiveTab('cleaner');
                }
              }}
            >
              <span className="nav-pill-index">02</span>
              <Sparkles size={15} />
              <span>Studio Workspace</span>
            </button>
            <button
              type="button"
              data-testid="nav-vault-btn"
              className={`nav-pill ${activeTab === 'vault' ? 'active' : ''}`}
              onClick={() => setActiveTab('vault')}
            >
              <span className="nav-pill-index">03</span>
              <Package size={15} />
              <span>Export Vault ({completedJobs.length})</span>
            </button>
          </nav>

          <button
            type="button"
            data-testid="guide-mode-btn"
            className={instructionalState.guideModeEnabled ? 'btn-gold' : 'btn-secondary'}
            onClick={() => {
              if (activeTab === 'landing') setActiveTab('cleaner');
              toggleGuideMode();
            }}
            style={{ padding: '9px 12px', fontSize: '12.5px' }}
            title="Toggle Interactive Guide Mode (Shortcut: ?)"
          >
            <span>? Guide Mode {instructionalState.guideModeEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            data-testid="technique-library-btn"
            className="btn-secondary"
            onClick={() => setShowTechniqueModal(true)}
            style={{ padding: '9px 12px', fontSize: '12.5px' }}
          >
            <Sliders size={14} />
            <span>Techniques</span>
          </button>

          <a
            href="/prompt-pack.html"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="prompt-vault-btn"
            className="btn-secondary"
            style={{
              padding: '9px 12px',
              fontSize: '12.5px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Open Interactive Commercial Backdrop & Lighting Prompt Vault"
          >
            <Sparkles size={14} style={{ color: 'var(--gold)' }} />
            <span>Prompt Vault ↗</span>
          </a>

          <button
            type="button"
            data-testid="studio-pro-btn"
            className={isProUnlocked ? 'btn-accent' : 'btn-gold'}
            onClick={() => setShowProModal(true)}
            style={{ padding: '9px 14px', fontSize: '12.5px' }}
          >
            <Sparkles size={14} />
            <span>
              {isProUnlocked
                ? 'STUDIO PRO ACTIVE'
                : `Unlock Studio Pro ($19) · ${trialState.remainingCount}/${trialState.maxAllowance} Trial`}
            </span>
          </button>

          <button
            type="button"
            data-testid="manual-guide-btn"
            className="btn-secondary"
            onClick={() => setShowManualModal(true)}
            style={{ padding: '9px 12px', fontSize: '12.5px' }}
          >
            <FileCode size={14} />
            <span>Manual</span>
          </button>

          <button
            type="button"
            data-testid="install-app-btn"
            className="btn-secondary"
            onClick={handleInstallAppClick}
            style={{ padding: '9px 12px', fontSize: '12.5px' }}
          >
            <Download size={14} />
            <span>Install App</span>
          </button>
        </div>
      </header>

      {/* ==================== LAYER A: FIRST-LAUNCH WELCOME MODAL (SKIPPABLE, REPLAYABLE, PERSISTED) ==================== */}
      {showWelcomeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to CleanSnap Studio"
          data-testid="first-launch-welcome-modal"
          onClick={completeWelcomeOnboarding}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(5, 7, 11, 0.88)',
            backdropFilter: 'blur(14px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '880px',
              width: '100%',
              border: '1px solid rgba(229, 193, 88, 0.5)',
              boxShadow: '0 28px 80px rgba(0, 0, 0, 0.88)',
              maxHeight: '92vh',
              overflowY: 'auto'
            }}
          >
            <div className="card-header">
              <div className="card-title-group">
                <span className="card-step-label">{WELCOME_CONFIG.eyebrow}</span>
                <h2 className="card-title" style={{ fontSize: '20px' }}>
                  {WELCOME_CONFIG.title}
                </h2>
              </div>
              <button
                type="button"
                data-testid="welcome-skip-btn"
                className="btn-secondary"
                onClick={completeWelcomeOnboarding}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Skip Intro (Esc)
              </button>
            </div>

            <p style={{ margin: '0 0 12px', fontSize: '13.2px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {WELCOME_CONFIG.subtitle}
            </p>

            {/* 3 GENUINE BEFORE/AFTER APPLICATION EXAMPLES */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '12px',
                marginBottom: '14px'
              }}
            >
              {WELCOME_CONFIG.showcaseExamples.map((ex) => (
                <div
                  key={ex.id}
                  className="workflow-section"
                  style={{ padding: '11px', gap: '8px', justifyContent: 'space-between' }}
                >
                  <div>
                    <div className="technique-pair-preview">
                      <img src={ex.beforeImg} alt={`Before: ${ex.title}`} />
                      <img src={ex.afterImg} alt={`After: ${ex.title}`} />
                    </div>
                    <h3 style={{ margin: '8px 0 3px', fontSize: '13.5px', color: 'var(--text-primary)' }}>
                      {ex.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      <strong style={{ color: 'var(--gold)' }}>Challenge:</strong> {ex.problem}
                    </p>
                  </div>
                  <div style={{ fontSize: '11.2px', color: '#6ee7b7' }}>
                    ✓ {ex.outcome}
                  </div>
                </div>
              ))}
            </div>

            {/* 4 CONNECTED WORKFLOW PILLARS */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
                gap: '10px',
                marginBottom: '16px'
              }}
            >
              {WELCOME_CONFIG.workflowPillars.map((p) => (
                <div
                  key={p.step}
                  style={{
                    background: 'rgba(8, 10, 16, 0.82)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '9px 11px'
                  }}
                >
                  <span className="mono-num" style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: 700 }}>
                    STEP {p.step}
                  </span>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', margin: '2px 0' }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: '11.2px', color: 'var(--text-secondary)', lineHeight: 1.38 }}>
                    {p.detail}
                  </div>
                </div>
              ))}
            </div>

            {/* 3 CLEAR ENTRY POINTS */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                data-testid="welcome-start-own-artwork-btn"
                className="btn-gold"
                onClick={() => {
                  completeWelcomeOnboarding();
                  setActiveTab('cleaner');
                  fileInputRef.current?.click();
                }}
                style={{ flex: '1 1 220px', padding: '11px 16px', fontSize: '13px' }}
              >
                <Upload size={15} />
                <span>Start With My Own Artwork</span>
              </button>

              <button
                type="button"
                data-testid="welcome-explore-sample-btn"
                className="btn-accent"
                onClick={() => {
                  completeWelcomeOnboarding();
                  setActiveTab('cleaner');
                  setStageMode('compare');
                  triggerInstructionalEvent('after_first_transform');
                }}
                style={{ flex: '1 1 220px', padding: '11px 16px', fontSize: '13px' }}
              >
                <Sparkles size={15} />
                <span>Explore an Interactive Sample</span>
              </button>

              <button
                type="button"
                data-testid="welcome-enter-workspace-btn"
                className="btn-secondary"
                onClick={() => {
                  completeWelcomeOnboarding();
                  setActiveTab('cleaner');
                }}
                style={{ flex: '1 1 200px', padding: '11px 16px', fontSize: '13px' }}
              >
                <span>Enter Workspace Directly →</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== LAYER E: INTERACTIVE TECHNIQUE LIBRARY MODAL ==================== */}
      {showTechniqueModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="CleanSnap Studio Interactive Technique Library"
          data-testid="technique-library-modal"
          onClick={() => setShowTechniqueModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(5, 7, 11, 0.88)',
            backdropFilter: 'blur(14px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '940px',
              width: '100%',
              border: '1px solid rgba(229, 193, 88, 0.5)',
              boxShadow: '0 28px 80px rgba(0, 0, 0, 0.88)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div className="card-header">
              <div className="card-title-group">
                <span className="card-step-label">LAYER E · PRACTICAL WORKSTATION TECHNIQUES</span>
                <h2 className="card-title">
                  Interactive Technique Library — Real Problems, Tools &amp; Bundled Samples
                </h2>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowTechniqueModal(false)}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                ✕ Close
              </button>
            </div>

            <div className="technique-grid">
              {TECHNIQUE_LIBRARY.map((tech) => (
                <article key={tech.id} className="technique-card" data-testid={`technique-card-${tech.id}`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="mono-num" style={{ fontSize: '10.5px', color: 'var(--gold)', fontWeight: 700 }}>
                        {tech.category.toUpperCase()}
                      </span>
                      <span className="mono-num" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        ISOLATED SAMPLE
                      </span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)' }}>
                      {tech.title}
                    </h3>
                    <div className="technique-pair-preview">
                      <img src={tech.beforeImg} alt={`Before: ${tech.title}`} />
                      <img src={tech.afterImg} alt={`After: ${tech.title}`} />
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Problem:</strong> {tech.problem}
                    </p>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {tech.relevantTools.map((t) => (
                        <span
                          key={t}
                          className="mono-num"
                          style={{
                            fontSize: '10px',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: 'rgba(229, 193, 88, 0.12)',
                            border: '1px solid rgba(229, 193, 88, 0.3)',
                            color: 'var(--gold)'
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <ol style={{ margin: 0, paddingLeft: '16px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      {tech.workflowSteps.map((step, i) => (
                        <li key={i} style={{ marginBottom: '3px' }}>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>

                  <button
                    type="button"
                    data-testid={`open-technique-sample-${tech.id}`}
                    className="btn-gold"
                    onClick={() => loadTechniqueSampleSafely(tech)}
                    style={{ width: '100%', padding: '9px 12px', fontSize: '12px' }}
                  >
                    <Sparkles size={13} />
                    <span>Open Bundled Sample in Editor →</span>
                  </button>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {showManualModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="CleanSnap Studio Interactive Quick-Start Manual & Walkthrough"
          onClick={() => setShowManualModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(5, 6, 10, 0.86)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '720px',
              width: '100%',
              border: '1px solid rgba(229, 193, 88, 0.5)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div className="card-header">
              <div className="card-title-group">
                <span className="card-step-label">INTERACTIVE USER MANUAL &amp; WALKTHROUGH</span>
                <h2 className="card-title">How to Use CleanSnap Studio &amp; Activate Packs</h2>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <a
                  href="/manual.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gold"
                  style={{ textDecoration: 'none', padding: '6px 12px', fontSize: '12px' }}
                >
                  Open Printable PDF Manual ↗
                </a>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowManualModal(false)}
                  style={{ padding: '6px 10px' }}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
              <div className="workflow-section" style={{ justifyContent: 'space-between' }}>
                <div>
                  <span className="mono-num" style={{ fontSize: '10.5px', color: 'var(--gold)', fontWeight: 700 }}>
                    STEP 01 · UPLOAD &amp; COMPOSITE
                  </span>
                  <h3 style={{ margin: '5px 0 4px', fontSize: '14.5px', color: 'var(--text-primary)' }}>
                    Single Photo or 200-Image Folder
                  </h3>
                  <p className="workflow-step-desc" style={{ fontSize: '12px' }}>
                    Drop individual photos or a full directory. Our local U²-Net ONNX engine isolates your subject on-device and composites it across 11 studio backdrops.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowManualModal(false);
                    launchStudioWithTransition({ stageMode: 'compare', tab: 'cleaner' });
                  }}
                  style={{ width: '100%', marginTop: '8px', fontSize: '12px' }}
                >
                  Jump to Studio Compare Stage →
                </button>
              </div>

              <div className="workflow-section" style={{ justifyContent: 'space-between' }}>
                <div>
                  <span className="mono-num" style={{ fontSize: '10.5px', color: '#34d399', fontWeight: 700 }}>
                    STEP 02 · SUB-PIXEL BRUSH REFINER
                  </span>
                  <h3 style={{ margin: '5px 0 4px', fontSize: '14.5px', color: 'var(--text-primary)' }}>
                    400% Ruby Mask &amp; Halo Cleanup
                  </h3>
                  <p className="workflow-step-desc" style={{ fontSize: '12px' }}>
                    Use the + Restore Brush, - Eraser, Morphological Choke (-12px to +12px), and RGB Halo Decontamination slider to perfect hair, fur, and glass edges.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowManualModal(false);
                    launchStudioWithTransition({ stageMode: 'refine', tab: 'cleaner' });
                  }}
                  style={{ width: '100%', marginTop: '8px', fontSize: '12px' }}
                >
                  Jump to Edge Brush Refiner →
                </button>
              </div>

              <div className="workflow-section" style={{ justifyContent: 'space-between' }}>
                <div>
                  <span className="mono-num" style={{ fontSize: '10.5px', color: '#38bdf8', fontWeight: 700 }}>
                    STEP 03 · VECTOR .SVG &amp; .ZIP VAULT
                  </span>
                  <h3 style={{ margin: '5px 0 4px', fontSize: '14.5px', color: 'var(--text-primary)' }}>
                    Die-Cut Sticker Paths &amp; Batch Export
                  </h3>
                  <p className="workflow-step-desc" style={{ fontSize: '12px' }}>
                    Download 4K transparent .PNGs, Marching-Squares vector .SVG cutlines (for Figma, Illustrator, Cricut &amp; Roland), or a complete batch .ZIP archive.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowManualModal(false);
                    setActiveTab('vault');
                  }}
                  style={{ width: '100%', marginTop: '8px', fontSize: '12px' }}
                >
                  Open Batch Export Vault →
                </button>
              </div>

              <div className="workflow-section" style={{ justifyContent: 'space-between' }}>
                <div>
                  <span className="mono-num" style={{ fontSize: '10.5px', color: 'var(--gold)', fontWeight: 700 }}>
                    STEP 04 · LICENSE &amp; PACK UNLOCK
                  </span>
                  <h3 style={{ margin: '5px 0 4px', fontSize: '14.5px', color: 'var(--text-primary)' }}>
                    Stripe Auto-Unlock &amp; Device Restore
                  </h3>
                  <p className="workflow-step-desc" style={{ fontSize: '12px' }}>
                    Stripe purchases unlock automatically on redirect. To restore on another device, enter your Stripe checkout email or signed <code>CSPRO-...</code> key.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-gold"
                  onClick={() => {
                    setShowManualModal(false);
                    setShowProModal(true);
                  }}
                  style={{ width: '100%', marginTop: '8px', fontSize: '12px' }}
                >
                  Activate or Restore License Key →
                </button>
              </div>
            </div>

            {/* INSTRUCTIONAL PREFERENCES & REPLAY BAR */}
            <div
              style={{
                marginTop: '14px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}
            >
              <span className="mono-num" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                INSTRUCTIONAL GUIDANCE CONTROLS
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  data-testid="replay-welcome-btn"
                  className="btn-secondary"
                  onClick={() => {
                    setShowManualModal(false);
                    setShowWelcomeModal(true);
                  }}
                  style={{ padding: '6px 10px', fontSize: '11.5px' }}
                >
                  Replay First-Launch Welcome
                </button>
                <button
                  type="button"
                  data-testid="toggle-auto-hints-btn"
                  className="btn-secondary"
                  onClick={toggleAutoHints}
                  style={{ padding: '6px 10px', fontSize: '11.5px' }}
                >
                  Auto-Hints: {instructionalState.autoHintsEnabled ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  data-testid="reset-instructional-btn"
                  className="btn-secondary"
                  onClick={() => {
                    setShowManualModal(false);
                    handleResetInstructionalProgress();
                  }}
                  style={{ padding: '6px 10px', fontSize: '11.5px' }}
                >
                  Reset All Hints &amp; Progress
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="CleanSnap Studio Pro & B2B Stripe Checkout"
          onClick={() => setShowProModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(4, 5, 8, 0.86)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            overflowY: 'auto'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '760px',
              background: '#0e111a',
              border: '1.5px solid var(--gold)',
              borderRadius: 'var(--radius-xl)',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 28px 64px rgba(0, 0, 0, 0.94)',
              maxHeight: '92vh',
              overflowY: 'auto'
            }}
          >
            {upgradeDialogBanner && !isProUnlocked && (
              <div
                data-testid="upgrade-entitlement-banner"
                style={{
                  background: 'rgba(229, 193, 88, 0.11)',
                  border: '1px solid rgba(229, 193, 88, 0.45)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '13.5px', color: 'var(--gold)' }}>
                    {upgradeDialogBanner.title}
                  </strong>
                  <span className="mono-num" style={{ fontSize: '10.5px', color: '#6ee7b7' }}>
                    ACTIVE PROJECT PRESERVED
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                  {upgradeDialogBanner.message}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <span className="card-step-label">SERVER-GATED STRIPE LICENSING &amp; B2B INTAKE</span>
                <h2 className="card-title" style={{ fontSize: '20px', marginTop: '3px' }}>
                  {isProUnlocked
                    ? `CleanSnap Studio Pro Unlocked (${proLicenseKey})`
                    : 'Unlock Industry Backdrop Packs, All-Access Pro, or B2B Bulk Service'}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  type="button"
                  className={proModalTab === 'packs' ? 'btn-gold' : 'btn-secondary'}
                  onClick={() => setProModalTab('packs')}
                  style={{ padding: '6px 11px', fontSize: '12px' }}
                >
                  Backdrop Packs &amp; Pro ($9–$19)
                </button>
                <button
                  type="button"
                  className={proModalTab === 'b2b' ? 'btn-accent' : 'btn-secondary'}
                  onClick={() => setProModalTab('b2b')}
                  style={{ padding: '6px 11px', fontSize: '12px' }}
                >
                  B2B 200-Photo Intake ($149)
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowProModal(false)}
                  style={{ padding: '6px 10px' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {proModalTab === 'packs' ? (
              <>
                {/* 3 Server-Gated Industry Backdrop Packs ($9 each) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '10px' }}>
                  {[
                    {
                      id: 'pack_rental',
                      title: 'Event & Party Rental Pack',
                      price: '$9',
                      img: '/products/02_CleanSnap_Event_Party_Rental_Pack_1080x1080.png',
                      desc: 'Unlocks 06 Twilight String-Lit Patio Turf & 07 Grand Hardwood Event Pavilion (Server-Gated).'
                    },
                    {
                      id: 'pack_auto',
                      title: 'Auto & Showroom Pack',
                      price: '$9',
                      img: '/products/03_CleanSnap_Auto_Showroom_Pack_1080x1080.png',
                      desc: 'Unlocks 08 Wet Obsidian Studio Cyclorama & 09 Architectural LED Dealership Bay (Server-Gated).'
                    },
                    {
                      id: 'pack_ecom',
                      title: 'E-Commerce & Apparel Pack',
                      price: '$9',
                      img: '/products/04_CleanSnap_ECommerce_Apparel_Pack_1080x1080.png',
                      desc: 'Unlocks 10 Warm Travertine Limestone Studio & 11 Editorial Sand Linen Backdrop (Server-Gated).'
                    }
                  ].map((pk) => {
                    const owned = isPackUnlocked(pk.id);
                    return (
                      <div key={pk.id} className="workflow-section" style={{ justifyContent: 'space-between' }}>
                        <div>
                          <img
                            src={pk.img}
                            alt={pk.title}
                            loading="lazy"
                            style={{
                              width: '100%',
                              aspectRatio: '16 / 10',
                              objectFit: 'cover',
                              borderRadius: '7px',
                              marginBottom: '8px',
                              border: '1px solid var(--border-subtle)'
                            }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="mono-num" style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: 600 }}>
                              {owned ? '✓ UNLOCKED' : '🔒 SERVER-GATED PACK'}
                            </span>
                            <span className="mono-num" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {pk.price}
                            </span>
                          </div>
                          <h3 style={{ margin: '4px 0', fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {pk.title}
                          </h3>
                          <p className="workflow-step-desc" style={{ fontSize: '11.5px' }}>
                            {pk.desc}
                          </p>
                        </div>
                        <button
                          type="button"
                          className={owned ? 'btn-accent' : 'btn-secondary'}
                          disabled={isCheckingOutStripe || owned}
                          onClick={() => handleStartStripeCheckout(pk.id)}
                          style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                        >
                          {owned ? '✓ Pack Active' : `Unlock Pack (${pk.price} via Stripe)`}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* All-Access Studio Pro Bundle ($19) + B2B Quick Card ($149) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                  <div className="workflow-section" style={{ borderColor: 'rgba(229, 193, 88, 0.55)', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                        <img
                          src="/products/01_CleanSnap_AllAccess_Pro_Bundle_1080x1080.png"
                          alt="All-Access Studio Pro Bundle"
                          style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--gold)' }}
                        />
                        <div>
                          <span className="mono-num" style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: 600 }}>
                            ⭐ BEST VALUE · ALL-ACCESS LIFETIME
                          </span>
                          <h3 style={{ margin: '2px 0', fontSize: '16.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            All-Access Studio Pro — $19
                          </h3>
                        </div>
                      </div>
                      <p className="workflow-step-desc" style={{ marginBottom: '8px' }}>
                        Unlocks <strong>all 3 Industry Backdrop Packs (11 studio environments)</strong> + unlimited batch folder uploads, Marching-Squares vector <code>.SVG</code> cutline packs (<code>.ZIP</code>), and custom brand watermarks.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-gold"
                      disabled={isCheckingOutStripe}
                      onClick={() => handleStartStripeCheckout('pro')}
                      style={{ width: '100%' }}
                    >
                      <Sparkles size={14} /> Unlock All-Access Pro ($19 via Stripe) →
                    </button>
                  </div>

                  <div className="workflow-section" style={{ borderColor: 'rgba(16, 185, 129, 0.45)', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                        <img
                          src="/products/05_CleanSnap_B2B_200Photo_Bulk_Catalog_1080x1080.png"
                          alt="200-Photo Bulk Catalog Batch"
                          style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--emerald)' }}
                        />
                        <div>
                          <span className="mono-num" style={{ fontSize: '10px', color: 'var(--emerald)', fontWeight: 600 }}>
                            DONE-FOR-YOU B2B CATALOG SERVICE
                          </span>
                          <h3 style={{ margin: '2px 0', fontSize: '16.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            200-Photo Bulk Batch — $149
                          </h3>
                        </div>
                      </div>
                      <p className="workflow-step-desc" style={{ marginBottom: '8px' }}>
                        Don&apos;t want to process hundreds of messy photos yourself? Pay via Stripe and submit your Google Drive / Dropbox folder link in the <strong>B2B Intake tab</strong>.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn-accent"
                        disabled={isCheckingOutStripe}
                        onClick={() => handleStartStripeCheckout('b2b')}
                        style={{ flex: 1.2 }}
                      >
                        Pay $149 via Stripe →
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setProModalTab('b2b')}
                        style={{ flex: 1 }}
                      >
                        Submit Folder Link
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* TAB 2: VIP B2B 100-500 PHOTO FOLDER INTAKE PORTAL */
              <form onSubmit={handleB2bIntakeSubmit} className="workflow-section" style={{ borderColor: 'rgba(16, 185, 129, 0.45)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span className="mono-num" style={{ fontSize: '10.5px', color: 'var(--emerald)', fontWeight: 600 }}>
                      VIP B2B BULK CATALOG INTAKE PORTAL (100–500 PHOTOS)
                    </span>
                    <h3 style={{ margin: '3px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Send Us Your Raw Photo Folder for White-Glove Batch Processing
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="btn-accent"
                    disabled={isCheckingOutStripe}
                    onClick={() => handleStartStripeCheckout('b2b')}
                    style={{ padding: '7px 12px', fontSize: '12px' }}
                  >
                    1. Pay $149 Batch Deposit on Stripe →
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  <div className="form-group">
                    <label htmlFor="b2b-biz">Business / Studio Name</label>
                    <input
                      id="b2b-biz"
                      type="text"
                      value={b2bForm.businessName}
                      onChange={(e) => setB2bForm({ ...b2bForm, businessName: e.target.value })}
                      placeholder="e.g. Lone Star Event Rentals / Apex Motors"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="b2b-email">Delivery Email Address *</label>
                    <input
                      id="b2b-email"
                      type="text"
                      required
                      value={b2bForm.contactEmail}
                      onChange={(e) => setB2bForm({ ...b2bForm, contactEmail: e.target.value })}
                      placeholder="you@yourbusiness.com"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="b2b-folder">
                    Raw Photo Folder Link (Google Drive, Dropbox, OneDrive, or WeTransfer URL) *
                  </label>
                  <input
                    id="b2b-folder"
                    type="text"
                    required
                    value={b2bForm.folderUrl}
                    onChange={(e) => setB2bForm({ ...b2bForm, folderUrl: e.target.value })}
                    placeholder="https://drive.google.com/drive/folders/... or https://we.tl/..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  <div className="form-group">
                    <label htmlFor="b2b-watermark">Custom Brand Watermark Text (Optional)</label>
                    <input
                      id="b2b-watermark"
                      type="text"
                      value={b2bForm.watermarkText}
                      onChange={(e) => setB2bForm({ ...b2bForm, watermarkText: e.target.value })}
                      placeholder="e.g. LONE STAR RENTALS • (512) 555-0199"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="b2b-pack">Target Backdrop Environment Pack</label>
                    <select
                      id="b2b-pack"
                      value={b2bForm.backdropPack}
                      onChange={(e) => setB2bForm({ ...b2bForm, backdropPack: e.target.value })}
                    >
                      <option value="Event & Party Rental Pack + Alpha .PNG + Vector .SVG">
                        Event &amp; Party Rental Pack (Sunny Lawn + Twilight Patio + Event Hall)
                      </option>
                      <option value="Auto & Dealership Showroom Pack + Alpha .PNG + Vector .SVG">
                        Auto &amp; Dealership Showroom Pack (Obsidian Cyclorama + LED Bay)
                      </option>
                      <option value="E-Commerce & Apparel Editorial Pack + Alpha .PNG + Vector .SVG">
                        E-Commerce &amp; Apparel Pack (Travertine + Sand Linen + Chalkboard)
                      </option>
                      <option value="All 11 Studio Backdrops + Alpha .PNG + Vector .SVG">
                        Complete Master Archive (All 11 Backdrops + Alpha .PNG + Vector .SVG)
                      </option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn-gold" style={{ width: '100%' }}>
                  <CheckCircle2 size={14} /> 2. Submit Photo Folder to Studio Pipeline
                </button>

                {b2bOrderReceipt && (
                  <div
                    className="mono-num"
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(6, 78, 59, 0.88)',
                      border: '1px solid rgba(16, 185, 129, 0.45)',
                      color: '#6ee7b7',
                      fontSize: '11.5px'
                    }}
                  >
                    <strong>✓ {b2bOrderReceipt.orderId} Confirmed:</strong> {b2bOrderReceipt.message}
                  </div>
                )}
              </form>
            )}

            {/* Restore Purchase by Stripe Email or License Key */}
            <form onSubmit={handleVerifyStripeKeyOrEmail} className="workflow-section">
              <label htmlFor="stripe-restore-input" style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Already Purchased on Stripe? Restore by Checkout Email or License Key:
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  id="stripe-restore-input"
                  type="text"
                  value={proInputVal}
                  onChange={(e) => setProInputVal(e.target.value)}
                  placeholder="Enter your Stripe checkout email or CSPRO-XXXX-XXXX-XXXX key"
                  style={{ flex: 1, minWidth: '220px' }}
                />
                <button type="submit" className="btn-gold">
                  <CheckCircle2 size={14} /> Activate License
                </button>
              </div>
              {proStatusMsg && (
                <div
                  className="mono-num"
                  style={{
                    fontSize: '11.5px',
                    color: isProUnlocked ? '#6ee7b7' : 'var(--gold)',
                    marginTop: '4px'
                  }}
                >
                  {proStatusMsg}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {showInstallModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Download or Install CleanSnap Studio"
          onClick={() => setShowInstallModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(4, 5, 8, 0.82)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '640px',
              background: '#0e111a',
              border: '1.5px solid var(--gold)',
              borderRadius: 'var(--radius-xl)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 28px 64px rgba(0, 0, 0, 0.9)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div>
                <span className="card-step-label">DIRECT APP DOWNLOADS &amp; STORE PACKAGES ($0)</span>
                <h2 className="card-title" style={{ fontSize: '21px', marginTop: '4px' }}>
                  Download CleanSnap Studio for Windows or Android
                </h2>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowInstallModal(false)}
                style={{ padding: '6px 12px' }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* 1-Click Direct Windows Download */}
              <div className="workflow-section" style={{ borderColor: 'rgba(229, 193, 88, 0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '14px', display: 'block' }}>
                      1. Windows 10 / 11 App Package (.MSIX + Microsoft Store Bundle)
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Includes <code>CleanSnap Studio.msixbundle</code> (for Microsoft Store) &amp; <code>install.ps1</code> (for instant local PC install).
                    </span>
                  </div>
                  <a
                    href="/downloads/CleanSnap_Studio_Windows_Installer.zip"
                    download="CleanSnap_Studio_Windows_Installer.zip"
                    style={{
                      textDecoration: 'none',
                      background: 'linear-gradient(180deg, #ebd074 0%, #d4af37 100%)',
                      color: '#090a0f',
                      fontWeight: 600,
                      fontSize: '12.5px',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Download size={14} /> Download Windows .ZIP (1.8 MB)
                  </a>
                </div>
              </div>

              {/* 1-Click Android APK Download Page */}
              <div className="workflow-section" style={{ borderColor: 'rgba(16, 185, 129, 0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '14px', display: 'block' }}>
                      2. Android Phone &amp; Tablet Package (.APK — 56 MB Offline Build)
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Compiled automatically by your GitHub Actions cloud builder. Scroll to <strong>Artifacts → CleanSnap-Studio-Android-APK</strong>.
                    </span>
                  </div>
                  <a
                    href="https://github.com/rouguemuse/cleansnap-ai/actions/runs/44524218279"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      textDecoration: 'none',
                      background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '12.5px',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Package size={14} /> Open GitHub Android .APK Build ↗
                  </a>
                </div>
              </div>

              {/* Browser PWA Install Note */}
              <div className="workflow-section">
                <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                  3. Instant Browser App Install (Edge / Chrome Outside IDE Preview)
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  If you are viewing this inside the IDE preview tab, embedded previews block OS installers— click <strong>Download Windows .ZIP</strong> above, or open <code>https://bold-oppenheimer.vercel.app</code> in standalone Microsoft Edge or Chrome and click the <strong>Install App</strong> icon in the address bar.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 0: FRONT-DOOR INTERACTIVE PRODUCT LANDING PAGE ==================== */}
      {activeTab === 'landing' && (
        <div className="landing-wrapper" data-testid="landing-page-view">
          {/* HERO SPLIT: CONCISE VISUAL PITCH + LIVE INTERACTIVE PROTOTYPE SANDBOX */}
          <section className="landing-hero-grid" aria-label="Interactive Product Overview and Live Prototype">
            {/* LEFT COLUMN: CRISP VISUAL PITCH, 3 INTERACTIVE MODE TILES & LAUNCH CTAS */}
            <div className="hero-copy-col">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="hero-kicker-badge">
                  <span className="prototype-live-dot" />
                  <span>100% ON-DEVICE U²-NET AI · ZERO CLOUD FEES</span>
                </div>

                <h2 className="hero-headline">
                  Instant Studio Cutouts,{' '}
                  <span className="hero-headline-accent">
                    11 Backdrops &amp; Vector .SVG Cutlines.
                  </span>
                </h2>

                <p className="hero-lead" style={{ fontSize: '13.5px' }}>
                  Test the live prototype on the right—pick a photo, drag the neural laser scanner, swap studio backdrops, and transition directly into the full editor.
                </p>

                {/* 3 COMPACT CLICKABLE VISUAL WORKSPACE TILES (REPLACES WALL OF TEXT) */}
                <div className="hero-visual-metrics-grid">
                  <div
                    className="hero-metric-tile"
                    onClick={() =>
                      launchStudioWithTransition({
                        job: selectedJob,
                        backdrop: backdropStyle,
                        stageMode: 'compare'
                      })
                    }
                    title="Open Before/After Compare Stage"
                  >
                    <span className="mono-num" style={{ fontSize: '10.5px', color: 'var(--gold)', fontWeight: 700 }}>
                      01 · COMPARE
                    </span>
                    <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>
                      11 Backdrops
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Live shadow composite →
                    </span>
                  </div>

                  <div
                    className="hero-metric-tile"
                    onClick={() =>
                      launchStudioWithTransition({
                        job: selectedJob,
                        backdrop: backdropStyle,
                        stageMode: 'refine'
                      })
                    }
                    title="Open Sub-Pixel Edge Brush Refiner"
                  >
                    <span className="mono-num" style={{ fontSize: '10.5px', color: '#34d399', fontWeight: 700 }}>
                      02 · REFINE
                    </span>
                    <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>
                      Edge Brush
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      400% Ruby Mask zoom →
                    </span>
                  </div>

                  <div
                    className="hero-metric-tile"
                    onClick={() =>
                      launchStudioWithTransition({
                        job: selectedJob,
                        backdrop: backdropStyle,
                        tab: 'vault'
                      })
                    }
                    title="Open Batch .PNG & Vector .SVG Vault"
                  >
                    <span className="mono-num" style={{ fontSize: '10.5px', color: '#38bdf8', fontWeight: 700 }}>
                      03 · EXPORT
                    </span>
                    <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>
                      Vector .SVG
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Alpha .PNG &amp; .ZIP Vault →
                    </span>
                  </div>
                </div>
              </div>

              {/* PRIMARY HERO CTA ROW */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    data-testid="hero-launch-studio-btn"
                    className="btn-gold"
                    onClick={() =>
                      launchStudioWithTransition({
                        job: selectedJob,
                        backdrop: backdropStyle,
                        stageMode: 'compare'
                      })
                    }
                    style={{
                      flex: '1 1 210px',
                      padding: '13px 16px',
                      fontSize: '13.5px',
                      fontWeight: 700
                    }}
                  >
                    <Sparkles size={16} />
                    <span>Launch Studio Workspace →</span>
                  </button>

                  <button
                    type="button"
                    data-testid="hero-upload-photo-btn"
                    className="btn-accent"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      flex: '1 1 180px',
                      padding: '13px 16px',
                      fontSize: '13.5px',
                      fontWeight: 700
                    }}
                  >
                    <Upload size={16} />
                    <span>Drop Your Photo</span>
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    fontSize: '11.5px',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <span>✓ Free on-device studio · ✓ Windows &amp; Android app ready</span>
                  <button
                    type="button"
                    onClick={() => {
                      document
                        .getElementById('commercial-catalog-section')
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--gold)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline'
                    }}
                  >
                    View 5 Studio Packs ($9–$149) ↓
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: LIVE INTERACTIVE PRODUCT-TO-PROTOTYPE SANDBOX */}
            <div className="prototype-stage-card" data-testid="hero-interactive-prototype">
              <div className="prototype-top-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="prototype-live-dot" />
                  <span
                    className="mono-num"
                    style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold)' }}
                  >
                    LIVE PROTOTYPE · CLICK A PHOTO &amp; DRAG SLIDER
                  </span>
                </div>
                <button
                  type="button"
                  className="filter-chip"
                  onClick={() => setIsAutoSweepHero((v) => !v)}
                  style={{ fontSize: '10.5px', padding: '4px 9px' }}
                >
                  {isAutoSweepHero ? '⏸ Pause Auto-Scan' : '▶ Auto-Scan'}
                </button>
              </div>

              {/* VISUAL PHOTO THUMBNAIL STRIP */}
              <div className="prototype-thumb-strip">
                {jobs
                  .filter((j) => j.is_showcase && j.status === 'completed')
                  .map((sampleJob) => {
                    const isCurrent = selectedJob?.job_id === sampleJob.job_id;
                    return (
                      <button
                        key={sampleJob.job_id}
                        type="button"
                        onClick={() => setSelectedJob(sampleJob)}
                        className={`prototype-thumb-btn ${isCurrent ? 'active' : ''}`}
                        title={sampleJob.title}
                      >
                        <img
                          src={sampleJob.thumb_url || sampleJob.original_url}
                          alt={sampleJob.title}
                          loading="lazy"
                        />
                      </button>
                    );
                  })}
              </div>

              {/* INTERACTIVE BEFORE/AFTER LASER SCANNER VIEWPORT */}
              <div
                ref={heroSliderRef}
                className="slider-container"
                role="slider"
                tabIndex={0}
                aria-label="Interactive Prototype Before and After Cutout Scanner"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(sliderPos)}
                onKeyDown={handleSliderKeyDown}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  updateHeroSliderFromPointer(e.clientX);
                }}
                onPointerMove={(e) => {
                  if (e.buttons === 1) {
                    updateHeroSliderFromPointer(e.clientX);
                  }
                }}
                style={{ minHeight: '290px', maxHeight: '325px' }}
              >
                {/* AFTER: Studio Composite */}
                <img
                  src={
                    activePreviewUrl ||
                    selectedJob?.thumb_url ||
                    '/samples/sports_coupe_after.jpg'
                  }
                  alt="Cleaned Studio Composite"
                  className="slider-image-layer"
                  draggable={false}
                />

                {/* BEFORE: Raw Photo Clipped by Slider */}
                <img
                  src={
                    selectedJob?.aligned_before_url ||
                    selectedJob?.original_url ||
                    '/samples/sports_coupe_before.jpg'
                  }
                  alt="Raw Original Subject"
                  className="slider-image-layer"
                  draggable={false}
                  style={{
                    clipPath: `inset(0 ${100 - sliderPos}% 0 0)`
                  }}
                />

                <div className="slider-divider" style={{ left: `${sliderPos}%` }}>
                  <div className="slider-handle-circle">⇄</div>
                </div>

                <div className="stage-pill before">RAW INPUT</div>
                <div className="stage-pill after">
                  {activeBackdropInfo.shortLabel.toUpperCase()}
                </div>
              </div>

              {/* COMPACT BACKDROP SWATCH BAR + OPEN IN STUDIO BUTTON */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {FIVE_BACKDROP_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBackdropStyle(opt.id)}
                      className={`filter-chip ${backdropStyle === opt.id ? 'active' : ''}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 9px',
                        fontSize: '11px'
                      }}
                    >
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '3px',
                          background: opt.swatchBg,
                          border: '1px solid rgba(255,255,255,0.28)',
                          display: 'inline-block'
                        }}
                      />
                      <span>{opt.shortLabel}</span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  data-testid="prototype-open-in-studio-btn"
                  className="btn-gold"
                  onClick={() =>
                    launchStudioWithTransition({
                      job: selectedJob,
                      backdrop: backdropStyle,
                      stageMode: 'compare'
                    })
                  }
                  style={{ padding: '7px 13px', fontSize: '12px' }}
                >
                  <Sparkles size={13} />
                  <span>Edit in Full Studio →</span>
                </button>
              </div>
            </div>
          </section>
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
                  job.previewByStyle?.[backdropStyle] ||
                  job.previewByStyle?.corkboard ||
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
                    <div className="contact-thumb-wrap" onContextMenu={(e) => e.preventDefault()}>
                      <img
                        src={thumbSrc}
                        alt={job.title || job.original_filename}
                        loading="lazy"
                        draggable={false}
                        onContextMenu={(e) => e.preventDefault()}
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
                    {activeBackdropInfo.index} / 11
                  </span>
                </div>
                <div className="form-group">
                  <label htmlFor="backdrop-select">
                    <span>Active Studio Environment</span>
                    <button
                      type="button"
                      onClick={() => {
                        setProModalTab('packs');
                        setShowProModal(true);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        color: 'var(--gold)',
                        fontSize: '11px',
                        textDecoration: 'underline',
                        cursor: 'pointer'
                      }}
                    >
                      + Unlock Backdrop Packs
                    </button>
                  </label>
                  <select
                    id="backdrop-select"
                    value={backdropStyle}
                    onChange={(e) => handleSelectBackdropStyle(e.target.value)}
                  >
                    <optgroup label="Included Starter Studio Backdrops (01–05)">
                      {FIVE_BACKDROP_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.index} — {opt.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label=" Industry Upsell Backdrop Packs (Server-Gated 06–11)">
                      {PREMIUM_BACKDROP_OPTIONS.map((opt) => {
                        const unlocked = isPackUnlocked(opt.packId);
                        return (
                          <option key={opt.id} value={opt.id}>
                            {unlocked ? '✓' : '🔒'} {opt.index} — {opt.label} ({opt.packName})
                          </option>
                        );
                      })}
                    </optgroup>
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
                    onClick={() => {
                      const nextMode = stageMode === 'refine' ? 'compare' : 'refine';
                      setStageMode(nextMode);
                      if (nextMode === 'refine') {
                        triggerInstructionalEvent('enter_refine_mode');
                      }
                    }}
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

              {/* STEP 4: EXPORT (CENTRALIZED ENTITLEMENT GATE & UPFRONT TRIAL DISCLOSURE) */}
              <div className="workflow-section">
                <div className="workflow-section-header">
                  <h3 className="workflow-step-title">
                    <span className="workflow-step-num">4</span>
                    <span>Export</span>
                  </h3>
                  <span
                    data-testid="sidebar-trial-allowance-badge"
                    className="mono-num"
                    onClick={() => !isProUnlocked && setShowProModal(true)}
                    style={{
                      fontSize: '10.5px',
                      color: isProUnlocked
                        ? '#6ee7b7'
                        : trialState.remainingCount > 0
                        ? 'var(--gold)'
                        : '#fcd34d',
                      cursor: isProUnlocked ? 'default' : 'pointer',
                      fontWeight: 600
                    }}
                    title="Free trial includes 3 clean single-image exports. Unlock Studio Pro ($19) for unlimited & batch .ZIP exports."
                  >
                    {isProUnlocked
                      ? 'PRO · UNLIMITED EXPORTS'
                      : `TRIAL · ${trialState.remainingCount}/${trialState.maxAllowance} EXPORTS LEFT`}
                  </span>
                </div>

                {!isProUnlocked && (
                  <div
                    style={{
                      fontSize: '11.2px',
                      color: 'var(--text-secondary)',
                      background: 'rgba(229, 193, 88, 0.08)',
                      border: '1px solid rgba(229, 193, 88, 0.25)',
                      borderRadius: '7px',
                      padding: '7px 9px',
                      lineHeight: 1.38
                    }}
                  >
                    Free tier includes <strong style={{ color: 'var(--text-primary)' }}>{trialState.maxAllowance} clean trial exports</strong> ({trialState.remainingCount} remaining). Batch <code>.ZIP</code> &amp; unlimited exports require{' '}
                    <button
                      type="button"
                      onClick={() => setShowProModal(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: 'var(--gold)',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: '11.2px'
                      }}
                    >
                      Studio Pro ($19)
                    </button>
                    .
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    data-testid="export-master-btn"
                    className="btn-gold"
                    disabled={!selectedJob || !activeCleanDownloadUrl}
                    onMouseEnter={() => setHoveredControlKey('export_master_jpg_png')}
                    onMouseLeave={() => setHoveredControlKey(null)}
                    onFocus={() => setHoveredControlKey('export_master_jpg_png')}
                    onClick={() => {
                      const base = selectedJob.original_filename.replace(/\.[^/.]+$/, '');
                      const ext = backdropStyle === 'transparent' ? 'png' : 'jpg';
                      downloadImage(activeCleanDownloadUrl, `${base}_${backdropStyle}.${ext}`, ext);
                    }}
                  >
                    <Download size={14} />
                    Download {activeBackdropInfo.shortLabel} ({backdropStyle === 'transparent' ? '.PNG' : '.JPG'})
                  </button>

                  <button
                    type="button"
                    data-testid="export-alpha-png-btn"
                    className="btn-secondary"
                    disabled={!selectedJob}
                    onMouseEnter={() => setHoveredControlKey('export_master_jpg_png')}
                    onMouseLeave={() => setHoveredControlKey(null)}
                    onFocus={() => setHoveredControlKey('export_master_jpg_png')}
                    onClick={() => {
                      const base = selectedJob.original_filename.replace(/\.[^/.]+$/, '');
                      const pngUrl =
                        selectedJob.full_res_alpha_url ||
                        selectedJob.cleanByStyle?.transparent ||
                        selectedJob.trimmed_sticker_url;
                      downloadImage(pngUrl, `${base}_alpha_cutout.png`, 'png');
                    }}
                  >
                    <ImageIcon size={14} />
                    Download Transparent Cutout (.PNG — Full Res)
                  </button>

                  <button
                    type="button"
                    data-testid="export-vector-svg-btn"
                    className="btn-accent"
                    disabled={!selectedJob?.svg_markup}
                    onMouseEnter={() => setHoveredControlKey('export_vector_svg')}
                    onMouseLeave={() => setHoveredControlKey(null)}
                    onFocus={() => setHoveredControlKey('export_vector_svg')}
                    onClick={() => downloadSingleSvg(selectedJob)}
                  >
                    <FileCode size={14} />
                    Download Vector-Clipped Cutline (.SVG)
                  </button>

                  <button
                    type="button"
                    data-testid="export-batch-zip-btn"
                    className="btn-secondary"
                    disabled={completedJobs.length === 0}
                    onMouseEnter={() => setHoveredControlKey('export_batch_zip')}
                    onMouseLeave={() => setHoveredControlKey(null)}
                    onFocus={() => setHoveredControlKey('export_batch_zip')}
                    onClick={downloadSvgPackZip}
                  >
                    <Archive size={14} />
                    Export Batch Archive ({completedJobs.length} .SVG in .ZIP) {!isProUnlocked ? '· PRO' : ''}
                  </button>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      data-testid="export-save-as-btn"
                      className="btn-secondary"
                      disabled={!selectedJob || !activeCleanDownloadUrl}
                      onClick={() => handleSaveAsNativeDesktop(selectedJob)}
                      style={{ flex: 1, padding: '7px 9px', fontSize: '11.5px' }}
                    >
                      Save As...
                    </button>
                    <button
                      type="button"
                      data-testid="export-copy-clipboard-btn"
                      className="btn-secondary"
                      disabled={!selectedJob}
                      onClick={() => handleCopyCutoutToClipboard(selectedJob)}
                      style={{ flex: 1, padding: '7px 9px', fontSize: '11.5px' }}
                    >
                      Copy .PNG
                    </button>
                  </div>
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
                    <label htmlFor="watermark-input">Custom Brand Watermark Text (Optional)</label>
                    <input
                      id="watermark-input"
                      type="text"
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      placeholder="Leave blank for clean watermark-free preview"
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

              {/* B2B DONE-FOR-YOU CATALOG SERVICE CTA (STRIPE) */}
              <div
                className="workflow-section"
                style={{
                  borderColor: 'rgba(229, 193, 88, 0.35)',
                  background: 'linear-gradient(180deg, rgba(229, 193, 88, 0.07) 0%, rgba(10, 12, 18, 0.85) 100%)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono-num" style={{ fontSize: '10.5px', color: 'var(--gold)', fontWeight: 600 }}>
                    WHITE-GLOVE B2B SERVICE
                  </span>
                  <span className="mono-num" style={{ fontSize: '10.5px', color: '#6ee7b7', fontWeight: 600 }}>
                    STRIPE CHECKOUT
                  </span>
                </div>
                <p className="workflow-step-desc" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  Need 100–200+ rental, auto, or product photos cleaned &amp; staged on custom brand backdrops?
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowProModal(true)}
                  style={{ width: '100%', borderColor: 'rgba(229, 193, 88, 0.45)', color: 'var(--gold)' }}
                >
                  <Sparkles size={13} /> Order Bulk Catalog Batch / Studio Pro →
                </button>
              </div>
            </aside>

            {/* ==================== RIGHT COLUMN: 5-ENVIRONMENT STAGE & EDGE REFINER ==================== */}
            <main className="card" aria-label="Inspection and Refinement Stage">
              <div className="card-header">
                <div className="card-title-group">
                  <span className="card-step-label">
                    {stageMode === 'refine'
                      ? 'MANUAL EDGE REFINEMENT WORKSPACE'
                      : `ENVIRONMENT COMPOSITOR (${activeBackdropInfo.index} / 11)`}
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
                      onClick={() => {
                        setStageMode('refine');
                        triggerInstructionalEvent('enter_refine_mode');
                      }}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      <Brush size={13} /> Refine Edges
                    </button>
                  </div>
                </div>
              </div>

              {/* LAYER C: CONTEXT-SENSITIVE INSTRUCTIONAL STATUS BAR */}
              <div
                className="instructional-status-bar"
                data-testid="instructional-status-bar"
                role="status"
                aria-live="polite"
              >
                <div className="status-bar-left">
                  <span className="status-bar-feature-pill">{activeStatusBar.feature}</span>
                  <span className="status-bar-guidance">{activeStatusBar.guidance}</span>
                </div>
                <div className="status-bar-right">
                  {activeStatusBar.shortcut && (
                    <span className="status-bar-shortcut">{activeStatusBar.shortcut}</span>
                  )}
                  <button
                    type="button"
                    data-testid="status-bar-trial-pill"
                    className={`status-bar-trial-pill ${!isProUnlocked && trialState.remainingCount === 0 ? 'exhausted' : ''}`}
                    onClick={() => !isProUnlocked && setShowProModal(true)}
                  >
                    {activeStatusBar.trialBadge}
                  </button>
                </div>
              </div>

              {/* LAYER B: EVENT-DRIVEN CONTEXTUAL INSTRUCTIONAL HINT CALLOUT */}
              {activeHint && (
                <div
                  className="contextual-hint-callout"
                  data-testid={`contextual-hint-${activeHint.id}`}
                  role="region"
                  aria-label={`Contextual Tip: ${activeHint.title}`}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1 1 380px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="mono-num" style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: 700 }}>
                        WORKSTATION TIP · {activeHint.title.toUpperCase()}
                      </span>
                      <span className="mono-num" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        {activeHint.shortcut}
                      </span>
                    </div>
                    <span style={{ fontSize: '12.3px', color: 'var(--text-primary)' }}>
                      {activeHint.message}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      type="button"
                      data-testid="dismiss-hint-btn"
                      className="btn-gold"
                      onClick={() => dismissContextualHint(activeHint.id, true)}
                      style={{ padding: '5px 10px', fontSize: '11px' }}
                    >
                      Got It
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={toggleAutoHints}
                      style={{ padding: '5px 9px', fontSize: '11px' }}
                    >
                      Mute Tips
                    </button>
                  </div>
                </div>
              )}

              {/* LAYER D: TOGGLEABLE GUIDE MODE & RICH CONTROL INSPECTOR */}
              {instructionalState.guideModeEnabled && (
                <section
                  className="guide-mode-panel"
                  data-testid="guide-mode-inspector"
                  aria-label="Interactive Guide Mode Technical Control Inspector"
                >
                  <div className="guide-control-list" role="tablist" aria-label="Technical Controls">
                    {Object.values(RICH_CONTROL_GUIDES).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        data-testid={`guide-item-${item.id}`}
                        className={`guide-control-item ${selectedGuideControlKey === item.id ? 'active' : ''}`}
                        onClick={() => setSelectedGuideControlKey(item.id)}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <span className="mono-num" style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 700 }}>
                          LAYER D · GUIDE MODE TECHNICAL INSPECTOR (NON-DESTRUCTIVE)
                        </span>
                        <h3 style={{ margin: '2px 0 0', fontSize: '15px', color: 'var(--text-primary)' }}>
                          {activeGuideDetail.title}
                        </h3>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setShowTechniqueModal(true)}
                          style={{ padding: '5px 10px', fontSize: '11px' }}
                        >
                          Open Technique Library →
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={toggleGuideMode}
                          style={{ padding: '5px 10px', fontSize: '11px' }}
                        >
                          Exit Guide Mode (?)
                        </button>
                      </div>
                    </div>

                    <div className="guide-detail-grid">
                      <div className="guide-detail-box">
                        <strong style={{ color: 'var(--gold)', display: 'block', marginBottom: '3px' }}>
                          What It Does &amp; When Useful
                        </strong>
                        {activeGuideDetail.whatItDoes} {activeGuideDetail.whenUseful}
                      </div>
                      <div className="guide-detail-box">
                        <strong style={{ color: '#34d399', display: 'block', marginBottom: '3px' }}>
                          Increasing / Decreasing Value
                        </strong>
                        {activeGuideDetail.valueEffect}
                      </div>
                      <div className="guide-detail-box">
                        <strong style={{ color: '#38bdf8', display: 'block', marginBottom: '3px' }}>
                          Trade-Offs &amp; Related Controls
                        </strong>
                        {activeGuideDetail.tradeOffs} ({activeGuideDetail.related})
                      </div>
                    </div>
                  </div>
                </section>
              )}

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
                        onMouseEnter={() => setHoveredControlKey('brush_restore')}
                        onMouseLeave={() => setHoveredControlKey(null)}
                        onClick={() => {
                          setBrushMode('add');
                          triggerInstructionalEvent('select_brush_tool', true);
                        }}
                      >
                        <Brush size={13} /> Restore Artwork (+)
                      </button>
                      <button
                        type="button"
                        data-testid="brush-erase-btn"
                        className={brushMode === 'erase' ? 'btn-gold' : 'btn-secondary'}
                        onMouseEnter={() => setHoveredControlKey('brush_erase')}
                        onMouseLeave={() => setHoveredControlKey(null)}
                        onClick={() => {
                          setBrushMode('erase');
                          triggerInstructionalEvent('select_brush_tool', true);
                        }}
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
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                      cursor: brushMode === 'pan' ? 'grab' : 'crosshair'
                    }}
                  >
                    <canvas
                      ref={refinerCanvasRef}
                      data-testid="refiner-canvas"
                      className="refiner-canvas"
                      onContextMenu={(e) => e.preventDefault()}
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

                    <div
                      className="refiner-slider-box"
                      onMouseEnter={() => setHoveredControlKey('edge_expand')}
                      onMouseLeave={() => setHoveredControlKey(null)}
                    >
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

                    <div
                      className="refiner-slider-box"
                      onMouseEnter={() => setHoveredControlKey('edge_feather')}
                      onMouseLeave={() => setHoveredControlKey(null)}
                    >
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

                    <div
                      className="refiner-slider-box"
                      onMouseEnter={() => setHoveredControlKey('color_decontam')}
                      onMouseLeave={() => setHoveredControlKey(null)}
                    >
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

      {/* ==================== COMMERCIAL PRODUCT SHOWCASE, PRICING & SEO LANDING SECTION (SHOWN ON LANDING PAGE) ==================== */}
      {activeTab === 'landing' && (
        <section
          id="commercial-catalog-section"
          className="card"
          aria-label="Studio Backdrop Packs, All-Access Pro & B2B Bulk Catalog Pricing"
          style={{ marginTop: '4px' }}
        >
          <div className="card-header">
            <div className="card-title-group">
              <span className="card-step-label">COMMERCIAL STUDIO CATALOG · POWERED BY STRIPE</span>
              <h2 className="card-title">
                Industry Backdrop Packs, All-Access Studio Pro &amp; White-Glove B2B Catalog Service
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-gold"
                onClick={() =>
                  launchStudioWithTransition({
                    job: selectedJob,
                    backdrop: backdropStyle,
                    stageMode: 'compare'
                  })
                }
              >
                <Sparkles size={14} /> Try Free Studio Workspace First →
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setProModalTab('b2b');
                  setShowProModal(true);
                }}
              >
                <Package size={14} /> Open B2B 200-Photo Folder Intake
              </button>
            </div>
          </div>

          <div className="catalog-five-grid">
            {[
              {
                tier: 'pro',
                badge: '⭐ ALL-ACCESS',
                title: 'Studio Pro Bundle',
                price: '$19',
                img: '/products/01_CleanSnap_AllAccess_Pro_Bundle_1080x1080.png',
                desc: 'All 11 Studio Backdrops · Batch .SVG & .ZIP Vault',
                btnClass: 'btn-gold',
                btnLabel: 'Unlock Pro ($19) →'
              },
              {
                tier: 'pack_rental',
                badge: 'PACK 01 · RENTAL',
                title: 'Event & Party Rental',
                price: '$9',
                img: '/products/02_CleanSnap_Event_Party_Rental_Pack_1080x1080.png',
                desc: '06 Twilight Patio Turf · 07 Hardwood Pavilion',
                btnClass: 'btn-secondary',
                btnLabel: 'Rental Pack ($9) →'
              },
              {
                tier: 'pack_auto',
                badge: 'PACK 02 · AUTO',
                title: 'Auto & Showroom',
                price: '$9',
                img: '/products/03_CleanSnap_Auto_Showroom_Pack_1080x1080.png',
                desc: '08 Wet Obsidian Cyclorama · 09 LED Dealership Bay',
                btnClass: 'btn-secondary',
                btnLabel: 'Auto Pack ($9) →'
              },
              {
                tier: 'pack_ecom',
                badge: 'PACK 03 · E-COM',
                title: 'Apparel & Editorial',
                price: '$9',
                img: '/products/04_CleanSnap_ECommerce_Apparel_Pack_1080x1080.png',
                desc: '10 Travertine Podium · 11 Sand Linen Gallery',
                btnClass: 'btn-secondary',
                btnLabel: 'E-Com Pack ($9) →'
              },
              {
                tier: 'b2b',
                badge: 'B2B CONCIERGE',
                title: '200-Photo Bulk Batch',
                price: '$149',
                img: '/products/05_CleanSnap_B2B_200Photo_Bulk_Catalog_1080x1080.png',
                desc: 'Done-For-You 200-Photo Drive/Dropbox Turnkey Batch',
                btnClass: 'btn-accent',
                btnLabel: '200-Photo Batch ($149) →'
              }
            ].map((item) => (
              <article
                key={item.tier}
                className="workflow-section"
                style={{
                  padding: '12px',
                  justifyContent: 'space-between',
                  borderColor:
                    item.tier === 'pro'
                      ? 'rgba(229, 193, 88, 0.5)'
                      : item.tier === 'b2b'
                      ? 'rgba(16, 185, 129, 0.45)'
                      : 'var(--border-subtle)'
                }}
              >
                <div>
                  <img
                    src={item.img}
                    alt={item.title}
                    loading="lazy"
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      marginBottom: '9px',
                      border: '1px solid var(--border-subtle)'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                    <span className="mono-num" style={{ fontSize: '9.5px', color: 'var(--gold)', fontWeight: 700 }}>
                      {item.badge}
                    </span>
                    <span className="mono-num" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {item.price}
                    </span>
                  </div>
                  <h3 style={{ margin: '4px 0 3px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {item.title}
                  </h3>
                  <p className="workflow-step-desc" style={{ fontSize: '11px', marginBottom: '10px', lineHeight: 1.38 }}>
                    {item.desc}
                  </p>
                </div>
                <button
                  type="button"
                  className={item.btnClass}
                  disabled={isCheckingOutStripe}
                  onClick={() => handleStartStripeCheckout(item.tier)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '11.5px' }}
                >
                  {item.btnLabel}
                </button>
              </article>
            ))}
          </div>

          {/* COMPANION CATALOG SHELF: 3 LITERARY BRUTALISM LIVE PRODUCTS IN CONTEXT & MUSE LLC (acct_1UeNRLBrNU5pKwT3) */}
          <div
            style={{
              marginTop: '14px',
              paddingTop: '14px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span className="mono-num" style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                COMPANION DESIGN SYSTEM BY CONTEXT &amp; MUSE LLC · LITERARY BRUTALISM EDITION 001
              </span>
              <a
                href="https://literary-brutalism.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="mono-num"
                style={{ fontSize: '11px', color: 'var(--gold)', textDecoration: 'none' }}
              >
                Preview Literary Brutalism Studio ↗
              </a>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '12px'
              }}
            >
              {[
                {
                  tier: 'lb_standard_49',
                  badge: 'EDITION 001 · STANDARD',
                  title: 'Literary Brutalism — Standard Studio Template',
                  price: '$49',
                  desc: 'Browser Studio Editor · Static .ZIP Exporter · 23 Vector SVGs'
                },
                {
                  tier: 'lb_complete_89',
                  badge: 'EDITION 001 · COMPLETE KIT',
                  title: 'Literary Brutalism — Complete Studio + Figma Bundle',
                  price: '$89',
                  desc: 'Standard Template + 5-Board 1440px Editable Figma Kit & Catalog'
                },
                {
                  tier: 'lb_agency_199',
                  badge: 'EDITION 001 · AGENCY LICENSE',
                  title: 'Literary Brutalism — Agency / Unlimited Commercial',
                  price: '$199',
                  desc: 'Complete Kit + Unlimited Client Builds & Full Modular Source Repo'
                }
              ].map((lb) => (
                <article
                  key={lb.tier}
                  className="workflow-section"
                  style={{
                    padding: '11px 13px',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="mono-num" style={{ fontSize: '9.5px', color: 'var(--gold)', fontWeight: 700 }}>
                        {lb.badge}
                      </span>
                      <span className="mono-num" style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {lb.price}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        margin: '2px 0'
                      }}
                    >
                      {lb.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{lb.desc}</div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={isCheckingOutStripe}
                    onClick={() => handleStartStripeCheckout(lb.tier)}
                    style={{ padding: '7px 11px', fontSize: '11px', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    Buy ({lb.price}) →
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
