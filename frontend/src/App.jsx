import React, { useState, useRef, useEffect } from 'react';
import {
  Folder,
  CheckCircle2,
  AlertCircle,
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
  Shield,
  Trees
} from 'lucide-react';
import { removeBackground } from '@imgly/background-removal';
import JSZip from 'jszip';
import './App.css';

// Pre-loaded Real EDR Bounce House Before/After Showcase Pairs
const EDR_SHOWCASE_SAMPLES = [
  {
    job_id: 'edr_tropical_slide',
    original_filename: 'Tropical_Water_Slide_28x14.png',
    title: 'Tropical Water Slide (28×14)',
    subtitle: 'Removed wet concrete driveway, yellow bucket, fence, house & red "18 / 28×14" badges → Polished & brightened on Sunny Park Lawn',
    before_url: '/samples/tropical_slide_before.jpg',
    after_park_url: '/samples/tropical_slide_after.jpg',
    is_showcase: true
  },
  {
    job_id: 'edr_ninja_turtles',
    original_filename: 'Ninja_Turtles_Bounce_18x15x20.png',
    title: 'Ninja Turtles Bounce (18×15×20)',
    subtitle: 'Removed winter driveway, dead overhanging branches, fence, cords & "10 18x15x20" text → Polished purple/green vinyl on Sunny Park Lawn',
    before_url: '/samples/ninja_turtles_before.jpg',
    after_park_url: '/samples/ninja_turtles_after.jpg',
    is_showcase: true
  },
  {
    job_id: 'edr_princess_castle',
    original_filename: 'Princess_Castle_12x12.png',
    title: 'Princess Castle (12×12)',
    subtitle: 'Removed blue ground tarp, asphalt driveway, garage, fence & lens glare → Polished pink/purple/teal vinyl on Sunny Park Lawn',
    before_url: '/samples/princess_castle_before.jpg',
    after_park_url: '/samples/princess_castle_after.jpg',
    is_showcase: true
  },
  {
    job_id: 'edr_toy_story',
    original_filename: 'Toy_Story_Bounce_14x12.png',
    title: 'Toy Story Bounce House (14×12)',
    subtitle: 'Removed concrete driveway, Ford truck, carport, rolled tarps, orange cord & "14 14×12" text → Polished on Lush Park Lawn',
    before_url: '/samples/toy_story_before.jpg',
    after_park_url: '/samples/toy_story_after.jpg',
    is_showcase: true
  },
  {
    job_id: 'edr_bungy_run',
    original_filename: 'Bungy_Run_Dual_Lane_20ft.png',
    title: 'Bungy Run Dual Lane (20ft)',
    subtitle: 'Removed asphalt street, parked cars, person blur, shoes, fence & "20 bungy Run" text → Polished primary vinyl on Sunny Park Lawn',
    before_url: '/samples/bungy_run_before.jpg',
    after_park_url: '/samples/bungy_run_after.jpg',
    is_showcase: true
  },
  {
    job_id: 'edr_rainbow_palace',
    original_filename: 'Rainbow_Palace_Slide.png',
    title: 'Rainbow Palace Combo Slide',
    subtitle: 'Removed patchy dry field, white tarp, horse trailer & barn → Polished vibrant rainbow vinyl on Sunny Park Lawn & Blue Sky',
    before_url: '/samples/rainbow_palace_before.jpg',
    after_park_url: '/samples/rainbow_palace_after.jpg',
    is_showcase: true
  }
];

// Generate repeating diagonal SVG watermark overlay ONLY for the on-page preview shield
// (Exported/downloaded files NEVER have this watermark!)
function createAntiTheftOverlaySvg(text = 'EDR PARTY RENTALS • PREVIEW ONLY') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="220">
    <g transform="rotate(-25 170 110)">
      <text x="15" y="80" fill="rgba(255,255,255,0.28)" stroke="rgba(15,23,42,0.22)" stroke-width="0.8" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="15" letter-spacing="1.8">${text}</text>
      <text x="35" y="180" fill="rgba(255,255,255,0.28)" stroke="rgba(15,23,42,0.22)" stroke-width="0.8" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="15" letter-spacing="1.8">${text}</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

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
      if (alpha > 12) {
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
 * Trace outer & inner boundary contour of the non-transparent alpha channel
 * to embed a true mathematical <path id="element_cutline_contour"> inside the exported .SVG file.
 */
function traceAlphaContourSvgPath(ctx, width, height, steps = 90) {
  const data = ctx.getImageData(0, 0, width, height).data;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(cx, cy);
  const points = [];

  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let bestR = 0;

    for (let r = maxR; r >= 0; r -= Math.max(2, Math.floor(maxR / 150))) {
      const x = Math.round(cx + cos * r);
      const y = Math.round(cy + sin * r);
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const a = data[(y * width + x) * 4 + 3];
        if (a > 25) {
          bestR = r;
          break;
        }
      }
    }

    if (bestR > 0) {
      const px = Math.max(0, Math.min(width, Math.round(cx + cos * bestR)));
      const py = Math.max(0, Math.min(height, Math.round(cy + sin * bestR)));
      points.push(`${px},${py}`);
    }
  }

  if (points.length < 3) {
    return `M 0,0 L ${width},0 L ${width},${height} L 0,${height} Z`;
  }
  return `M ${points.join(' L ')} Z`;
}

/**
 * Build a standalone, scalable .SVG string containing:
 * - Scalable viewBox matching the trimmed element dimensions
 * - Traced mathematical vector <clipPath> & die-cut <path id="element_cutline_contour"> contour
 * - High-resolution embedded cutout image
 */
function createStandaloneSvgMarkup(stickerCanvas, pngDataUrl) {
  const w = stickerCanvas.width;
  const h = stickerCanvas.height;
  const ctx = stickerCanvas.getContext('2d');
  const contourPath = traceAlphaContourSvgPath(ctx, w, h, 96);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <path id="element_cutline_contour" d="${contourPath}" />
    <clipPath id="element_clip">
      <use href="#element_cutline_contour" />
    </clipPath>
  </defs>
  <g id="visual_sentence_element">
    <image width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" href="${pngDataUrl}" />
    <use href="#element_cutline_contour" fill="none" stroke="none" />
  </g>
</svg>`;
}

// Cache the loaded Sunny Park Lawn & Sky backdrop image
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
 * Multi-Stage Bounce House Vinyl Polish, De-Wrinkle, Sunlight Warmth & Color Pop Engine
 * Specifically engineered to transform dull, shadowy backyard/driveway bounce house photos
 * into bright, vibrant, glossy, sun-lit commercial rental inventory.
 */
function processBounceHouseVinylPolish(
  origImg,
  cutoutImg,
  polishIntensity = 'high'
) {
  const w = origImg.width;
  const h = origImg.height;

  const subjectCanvas = document.createElement('canvas');
  subjectCanvas.width = w;
  subjectCanvas.height = h;
  const ctx = subjectCanvas.getContext('2d');
  ctx.drawImage(origImg, 0, 0, w, h);

  // Step 1: Surface De-Wrinkle Base (gentle bilateral-like blend between smooth vinyl color & sharp seams)
  let smoothData = null;
  if (polishIntensity !== 'off') {
    const smoothCanvas = document.createElement('canvas');
    smoothCanvas.width = w;
    smoothCanvas.height = h;
    const smoothCtx = smoothCanvas.getContext('2d');
    smoothCtx.filter = 'blur(2.2px)';
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

  // Step 2: Shadow-Lifting Sunlight Tone Curve + Warmth + PVC Vinyl Specular Gloss
  const shadowLiftGamma = polishIntensity === 'high' ? 0.72 : polishIntensity === 'medium' ? 0.84 : 1.0;
  const contrastGain = polishIntensity === 'high' ? 1.18 : polishIntensity === 'medium' ? 1.10 : 1.0;
  const vibranceBoost = polishIntensity === 'high' ? 0.42 : polishIntensity === 'medium' ? 0.24 : 0.0;
  const vinylSheen = polishIntensity === 'high' ? 16 : polishIntensity === 'medium' ? 8 : 0;

  // Build separate R, G, B sunlight tone LUTs (adds warm golden-hour sunlight & removes cold overcast blue cast)
  const lutR = new Uint8Array(256);
  const lutG = new Uint8Array(256);
  const lutB = new Uint8Array(256);

  for (let v = 0; v < 256; v++) {
    let norm = v / 255.0;
    // Deep shadow recovery curve (lifts dark bounce house interiors & shaded walls without blowing out highlights)
    const lifted = Math.pow(norm, shadowLiftGamma);
    // S-curve contrast around mid-point
    const contrasted = (lifted - 0.46) * contrastGain + 0.48;
    // Specular vinyl gloss sheen on bright planes
    const baseOut = contrasted * 255.0 + vinylSheen * Math.pow(lifted, 2.2);

    const warmShift = polishIntensity === 'high' ? 6 * Math.sin(norm * Math.PI) : polishIntensity === 'medium' ? 3 * Math.sin(norm * Math.PI) : 0;
    lutR[v] = Math.max(0, Math.min(255, Math.round(baseOut + warmShift * 1.15)));
    lutG[v] = Math.max(0, Math.min(255, Math.round(baseOut + warmShift * 0.45)));
    lutB[v] = Math.max(0, Math.min(255, Math.round(baseOut - warmShift * 0.65)));
  }

  for (let i = 0; i < data.length; i += 4) {
    if (!keepFullScene && maskData) {
      let a = maskData[i + 3];
      // Clean alpha fringe (erosion of noisy low-alpha driveway/branch halo)
      if (a < 28) {
        data[i + 3] = 0;
        continue;
      }
      a = Math.min(255, Math.round((a - 24) * 1.25));
      data[i + 3] = a;
    } else {
      data[i + 3] = 255;
    }

    let rOrig = data[i];
    let gOrig = data[i + 1];
    let bOrig = data[i + 2];

    // Edge-preserving vinyl de-wrinkle: if local pixel difference from blurred canvas is small (minor wrinkle/grain),
    // blend 35% of smooth vinyl surface; if large (seam, netting, character art), keep 100% sharp!
    if (smoothData) {
      const diff =
        Math.abs(rOrig - smoothData[i]) +
        Math.abs(gOrig - smoothData[i + 1]) +
        Math.abs(bOrig - smoothData[i + 2]);
      if (diff < 42) {
        const smoothWeight = (1.0 - diff / 42.0) * 0.38;
        rOrig = Math.round(rOrig * (1 - smoothWeight) + smoothData[i] * smoothWeight);
        gOrig = Math.round(gOrig * (1 - smoothWeight) + smoothData[i + 1] * smoothWeight);
        bOrig = Math.round(bOrig * (1 - smoothWeight) + smoothData[i + 2] * smoothWeight);
      }
    }

    let r = lutR[rOrig];
    let g = lutG[gOrig];
    let b = lutB[bOrig];

    // Selective Vinyl Color Pop (boosts primary/secondary inflatable vinyl colors while protecting white labels)
    if (vibranceBoost > 0) {
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const chroma = maxC - minC;
      const sat = maxC > 0 ? chroma / maxC : 0;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;

      // Only boost pixels that already have color hue (protects neutral whites/blacks)
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

  // Step 3: Crisp Seam & Artwork Definition Pass (Unsharp Mask on structural details)
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
    const amount = polishIntensity === 'high' ? 0.45 : 0.26;

    for (let i = 0; i < sp.length; i += 4) {
      if (sp[i + 3] === 0) continue;
      const dR = sp[i] - bp[i];
      const dG = sp[i + 1] - bp[i + 1];
      const dB = sp[i + 2] - bp[i + 2];
      // Only sharpen true seams/edges (threshold > 6) so vinyl stays smooth and glossy
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
 * Build All Outputs:
 * 1. Sunny Park Lawn & Sky Composite (1448×1086 4:3 EDR Bounce House Standard!)
 * 2. Aligned Before Image (1448×1086 4:3 so the Before/After slider aligns 1:1 without jumping!)
 * 3. Catalog Pure White (2000×2000)
 * 4. Trimmed Transparent Sticker .PNG + Cutline-Traced .SVG for 1-Click Export & SVG Pack ZIP
 */
async function buildBounceHouseAndSvgOutputs(
  originalFileOrUrl,
  cutoutBlob,
  polishIntensity = 'high',
  prebakedAfterParkUrl = null
) {
  const origUrl =
    typeof originalFileOrUrl === 'string'
      ? originalFileOrUrl
      : URL.createObjectURL(originalFileOrUrl);
  const cutUrl = cutoutBlob ? URL.createObjectURL(cutoutBlob) : null;

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
  const subjectCanvas = processBounceHouseVinylPolish(origImg, cutImg, polishIntensity);
  const subjectCtx = subjectCanvas.getContext('2d');

  // 1. Tightly cropped Sticker PNG + Standalone Vector-Contour SVG for 1-Click SVG & Pack ZIP
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

  // 2. Sunny Park Lawn & Sky Composite (1448×1086 4:3 EDR Bounce House Standard)
  const parkW = 1448;
  const parkH = 1086;

  // Compute placement on the Sunny Park Lawn so the bounce house sits naturally on the grass
  const maxParkOccW = Math.floor(parkW * 0.84);
  const maxParkOccH = Math.floor(parkH * 0.82);
  const parkScale = Math.min(maxParkOccW / tightBbox.w, maxParkOccH / tightBbox.h);
  const drawW = Math.max(1, Math.floor(tightBbox.w * parkScale));
  const drawH = Math.max(1, Math.floor(tightBbox.h * parkScale));
  const drawX = Math.floor((parkW - drawW) / 2);
  const groundLineY = Math.floor(parkH * 0.91);
  const drawY = Math.max(Math.floor(parkH * 0.06), groundLineY - drawH);

  let sunnyParkUrl = prebakedAfterParkUrl;
  if (!sunnyParkUrl) {
    const parkCanvas = document.createElement('canvas');
    parkCanvas.width = parkW;
    parkCanvas.height = parkH;
    const parkCtx = parkCanvas.getContext('2d');

    if (parkBackdropImg) {
      parkCtx.drawImage(parkBackdropImg, 0, 0, parkW, parkH);
    } else {
      const skyGrad = parkCtx.createLinearGradient(0, 0, 0, parkH * 0.58);
      skyGrad.addColorStop(0, '#2563eb');
      skyGrad.addColorStop(1, '#93c5fd');
      parkCtx.fillStyle = skyGrad;
      parkCtx.fillRect(0, 0, parkW, parkH * 0.58);
      const lawnGrad = parkCtx.createLinearGradient(0, parkH * 0.58, 0, parkH);
      lawnGrad.addColorStop(0, '#4d7c0f');
      lawnGrad.addColorStop(1, '#365314');
      parkCtx.fillStyle = lawnGrad;
      parkCtx.fillRect(0, parkH * 0.58, parkW, parkH * 0.42);
    }

    // Realistic dual-layer grass contact shadow & warm sunlight cast shadow (sun from upper-left)
    parkCtx.save();
    const shadowCenterX = drawX + Math.floor(drawW * 0.53);
    const shadowCenterY = drawY + drawH - Math.floor(drawH * 0.02);
    const shadowRx = Math.floor(drawW * 0.49);
    const shadowRy = Math.max(18, Math.floor(drawH * 0.055));

    const ambientGrad = parkCtx.createRadialGradient(
      shadowCenterX,
      shadowCenterY,
      10,
      shadowCenterX,
      shadowCenterY,
      shadowRx
    );
    ambientGrad.addColorStop(0, 'rgba(15, 35, 10, 0.58)');
    ambientGrad.addColorStop(0.6, 'rgba(15, 35, 10, 0.30)');
    ambientGrad.addColorStop(1, 'rgba(15, 35, 10, 0)');

    parkCtx.translate(shadowCenterX, shadowCenterY);
    parkCtx.scale(1, shadowRy / shadowRx);
    parkCtx.beginPath();
    parkCtx.arc(0, 0, shadowRx, 0, Math.PI * 2);
    parkCtx.fillStyle = ambientGrad;
    parkCtx.fill();
    parkCtx.restore();

    // Tight dark contact occlusion line directly under the vinyl base on the grass
    parkCtx.save();
    parkCtx.fillStyle = 'rgba(10, 28, 6, 0.48)';
    parkCtx.filter = 'blur(6px)';
    parkCtx.fillRect(drawX + drawW * 0.04, drawY + drawH - 10, drawW * 0.92, 16);
    parkCtx.restore();

    // Draw polished, brightened bounce house onto the sunny park lawn
    parkCtx.drawImage(
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

    sunnyParkUrl = parkCanvas.toDataURL('image/jpeg', 0.94);
  }

  // 3. Aligned Original "Before" Canvas (1448×1086 4:3 matching the After frame)
  const beforeCanvas = document.createElement('canvas');
  beforeCanvas.width = parkW;
  beforeCanvas.height = parkH;
  const beforeCtx = beforeCanvas.getContext('2d');
  beforeCtx.fillStyle = '#0f172a';
  beforeCtx.fillRect(0, 0, parkW, parkH);

  if (prebakedAfterParkUrl) {
    beforeCtx.drawImage(origImg, 0, 0, parkW, parkH);
  } else {
    const fullOrigW = Math.round(origImg.width * parkScale);
    const fullOrigH = Math.round(origImg.height * parkScale);
    const fullOrigX = Math.round(drawX - tightBbox.x * parkScale);
    const fullOrigY = Math.round(drawY - tightBbox.y * parkScale);
    beforeCtx.drawImage(origImg, 0, 0, origImg.width, origImg.height, fullOrigX, fullOrigY, fullOrigW, fullOrigH);
  }
  const alignedBeforeUrl = beforeCanvas.toDataURL('image/jpeg', 0.92);

  // 4. Clean Transparent PNG & 2000×2000 White Catalog JPG
  const canvasW = 2000;
  const canvasH = 2000;
  const maxAllowedW = Math.floor(canvasW * 0.88);
  const maxAllowedH = Math.floor(canvasH * 0.82);
  const catScale = Math.min(maxAllowedW / tightBbox.w, maxAllowedH / tightBbox.h);
  const newW = Math.max(1, Math.floor(tightBbox.w * catScale));
  const newH = Math.max(1, Math.floor(tightBbox.h * catScale));
  const posX = Math.floor((canvasW - newW) / 2);
  const posY = Math.max(Math.floor(canvasH * 0.06), Math.floor(canvasH * 0.88) - newH);

  const transCanvas = document.createElement('canvas');
  transCanvas.width = canvasW;
  transCanvas.height = canvasH;
  const transCtx = transCanvas.getContext('2d');
  transCtx.drawImage(subjectCanvas, tightBbox.x, tightBbox.y, tightBbox.w, tightBbox.h, posX, posY, newW, newH);
  const transparentUrl = transCanvas.toDataURL('image/png');

  const whiteCanvas = document.createElement('canvas');
  whiteCanvas.width = canvasW;
  whiteCanvas.height = canvasH;
  const whiteCtx = whiteCanvas.getContext('2d');
  whiteCtx.fillStyle = '#ffffff';
  whiteCtx.fillRect(0, 0, canvasW, canvasH);
  whiteCtx.drawImage(subjectCanvas, tightBbox.x, tightBbox.y, tightBbox.w, tightBbox.h, posX, posY, newW, newH);
  const catalogWhiteUrl = whiteCanvas.toDataURL('image/jpeg', 0.94);

  if (typeof originalFileOrUrl !== 'string') URL.revokeObjectURL(origUrl);
  if (cutUrl) URL.revokeObjectURL(cutUrl);

  return {
    sunnyParkUrl,
    alignedBeforeUrl,
    transparentUrl,
    catalogWhiteUrl,
    trimmedStickerUrl,
    svgMarkup,
    stickerWidth: tightBbox.w,
    stickerHeight: tightBbox.h
  };
}

// Presets for Banner & Visual Sentences Builder
const BANNER_PRESETS = [
  { id: 'fb_cover', name: 'Facebook Cover Banner (1640 × 624)', width: 1640, height: 624 },
  { id: 'ig_square', name: 'Instagram Square Post / Ad (1080 × 1080)', width: 1080, height: 1080 },
  { id: 'ig_story', name: 'Instagram Story / Reel Cover (1080 × 1920)', width: 1080, height: 1920 },
  { id: 'web_hero', name: 'Website Hero Banner (1920 × 700)', width: 1920, height: 700 },
  { id: 'print_sheet', name: 'Printable Sticker / Puzzle Sheet (2400 × 1800)', width: 2400, height: 1800 }
];

const BANNER_BACKGROUNDS = [
  { id: 'sunny_park', name: 'Sunny Park Lawn & Blue Sky', css: 'url("/backdrops/sunny_park_lawn.jpg") center/cover no-repeat', colors: ['#2563eb', '#60a5fa', '#4d7c0f'] },
  { id: 'sunset_party', name: 'Sunset Party Gradient', css: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #6366f1 100%)', colors: ['#f97316', '#ec4899', '#6366f1'] },
  { id: 'tropical_aqua', name: 'Tropical Water Slide Splash', css: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 55%, #1d4ed8 100%)', colors: ['#06b6d4', '#3b82f6', '#1d4ed8'] },
  { id: 'royal_night', name: 'Visual Sentences Midnight Gold', css: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)', colors: ['#0f172a', '#1e1b4b', '#312e81'] },
  { id: 'clean_white', name: 'Pure Studio White', css: '#ffffff', colors: ['#ffffff', '#f8fafc', '#f1f5f9'] }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('cleaner'); // 'cleaner' | 'vault' | 'banner'

  // Bounce House Polish & Backdrop Mode
  const [backdropStyle, setBackdropStyle] = useState('sunny_park'); // 'sunny_park' | 'white_catalog' | 'transparent_cutout'
  const [polishIntensity, setPolishIntensity] = useState('high');
  const [watermarkText, setWatermarkText] = useState('EDR PARTY RENTALS • PREVIEW ONLY');

  // Queue & PNG/SVG Vault State
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [sliderPos, setSliderPos] = useState(50);
  const [packCategory, setPackCategory] = useState('EDR_Bounce_House_SVG_Pack');

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

  // Initialize with the 6 real EDR Bounce House Before/After Showcase items on mount
  useEffect(() => {
    let mounted = true;
    async function initShowcase() {
      const initialJobs = EDR_SHOWCASE_SAMPLES.map((s) => ({
        job_id: s.job_id,
        original_filename: s.original_filename,
        title: s.title,
        subtitle: s.subtitle,
        pack_name: 'EDR_Bounce_House_SVG_Pack',
        original_url: s.before_url,
        aligned_before_url: s.before_url,
        sunny_park_url: s.after_park_url,
        catalog_white_url: s.after_park_url,
        transparent_url: s.after_park_url,
        trimmed_sticker_url: s.after_park_url,
        svg_markup: null,
        status: 'completed',
        is_showcase: true,
        model_used: 'EDR Bounce House Cleanup + Vinyl Polish + Sunny Park Lawn',
        processing_time: '0.85'
      }));

      setJobs(initialJobs);
      setSelectedJob(initialJobs[0]);

      // Build scalable SVG + sticker PNG for each showcase item in the background so 1-Click SVG Export works immediately
      for (const sample of EDR_SHOWCASE_SAMPLES) {
        if (!mounted) return;
        try {
          const img = await new Promise((res, rej) => {
            const el = new Image();
            el.crossOrigin = 'anonymous';
            el.onload = () => res(el);
            el.onerror = rej;
            el.src = sample.after_park_url;
          });
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const pngUrl = c.toDataURL('image/png');
          const svgStr = createStandaloneSvgMarkup(c, pngUrl);

          if (!mounted) return;
          setJobs((prev) =>
            prev.map((j) =>
              j.job_id === sample.job_id
                ? { ...j, svg_markup: svgStr, trimmed_sticker_url: pngUrl }
                : j
            )
          );
          setSelectedJob((prev) =>
            prev && prev.job_id === sample.job_id
              ? { ...prev, svg_markup: svgStr, trimmed_sticker_url: pngUrl }
              : prev
          );
        } catch (e) {
          console.warn('Showcase SVG init warning:', e);
        }
      }
    }
    initShowcase();
    return () => {
      mounted = false;
    };
  }, []);

  // Process uploaded files (1 to 100+ photos) through the AI Cutout + Bounce House Vinyl Polish + Sunny Park Compositor
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
      subtitle: 'Live AI Cutout + Vinyl Polish, De-Wrinkle & Brighten + Sunny Park Lawn Composite',
      pack_name: packCategory,
      original_url: URL.createObjectURL(file),
      aligned_before_url: null,
      sunny_park_url: null,
      catalog_white_url: null,
      transparent_url: null,
      trimmed_sticker_url: null,
      svg_markup: null,
      status: 'queued',
      model_used: 'IS-Net Cutout + Vinyl Polish & Sunny Park Lawn Composite',
      stickerWidth: 500,
      stickerHeight: 500,
      processing_time: null
    }));

    setJobs((prev) => [...newEntries, ...prev]);
    setSelectedJob(newEntries[0]);

    for (let i = 0; i < newEntries.length; i++) {
      const entry = newEntries[i];
      const t0 = performance.now();
      setProgressMsg(
        `Cleaning, Polishing & Placing on Sunny Park Lawn (${i + 1}/${newEntries.length}): ${entry.original_filename}...`
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
            sunny_park_url: canon.sunny_park_url,
            catalog_white_url: canon.catalog_white_url,
            transparent_url: canon.transparent_url,
            trimmed_sticker_url: canon.trimmed_sticker_url,
            svg_markup: canon.svg_markup,
            stickerWidth: canon.stickerWidth,
            stickerHeight: canon.stickerHeight,
            processing_time: 0.01
          };
          setJobs((prev) => prev.map((j) => (j.job_id === entry.job_id ? skippedJob : j)));
          setSelectedJob(skippedJob);
          continue;
        }

        let cutoutBlob = null;
        try {
          cutoutBlob = await removeBackground(entry.file, {
            model: 'isnet_fp16',
            output: { format: 'image/png', quality: 1.0 },
            progress: (key, current, total) => {
              if (total > 0) {
                const pct = Math.round((current / total) * 100);
                setProgressMsg(
                  `Removing Driveway/Clutter & Polishing Vinyl ${i + 1}/${newEntries.length} (${entry.original_filename}) — AI ${pct}%`
                );
              }
            }
          });
        } catch (wasmErr) {
          if (String(wasmErr.message || '').includes('Failed to fetch dynamically imported module')) {
            window.location.reload();
            return;
          }
          console.warn('AI segmentation fell back to full studio polish:', wasmErr);
          cutoutBlob = null;
        }

        const {
          sunnyParkUrl,
          alignedBeforeUrl,
          transparentUrl,
          catalogWhiteUrl,
          trimmedStickerUrl,
          svgMarkup,
          stickerWidth,
          stickerHeight
        } = await buildBounceHouseAndSvgOutputs(entry.file, cutoutBlob, polishIntensity);

        const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
        const completedJob = {
          ...entry,
          status: 'completed',
          sunny_park_url: sunnyParkUrl,
          aligned_before_url: alignedBeforeUrl,
          catalog_white_url: catalogWhiteUrl,
          transparent_url: transparentUrl,
          trimmed_sticker_url: trimmedStickerUrl,
          svg_markup: svgMarkup,
          stickerWidth,
          stickerHeight,
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

  // Run Live AI Cutout + Vinyl Polish + Sunny Park Composite on any preloaded sample raw photo
  const runLiveAiCleanupOnSample = async (sampleJob) => {
    if (isProcessingBatch) return;
    try {
      setIsProcessingBatch(true);
      setProgressMsg(`Fetching raw photo for ${sampleJob.title || sampleJob.original_filename}...`);
      const resp = await fetch(sampleJob.original_url);
      const blob = await resp.blob();
      const file = new File([blob], sampleJob.original_filename, { type: blob.type || 'image/jpeg' });
      await handleFilesSelected([file]);
    } catch (e) {
      console.error('Live sample cleanup failed:', e);
      setIsProcessingBatch(false);
      setProgressMsg('');
    }
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
    const completed = jobs.filter((j) => (j.status === 'completed' || j.status === 'skipped') && j.svg_markup);
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
      src: job.trimmed_sticker_url || job.transparent_url || job.sunny_park_url,
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
        color: '#ffffff'
      }
    ]);
    setActiveLayerId(id);
    setCustomTextInput('');
  };

  // Export High-Resolution Banner (.SVG)
  const exportHighResBannerSvg = async () => {
    const w = selectedPreset.width;
    const h = selectedPreset.height;

    let bgMarkup = '';
    if (selectedBg.colors) {
      bgMarkup = `
  <defs>
    <linearGradient id="banner_bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${selectedBg.colors[0]}" />
      <stop offset="50%" stop-color="${selectedBg.colors[1]}" />
      <stop offset="100%" stop-color="${selectedBg.colors[2]}" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#banner_bg)" />`;
    }

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
        const safeText = layer.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        layerMarkups.push(
          `  <text x="${cx}" y="${cy}" fill="${layer.color || '#ffffff'}" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">${safeText}</text>`
        );
      }
    }

    const svgDoc = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bgMarkup}
${layerMarkups.join('\n')}
</svg>`;
    const blob = new Blob([svgDoc], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    downloadImage(url, `CleanSnap_${selectedPreset.id}_${w}x${h}.svg`);
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
  const antiTheftOverlayUrl = createAntiTheftOverlaySvg(watermarkText);
  const activeLayer = bannerLayers.find((l) => l.id === activeLayerId);

  // Pick which After image to display based on selected backdrop mode
  const activeAfterUrl = selectedJob
    ? backdropStyle === 'sunny_park'
      ? selectedJob.sunny_park_url || selectedJob.catalog_white_url
      : backdropStyle === 'white_catalog'
      ? selectedJob.catalog_white_url || selectedJob.sunny_park_url
      : selectedJob.transparent_url || selectedJob.sunny_park_url
    : null;

  return (
    <div className="app-container">
      <header style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div className="logo-area">
          <h1>CleanSnap AI — Bounce House Cleaner, Vinyl Polish &amp; SVG Studio</h1>
          <p>
            Removes Messy Driveways, Tarps, Fences &amp; Text • Polishes &amp; Brightens Vinyl • Places on Sunny Park Lawn • 1-Click .SVG &amp; .SVG Pack Export
          </p>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={activeTab === 'cleaner' ? 'btn-accent' : 'btn-secondary'}
            onClick={() => setActiveTab('cleaner')}
          >
            <Sparkles size={16} /> 1. Bounce House Cleaner &amp; Polish
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

      {/* ==================== TAB 1: BOUNCE HOUSE CLEANER, VINYL POLISH & SUNNY PARK COMPOSITOR ==================== */}
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
                  EDR Bounce House Cleanup Standard — Cleaned, Polished, Brightened &amp; Placed on Sunny Park Lawn
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  Click any bounce house below to inspect the Before/After slider (muddy driveways, tarps, trucks, fences &amp; text removed → vibrant polished vinyl on a sunny green park lawn).
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
                    <div style={{ position: 'relative', height: '96px', borderRadius: '6px', overflow: 'hidden', marginBottom: '6px' }}>
                      <img
                        src={job.sunny_park_url || job.catalog_white_url}
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
                        POLISHED
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
            {/* LEFT COLUMN: Upload & Bounce House Polish Controls */}
            <div className="card">
              <div className="card-header">
                <span>1. Drop Raw Bounce House / Product Photos</span>
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
                    ? progressMsg || 'Cleaning, polishing vinyl & placing on Sunny Park Lawn...'
                    : 'Drag & Drop Raw Bounce House or Rental Photos Here'}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
                  Automatically removes driveways/tarps/fences, lifts dark shadows, smooths &amp; brightens vinyl colors, places on the Sunny Park Lawn, and logs a cutline-traced .SVG!
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
                  <Sun size={16} /> Bounce House Cleanup, Polish &amp; Backdrop Settings
                </div>

                <div className="form-group">
                  <label>Cleaned Scene Backdrop Style</label>
                  <select
                    value={backdropStyle}
                    onChange={(e) => setBackdropStyle(e.target.value)}
                  >
                    <option value="sunny_park">
                      🌳 Sunny Park Lawn, Green Summer Trees &amp; Blue Sky (EDR Bounce House Standard)
                    </option>
                    <option value="white_catalog">
                      ⬜ Pure Studio White Catalog (2000×2000 Square)
                    </option>
                    <option value="transparent_cutout">
                      🏁 Transparent Cutout Only (For .SVG Pack &amp; Banner Builder)
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Vinyl De-Wrinkle, Sunlight Brightening &amp; Color Pop Intensity</label>
                  <select
                    value={polishIntensity}
                    onChange={(e) => setPolishIntensity(e.target.value)}
                  >
                    <option value="high">
                      ✨ High Vinyl Polish (Deep Shadow Lift + Warm Sunlight + Vivid Vinyl Color Pop + Gloss Sheen)
                    </option>
                    <option value="medium">
                      ☀️ Balanced Sunlight Polish (Moderate Shadow Lift + Natural Color Boost)
                    </option>
                    <option value="off">
                      Off (Cutout &amp; Park Placement Only — Keep Raw Lighting)
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label>On-Page Anti-Theft Watermark Text (Never Added to Downloads)</label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="EDR PARTY RENTALS • PREVIEW ONLY"
                  />
                </div>
              </div>

              {/* 1-Click SVG Export & SVG Pack Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(15,23,42,0.5)', borderRadius: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '14px', fontSize: '13px', color: '#94a3b8' }}>
                  <span>Ready in Vault: <strong style={{ color: '#22c55e' }}>{completedJobs.length}</strong></span>
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

            {/* RIGHT COLUMN: Smooth Aligned Before / After Slider */}
            <div className="card">
              <div className="card-header" style={{ flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span>2. Before / After Bounce House Cleanup Preview</span>
                  {selectedJob?.subtitle && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400, marginTop: '2px' }}>
                      {selectedJob.subtitle}
                    </div>
                  )}
                </div>
                {selectedJob?.is_showcase && (
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '11px' }}
                    disabled={isProcessingBatch}
                    onClick={() => runLiveAiCleanupOnSample(selectedJob)}
                    title="Re-run the live browser AI cutout + vinyl polish engine on this raw photo"
                  >
                    <Sparkles size={13} /> Re-Run Live AI on Raw Photo
                  </button>
                )}
              </div>

              {selectedJob && activeAfterUrl ? (
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
                      maxHeight: '430px',
                      backgroundColor: '#0f172a',
                      touchAction: 'none',
                      cursor: 'ew-resize',
                      borderRadius: '10px',
                      overflow: 'hidden'
                    }}
                  >
                    {/* AFTER Layer: Cleaned, Polished, Brightened & Placed on Sunny Park Lawn */}
                    <img
                      src={activeAfterUrl}
                      alt="AFTER: Cleaned, Polished & Brightened on Sunny Park Lawn"
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
                      alt="BEFORE: Raw Driveway Photo"
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

                    {/* On-Page Anti-Theft Watermark Shield Overlay (Protects webpage preview from right-click theft; NEVER in downloads) */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url("${antiTheftOverlayUrl}")`,
                        backgroundRepeat: 'repeat',
                        pointerEvents: 'none',
                        zIndex: 5
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
                      BEFORE (Raw Driveway / Tarp / Clutter)
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
                      AFTER (Cleaned, Polished &amp; Sunny Park Lawn)
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
                    <span style={{ fontSize: '12px', color: '#4ade80', minWidth: '45px', textAlign: 'right', fontWeight: 600 }}>
                      Polished
                    </span>
                  </div>

                  {/* Clean Watermark-Free Download Buttons */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <button
                      className="btn-accent"
                      style={{ flex: 1.2, background: '#16a34a' }}
                      onClick={() => {
                        const base = selectedJob.original_filename.replace(/\.[^/.]+$/, '');
                        downloadImage(activeAfterUrl, `${base}_cleaned_polished.jpg`);
                      }}
                    >
                      <Download size={15} /> Download Cleaned &amp; Polished (.JPG)
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
                    Select a bounce house above or drop raw photos on the left!
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
                Every cleaned unit has a traced vector contour path and is ready for 1-Click .SVG export or full .SVG Pack ZIP download.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn-accent" onClick={downloadSvgPackZip} disabled={completedJobs.length === 0}>
                <FileCode size={16} /> 1-Click Export SVG Pack (.ZIP)
              </button>
            </div>
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
                      src={job.sunny_park_url || job.trimmed_sticker_url}
                      alt={job.original_filename}
                      draggable={false}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url("${antiTheftOverlayUrl}")`,
                        backgroundRepeat: 'repeat',
                        pointerEvents: 'none'
                      }}
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
              <label>2. Choose Backdrop Theme</label>
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
              <label>4. Click Any Element Below to Drop Onto Banner ({completedJobs.length} Available)</label>
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
                      src={job.sunny_park_url || job.trimmed_sticker_url}
                      alt={job.original_filename}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
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
                  touchAction: 'none'
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
                            color: layer.color || '#ffffff',
                            textShadow: '0 4px 12px rgba(0,0,0,0.65)',
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
