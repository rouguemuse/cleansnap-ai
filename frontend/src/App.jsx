import React, { useState, useRef, useEffect } from 'react';
import {
  Folder,
  Upload,
  Download,
  Sparkles,
  Image as ImageIcon,
  Archive,
  Sliders,
  Layout,
  Plus,
  Trash2,
  Type,
  Package,
  Move,
  FileCode,
  Layers
} from 'lucide-react';
import JSZip from 'jszip';
import {
  segmentSubjectPermissive,
  traceMarchingSquaresSvgPath
} from './lib/mitSegmentationEngine';
import './App.css';

// The 5 Official Studio Backdrops (Zero Emojis — Clean Tactile Material Swatches & Monospace Indices)
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
    description: 'Zero-background die-cut alpha master for 1-Click .SVG export & scene layering'
  }
];

// Pre-loaded Showcase Pairs: #01 is Figure on Green Screen, #02 is 1 Bounce House, #03-#06 are 4 User Images
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
    is_showcase: true
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

// Compute SHA-256 content hash in browser
async function hashArrayBuffer(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Find non-transparent bounding box of an RGBA canvas
function getTransparentBoundingBox(ctx, width, height) {
  const imgData = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = 0, maxY = 0;
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
  if (!found) return { x: 0, y: 0, w: width, h: height };
  return { x: minX, y: minY, w: Math.max(1, maxX - minX + 1), h: Math.max(1, maxY - minY + 1) };
}

/**
 * Build a standalone, scalable .SVG string containing:
 * - Scalable viewBox matching the trimmed element dimensions
 * - True 2D Marching Squares + Douglas-Peucker multi-contour & hole <path id="element_cutline_contour">
 * - Applied <clipPath id="element_clip"> on the high-res cutout element
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

// Cache the 4 Photorealistic Studio Backdrop Photographs (Green Screen Studio, Cork Bulletin Board, Belgian Slate Chalkboard, Sunny Grass Yard)
const cachedBackdrops = {
  greenScreen: null,
  corkboard: null,
  chalkboard: null,
  grass: null
};

async function loadImageSafe(src) {
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
 * Bake the Diagonal Anti-Theft Watermark DIRECTLY into a Preview Canvas
 * so that inspecting browser DOM or Network images NEVER exposes an unwatermarked master.
 */
function createWatermarkedPreviewDataUrl(sourceCanvas, watermarkText = 'EDR PARTY RENTALS • PREVIEW ONLY') {
  const prevW = 1040;
  const prevH = Math.round((sourceCanvas.height / sourceCanvas.width) * prevW);
  const c = document.createElement('canvas');
  c.width = prevW;
  c.height = prevH;
  const ctx = c.getContext('2d');

  // Subtle dark obsidian checkerboard behind transparent previews
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

  // Destructively rasterize refined diagonal watermark text across the preview pixels
  if (watermarkText && watermarkText.trim()) {
    ctx.save();
    ctx.translate(prevW / 2, prevH / 2);
    ctx.rotate((-24 * Math.PI) / 180);
    ctx.font = '600 15px "JetBrains Mono", monospace';
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

  return c.toDataURL('image/jpeg', 0.90);
}

/**
 * Multi-Stage Bounce House Vinyl Polish, De-Wrinkle, Sunlight Warmth & Color Pop Engine
 */
function processBounceHouseVinylPolish(origImg, cutoutImg, polishIntensity = 'high') {
  const w = origImg.width;
  const h = origImg.height;

  const subjectCanvas = document.createElement('canvas');
  subjectCanvas.width = w;
  subjectCanvas.height = h;
  const ctx = subjectCanvas.getContext('2d');
  ctx.drawImage(origImg, 0, 0, w, h);

  let smoothData = null;
  if (polishIntensity !== 'off') {
    const smoothCanvas = document.createElement('canvas');
    smoothCanvas.width = w;
    smoothCanvas.height = h;
    const smoothCtx = smoothCanvas.getContext('2d');
    smoothCtx.filter = 'blur(2.0px)';
    smoothCtx.drawImage(origImg, 0, 0, w, h);
    smoothData = smoothCtx.getImageData(0, 0, w, h).data;
  }

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let maskData = null;
  let keepFullScene = !cutoutImg;

  if (cutoutImg) {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const maskCtx = maskCanvas.getContext('2d');
    maskCtx.drawImage(cutoutImg, 0, 0, w, h);
    maskData = maskCtx.getImageData(0, 0, w, h).data;

    let opaqueCount = 0;
    for (let i = 0; i < maskData.length; i += 4) {
      if (maskData[i + 3] > 60) opaqueCount++;
    }
    if (opaqueCount / (w * h) < 0.04) {
      keepFullScene = true;
    }
  }

  const shadowLiftGamma = polishIntensity === 'high' ? 0.74 : polishIntensity === 'medium' ? 0.85 : 1.0;
  const contrastGain = polishIntensity === 'high' ? 1.16 : polishIntensity === 'medium' ? 1.09 : 1.0;
  const vibranceBoost = polishIntensity === 'high' ? 0.40 : polishIntensity === 'medium' ? 0.22 : 0.0;
  const vinylSheen = polishIntensity === 'high' ? 14 : polishIntensity === 'medium' ? 7 : 0;

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
        ? 5.5 * Math.sin(norm * Math.PI)
        : polishIntensity === 'medium'
        ? 3.0 * Math.sin(norm * Math.PI)
        : 0;
    lutR[v] = Math.max(0, Math.min(255, Math.round(baseOut + warmShift * 1.15)));
    lutG[v] = Math.max(0, Math.min(255, Math.round(baseOut + warmShift * 0.45)));
    lutB[v] = Math.max(0, Math.min(255, Math.round(baseOut - warmShift * 0.65)));
  }

  for (let i = 0; i < data.length; i += 4) {
    if (!keepFullScene && maskData) {
      const a = maskData[i + 3];
      if (a < 14) {
        data[i + 3] = 0;
        continue;
      }
      data[i + 3] = a > 225 ? 255 : a;
    } else {
      data[i + 3] = 255;
    }

    let rOrig = data[i];
    let gOrig = data[i + 1];
    let bOrig = data[i + 2];

    if (smoothData) {
      const diff =
        Math.abs(rOrig - smoothData[i]) +
        Math.abs(gOrig - smoothData[i + 1]) +
        Math.abs(bOrig - smoothData[i + 2]);
      if (diff < 40) {
        const smoothWeight = (1.0 - diff / 40.0) * 0.36;
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

  if (polishIntensity !== 'off') {
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = w;
    blurCanvas.height = h;
    const blurCtx = blurCanvas.getContext('2d');
    blurCtx.filter = 'blur(1.2px)';
    blurCtx.drawImage(subjectCanvas, 0, 0);

    const sharpData = ctx.getImageData(0, 0, w, h);
    const sp = sharpData.data;
    const bp = blurCtx.getImageData(0, 0, w, h).data;
    const amount = polishIntensity === 'high' ? 0.42 : 0.25;

    for (let i = 0; i < sp.length; i += 4) {
      if (sp[i + 3] === 0) continue;
      const dR = sp[i] - bp[i];
      const dG = sp[i + 1] - bp[i + 1];
      const dB = sp[i + 2] - bp[i + 2];
      if (Math.abs(dR) + Math.abs(dG) + Math.abs(dB) > 18) {
        sp[i] = Math.max(0, Math.min(255, Math.round(sp[i] + dR * amount)));
        sp[i + 1] = Math.max(0, Math.min(255, Math.round(sp[i + 1] + dG * amount)));
        sp[i + 2] = Math.max(0, Math.min(255, Math.round(sp[i + 2] + dB * amount)));
      }
    }
    ctx.putImageData(sharpData, 0, 0);
  }

  return subjectCanvas;
}

/**
 * Build All 5 Photorealistic Studio Backdrop Composites + Baked Watermarked Previews + Marching Squares .SVG
 */
async function buildAllFiveBackdropsAndSvg(
  originalFileOrUrl,
  cutoutBlobOrUrl,
  polishIntensity = 'high',
  watermarkText = 'EDR PARTY RENTALS • PREVIEW ONLY',
  prebakedGrassYardUrl = null
) {
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

  const origImg = await loadImageSafe(origUrl);
  const cutImg = cutUrl ? await loadImageSafe(cutUrl) : null;
  const backdrops = await loadAllStudioBackdrops();

  const subjectSourceImg = prebakedGrassYardUrl && cutImg ? cutImg : origImg;
  const effectivePolish = prebakedGrassYardUrl ? 'off' : polishIntensity;
  const subjectCanvas = processBounceHouseVinylPolish(subjectSourceImg, cutImg, effectivePolish);
  const subjectCtx = subjectCanvas.getContext('2d');

  // Tightly cropped Sticker PNG + True Marching Squares Vector-Contour SVG
  const tightBbox = getTransparentBoundingBox(subjectCtx, subjectCanvas.width, subjectCanvas.height);
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
  const drawY = Math.floor((sceneH - drawH) * 0.50);

  // --- OPTION 01: FIGURE ON GREEN SCREEN (Studio Chroma Key Cyclorama) ---
  const gsCanvas = document.createElement('canvas');
  gsCanvas.width = sceneW;
  gsCanvas.height = sceneH;
  const gsCtx = gsCanvas.getContext('2d');
  if (backdrops.greenScreen) {
    gsCtx.drawImage(backdrops.greenScreen, 0, 0, sceneW, sceneH);
  } else {
    gsCtx.fillStyle = '#16a34a';
    gsCtx.fillRect(0, 0, sceneW, sceneH);
  }
  gsCtx.save();
  gsCtx.shadowColor = 'rgba(5, 46, 22, 0.42)';
  gsCtx.shadowBlur = 26;
  gsCtx.shadowOffsetY = 14;
  gsCtx.drawImage(
    subjectCanvas,
    tightBbox.x,
    tightBbox.y,
    tightBbox.w,
    tightBbox.h,
    drawX,
    drawY,
    drawW,
    drawH
  );
  gsCtx.restore();
  const greenScreenUrl = gsCanvas.toDataURL('image/jpeg', 0.95);
  const greenScreenPreviewUrl = createWatermarkedPreviewDataUrl(gsCanvas, watermarkText);

  // --- OPTION 02: CORK BULLETIN BOARD (Photorealistic Honey Cork + Warm Oak Frame) ---
  const corkCanvas = document.createElement('canvas');
  corkCanvas.width = sceneW;
  corkCanvas.height = sceneH;
  const corkCtx = corkCanvas.getContext('2d');
  if (backdrops.corkboard) {
    corkCtx.drawImage(backdrops.corkboard, 0, 0, sceneW, sceneH);
  } else {
    corkCtx.fillStyle = '#c88d55';
    corkCtx.fillRect(0, 0, sceneW, sceneH);
  }
  corkCtx.save();
  corkCtx.shadowColor = 'rgba(42, 22, 8, 0.44)';
  corkCtx.shadowBlur = 24;
  corkCtx.shadowOffsetY = 12;
  corkCtx.drawImage(subjectCanvas, tightBbox.x, tightBbox.y, tightBbox.w, tightBbox.h, drawX, drawY, drawW, drawH);
  corkCtx.restore();
  const corkboardUrl = corkCanvas.toDataURL('image/jpeg', 0.94);
  const corkboardPreviewUrl = createWatermarkedPreviewDataUrl(corkCanvas, watermarkText);

  // --- OPTION 03: BELGIAN SLATE CHALKBOARD (Photorealistic Walnut-Framed Slate) ---
  const cbCanvas = document.createElement('canvas');
  cbCanvas.width = sceneW;
  cbCanvas.height = sceneH;
  const cbCtx = cbCanvas.getContext('2d');
  if (backdrops.chalkboard) {
    cbCtx.drawImage(backdrops.chalkboard, 0, 0, sceneW, sceneH);
  } else {
    cbCtx.fillStyle = '#18181b';
    cbCtx.fillRect(0, 0, sceneW, sceneH);
  }
  cbCtx.save();
  cbCtx.shadowColor = 'rgba(0, 0, 0, 0.62)';
  cbCtx.shadowBlur = 32;
  cbCtx.shadowOffsetY = 14;
  cbCtx.drawImage(
    subjectCanvas,
    tightBbox.x,
    tightBbox.y,
    tightBbox.w,
    tightBbox.h,
    drawX,
    drawY,
    drawW,
    drawH
  );
  cbCtx.restore();
  const chalkboardUrl = cbCanvas.toDataURL('image/jpeg', 0.94);
  const chalkboardPreviewUrl = createWatermarkedPreviewDataUrl(cbCanvas, watermarkText);

  // --- OPTION 04: SUNNY GRASS YARD ---
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = sceneW;
  grassCanvas.height = sceneH;
  const grassCtx = grassCanvas.getContext('2d');

  if (prebakedGrassYardUrl) {
    const preImg = await loadImageSafe(prebakedGrassYardUrl);
    if (preImg) {
      grassCtx.drawImage(preImg, 0, 0, sceneW, sceneH);
    }
  } else {
    if (backdrops.grass) {
      grassCtx.drawImage(backdrops.grass, 0, 0, sceneW, sceneH);
    } else {
      grassCtx.fillStyle = '#3b82f6';
      grassCtx.fillRect(0, 0, sceneW, sceneH * 0.58);
      grassCtx.fillStyle = '#4d7c0f';
      grassCtx.fillRect(0, sceneH * 0.58, sceneW, sceneH * 0.42);
    }

    grassCtx.save();
    const shadowCenterX = drawX + Math.floor(drawW * 0.52);
    const shadowCenterY = drawY + drawH - Math.floor(drawH * 0.02);
    const shadowRx = Math.floor(drawW * 0.48);
    const shadowRy = Math.max(18, Math.floor(drawH * 0.055));
    const ambientGrad = grassCtx.createRadialGradient(
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
    grassCtx.translate(shadowCenterX, shadowCenterY);
    grassCtx.scale(1, shadowRy / shadowRx);
    grassCtx.beginPath();
    grassCtx.arc(0, 0, shadowRx, 0, Math.PI * 2);
    grassCtx.fillStyle = ambientGrad;
    grassCtx.fill();
    grassCtx.restore();

    grassCtx.drawImage(
      subjectCanvas,
      tightBbox.x,
      tightBbox.y,
      tightBbox.w,
      tightBbox.h,
      drawX,
      drawY,
      drawW,
      drawH
    );
  }
  const grassYardUrl = prebakedGrassYardUrl || grassCanvas.toDataURL('image/jpeg', 0.94);
  const grassYardPreviewUrl = createWatermarkedPreviewDataUrl(grassCanvas, watermarkText);

  // --- OPTION 05: ALPHA CUTOUT ---
  const trCanvas = document.createElement('canvas');
  trCanvas.width = sceneW;
  trCanvas.height = sceneH;
  const trCtx = trCanvas.getContext('2d');
  trCtx.drawImage(
    subjectCanvas,
    tightBbox.x,
    tightBbox.y,
    tightBbox.w,
    tightBbox.h,
    drawX,
    drawY,
    drawW,
    drawH
  );
  const transparentUrl = trCanvas.toDataURL('image/png');
  const transparentPreviewUrl = createWatermarkedPreviewDataUrl(trCanvas, watermarkText);

  // Aligned Before Image (1448×1086 4:3)
  const beforeCanvas = document.createElement('canvas');
  beforeCanvas.width = sceneW;
  beforeCanvas.height = sceneH;
  const beforeCtx = beforeCanvas.getContext('2d');
  beforeCtx.fillStyle = '#07080c';
  beforeCtx.fillRect(0, 0, sceneW, sceneH);

  if (prebakedGrassYardUrl) {
    beforeCtx.drawImage(origImg, 0, 0, sceneW, sceneH);
  } else {
    const fullOrigW = Math.round(origImg.width * sceneScale);
    const fullOrigH = Math.round(origImg.height * sceneScale);
    const fullOrigX = Math.round(drawX - tightBbox.x * sceneScale);
    const fullOrigY = Math.round(drawY - tightBbox.y * sceneScale);
    beforeCtx.drawImage(origImg, 0, 0, origImg.width, origImg.height, fullOrigX, fullOrigY, fullOrigW, fullOrigH);
  }
  const alignedBeforeUrl = beforeCanvas.toDataURL('image/jpeg', 0.92);

  if (typeof originalFileOrUrl !== 'string') URL.revokeObjectURL(origUrl);
  if (cutoutBlobOrUrl && typeof cutoutBlobOrUrl !== 'string') URL.revokeObjectURL(cutUrl);

  return {
    alignedBeforeUrl,
    trimmedStickerUrl,
    svgMarkup,
    cleanByStyle: {
      green_screen: greenScreenUrl,
      corkboard: corkboardUrl,
      chalkboard: chalkboardUrl,
      grass_yard: grassYardUrl,
      transparent: transparentUrl
    },
    previewByStyle: {
      green_screen: greenScreenPreviewUrl,
      corkboard: corkboardPreviewUrl,
      chalkboard: chalkboardPreviewUrl,
      grass_yard: grassYardPreviewUrl,
      transparent: transparentPreviewUrl
    }
  };
}

// Presets for Banner & Visual Sentences Builder
const BANNER_PRESETS = [
  { id: 'fb_cover', name: 'Facebook Cover Banner (1640 × 624)', width: 1640, height: 624 },
  { id: 'ig_square', name: 'Instagram Square Post (1080 × 1080)', width: 1080, height: 1080 },
  { id: 'ig_story', name: 'Instagram Story / Reel (1080 × 1920)', width: 1080, height: 1920 },
  { id: 'web_hero', name: 'Editorial Web Hero (1920 × 700)', width: 1920, height: 700 },
  { id: 'print_sheet', name: 'Printable Visual Sentence Sheet (2400 × 1800)', width: 2400, height: 1800 }
];

const BANNER_BACKGROUNDS = [
  { id: 'green_screen', name: '01 · Figure on Green Screen', css: 'url("/backdrops/green_screen_studio.jpg") center/cover no-repeat', colors: ['#22c55e', '#16a34a', '#15803d'] },
  { id: 'corkboard', name: '02 · Cork Bulletin Board', css: 'url("/backdrops/cork_bulletin_board.jpg") center/cover no-repeat', colors: ['#d99b66', '#b8763e', '#9a5b2c'] },
  { id: 'chalkboard', name: '03 · Belgian Slate Chalkboard', css: 'url("/backdrops/slate_chalkboard.jpg") center/cover no-repeat', colors: ['#233b2e', '#192b21', '#0f1c15'] },
  { id: 'grass_yard', name: '04 · Sunny Grass Yard', css: 'url("/backdrops/sunny_park_lawn.jpg") center/cover no-repeat', colors: ['#2563eb', '#60a5fa', '#4d7c0f'] },
  { id: 'obsidian_gold', name: '05 · Obsidian Editorial Gold', css: 'linear-gradient(135deg, #07080c 0%, #151824 55%, #272214 100%)', colors: ['#07080c', '#151824', '#272214'] }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('cleaner'); // 'cleaner' | 'vault' | 'banner'

  // The 5 Background Options ('green_screen' | 'corkboard' | 'chalkboard' | 'grass_yard' | 'transparent')
  const [backdropStyle, setBackdropStyle] = useState('corkboard');
  const [polishIntensity, setPolishIntensity] = useState('high');
  const [watermarkText, setWatermarkText] = useState('EDR PARTY RENTALS • PREVIEW ONLY');

  // Queue & SVG Vault State
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [sliderPos, setSliderPos] = useState(50);
  const [packCategory, setPackCategory] = useState('EDR_Visual_Sentences_SVG_Pack');

  // Banner & Visual Sentences Builder State
  const [selectedPreset, setSelectedPreset] = useState(BANNER_PRESETS[0]);
  const [selectedBg, setSelectedBg] = useState(BANNER_BACKGROUNDS[1]);
  const [bannerLayers, setBannerLayers] = useState([
    {
      id: 'title_1',
      type: 'text',
      text: 'CLEAN IMAGES. CLEAR CHOICES. MORE BOOKINGS.',
      x: 50,
      y: 16,
      scale: 0.85,
      color: '#ffffff'
    }
  ]);
  const [activeLayerId, setActiveLayerId] = useState('title_1');
  const [customTextInput, setCustomTextInput] = useState('');

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const sliderRef = useRef(null);
  const bannerStageRef = useRef(null);
  const seenHashesRef = useRef(new Map());

  // Initialize the 6 Showcase items (#01 Figure on Green Screen + 5 Real EDR Bounce Houses) across all 5 Backdrops
  useEffect(() => {
    let mounted = true;
    async function initShowcase() {
      const placeholderJobs = EDR_SHOWCASE_SAMPLES.map((s) => ({
        job_id: s.job_id,
        original_filename: s.original_filename,
        title: s.title,
        dimensions: s.dimensions,
        subtitle: s.subtitle,
        pack_name: 'EDR_Visual_Sentences_SVG_Pack',
        original_url: s.before_url,
        aligned_before_url: s.before_url,
        trimmed_sticker_url: s.cutout_url,
        svg_markup: null,
        cleanByStyle: {
          green_screen: s.after_park_url,
          corkboard: s.after_park_url,
          chalkboard: s.after_park_url,
          grass_yard: s.after_park_url,
          transparent: s.cutout_url
        },
        previewByStyle: {
          green_screen: s.after_park_url,
          corkboard: s.after_park_url,
          chalkboard: s.after_park_url,
          grass_yard: s.after_park_url,
          transparent: s.cutout_url
        },
        status: 'completed',
        is_showcase: true,
        model_used: 'Permissive MIT/Apache-2.0 Engine + 5-Backdrop Studio',
        processing_time: '0.65'
      }));

      setJobs(placeholderJobs);
      setSelectedJob(placeholderJobs[0]);

      for (const sample of EDR_SHOWCASE_SAMPLES) {
        if (!mounted) return;
        try {
          const built = await buildAllFiveBackdropsAndSvg(
            sample.before_url,
            sample.cutout_url,
            'high',
            watermarkText,
            sample.use_dynamic_backdrops ? null : sample.after_park_url
          );
          if (!mounted) return;
          setJobs((prev) =>
            prev.map((j) =>
              j.job_id === sample.job_id
                ? {
                    ...j,
                    aligned_before_url: built.alignedBeforeUrl,
                    trimmed_sticker_url: built.trimmedStickerUrl,
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
                  aligned_before_url: built.alignedBeforeUrl,
                  trimmed_sticker_url: built.trimmedStickerUrl,
                  svg_markup: built.svgMarkup,
                  cleanByStyle: built.cleanByStyle,
                  previewByStyle: built.previewByStyle
                }
              : prev
          );
        } catch (err) {
          console.warn('Showcase 5-backdrop build warning:', err);
        }
      }
    }
    initShowcase();
    return () => {
      mounted = false;
    };
  }, []);

  // Process uploaded files through our 100% permissive MIT/Apache-2.0 segmentation & 5-Backdrop compositor
  const handleFilesSelected = async (fileList) => {
    const files = Array.from(fileList).filter((f) =>
      /\.(png|jpe?g|webp|bmp|heic|heif)$/i.test(f.name)
    );
    if (files.length === 0) {
      alert('Please select or drop image files (.png, .jpg, .jpeg, .webp).');
      return;
    }

    setIsProcessingBatch(true);

    const newEntries = files.map((file, idx) => ({
      job_id: `job_${Date.now()}_${idx}`,
      file,
      original_filename: file.name,
      title: file.name.replace(/\.[^/.]+$/, ''),
      dimensions: 'CUSTOM',
      subtitle: 'Cleaned, Polished & Rendered Across All 5 Studio Backdrops + Vector-Clipped .SVG',
      pack_name: packCategory,
      original_url: URL.createObjectURL(file),
      aligned_before_url: null,
      trimmed_sticker_url: null,
      svg_markup: null,
      cleanByStyle: null,
      previewByStyle: null,
      status: 'queued',
      model_used: 'Permissive MIT ONNX Engine + 5-Backdrop Compositor',
      processing_time: null
    }));

    setJobs((prev) => [...newEntries, ...prev]);
    setSelectedJob(newEntries[0]);

    for (let i = 0; i < newEntries.length; i++) {
      const entry = newEntries[i];
      const t0 = performance.now();
      setProgressMsg(
        `Cleaning, Polishing & Rendering 5 Backdrops (${i + 1}/${newEntries.length}): ${entry.original_filename}...`
      );

      setJobs((prev) =>
        prev.map((j) => (j.job_id === entry.job_id ? { ...j, status: 'processing' } : j))
      );

      await new Promise((r) => setTimeout(r, 30));

      try {
        const buffer = await entry.file.arrayBuffer();
        const sha256 = `${polishIntensity}_${await hashArrayBuffer(buffer)}`;

        if (seenHashesRef.current.has(sha256)) {
          const canon = seenHashesRef.current.get(sha256);
          const skippedJob = {
            ...entry,
            status: 'skipped',
            model_used: `SHA-256 Duplicate of ${canon.original_filename} (0.01s)`,
            aligned_before_url: canon.aligned_before_url,
            trimmed_sticker_url: canon.trimmed_sticker_url,
            svg_markup: canon.svg_markup,
            cleanByStyle: canon.cleanByStyle,
            previewByStyle: canon.previewByStyle,
            processing_time: 0.01
          };
          setJobs((prev) => prev.map((j) => (j.job_id === entry.job_id ? skippedJob : j)));
          setSelectedJob(skippedJob);
          continue;
        }

        let cutoutBlob = null;
        try {
          cutoutBlob = await segmentSubjectPermissive(entry.file, (stage, current, total) => {
            const pct = total > 0 ? Math.round((current / total) * 100) : 50;
            setProgressMsg(
              `${stage} (${i + 1}/${newEntries.length}: ${entry.original_filename}) — ${pct}%`
            );
          });
        } catch (segErr) {
          console.warn('Segmentation fallback:', segErr);
          cutoutBlob = null;
        }

        const built = await buildAllFiveBackdropsAndSvg(
          entry.file,
          cutoutBlob,
          polishIntensity,
          watermarkText,
          null
        );

        const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
        const completedJob = {
          ...entry,
          status: 'completed',
          aligned_before_url: built.alignedBeforeUrl,
          trimmed_sticker_url: built.trimmedStickerUrl,
          svg_markup: built.svgMarkup,
          cleanByStyle: built.cleanByStyle,
          previewByStyle: built.previewByStyle,
          processing_time: elapsed
        };

        seenHashesRef.current.set(sha256, completedJob);
        setJobs((prev) => prev.map((j) => (j.job_id === entry.job_id ? completedJob : j)));
        setSelectedJob(completedJob);
      } catch (err) {
        console.error('Error processing image:', err);
        setJobs((prev) =>
          prev.map((j) =>
            j.job_id === entry.job_id
              ? { ...j, status: 'failed', error_reason: err.message || 'Processing error' }
              : j
          )
        );
      }
    }

    setProgressMsg('');
    setIsProcessingBatch(false);
  };

  // Download single clean image (100% watermark-free!)
  const downloadImage = (dataUrl, filename) => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1-Click Download single .SVG file
  const downloadSingleSvg = (job) => {
    if (!job?.svg_markup) return;
    const base = job.original_filename.replace(/\.[^/.]+$/, '');
    const blob = new Blob([job.svg_markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    downloadImage(url, `${base}_element.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  // 1-Click Download SVG Pack (.ZIP)
  const downloadSvgPackZip = async () => {
    const completed = jobs.filter(
      (j) => (j.status === 'completed' || j.status === 'skipped') && j.svg_markup
    );
    if (completed.length === 0) return;

    const zip = new JSZip();
    const packFolderName = packCategory.replace(/[^a-z0-9_-]/gi, '_');

    completed.forEach((job, idx) => {
      const base = job.original_filename.replace(/\.[^/.]+$/, '');
      zip.file(`${packFolderName}/${base}_element_${idx + 1}.svg`, job.svg_markup);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    downloadImage(url, `${packFolderName}_${completed.length}_SVG_Pack.zip`);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // Add a cleaned element from the Vault onto the Banner Builder canvas
  const addElementToBanner = (job) => {
    const id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newLayer = {
      id,
      type: 'image',
      name: job.title || job.original_filename,
      src: job.trimmed_sticker_url || job.cleanByStyle?.transparent,
      x: 30 + ((bannerLayers.length * 14) % 45),
      y: 56,
      scale: 0.45
    };
    setBannerLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(id);
    setActiveTab('banner');
  };

  // Add custom headline text to Banner Builder
  const addTextToBanner = () => {
    const textVal = customTextInput.trim() || 'NEW VISUAL SENTENCE BANNER';
    const id = `text_${Date.now()}`;
    setBannerLayers((prev) => [
      ...prev,
      {
        id,
        type: 'text',
        text: textVal,
        x: 50,
        y: 25,
        scale: 1,
        color: selectedBg.textColor || '#ffffff'
      }
    ]);
    setActiveLayerId(id);
    setCustomTextInput('');
  };

  // Export High-Resolution Banner (.SVG) with photorealistic background rendering
  const exportHighResBannerSvg = async () => {
    const w = selectedPreset.width;
    const h = selectedPreset.height;

    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = w;
    bgCanvas.height = h;
    const bgCtx = bgCanvas.getContext('2d');
    const backdrops = await loadAllStudioBackdrops();

    if (selectedBg.id === 'green_screen' && backdrops.greenScreen) {
      bgCtx.drawImage(backdrops.greenScreen, 0, 0, w, h);
    } else if (selectedBg.id === 'corkboard' && backdrops.corkboard) {
      bgCtx.drawImage(backdrops.corkboard, 0, 0, w, h);
    } else if (selectedBg.id === 'chalkboard' && backdrops.chalkboard) {
      bgCtx.drawImage(backdrops.chalkboard, 0, 0, w, h);
    } else if (selectedBg.id === 'grass_yard' && backdrops.grass) {
      bgCtx.drawImage(backdrops.grass, 0, 0, w, h);
    } else if (selectedBg.colors) {
      const grad = bgCtx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, selectedBg.colors[0]);
      grad.addColorStop(0.5, selectedBg.colors[1]);
      grad.addColorStop(1, selectedBg.colors[2]);
      bgCtx.fillStyle = grad;
      bgCtx.fillRect(0, 0, w, h);
    }
    const bgDataUrl = bgCanvas.toDataURL('image/jpeg', 0.92);

    const layerMarkups = [];
    for (const layer of bannerLayers) {
      const cx = Math.round((layer.x / 100) * w);
      const cy = Math.round((layer.y / 100) * h);
      if (layer.type === 'image') {
        const img = await loadImageSafe(layer.src);
        if (img) {
          const targetH = Math.round(h * layer.scale);
          const targetW = Math.round(targetH * (img.width / img.height));
          const x = Math.round(cx - targetW / 2);
          const y = Math.round(cy - targetH / 2);
          layerMarkups.push(
            `  <image x="${x}" y="${y}" width="${targetW}" height="${targetH}" href="${layer.src}" />`
          );
        }
      } else if (layer.type === 'text') {
        const fontSize = Math.round(h * 0.068 * layer.scale);
        const safeText = layer.text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        layerMarkups.push(
          `  <text x="${cx}" y="${cy}" fill="${layer.color || '#ffffff'}" font-family="Syne, Segoe UI, Arial, sans-serif" font-weight="800" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">${safeText}</text>`
        );
      }
    }

    const svgDoc = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <image x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" href="${bgDataUrl}" />
${layerMarkups.join('\n')}
</svg>`;
    const blob = new Blob([svgDoc], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    downloadImage(url, `CleanSnap_${selectedPreset.id}_${selectedBg.id}_${w}x${h}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const handleBannerPointerMove = (e) => {
    if (e.buttons !== 1 || !activeLayerId || !bannerStageRef.current) return;
    const rect = bannerStageRef.current.getBoundingClientRect();
    const xPct = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
    setBannerLayers((prev) =>
      prev.map((l) => (l.id === activeLayerId ? { ...l, x: xPct, y: yPct } : l))
    );
  };

  const updateSliderFromPointer = (clientX) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  };

  const completedJobs = jobs.filter((j) => j.status === 'completed' || j.status === 'skipped');
  const activeLayer = bannerLayers.find((l) => l.id === activeLayerId);

  const activePreviewUrl = selectedJob?.previewByStyle?.[backdropStyle] || null;
  const activeCleanDownloadUrl = selectedJob?.cleanByStyle?.[backdropStyle] || null;
  const activeBackdropInfo =
    FIVE_BACKDROP_OPTIONS.find((b) => b.id === backdropStyle) || FIVE_BACKDROP_OPTIONS[0];

  return (
    <div className="app-container">
      {/* ==================== TOP EDITORIAL STUDIO HEADER ==================== */}
      <header className="studio-header">
        <div className="brand-lockup">
          <div className="brand-eyebrow">
            <span className="brand-eyebrow-dot" />
            <span>CONTEXT &amp; MUSE · COMMERCIAL ASSET LAB</span>
          </div>
          <h1 className="brand-title">
            <span>CleanSnap</span>
            <span className="brand-title-serif">Studio</span>
          </h1>
          <p className="brand-subtitle">
            Automated Vinyl Polish, 5-Stage Environmental Compositing &amp; Marching-Squares Vector Cutline Engine
          </p>
        </div>

        {/* Segmented Navigation Bar */}
        <nav className="nav-pill-group" aria-label="Workspace Mode">
          <button
            className={`nav-pill ${activeTab === 'cleaner' ? 'active' : ''}`}
            onClick={() => setActiveTab('cleaner')}
          >
            <span className="nav-pill-index">01</span>
            <Sparkles size={15} />
            <span>Studio Cleaner &amp; 5 Backdrops</span>
          </button>
          <button
            className={`nav-pill ${activeTab === 'vault' ? 'active' : ''}`}
            onClick={() => setActiveTab('vault')}
          >
            <span className="nav-pill-index">02</span>
            <Package size={15} />
            <span>Vector .SVG Vault ({completedJobs.length})</span>
          </button>
        </nav>
      </header>

      {/* ==================== TAB 1: STUDIO CLEANER & 5 BACKDROPS ==================== */}
      {activeTab === 'cleaner' && (
        <>
          {/* Capture-One Style Contact Sheet Filmstrip */}
          <section className="filmstrip-panel">
            <div className="filmstrip-header">
              <div className="filmstrip-title-row">
                <span className="filmstrip-tag">MASTER CONTACT SHEET</span>
                <span className="filmstrip-title">
                  Select an Inventory Asset to Inspect Across All 5 Studio Environments
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="btn-gold" onClick={downloadSvgPackZip} style={{ padding: '8px 14px', fontSize: '12px' }}>
                  <FileCode size={14} /> Export Complete .SVG Pack (.ZIP)
                </button>
              </div>
            </div>

            <div className="filmstrip-grid">
              {jobs.slice(0, 6).map((job, idx) => {
                const isSelected = selectedJob?.job_id === job.job_id;
                const thumbSrc = job.cleanByStyle?.[backdropStyle] || job.cleanByStyle?.corkboard || job.cleanByStyle?.grass_yard;
                return (
                  <div
                    key={job.job_id}
                    onClick={() => setSelectedJob(job)}
                    className={`contact-card ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="contact-thumb-wrap">
                      <img
                        src={thumbSrc}
                        alt={job.title || job.original_filename}
                      />
                      <span className="contact-badge">{job.dimensions || `0${idx + 1}`}</span>
                    </div>
                    <div className="contact-meta">
                      <span className="contact-name">{job.title || job.original_filename}</span>
                      <span className="contact-index">0{idx + 1}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid-layout">
            {/* LEFT COLUMN: Ingest & Optical Grading Controls */}
            <div className="card">
              <div className="card-header">
                <div className="card-title-group">
                  <span className="card-step-label">STAGE 01 · ASSET INGEST &amp; GRADING</span>
                  <h2 className="card-title">Batch Ingest &amp; Optical Polish</h2>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn-gold"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingBatch}
                    style={{ padding: '8px 13px', fontSize: '12px' }}
                  >
                    <Upload size={14} /> Add Photos
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={isProcessingBatch}
                    style={{ padding: '8px 13px', fontSize: '12px' }}
                  >
                    <Folder size={14} /> Folder
                  </button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory="true"
                directory="true"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleFilesSelected(e.target.files)}
              />

              <div
                className="studio-dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.length) {
                    handleFilesSelected(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="dropzone-icon-ring">
                  <Sparkles size={20} />
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                  {isProcessingBatch
                    ? progressMsg || 'Running Neural Cutout & 5-Stage Compositor...'
                    : 'Drop Raw Inventory or Visual Sentence Photos'}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '6px', maxWidth: '330px', marginInline: 'auto' }}>
                  Removes driveways, tarps &amp; clutter · Lifts shadows · Renders all 5 studio environments &amp; vector-clipped .SVG
                </div>
              </div>

              <div className="control-panel">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.1em' }}>
                    OPTICAL &amp; ENVIRONMENT PARAMETERS
                  </span>
                  <Sliders size={14} style={{ color: 'var(--gold)' }} />
                </div>

                <div className="form-group">
                  <label>Active Studio Environment (5 Presets)</label>
                  <select
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

                <div className="form-group">
                  <label>Specular Vinyl Polish &amp; Shadow Recovery</label>
                  <select
                    value={polishIntensity}
                    onChange={(e) => setPolishIntensity(e.target.value)}
                  >
                    <option value="high">
                      High Commercial Grade (Deep Shadow Lift + Daylight Warmth + Specular Sheen)
                    </option>
                    <option value="medium">
                      Balanced Studio Grade (Natural Shadow Recovery + Subtle Vibrance)
                    </option>
                    <option value="off">
                      Linear Bypass (Cutout &amp; Environment Composite Only)
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Preview Security Watermark (Never Injected Into Exports)</label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="EDR PARTY RENTALS • PREVIEW ONLY"
                  />
                </div>

                <div className="form-group">
                  <label>Vector .SVG Archive Identifier</label>
                  <input
                    type="text"
                    value={packCategory}
                    onChange={(e) => setPackCategory(e.target.value)}
                    placeholder="EDR_Visual_Sentences_SVG_Pack"
                  />
                </div>
              </div>

              {/* Telemetry & 1-Click Vector Export Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: 'rgba(7, 8, 12, 0.7)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  VAULT READY: <strong style={{ color: 'var(--gold)' }}>{completedJobs.length} ASSETS</strong>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn-gold"
                    onClick={() => selectedJob && downloadSingleSvg(selectedJob)}
                    disabled={!selectedJob?.svg_markup}
                    style={{ padding: '7px 12px', fontSize: '12px' }}
                  >
                    <FileCode size={13} /> 1-Click .SVG
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={downloadSvgPackZip}
                    disabled={completedJobs.length === 0}
                    style={{ padding: '7px 12px', fontSize: '12px' }}
                  >
                    <Archive size={13} /> .SVG Pack (.ZIP)
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: 5-Environment Swatch Selector + Precision Split Loupe */}
            <div className="card">
              <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
                <div className="card-title-group">
                  <span className="card-step-label">
                    STAGE 02 · ENVIRONMENT COMPOSITOR ({activeBackdropInfo.index} / 05)
                  </span>
                  <h2 className="card-title">
                    {selectedJob?.title || 'Select an Asset'} —{' '}
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--gold)' }}>
                      {activeBackdropInfo.label}
                    </span>
                  </h2>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)'
                  }}
                >
                  SPLIT CURTAIN · <strong style={{ color: 'var(--gold)' }}>{Math.round(sliderPos)}%</strong>
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

              {selectedJob && activePreviewUrl ? (
                <>
                  <div
                    className="slider-container"
                    ref={sliderRef}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      updateSliderFromPointer(e.clientX);
                    }}
                    onPointerMove={(e) => {
                      if (e.buttons === 1) {
                        updateSliderFromPointer(e.clientX);
                      }
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{ touchAction: 'none', cursor: 'ew-resize' }}
                  >
                    {/* AFTER Layer: Watermark is rasterized directly into the preview image pixels */}
                    <img
                      src={activePreviewUrl}
                      alt={`AFTER: ${activeBackdropInfo.label}`}
                      className="slider-img"
                      draggable={false}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    />

                    {/* BEFORE Layer: Raw Driveway / Tarp / Cluttered Photo clipped cleanly */}
                    <img
                      src={selectedJob.aligned_before_url || selectedJob.original_url}
                      alt="BEFORE: Raw Capture"
                      className="slider-img"
                      draggable={false}
                      style={{
                        pointerEvents: 'none',
                        userSelect: 'none',
                        clipPath: `inset(0 ${100 - sliderPos}% 0 0)`
                      }}
                    />

                    <span className="stage-pill before">RAW CAPTURE</span>
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

                  {/* Precision Scrubber Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '2px 4px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', minWidth: '82px' }}>
                      RAW BEFORE
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={sliderPos}
                      onChange={(e) => setSliderPos(Number(e.target.value))}
                      style={{ flex: 1, cursor: 'pointer' }}
                    />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--gold)', minWidth: '95px', textAlign: 'right' }}>
                      {activeBackdropInfo.shortLabel.toUpperCase()}
                    </span>
                  </div>

                  {/* Clean Watermark-Free Master Export Bar */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
                    <button
                      className="btn-gold"
                      style={{ flex: 1.4 }}
                      onClick={() => {
                        const base = selectedJob.original_filename.replace(/\.[^/.]+$/, '');
                        const ext = backdropStyle === 'transparent' ? 'png' : 'jpg';
                        downloadImage(activeCleanDownloadUrl, `${base}_${backdropStyle}_master.${ext}`);
                      }}
                    >
                      <Download size={15} /> Export Clean {activeBackdropInfo.shortLabel} ({backdropStyle === 'transparent' ? '.PNG' : '.JPG'})
                    </button>
                    <button
                      className="btn-accent"
                      style={{ flex: 1 }}
                      onClick={() => downloadSingleSvg(selectedJob)}
                      disabled={!selectedJob.svg_markup}
                    >
                      <FileCode size={15} /> 1-Click Export .SVG
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ flex: 1 }}
                      onClick={downloadSvgPackZip}
                    >
                      <Archive size={15} /> 1-Click .SVG Pack (.ZIP)
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
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Select an Inventory Asset Above or Drop Photos on the Left
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ==================== TAB 2: VECTOR .SVG & ELEMENT PACK VAULT ==================== */}
      {activeTab === 'vault' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div className="card-title-group">
              <span className="card-step-label">STAGE 02 · DIE-CUT VECTOR ARCHIVE</span>
              <h2 className="card-title">
                1-Click .SVG &amp; Element Vault — "{packCategory}" ({completedJobs.length} Assets)
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn-gold" onClick={downloadSvgPackZip} disabled={completedJobs.length === 0}>
                <FileCode size={15} /> 1-Click Export Complete .SVG Pack (.ZIP)
              </button>
            </div>
          </div>

          <div className="backdrop-swatch-bar">
            {FIVE_BACKDROP_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBackdropStyle(opt.id)}
                className={`backdrop-swatch-btn ${backdropStyle === opt.id ? 'active' : ''}`}
              >
                <div className="swatch-top-row">
                  <span className="swatch-dot" style={{ background: opt.swatchBg }} />
                  <span className="swatch-index">{opt.index}</span>
                </div>
                <span className="swatch-name">Preview: {opt.shortLabel}</span>
              </button>
            ))}
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
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <img
                      src={job.previewByStyle?.[backdropStyle] || job.trimmed_sticker_url}
                      alt={job.original_filename}
                      draggable={false}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                    />
                    <span className="contact-badge">0{idx + 1}</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {job.title || job.original_filename}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn-gold"
                      style={{ flex: 1, padding: '8px 10px', fontSize: '12px' }}
                      onClick={() => downloadSingleSvg(job)}
                    >
                      <FileCode size={14} /> 1-Click .SVG
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No assets in Vault yet. Drop photos in Stage 01 to generate cutouts and vector .SVGs.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
