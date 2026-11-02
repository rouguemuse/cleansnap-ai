import React, { useState, useRef, useEffect } from 'react';
import {
  Folder,
  Upload,
  Download,
  Sparkles,
  Image as ImageIcon,
  Archive,
  Sun,
  Layout,
  Plus,
  Trash2,
  Type,
  Package,
  Move,
  FileCode,
  Trees
} from 'lucide-react';
import JSZip from 'jszip';
import {
  segmentSubjectPermissive,
  traceMarchingSquaresSvgPath
} from './lib/mitSegmentationEngine';
import './App.css';

// The 5 Official Background Options
const FIVE_BACKDROP_OPTIONS = [
  {
    id: 'grass_yard',
    label: '🌳 Grass Yard (Bounce Houses)',
    shortLabel: '🌳 Grass Yard',
    description: 'Sunny green grass yard, lush summer trees & blue sky with natural turf contact shadow'
  },
  {
    id: 'whiteboard',
    label: '📋 Whiteboard (Dry-Erase Board)',
    shortLabel: '📋 Whiteboard',
    description: 'Glossy dry-erase whiteboard with aluminum frame, marker tray & soft board shadow'
  },
  {
    id: 'chalkboard',
    label: '🖍️ Chalkboard (Classic Slate)',
    shortLabel: '🖍️ Chalkboard',
    description: 'Textured dark green/charcoal slate chalkboard with chalk-dust rub & oak wood frame'
  },
  {
    id: 'studio_white',
    label: '⬜ Studio White (Catalog Square)',
    shortLabel: '⬜ Studio White',
    description: 'Pure #FFFFFF e-commerce catalog background with soft floor contact shadow'
  },
  {
    id: 'transparent',
    label: '🏁 Transparent Cutout (.SVG / .PNG)',
    shortLabel: '🏁 Transparent',
    description: 'Clean transparent alpha cutout for 1-Click .SVG export, .SVG Pack ZIP & banners'
  }
];

// Pre-loaded Real EDR Bounce House Before/After Showcase Pairs (with transparent cutouts for all 5 backgrounds!)
const EDR_SHOWCASE_SAMPLES = [
  {
    job_id: 'edr_tropical_slide',
    original_filename: 'Tropical_Water_Slide_28x14.png',
    title: 'Tropical Water Slide (28×14)',
    subtitle: 'Removed wet concrete driveway, yellow bucket, fence, house & red "18 / 28×14" badges → Polished & brightened',
    before_url: '/samples/tropical_slide_before.jpg',
    after_park_url: '/samples/tropical_slide_after.jpg',
    cutout_url: '/samples/tropical_slide_cutout.webp',
    is_showcase: true
  },
  {
    job_id: 'edr_ninja_turtles',
    original_filename: 'Ninja_Turtles_Bounce_18x15x20.png',
    title: 'Ninja Turtles Bounce (18×15×20)',
    subtitle: 'Removed winter driveway, dead overhanging branches, fence, cords & "10 18x15x20" text → Polished purple/green vinyl',
    before_url: '/samples/ninja_turtles_before.jpg',
    after_park_url: '/samples/ninja_turtles_after.jpg',
    cutout_url: '/samples/ninja_turtles_cutout.webp',
    is_showcase: true
  },
  {
    job_id: 'edr_princess_castle',
    original_filename: 'Princess_Castle_12x12.png',
    title: 'Princess Castle (12×12)',
    subtitle: 'Removed blue ground tarp, asphalt driveway, garage, fence & lens glare → Polished pink/purple/teal vinyl',
    before_url: '/samples/princess_castle_before.jpg',
    after_park_url: '/samples/princess_castle_after.jpg',
    cutout_url: '/samples/princess_castle_cutout.webp',
    is_showcase: true
  },
  {
    job_id: 'edr_toy_story',
    original_filename: 'Toy_Story_Bounce_14x12.png',
    title: 'Toy Story Bounce House (14×12)',
    subtitle: 'Removed concrete driveway, Ford truck, carport, rolled tarps, orange cord & "14 14×12" text → Polished vinyl',
    before_url: '/samples/toy_story_before.jpg',
    after_park_url: '/samples/toy_story_after.jpg',
    cutout_url: '/samples/toy_story_cutout.webp',
    is_showcase: true
  },
  {
    job_id: 'edr_bungy_run',
    original_filename: 'Bungy_Run_Dual_Lane_20ft.png',
    title: 'Bungy Run Dual Lane (20ft)',
    subtitle: 'Removed asphalt street, parked cars, person blur, shoes, fence & "20 bungy Run" text → Polished primary vinyl',
    before_url: '/samples/bungy_run_before.jpg',
    after_park_url: '/samples/bungy_run_after.jpg',
    cutout_url: '/samples/bungy_run_cutout.webp',
    is_showcase: true
  },
  {
    job_id: 'edr_rainbow_palace',
    original_filename: 'Rainbow_Palace_Slide.png',
    title: 'Rainbow Palace Combo Slide',
    subtitle: 'Removed patchy dry field, white tarp, horse trailer & barn → Polished vibrant rainbow vinyl',
    before_url: '/samples/rainbow_palace_before.jpg',
    after_park_url: '/samples/rainbow_palace_after.jpg',
    cutout_url: '/samples/rainbow_palace_cutout.webp',
    is_showcase: true
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

// Cache the loaded Sunny Grass Yard backdrop image
let cachedParkBackdropImg = null;
async function loadSunnyParkBackdrop() {
  if (cachedParkBackdropImg) return cachedParkBackdropImg;
  cachedParkBackdropImg = await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/backdrops/sunny_park_lawn.jpg';
  });
  return cachedParkBackdropImg;
}

/**
 * Draw Realistic Classroom / Studio Dry-Erase Whiteboard Background onto a 2D Canvas
 */
function drawWhiteboardBackground(ctx, w, h) {
  // 1. Outer anodized brushed aluminum frame
  const frameGrad = ctx.createLinearGradient(0, 0, w, h);
  frameGrad.addColorStop(0, '#cbd5e1');
  frameGrad.addColorStop(0.5, '#f1f5f9');
  frameGrad.addColorStop(1, '#94a3b8');
  ctx.fillStyle = frameGrad;
  ctx.fillRect(0, 0, w, h);

  const border = Math.round(Math.min(w, h) * 0.028);
  // Inner bezel shadow
  ctx.fillStyle = '#64748b';
  ctx.fillRect(border - 3, border - 3, w - (border - 3) * 2, h - (border - 3) * 2);

  // 2. Glossy porcelain dry-erase surface
  const boardGrad = ctx.createLinearGradient(0, border, w, h - border);
  boardGrad.addColorStop(0, '#ffffff');
  boardGrad.addColorStop(0.35, '#f8fafc');
  boardGrad.addColorStop(0.65, '#ffffff');
  boardGrad.addColorStop(1, '#f1f5f9');
  ctx.fillStyle = boardGrad;
  ctx.fillRect(border, border, w - border * 2, h - border * 2);

  // 3. Subtle dot-matrix alignment grid (faint dry-erase studio grid)
  ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
  const step = Math.round(w / 28);
  for (let y = border + step; y < h - border - step * 0.6; y += step) {
    for (let x = border + step; x < w - border; x += step) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // 4. Soft diagonal glass specular reflection
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(border + w * 0.08, border);
  ctx.lineTo(border + w * 0.36, border);
  ctx.lineTo(border, border + h * 0.52);
  ctx.lineTo(border, border + h * 0.16);
  ctx.closePath();
  const sheenGrad = ctx.createLinearGradient(0, border, w * 0.4, h * 0.5);
  sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
  sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = sheenGrad;
  ctx.fill();
  ctx.restore();

  // 5. Bottom aluminum marker tray with dry-erase markers & eraser
  const trayH = Math.round(border * 0.65);
  const trayY = h - border - trayH * 0.3;
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(w * 0.22, trayY, w * 0.56, trayH);
  // Dry-erase markers (Red, Blue, Green, Black)
  const markerColors = ['#ef4444', '#2563eb', '#16a34a', '#1e293b'];
  markerColors.forEach((col, i) => {
    const mx = w * 0.28 + i * (w * 0.09);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx, trayY - 8, w * 0.055, 8);
    ctx.fillStyle = col;
    ctx.fillRect(mx, trayY - 8, w * 0.018, 8);
  });
}

/**
 * Draw Realistic Classic Slate Chalkboard Background onto a 2D Canvas
 */
function drawChalkboardBackground(ctx, w, h) {
  // 1. Warm oak wood frame border
  const woodGrad = ctx.createLinearGradient(0, 0, w, h);
  woodGrad.addColorStop(0, '#78350f');
  woodGrad.addColorStop(0.5, '#92400e');
  woodGrad.addColorStop(1, '#451a03');
  ctx.fillStyle = woodGrad;
  ctx.fillRect(0, 0, w, h);

  const border = Math.round(Math.min(w, h) * 0.032);
  // Inner wood bevel
  ctx.fillStyle = '#290f02';
  ctx.fillRect(border - 4, border - 4, w - (border - 4) * 2, h - (border - 4) * 2);

  // 2. Deep slate green/charcoal chalkboard surface
  const slateGrad = ctx.createRadialGradient(w * 0.5, h * 0.48, w * 0.08, w * 0.5, h * 0.5, w * 0.72);
  slateGrad.addColorStop(0, '#233b2e');
  slateGrad.addColorStop(0.65, '#192b21');
  slateGrad.addColorStop(1, '#0f1c15');
  ctx.fillStyle = slateGrad;
  ctx.fillRect(border, border, w - border * 2, h - border * 2);

  // 3. Procedural erased chalk-dust clouds & slate grain
  ctx.save();
  for (let i = 0; i < 38; i++) {
    const cx = border + ((i * 197) % (w - border * 2));
    const cy = border + ((i * 131) % (h - border * 2));
    const rx = (w * 0.08) + ((i * 43) % Math.round(w * 0.14));
    const dustGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, rx);
    dustGrad.addColorStop(0, 'rgba(255, 255, 255, 0.045)');
    dustGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.018)');
    dustGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = dustGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, rx, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle hand-drawn chalk inner border line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([14, 6, 8, 4]);
  ctx.strokeRect(border + 18, border + 18, w - (border + 18) * 2, h - (border + 18) * 2);
  ctx.restore();

  // 4. Chalk pieces resting on bottom wood ledge
  const ledgeY = h - border - 6;
  const chalkColors = ['#f8fafc', '#fde047', '#f9a8d4', '#93c5fd'];
  chalkColors.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(w * 0.32 + i * (w * 0.08), ledgeY, w * 0.038, 6);
  });
}

/**
 * Bake the Diagonal Anti-Theft Watermark DIRECTLY into a Preview Canvas
 * so that inspecting browser DOM or Network images NEVER exposes an unwatermarked master.
 */
function createWatermarkedPreviewDataUrl(sourceCanvas, watermarkText = 'EDR PARTY RENTALS • PREVIEW ONLY') {
  const prevW = 960;
  const prevH = Math.round((sourceCanvas.height / sourceCanvas.width) * prevW);
  const c = document.createElement('canvas');
  c.width = prevW;
  c.height = prevH;
  const ctx = c.getContext('2d');

  // Checkerboard behind transparent previews
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, prevW, prevH);
  const tile = 20;
  ctx.fillStyle = '#cbd5e1';
  for (let y = 0; y < prevH; y += tile) {
    for (let x = 0; x < prevW; x += tile) {
      if (((x / tile) + (y / tile)) % 2 === 0) {
        ctx.fillRect(x, y, tile, tile);
      }
    }
  }

  ctx.drawImage(sourceCanvas, 0, 0, prevW, prevH);

  // Destructively rasterize diagonal watermark text across the preview pixels
  if (watermarkText && watermarkText.trim()) {
    ctx.save();
    ctx.translate(prevW / 2, prevH / 2);
    ctx.rotate((-25 * Math.PI) / 180);
    ctx.font = '800 18px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';

    for (let y = -prevH; y <= prevH; y += 110) {
      for (let x = -prevW; x <= prevW; x += 360) {
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.30)';
        ctx.lineWidth = 3;
        ctx.strokeText(watermarkText, x, y);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
        ctx.fillText(watermarkText, x, y);
      }
    }
    ctx.restore();
  }

  return c.toDataURL('image/jpeg', 0.88);
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
      // Preserve natural semi-transparency on mesh/hair while cleaning outer driveway halo
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
 * Build All 5 Background Options + Baked Watermarked Previews + True Marching Squares .SVG
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

  const origImg = await new Promise((res, rej) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => res(el);
    el.onerror = rej;
    el.src = origUrl;
  });

  const cutImg = cutUrl
    ? await new Promise((res, rej) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => res(el);
        el.onerror = rej;
        el.src = cutUrl;
      })
    : null;

  const parkBackdropImg = await loadSunnyParkBackdrop();

  // For pre-baked showcase items, extract the polished subject from the cutout image directly
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

  // Standard 4:3 Scene Dimensions (1448×1086) for Grass Yard, Whiteboard & Chalkboard
  const sceneW = 1448;
  const sceneH = 1086;

  const maxOccW = Math.floor(sceneW * 0.82);
  const maxOccH = Math.floor(sceneH * 0.80);
  const sceneScale = Math.min(maxOccW / tightBbox.w, maxOccH / tightBbox.h);
  const drawW = Math.max(1, Math.floor(tightBbox.w * sceneScale));
  const drawH = Math.max(1, Math.floor(tightBbox.h * sceneScale));
  const drawX = Math.floor((sceneW - drawW) / 2);
  const groundLineY = Math.floor(sceneH * 0.90);
  const drawY = Math.max(Math.floor(sceneH * 0.07), groundLineY - drawH);

  // --- OPTION 1: GRASS YARD (Sunny Park Lawn & Sky) ---
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = sceneW;
  grassCanvas.height = sceneH;
  const grassCtx = grassCanvas.getContext('2d');

  if (prebakedGrassYardUrl) {
    const preImg = await new Promise((res) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => res(el);
      el.onerror = () => res(null);
      el.src = prebakedGrassYardUrl;
    });
    if (preImg) {
      grassCtx.drawImage(preImg, 0, 0, sceneW, sceneH);
    }
  } else {
    if (parkBackdropImg) {
      grassCtx.drawImage(parkBackdropImg, 0, 0, sceneW, sceneH);
    } else {
      grassCtx.fillStyle = '#3b82f6';
      grassCtx.fillRect(0, 0, sceneW, sceneH * 0.58);
      grassCtx.fillStyle = '#4d7c0f';
      grassCtx.fillRect(0, sceneH * 0.58, sceneW, sceneH * 0.42);
    }

    // Dual-layer grass contact shadow
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

  // --- OPTION 2: WHITEBOARD (Classroom / Studio Dry-Erase Board) ---
  const wbCanvas = document.createElement('canvas');
  wbCanvas.width = sceneW;
  wbCanvas.height = sceneH;
  const wbCtx = wbCanvas.getContext('2d');
  drawWhiteboardBackground(wbCtx, sceneW, sceneH);
  wbCtx.save();
  wbCtx.shadowColor = 'rgba(15, 23, 42, 0.24)';
  wbCtx.shadowBlur = 24;
  wbCtx.shadowOffsetY = 10;
  wbCtx.drawImage(
    subjectCanvas,
    tightBbox.x,
    tightBbox.y,
    tightBbox.w,
    tightBbox.h,
    drawX,
    Math.floor((sceneH - drawH) / 2),
    drawW,
    drawH
  );
  wbCtx.restore();
  const whiteboardUrl = wbCanvas.toDataURL('image/jpeg', 0.94);
  const whiteboardPreviewUrl = createWatermarkedPreviewDataUrl(wbCanvas, watermarkText);

  // --- OPTION 3: CHALKBOARD (Classic Slate Chalkboard) ---
  const cbCanvas = document.createElement('canvas');
  cbCanvas.width = sceneW;
  cbCanvas.height = sceneH;
  const cbCtx = cbCanvas.getContext('2d');
  drawChalkboardBackground(cbCtx, sceneW, sceneH);
  cbCtx.save();
  cbCtx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  cbCtx.shadowBlur = 28;
  cbCtx.shadowOffsetY = 12;
  cbCtx.drawImage(
    subjectCanvas,
    tightBbox.x,
    tightBbox.y,
    tightBbox.w,
    tightBbox.h,
    drawX,
    Math.floor((sceneH - drawH) / 2),
    drawW,
    drawH
  );
  cbCtx.restore();
  const chalkboardUrl = cbCanvas.toDataURL('image/jpeg', 0.94);
  const chalkboardPreviewUrl = createWatermarkedPreviewDataUrl(cbCanvas, watermarkText);

  // --- OPTION 4: STUDIO WHITE (Pure White Catalog) ---
  const swCanvas = document.createElement('canvas');
  swCanvas.width = sceneW;
  swCanvas.height = sceneH;
  const swCtx = swCanvas.getContext('2d');
  swCtx.fillStyle = '#ffffff';
  swCtx.fillRect(0, 0, sceneW, sceneH);
  swCtx.save();
  swCtx.shadowColor = 'rgba(15, 23, 42, 0.18)';
  swCtx.shadowBlur = 20;
  swCtx.shadowOffsetY = 12;
  swCtx.drawImage(
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
  swCtx.restore();
  const studioWhiteUrl = swCanvas.toDataURL('image/jpeg', 0.95);
  const studioWhitePreviewUrl = createWatermarkedPreviewDataUrl(swCanvas, watermarkText);

  // --- OPTION 5: TRANSPARENT CUTOUT ---
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
  beforeCtx.fillStyle = '#0f172a';
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
      grass_yard: grassYardUrl,
      whiteboard: whiteboardUrl,
      chalkboard: chalkboardUrl,
      studio_white: studioWhiteUrl,
      transparent: transparentUrl
    },
    previewByStyle: {
      grass_yard: grassYardPreviewUrl,
      whiteboard: whiteboardPreviewUrl,
      chalkboard: chalkboardPreviewUrl,
      studio_white: studioWhitePreviewUrl,
      transparent: transparentPreviewUrl
    }
  };
}

// Presets for Banner & Visual Sentences Builder
const BANNER_PRESETS = [
  { id: 'fb_cover', name: 'Facebook Cover Banner (1640 × 624)', width: 1640, height: 624 },
  { id: 'ig_square', name: 'Instagram Square Post / Ad (1080 × 1080)', width: 1080, height: 1080 },
  { id: 'ig_story', name: 'Instagram Story / Reel Cover (1080 × 1920)', width: 1080, height: 1920 },
  { id: 'web_hero', name: 'Website Hero Banner (1920 × 700)', width: 1920, height: 700 },
  { id: 'print_sheet', name: 'Printable Classroom / Puzzle Sheet (2400 × 1800)', width: 2400, height: 1800 }
];

const BANNER_BACKGROUNDS = [
  { id: 'grass_yard', name: '1. 🌳 Grass Yard (Sunny Park & Sky)', css: 'url("/backdrops/sunny_park_lawn.jpg") center/cover no-repeat', colors: ['#2563eb', '#60a5fa', '#4d7c0f'] },
  { id: 'whiteboard', name: '2. 📋 Whiteboard (Dry-Erase Studio)', css: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #e2e8f0 100%)', colors: ['#ffffff', '#f8fafc', '#e2e8f0'], textColor: '#0f172a' },
  { id: 'chalkboard', name: '3. 🖍️ Chalkboard (Classic Slate)', css: 'radial-gradient(circle, #233b2e 0%, #192b21 65%, #0f1c15 100%)', colors: ['#233b2e', '#192b21', '#0f1c15'] },
  { id: 'studio_white', name: '4. ⬜ Studio White', css: '#ffffff', colors: ['#ffffff', '#ffffff', '#f8fafc'], textColor: '#0f172a' },
  { id: 'sunset_party', name: '5. 🌅 Sunset Party Gradient', css: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #6366f1 100%)', colors: ['#f97316', '#ec4899', '#6366f1'] }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('cleaner'); // 'cleaner' | 'vault' | 'banner'

  // The 5 Background Options ('grass_yard' | 'whiteboard' | 'chalkboard' | 'studio_white' | 'transparent')
  const [backdropStyle, setBackdropStyle] = useState('grass_yard');
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
  const [selectedBg, setSelectedBg] = useState(BANNER_BACKGROUNDS[0]);
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

  // Initialize the 6 Real EDR Bounce House Showcase items with all 5 Background Options & Marching Squares SVGs
  useEffect(() => {
    let mounted = true;
    async function initShowcase() {
      const placeholderJobs = EDR_SHOWCASE_SAMPLES.map((s) => ({
        job_id: s.job_id,
        original_filename: s.original_filename,
        title: s.title,
        subtitle: s.subtitle,
        pack_name: 'EDR_Visual_Sentences_SVG_Pack',
        original_url: s.before_url,
        aligned_before_url: s.before_url,
        trimmed_sticker_url: s.cutout_url,
        svg_markup: null,
        cleanByStyle: {
          grass_yard: s.after_park_url,
          whiteboard: s.after_park_url,
          chalkboard: s.after_park_url,
          studio_white: s.after_park_url,
          transparent: s.cutout_url
        },
        previewByStyle: {
          grass_yard: s.after_park_url,
          whiteboard: s.after_park_url,
          chalkboard: s.after_park_url,
          studio_white: s.after_park_url,
          transparent: s.cutout_url
        },
        status: 'completed',
        is_showcase: true,
        model_used: 'Permissive MIT/Apache-2.0 Engine + 5-Backdrop Studio',
        processing_time: '0.65'
      }));

      setJobs(placeholderJobs);
      setSelectedJob(placeholderJobs[0]);

      // Build all 5 backdrops (Grass Yard, Whiteboard, Chalkboard, Studio White, Transparent) + Marching Squares SVG for each showcase item
      for (const sample of EDR_SHOWCASE_SAMPLES) {
        if (!mounted) return;
        try {
          const built = await buildAllFiveBackdropsAndSvg(
            sample.before_url,
            sample.cutout_url,
            'high',
            watermarkText,
            sample.after_park_url
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
      subtitle: 'Cleaned, Polished & Rendered Across All 5 Background Options + Vector-Clipped .SVG',
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

  // Export High-Resolution Banner (.SVG) with accurate background rendering for all 5 styles
  const exportHighResBannerSvg = async () => {
    const w = selectedPreset.width;
    const h = selectedPreset.height;

    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = w;
    bgCanvas.height = h;
    const bgCtx = bgCanvas.getContext('2d');

    if (selectedBg.id === 'grass_yard') {
      const parkImg = await loadSunnyParkBackdrop();
      if (parkImg) {
        bgCtx.drawImage(parkImg, 0, 0, w, h);
      }
    } else if (selectedBg.id === 'whiteboard') {
      drawWhiteboardBackground(bgCtx, w, h);
    } else if (selectedBg.id === 'chalkboard') {
      drawChalkboardBackground(bgCtx, w, h);
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
        const img = await new Promise((res) => {
          const el = new Image();
          el.crossOrigin = 'anonymous';
          el.onload = () => res(el);
          el.onerror = () => res(null);
          el.src = layer.src;
        });
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
          `  <text x="${cx}" y="${cy}" fill="${layer.color || '#ffffff'}" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">${safeText}</text>`
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

  // Dragging layers inside the Banner Builder
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

  // On-page preview uses the watermark-baked image; official downloads use the 100% clean master
  const activePreviewUrl = selectedJob?.previewByStyle?.[backdropStyle] || null;
  const activeCleanDownloadUrl = selectedJob?.cleanByStyle?.[backdropStyle] || null;
  const activeBackdropInfo =
    FIVE_BACKDROP_OPTIONS.find((b) => b.id === backdropStyle) || FIVE_BACKDROP_OPTIONS[0];

  return (
    <div className="app-container">
      <header style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div className="logo-area">
          <h1>CleanSnap AI &amp; Visual Sentences Studio</h1>
          <p>
            5 Instant Backdrops (🌳 Grass Yard • 📋 Whiteboard • 🖍️ Chalkboard • ⬜ Studio White • 🏁 Transparent) + 1-Click .SVG &amp; .SVG Pack Export
          </p>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={activeTab === 'cleaner' ? 'btn-accent' : 'btn-secondary'}
            onClick={() => setActiveTab('cleaner')}
          >
            <Sparkles size={16} /> 1. Photo Cleaner &amp; 5 Backdrops
          </button>
          <button
            className={activeTab === 'vault' ? 'btn-accent' : 'btn-secondary'}
            onClick={() => setActiveTab('vault')}
          >
            <Package size={16} /> 2. 1-Click .SVG Pack Vault ({completedJobs.length})
          </button>
          <button
            className={activeTab === 'banner' ? 'btn-accent' : 'btn-secondary'}
            onClick={() => setActiveTab('banner')}
          >
            <Layout size={16} /> 3. Banner &amp; Scene Builder
          </button>
        </div>
      </header>

      {/* ==================== TAB 1: CLEANER, POLISH & 5 BACKGROUND OPTIONS ==================== */}
      {activeTab === 'cleaner' && (
        <>
          {/* Real EDR Bounce House Showcase Strip */}
          <div
            className="card"
            style={{
              marginBottom: '20px',
              padding: '16px 20px',
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.88))',
              border: '1px solid rgba(56, 189, 248, 0.28)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trees size={18} style={{ color: '#22c55e' }} />
                  Interactive Showcase — Test Any Item Across All 5 Background Options (Grass Yard, Whiteboard, Chalkboard, Studio White, Transparent)
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  Click any bounce house below, then click the 5 Background Option buttons above the slider to switch backdrops instantaneously!
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-accent" onClick={downloadSvgPackZip} style={{ padding: '8px 14px', fontSize: '12px' }}>
                  <FileCode size={15} /> 1-Click Export SVG Pack (.ZIP)
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '10px' }}>
              {jobs.slice(0, 6).map((job) => {
                const isSelected = selectedJob?.job_id === job.job_id;
                const thumbSrc = job.cleanByStyle?.[backdropStyle] || job.cleanByStyle?.grass_yard;
                return (
                  <div
                    key={job.job_id}
                    onClick={() => setSelectedJob(job)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: '10px',
                      padding: '8px',
                      background: isSelected ? 'rgba(37, 99, 235, 0.25)' : 'rgba(15, 23, 42, 0.65)',
                      border: isSelected ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ position: 'relative', height: '96px', borderRadius: '6px', overflow: 'hidden', marginBottom: '6px', background: '#0f172a' }}>
                      <img
                        src={thumbSrc}
                        alt={job.title || job.original_filename}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          background: 'rgba(22, 163, 74, 0.92)',
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {activeBackdropInfo.shortLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {job.title || job.original_filename}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid-layout">
            {/* LEFT COLUMN: Upload & 5 Background Options Controls */}
            <div className="card">
              <div className="card-header">
                <span>1. Drop Photos to Clean, Polish &amp; Place on 5 Backdrops</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn-accent"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingBatch}
                  >
                    <Upload size={16} /> Select Photos
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={isProcessingBatch}
                  >
                    <Folder size={16} /> Select Folder
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
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.length) {
                    handleFilesSelected(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed rgba(34, 197, 94, 0.55)',
                  borderRadius: '12px',
                  padding: '22px 18px',
                  textAlign: 'center',
                  background: 'rgba(15, 23, 42, 0.55)',
                  cursor: 'pointer'
                }}
              >
                <Sparkles size={30} style={{ color: '#22c55e', margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>
                  {isProcessingBatch
                    ? progressMsg || 'Cleaning, polishing & rendering 5 backgrounds...'
                    : 'Drag & Drop Bounce House or Visual Sentence Photos Here'}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
                  100% AGPL-Free Permissive Engine • Generates Grass Yard, Whiteboard, Chalkboard, Studio White &amp; Transparent .SVG/.PNG!
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.55)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#4ade80' }}>
                  <Sun size={16} /> 5 Background Options &amp; Studio Polish Settings
                </div>

                <div className="form-group">
                  <label>Choose Background Option (5 Studio Backdrops)</label>
                  <select
                    value={backdropStyle}
                    onChange={(e) => setBackdropStyle(e.target.value)}
                  >
                    {FIVE_BACKDROP_OPTIONS.map((opt, idx) => (
                      <option key={opt.id} value={opt.id}>
                        {idx + 1}. {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Vinyl De-Wrinkle, Sunlight Brightening &amp; Color Pop Intensity</label>
                  <select
                    value={polishIntensity}
                    onChange={(e) => setPolishIntensity(e.target.value)}
                  >
                    <option value="high">
                      ✨ High Polish (Deep Shadow Lift + Warm Sunlight + Vivid Color Pop + Gloss Sheen)
                    </option>
                    <option value="medium">
                      ☀️ Balanced Polish (Moderate Shadow Lift + Natural Color Boost)
                    </option>
                    <option value="off">
                      Off (Cutout &amp; Backdrop Placement Only — Keep Raw Lighting)
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label>SVG Pack Folder Name</label>
                  <input
                    type="text"
                    value={packCategory}
                    onChange={(e) => setPackCategory(e.target.value)}
                    placeholder="EDR_Visual_Sentences_SVG_Pack"
                  />
                </div>
              </div>

              {/* 1-Click SVG Export & SVG Pack Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(15,23,42,0.5)', borderRadius: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '14px', fontSize: '13px', color: '#94a3b8' }}>
                  <span>Logged in Vault: <strong style={{ color: '#22c55e' }}>{completedJobs.length}</strong></span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="btn-accent"
                    onClick={() => selectedJob && downloadSingleSvg(selectedJob)}
                    disabled={!selectedJob?.svg_markup}
                    style={{ padding: '8px 12px', fontSize: '12px' }}
                  >
                    <FileCode size={14} /> 1-Click Export .SVG
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={downloadSvgPackZip}
                    disabled={completedJobs.length === 0}
                    style={{ padding: '8px 12px', fontSize: '12px' }}
                  >
                    <Archive size={14} /> 1-Click SVG Pack (.ZIP)
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: 5-Backdrop Quick Switcher + Smooth Aligned Before / After Slider */}
            <div className="card">
              <div className="card-header" style={{ flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span>2. Protected Preview (Watermark Baked Into Preview Pixels Only)</span>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400, marginTop: '2px' }}>
                    Active Backdrop: <strong style={{ color: '#38bdf8' }}>{activeBackdropInfo.label}</strong> — {activeBackdropInfo.description}
                  </div>
                </div>
              </div>

              {/* 5 Background Option Pill Buttons */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {FIVE_BACKDROP_OPTIONS.map((opt) => {
                  const active = backdropStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setBackdropStyle(opt.id)}
                      className={active ? 'btn-accent' : 'btn-secondary'}
                      style={{
                        flex: '1 1 auto',
                        padding: '7px 10px',
                        fontSize: '12px',
                        justifyContent: 'center',
                        border: active ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      {opt.shortLabel}
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
                    style={{
                      position: 'relative',
                      aspectRatio: '4 / 3',
                      height: 'auto',
                      maxHeight: '420px',
                      backgroundColor: '#0f172a',
                      touchAction: 'none',
                      cursor: 'ew-resize',
                      borderRadius: '10px',
                      overflow: 'hidden'
                    }}
                  >
                    {/* AFTER Layer: Watermark is rasterized directly into the preview image pixels! */}
                    <img
                      src={activePreviewUrl}
                      alt={`AFTER: ${activeBackdropInfo.label}`}
                      className="slider-img"
                      draggable={false}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        pointerEvents: 'none',
                        userSelect: 'none'
                      }}
                    />

                    {/* BEFORE Layer: Raw Driveway / Tarp / Cluttered Photo clipped cleanly */}
                    <img
                      src={selectedJob.aligned_before_url || selectedJob.original_url}
                      alt="BEFORE: Raw Photo"
                      className="slider-img"
                      draggable={false}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        clipPath: `inset(0 ${100 - sliderPos}% 0 0)`
                      }}
                    />

                    <span
                      style={{
                        position: 'absolute',
                        bottom: '12px',
                        left: '12px',
                        background: 'rgba(15, 23, 42, 0.88)',
                        color: '#f8fafc',
                        padding: '5px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        pointerEvents: 'none',
                        zIndex: 6,
                        border: '1px solid rgba(255,255,255,0.15)'
                      }}
                    >
                      BEFORE (Raw Photo)
                    </span>
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '12px',
                        right: '12px',
                        background: 'rgba(22, 163, 74, 0.95)',
                        color: '#ffffff',
                        padding: '5px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        pointerEvents: 'none',
                        zIndex: 6,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                      }}
                    >
                      AFTER ({activeBackdropInfo.shortLabel})
                    </span>

                    <div
                      className="slider-handle"
                      style={{ left: `${sliderPos}%`, zIndex: 10, pointerEvents: 'none' }}
                    >
                      <div className="slider-handle-circle">↔</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '2px 4px' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8', minWidth: '50px' }}>Before</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={sliderPos}
                      onChange={(e) => setSliderPos(Number(e.target.value))}
                      style={{ flex: 1, cursor: 'pointer', accentColor: '#22c55e' }}
                    />
                    <span style={{ fontSize: '12px', color: '#4ade80', minWidth: '55px', textAlign: 'right', fontWeight: 600 }}>
                      {activeBackdropInfo.shortLabel}
                    </span>
                  </div>

                  {/* Clean Watermark-Free Download Buttons */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <button
                      className="btn-accent"
                      style={{ flex: 1.2, background: '#16a34a' }}
                      onClick={() => {
                        const base = selectedJob.original_filename.replace(/\.[^/.]+$/, '');
                        const ext = backdropStyle === 'transparent' ? 'png' : 'jpg';
                        downloadImage(activeCleanDownloadUrl, `${base}_${backdropStyle}_clean.${ext}`);
                      }}
                    >
                      <Download size={15} /> Download {activeBackdropInfo.shortLabel} ({backdropStyle === 'transparent' ? '.PNG' : '.JPG'})
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
                    color: '#94a3b8',
                    background: 'rgba(15, 23, 42, 0.4)',
                    borderRadius: '8px',
                    border: '1px dashed rgba(255,255,255,0.1)',
                    padding: '24px',
                    textAlign: 'center'
                  }}
                >
                  <ImageIcon size={40} style={{ color: '#475569' }} />
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#e2e8f0' }}>
                    Select a showcase item above or drop raw photos on the left!
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ==================== TAB 2: 1-CLICK .SVG & ELEMENT PACK VAULT ==================== */}
      {activeTab === 'vault' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span>1-Click .SVG &amp; Element Vault — "{packCategory}" ({completedJobs.length} Elements)</span>
              <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'normal', marginTop: '2px' }}>
                Every element features a Marching Squares + Douglas-Peucker vector cutline path (`fill-rule="evenodd"`) and can be previewed across all 5 backdrops.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn-accent" onClick={downloadSvgPackZip} disabled={completedJobs.length === 0}>
                <FileCode size={16} /> 1-Click Export SVG Pack (.ZIP)
              </button>
            </div>
          </div>

          {/* 5-Backdrop Switcher inside Vault */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {FIVE_BACKDROP_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setBackdropStyle(opt.id)}
                className={backdropStyle === opt.id ? 'btn-accent' : 'btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Preview on {opt.shortLabel}
              </button>
            ))}
          </div>

          {completedJobs.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                gap: '16px',
                marginTop: '8px'
              }}
            >
              {completedJobs.map((job) => (
                <div
                  key={job.job_id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      height: '165px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      background: '#0f172a'
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <img
                      src={job.previewByStyle?.[backdropStyle] || job.trimmed_sticker_url}
                      alt={job.original_filename}
                      draggable={false}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                    />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {job.title || job.original_filename}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn-accent"
                      style={{ flex: 1, padding: '7px 10px', fontSize: '12px' }}
                      onClick={() => downloadSingleSvg(job)}
                    >
                      <FileCode size={14} /> 1-Click .SVG
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ padding: '7px 10px', fontSize: '12px' }}
                      title="Use in Banner Builder"
                      onClick={() => addElementToBanner(job)}
                    >
                      <Plus size={14} /> Banner
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              Your SVG Vault is empty. Drop photos in <strong>Tab 1</strong> to automatically generate and log SVG elements here!
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: SOCIAL / WEB BANNER & VISUAL SENTENCE BUILDER ==================== */}
      {activeTab === 'banner' && (
        <div className="grid-layout">
          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '8px' }}>
              <span>Banner &amp; Visual Sentence Controls</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn-accent" onClick={exportHighResBannerSvg} style={{ padding: '8px 12px', fontSize: '12px' }}>
                  <FileCode size={15} /> 1-Click Export Banner .SVG
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>1. Choose Banner / Printable Size Preset</label>
              <select
                value={selectedPreset.id}
                onChange={(e) => {
                  const found = BANNER_PRESETS.find((p) => p.id === e.target.value);
                  if (found) setSelectedPreset(found);
                }}
              >
                {BANNER_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>2. Choose Banner Backdrop (Grass Yard, Whiteboard, Chalkboard, etc.)</label>
              <select
                value={selectedBg.id}
                onChange={(e) => {
                  const found = BANNER_BACKGROUNDS.find((b) => b.id === e.target.value);
                  if (found) setSelectedBg(found);
                }}
              >
                {BANNER_BACKGROUNDS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>3. Add Headline / Visual Sentence Text</label>
              <div className="input-with-button">
                <input
                  type="text"
                  value={customTextInput}
                  onChange={(e) => setCustomTextInput(e.target.value)}
                  placeholder="Type banner headline or visual sentence..."
                />
                <button className="btn-secondary" onClick={addTextToBanner}>
                  <Type size={15} /> Add Text
                </button>
              </div>
            </div>

            {activeLayer && (
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: '10px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#60a5fa' }}>
                    Selected Layer: {activeLayer.type === 'text' ? activeLayer.text : activeLayer.name}
                  </span>
                  <button
                    className="btn-danger"
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    onClick={() => {
                      setBannerLayers((prev) => prev.filter((l) => l.id !== activeLayer.id));
                      setActiveLayerId(null);
                    }}
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                </div>

                {activeLayer.type === 'text' && (
                  <input
                    type="text"
                    value={activeLayer.text}
                    onChange={(e) =>
                      setBannerLayers((prev) =>
                        prev.map((l) => (l.id === activeLayer.id ? { ...l, text: e.target.value } : l))
                      )
                    }
                  />
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Size / Scale:</span>
                  <input
                    type="range"
                    min="0.15"
                    max="1.6"
                    step="0.02"
                    value={activeLayer.scale}
                    onChange={(e) =>
                      setBannerLayers((prev) =>
                        prev.map((l) =>
                          l.id === activeLayer.id ? { ...l, scale: Number(e.target.value) } : l
                        )
                      )
                    }
                    style={{ flex: 1, cursor: 'pointer', accentColor: '#3b82f6' }}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>4. Click Any Cutout Element Below to Drop Onto Banner ({completedJobs.length} Available)</label>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '8px 0' }}>
                {completedJobs.map((job) => (
                  <div
                    key={job.job_id}
                    onClick={() => addElementToBanner(job)}
                    title={`Click to add ${job.title || job.original_filename}`}
                    style={{
                      minWidth: '84px',
                      height: '68px',
                      background: '#0f172a',
                      borderRadius: '8px',
                      padding: '4px',
                      cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}
                  >
                    <img
                      src={job.trimmed_sticker_url}
                      alt={job.original_filename}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span>Interactive Banner Canvas ({selectedPreset.name})</span>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                <Move size={13} style={{ display: 'inline', marginRight: '4px' }} />
                Click &amp; Drag Elements to Arrange
              </span>
            </div>

            <div
              style={{
                width: '100%',
                minHeight: '380px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#090d16',
                borderRadius: '10px',
                padding: '16px',
                overflow: 'hidden'
              }}
            >
              <div
                ref={bannerStageRef}
                onPointerMove={handleBannerPointerMove}
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: `${selectedPreset.width} / ${selectedPreset.height}`,
                  maxHeight: '420px',
                  background: selectedBg.css,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  userSelect: 'none',
                  touchAction: 'none',
                  border:
                    selectedBg.id === 'whiteboard'
                      ? '8px solid #cbd5e1'
                      : selectedBg.id === 'chalkboard'
                      ? '10px solid #78350f'
                      : 'none'
                }}
              >
                {bannerLayers.map((layer) => {
                  const isSelected = layer.id === activeLayerId;
                  return (
                    <div
                      key={layer.id}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setActiveLayerId(layer.id);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${layer.x}%`,
                        top: `${layer.y}%`,
                        transform: 'translate(-50%, -50%)',
                        cursor: 'grab',
                        border: isSelected ? '2px dashed #38bdf8' : '2px solid transparent',
                        borderRadius: '6px',
                        padding: '4px'
                      }}
                    >
                      {layer.type === 'image' ? (
                        <img
                          src={layer.src}
                          alt={layer.name}
                          draggable={false}
                          style={{
                            height: `${Math.round(240 * layer.scale)}px`,
                            width: 'auto',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.35))',
                            pointerEvents: 'none'
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            fontSize: `${Math.round(22 * layer.scale)}px`,
                            fontWeight: 800,
                            color:
                              selectedBg.id === 'whiteboard' || selectedBg.id === 'studio_white'
                                ? '#0f172a'
                                : layer.color || '#ffffff',
                            textShadow:
                              selectedBg.id === 'whiteboard' || selectedBg.id === 'studio_white'
                                ? 'none'
                                : '0 4px 12px rgba(0,0,0,0.65)',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none'
                          }}
                        >
                          {layer.text}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#94a3b8', flexWrap: 'wrap', gap: '8px' }}>
              <span>Click any element on the canvas to drag or resize it.</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-accent" onClick={exportHighResBannerSvg}>
                  <FileCode size={15} /> 1-Click Export Banner .SVG
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
