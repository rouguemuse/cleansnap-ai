import React, { useState, useRef, useEffect } from 'react';
import {
  Folder,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Upload,
  Download,
  Shield,
  Sparkles,
  Image as ImageIcon,
  Archive,
  Sun,
  Layers,
  Layout,
  Plus,
  Trash2,
  Type,
  Package,
  Move
} from 'lucide-react';
import { removeBackground } from '@imgly/background-removal';
import JSZip from 'jszip';
import './App.css';

// Generate repeating diagonal SVG watermark data URL ONLY for the on-page preview backdrop
function createPreviewBackdropPattern(text = 'EDR PARTY RENTALS • PREVIEW ONLY') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">
    <rect width="300" height="200" fill="#ffffff"/>
    <g transform="rotate(-26 150 100)">
      <text x="15" y="75" fill="#cbd5e1" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="15" letter-spacing="1.5">${text}</text>
      <text x="35" y="165" fill="#cbd5e1" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="15" letter-spacing="1.5">${text}</text>
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
      if (alpha > 8) {
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
 * Multi-Stage Studio Polish, Brightening & Color Pop Pipeline
 */
function processStudioSubject(
  origImg,
  cutoutImg,
  cleaningMode = 'cutout_and_polish',
  polishIntensity = 'high'
) {
  const w = origImg.width;
  const h = origImg.height;

  const subjectCanvas = document.createElement('canvas');
  subjectCanvas.width = w;
  subjectCanvas.height = h;
  const ctx = subjectCanvas.getContext('2d');
  ctx.drawImage(origImg, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let maskData = null;
  let keepFullScene = cleaningMode === 'polish_only' || !cutoutImg;

  if (!keepFullScene && cutoutImg) {
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

  const gamma = polishIntensity === 'high' ? 0.80 : polishIntensity === 'medium' ? 0.88 : 1.0;
  const contrastGain = polishIntensity === 'high' ? 1.16 : polishIntensity === 'medium' ? 1.09 : 1.0;
  const vibranceBoost = polishIntensity === 'high' ? 0.34 : polishIntensity === 'medium' ? 0.20 : 0.0;
  const specularLift = polishIntensity === 'high' ? 12 : polishIntensity === 'medium' ? 6 : 0;

  const toneLut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    let norm = v / 255.0;
    norm = Math.pow(norm, gamma);
    norm = (norm - 0.5) * contrastGain + 0.5;
    let out = norm * 255.0 + specularLift * Math.pow(norm, 2);
    toneLut[v] = Math.max(0, Math.min(255, Math.round(out)));
  }

  for (let i = 0; i < data.length; i += 4) {
    if (!keepFullScene && maskData) {
      let a = maskData[i + 3];
      if (a > 8) {
        a = Math.min(255, Math.round(a * 1.75));
      } else {
        data[i + 3] = 0;
        continue;
      }
      data[i + 3] = a;
    } else {
      data[i + 3] = 255;
    }

    let r = toneLut[data[i]];
    let g = toneLut[data[i + 1]];
    let b = toneLut[data[i + 2]];

    if (vibranceBoost > 0) {
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = (maxC - minC) / 255.0;
      const avg = 0.299 * r + 0.587 * g + 0.114 * b;
      const dynVib = vibranceBoost * (1.0 - sat * 0.65);

      r = Math.max(0, Math.min(255, Math.round(r + (r - avg) * dynVib)));
      g = Math.max(0, Math.min(255, Math.round(g + (g - avg) * dynVib)));
      b = Math.max(0, Math.min(255, Math.round(b + (b - avg) * dynVib)));
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
    blurCtx.filter = 'blur(1.5px)';
    blurCtx.drawImage(subjectCanvas, 0, 0);

    const sharpData = ctx.getImageData(0, 0, w, h);
    const sp = sharpData.data;
    const bp = blurCtx.getImageData(0, 0, w, h).data;
    const amount = polishIntensity === 'high' ? 0.42 : 0.25;

    for (let i = 0; i < sp.length; i += 4) {
      if (sp[i + 3] === 0) continue;
      sp[i] = Math.max(0, Math.min(255, Math.round(sp[i] + (sp[i] - bp[i]) * amount)));
      sp[i + 1] = Math.max(0, Math.min(255, Math.round(sp[i + 1] + (sp[i + 1] - bp[i + 1]) * amount)));
      sp[i + 2] = Math.max(0, Math.min(255, Math.round(sp[i + 2] + (sp[i + 2] - bp[i + 2]) * amount)));
    }
    ctx.putImageData(sharpData, 0, 0);
  }

  return subjectCanvas;
}

// Render 2000x2000 Catalog Framed outputs + Tightly Cropped Sticker PNG for Banner Builder
async function buildCatalogOutputs(
  originalFile,
  cutoutBlob,
  cleaningMode = 'cutout_and_polish',
  framingMode = 'catalog',
  polishIntensity = 'high'
) {
  const origUrl = URL.createObjectURL(originalFile);
  const cutUrl = cutoutBlob ? URL.createObjectURL(cutoutBlob) : null;

  const origImg = await new Promise((res, rej) => {
    const el = new Image();
    el.onload = () => res(el);
    el.onerror = rej;
    el.src = origUrl;
  });

  const cutImg = cutUrl
    ? await new Promise((res, rej) => {
        const el = new Image();
        el.onload = () => res(el);
        el.onerror = rej;
        el.src = cutUrl;
      })
    : null;

  const subjectCanvas = processStudioSubject(origImg, cutImg, cleaningMode, polishIntensity);
  const subjectCtx = subjectCanvas.getContext('2d');

  // Tightly cropped Sticker PNG for Visual Sentences / Banner Element Pack
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

  const canvasW = 2000;
  const canvasH = 2000;

  let bbox, newW, newH, posX, posY;

  if (framingMode === 'catalog' && cleaningMode !== 'polish_only') {
    bbox = tightBbox;
    const maxOccupancy = 0.88;
    const minMargin = 0.06;
    const groundLineRatio = 0.88;

    const maxAllowedW = Math.floor(canvasW * maxOccupancy);
    const maxAllowedH = Math.floor(canvasH * (groundLineRatio - minMargin));
    const scale = Math.min(maxAllowedW / bbox.w, maxAllowedH / bbox.h);

    newW = Math.max(1, Math.floor(bbox.w * scale));
    newH = Math.max(1, Math.floor(bbox.h * scale));
    posX = Math.floor((canvasW - newW) / 2);
    const groundY = Math.floor(canvasH * groundLineRatio);
    posY = Math.max(Math.floor(canvasH * minMargin), groundY - newH);
  } else {
    bbox = { x: 0, y: 0, w: subjectCanvas.width, h: subjectCanvas.height };
    const scale = Math.min(canvasW / bbox.w, canvasH / bbox.h);
    newW = Math.max(1, Math.floor(bbox.w * scale));
    newH = Math.max(1, Math.floor(bbox.h * scale));
    posX = Math.floor((canvasW - newW) / 2);
    posY = Math.floor((canvasH - newH) / 2);
  }

  const drawContactShadow = (ctx) => {
    if (cleaningMode === 'polish_only') return;
    ctx.save();
    const shadowX = canvasW / 2;
    const shadowY = posY + newH - Math.floor(newH * 0.015);
    const radiusX = Math.floor(newW * 0.44);
    const radiusY = Math.max(12, Math.floor(newH * 0.025));

    const grad = ctx.createRadialGradient(shadowX, shadowY, 5, shadowX, shadowY, radiusX);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.25)');
    grad.addColorStop(0.65, 'rgba(15, 23, 42, 0.09)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');

    ctx.translate(shadowX, shadowY);
    ctx.scale(1, radiusY / radiusX);
    ctx.beginPath();
    ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  };

  // 1. Aligned Original "Before" Canvas
  const beforeCanvas = document.createElement('canvas');
  beforeCanvas.width = canvasW;
  beforeCanvas.height = canvasH;
  const beforeCtx = beforeCanvas.getContext('2d');
  beforeCtx.fillStyle = '#0f172a';
  beforeCtx.fillRect(0, 0, canvasW, canvasH);
  const scaleUsed = newW / bbox.w;
  const fullOrigW = Math.round(origImg.width * scaleUsed);
  const fullOrigH = Math.round(origImg.height * scaleUsed);
  const fullOrigX = Math.round(posX - bbox.x * scaleUsed);
  const fullOrigY = Math.round(posY - bbox.y * scaleUsed);
  beforeCtx.drawImage(origImg, 0, 0, origImg.width, origImg.height, fullOrigX, fullOrigY, fullOrigW, fullOrigH);
  const alignedBeforeUrl = beforeCanvas.toDataURL('image/jpeg', 0.92);

  // 2. Clean Transparent PNG (2000x2000)
  const transCanvas = document.createElement('canvas');
  transCanvas.width = canvasW;
  transCanvas.height = canvasH;
  const transCtx = transCanvas.getContext('2d');
  drawContactShadow(transCtx);
  transCtx.drawImage(subjectCanvas, bbox.x, bbox.y, bbox.w, bbox.h, posX, posY, newW, newH);
  const transparentUrl = transCanvas.toDataURL('image/png');

  // 3. Clean Catalog White JPG (2000x2000)
  const whiteCanvas = document.createElement('canvas');
  whiteCanvas.width = canvasW;
  whiteCanvas.height = canvasH;
  const whiteCtx = whiteCanvas.getContext('2d');
  whiteCtx.fillStyle = '#ffffff';
  whiteCtx.fillRect(0, 0, canvasW, canvasH);
  drawContactShadow(whiteCtx);
  whiteCtx.drawImage(subjectCanvas, bbox.x, bbox.y, bbox.w, bbox.h, posX, posY, newW, newH);
  const catalogWhiteUrl = whiteCanvas.toDataURL('image/jpeg', 0.95);

  URL.revokeObjectURL(origUrl);
  if (cutUrl) URL.revokeObjectURL(cutUrl);

  return {
    alignedBeforeUrl,
    transparentUrl,
    catalogWhiteUrl,
    trimmedStickerUrl,
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
  { id: 'sunset_party', name: 'Sunset Party Gradient', css: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #6366f1 100%)', colors: ['#f97316', '#ec4899', '#6366f1'] },
  { id: 'tropical_aqua', name: 'Tropical Water Slide Splash', css: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 55%, #1d4ed8 100%)', colors: ['#06b6d4', '#3b82f6', '#1d4ed8'] },
  { id: 'royal_night', name: 'Visual Sentences Midnight Gold', css: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)', colors: ['#0f172a', '#1e1b4b', '#312e81'] },
  { id: 'emerald_lawn', name: 'Summer Park Emerald', css: 'linear-gradient(135deg, #10b981 0%, #059669 55%, #064e3b 100%)', colors: ['#10b981', '#059669', '#064e3b'] },
  { id: 'clean_white', name: 'Pure Studio White', css: '#ffffff', colors: ['#ffffff', '#f8fafc', '#f1f5f9'] },
  { id: 'transparent', name: 'Transparent Scene Overlay', css: 'transparent', colors: null }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('cleaner'); // 'cleaner' | 'vault' | 'banner'

  // Cleaning Mode, Studio Polish & Framing Controls
  const [cleaningMode, setCleaningMode] = useState('cutout_and_polish');
  const [polishIntensity, setPolishIntensity] = useState('high');
  const [framingMode, setFramingMode] = useState('catalog');
  const [watermarkText, setWatermarkText] = useState('EDR PARTY RENTALS • PREVIEW ONLY');

  // Queue & PNG Vault State
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [sliderPos, setSliderPos] = useState(50);
  const [packCategory, setPackCategory] = useState('Visual Sentences Pack #1');

  // Banner & Visual Sentences Builder State
  const [selectedPreset, setSelectedPreset] = useState(BANNER_PRESETS[0]);
  const [selectedBg, setSelectedBg] = useState(BANNER_BACKGROUNDS[0]);
  const [bannerLayers, setBannerLayers] = useState([
    {
      id: 'title_1',
      type: 'text',
      text: 'BUILD YOUR OWN VISUAL SCENE',
      x: 50,
      y: 18,
      scale: 1,
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

  // Process uploaded files (1 to 100+ photos) and automatically log their cutout PNGs into the PNG Element Vault
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
      pack_name: packCategory,
      original_url: URL.createObjectURL(file),
      aligned_before_url: null,
      status: 'queued',
      model_used:
        cleaningMode === 'polish_only'
          ? 'Studio Brighten, Color Pop & Crispness Polish'
          : 'IS-Net Cutout + Studio Brighten & Vinyl Polish',
      catalog_white_url: null,
      transparent_url: null,
      trimmed_sticker_url: null,
      stickerWidth: 500,
      stickerHeight: 500,
      processing_time: null
    }));

    setJobs((prev) => [...newEntries, ...prev]);
    if (!selectedJob) setSelectedJob(newEntries[0]);

    for (let i = 0; i < newEntries.length; i++) {
      const entry = newEntries[i];
      const t0 = performance.now();
      setProgressMsg(`Polishing & extracting PNG ${i + 1} of ${newEntries.length}: ${entry.original_filename}...`);

      setJobs((prev) =>
        prev.map((j) => (j.job_id === entry.job_id ? { ...j, status: 'processing' } : j))
      );

      await new Promise((r) => setTimeout(r, 30));

      try {
        const buffer = await entry.file.arrayBuffer();
        const sha256 = `${cleaningMode}_${polishIntensity}_${framingMode}_${await hashArrayBuffer(buffer)}`;

        if (seenHashesRef.current.has(sha256)) {
          const canon = seenHashesRef.current.get(sha256);
          const skippedJob = {
            ...entry,
            status: 'skipped',
            model_used: `SHA-256 Duplicate of ${canon.original_filename} (0.01s)`,
            aligned_before_url: canon.aligned_before_url,
            catalog_white_url: canon.catalog_white_url,
            transparent_url: canon.transparent_url,
            trimmed_sticker_url: canon.trimmed_sticker_url,
            stickerWidth: canon.stickerWidth,
            stickerHeight: canon.stickerHeight,
            processing_time: 0.01
          };
          setJobs((prev) => prev.map((j) => (j.job_id === entry.job_id ? skippedJob : j)));
          setSelectedJob(skippedJob);
          continue;
        }

        let cutoutBlob = null;
        if (cleaningMode !== 'polish_only') {
          try {
            cutoutBlob = await removeBackground(entry.file, {
              model: 'isnet_fp16',
              output: { format: 'image/png', quality: 1.0 },
              progress: (key, current, total) => {
                if (total > 0) {
                  const pct = Math.round((current / total) * 100);
                  setProgressMsg(
                    `Cleaning & Logging PNG ${i + 1}/${newEntries.length} (${entry.original_filename}) — AI ${pct}%`
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
        }

        const effectivePolish = cleaningMode === 'cutout_only' ? 'off' : polishIntensity;

        const {
          alignedBeforeUrl,
          transparentUrl,
          catalogWhiteUrl,
          trimmedStickerUrl,
          stickerWidth,
          stickerHeight
        } = await buildCatalogOutputs(
          entry.file,
          cutoutBlob,
          cleaningMode,
          framingMode,
          effectivePolish
        );

        const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
        const completedJob = {
          ...entry,
          status: 'completed',
          aligned_before_url: alignedBeforeUrl,
          catalog_white_url: catalogWhiteUrl,
          transparent_url: transparentUrl,
          trimmed_sticker_url: trimmedStickerUrl,
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

  // Download single clean image
  const downloadImage = (dataUrl, filename) => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download all completed photos as a clean ZIP archive (including a /PNG_Element_Pack folder!)
  const downloadAllAsZip = async (onlyStickerPack = false) => {
    const completed = jobs.filter((j) => j.status === 'completed' || j.status === 'skipped');
    if (completed.length === 0) return;

    const zip = new JSZip();
    const packFolderName = packCategory.replace(/[^a-z0-9_-]/gi, '_');

    completed.forEach((job, idx) => {
      const base = job.original_filename.replace(/\.[^/.]+$/, '');
      if (job.trimmed_sticker_url) {
        const base64Sticker = job.trimmed_sticker_url.split(',')[1];
        zip.file(`${packFolderName}_PNG_Elements/${base}_element_${idx + 1}.png`, base64Sticker, { base64: true });
      }
      if (!onlyStickerPack) {
        if (job.catalog_white_url) {
          const base64White = job.catalog_white_url.split(',')[1];
          zip.file(`Catalog_White_2000x2000/${base}_polished_white.jpg`, base64White, { base64: true });
        }
        if (job.transparent_url) {
          const base64Trans = job.transparent_url.split(',')[1];
          zip.file(`Catalog_Transparent_2000x2000/${base}_polished_2000x2000.png`, base64Trans, { base64: true });
        }
      }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const zipName = onlyStickerPack
      ? `${packFolderName}_${completed.length}_PNG_Pack.zip`
      : `CleanSnap_Full_Bundle_${completed.length}_Assets.zip`;
    downloadImage(url, zipName);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // Add a cleaned PNG element from the Vault onto the Banner Builder canvas
  const addElementToBanner = (job) => {
    const id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newLayer = {
      id,
      type: 'image',
      name: job.original_filename,
      src: job.trimmed_sticker_url || job.transparent_url,
      x: 30 + ((bannerLayers.length * 14) % 45),
      y: 55,
      scale: 0.42
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

  // Export High-Resolution Banner (Facebook, Instagram, Website, or Printable Sheet)
  const exportHighResBanner = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = selectedPreset.width;
    canvas.height = selectedPreset.height;
    const ctx = canvas.getContext('2d');

    // 1. Draw Background
    if (selectedBg.colors) {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, selectedBg.colors[0]);
      grad.addColorStop(0.5, selectedBg.colors[1]);
      grad.addColorStop(1, selectedBg.colors[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Draw all layers in order
    for (const layer of bannerLayers) {
      const cx = (layer.x / 100) * canvas.width;
      const cy = (layer.y / 100) * canvas.height;

      if (layer.type === 'image') {
        const img = await new Promise((res) => {
          const el = new Image();
          el.onload = () => res(el);
          el.onerror = () => res(null);
          el.src = layer.src;
        });
        if (img) {
          const targetH = canvas.height * layer.scale;
          const aspect = img.width / img.height;
          const targetW = targetH * aspect;

          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
          ctx.shadowBlur = 24;
          ctx.shadowOffsetY = 10;
          ctx.drawImage(img, cx - targetW / 2, cy - targetH / 2, targetW, targetH);
          ctx.restore();
        }
      } else if (layer.type === 'text') {
        ctx.save();
        const fontSize = Math.round(canvas.height * 0.075 * layer.scale);
        ctx.font = `800 ${fontSize}px "Segoe UI", Arial, sans-serif`;
        ctx.fillStyle = layer.color || '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 4;
        ctx.fillText(layer.text, cx, cy);
        ctx.restore();
      }
    }

    const dataUrl = canvas.toDataURL('image/png');
    downloadImage(dataUrl, `CleanSnap_${selectedPreset.id}_${selectedPreset.width}x${selectedPreset.height}.png`);
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
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const skippedCount = jobs.filter((j) => j.status === 'skipped').length;
  const previewBackdropUrl = createPreviewBackdropPattern(watermarkText);
  const activeLayer = bannerLayers.find((l) => l.id === activeLayerId);

  return (
    <div className="app-container">
      <header style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div className="logo-area">
          <h1>CleanSnap AI &amp; Visual Sentences Studio</h1>
          <p>Product Cutout, Studio Polish, PNG Element Pack Vault &amp; Social/Web Banner Builder</p>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={activeTab === 'cleaner' ? 'btn-accent' : 'btn-secondary'}
            onClick={() => setActiveTab('cleaner')}
          >
            <Sparkles size={16} /> 1. Photo Cleaner &amp; Polish
          </button>
          <button
            className={activeTab === 'vault' ? 'btn-accent' : 'btn-secondary'}
            onClick={() => setActiveTab('vault')}
          >
            <Package size={16} /> 2. PNG Element Pack Vault ({completedJobs.length})
          </button>
          <button
            className={activeTab === 'banner' ? 'btn-accent' : 'btn-secondary'}
            onClick={() => setActiveTab('banner')}
          >
            <Layout size={16} /> 3. Banner &amp; Scene Builder
          </button>
        </div>
      </header>

      {/* ==================== TAB 1: PHOTO CLEANER & STUDIO POLISH ==================== */}
      {activeTab === 'cleaner' && (
        <>
          <div className="grid-layout">
            <div className="card">
              <div className="card-header">
                <span>1. Drop Photos to Clean, Polish &amp; Log into PNG Vault</span>
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
                    <Folder size={16} /> Select Whole Folder
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
                  border: '2px dashed rgba(59, 130, 246, 0.5)',
                  borderRadius: '12px',
                  padding: '24px 20px',
                  textAlign: 'center',
                  background: 'rgba(15, 23, 42, 0.5)',
                  cursor: 'pointer'
                }}
              >
                <Sparkles size={32} style={{ color: '#3b82f6', margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>
                  {isProcessingBatch
                    ? progressMsg || 'Polishing & logging PNGs...'
                    : 'Drag & Drop 1 to 100+ Photos Here (Auto-Logs into PNG Element Vault)'}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
                  Every cleaned PNG is automatically trimmed and saved into your PNG Element Pack Vault for banners, web packs, or printables.
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#60a5fa' }}>
                  <Sun size={16} /> Studio Polish, Pack Name &amp; Cutout Settings
                </div>

                <div className="form-group">
                  <label>PNG Pack / Folder Name (For Logging &amp; ZIP Pack Export)</label>
                  <input
                    type="text"
                    value={packCategory}
                    onChange={(e) => setPackCategory(e.target.value)}
                    placeholder="e.g. Visual Sentences Pack #1"
                  />
                </div>

                <div className="form-group">
                  <label>Processing Pipeline Mode</label>
                  <select
                    value={cleaningMode}
                    onChange={(e) => setCleaningMode(e.target.value)}
                  >
                    <option value="cutout_and_polish">
                      Full Product / Element Cleanup (Cutout Background + Brighten, Polish &amp; Color Pop)
                    </option>
                    <option value="polish_only">
                      Studio Polish &amp; Brighten Only (Keep Full Scene + Boost Lighting &amp; Crispness)
                    </option>
                    <option value="cutout_only">
                      Background Cutout Only (Keep Original Raw Lighting)
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Brightening, Vinyl Gloss &amp; Color Pop Intensity</label>
                  <select
                    value={polishIntensity}
                    onChange={(e) => setPolishIntensity(e.target.value)}
                  >
                    <option value="high">
                      High Studio Polish (Lift Shadows + Vibrant Colors + Unsharp Crispness)
                    </option>
                    <option value="medium">
                      Balanced Natural Polish (Gentle Brightening + Subtle Vibrance)
                    </option>
                    <option value="off">Off (No Color/Brightness Adjustment)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(15,23,42,0.5)', borderRadius: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '14px', fontSize: '13px', color: '#94a3b8' }}>
                  <span>Total: <strong style={{ color: '#fff' }}>{jobs.length}</strong></span>
                  <span>Logged PNGs: <strong style={{ color: '#10b981' }}>{completedCount + skippedCount}</strong></span>
                </div>
                {completedJobs.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn-secondary"
                      onClick={() => downloadAllAsZip(true)}
                      style={{ padding: '8px 12px', fontSize: '12px' }}
                    >
                      <Package size={14} /> Export PNG Element Pack ZIP
                    </button>
                    <button
                      className="btn-accent"
                      onClick={() => setActiveTab('banner')}
                      style={{ padding: '8px 12px', fontSize: '12px' }}
                    >
                      <Layout size={14} /> Open in Banner Builder →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Smooth Aligned Before / After Slider */}
            <div className="card">
              <div className="card-header">
                <span>2. On-Page Protected Preview (Downloads Are 100% Watermark-Free)</span>
                {selectedJob && (
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>{selectedJob.original_filename}</span>
                )}
              </div>

              {selectedJob && selectedJob.catalog_white_url ? (
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
                      backgroundImage: `url("${previewBackdropUrl}")`,
                      backgroundRepeat: 'repeat',
                      backgroundColor: '#ffffff',
                      touchAction: 'none',
                      cursor: 'ew-resize'
                    }}
                  >
                    <img
                      src={selectedJob.transparent_url}
                      alt="Polished & Cleaned Subject"
                      className="slider-img"
                      draggable={false}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    />
                    <img
                      src={selectedJob.aligned_before_url || selectedJob.original_url}
                      alt="Original Before"
                      className="slider-img"
                      draggable={false}
                      style={{
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
                        background: 'rgba(15, 23, 42, 0.82)',
                        color: '#f8fafc',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        pointerEvents: 'none',
                        zIndex: 6
                      }}
                    >
                      BEFORE (Raw Photo)
                    </span>
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '12px',
                        right: '12px',
                        background: 'rgba(16, 185, 129, 0.92)',
                        color: '#ffffff',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        pointerEvents: 'none',
                        zIndex: 6
                      }}
                    >
                      AFTER (Polished &amp; Cutout)
                    </span>

                    <div
                      className="slider-handle"
                      style={{ left: `${sliderPos}%`, zIndex: 10, pointerEvents: 'none' }}
                    >
                      <div className="slider-handle-circle">↔</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 4px' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8', minWidth: '45px' }}>Before</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={sliderPos}
                      onChange={(e) => setSliderPos(Number(e.target.value))}
                      style={{ flex: 1, cursor: 'pointer', accentColor: '#3b82f6' }}
                    />
                    <span style={{ fontSize: '12px', color: '#94a3b8', minWidth: '38px', textAlign: 'right' }}>After</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <button
                      className="btn-accent"
                      style={{ flex: 1 }}
                      onClick={() => {
                        const base = selectedJob.original_filename.replace(/\.[^/.]+$/, '');
                        downloadImage(selectedJob.catalog_white_url, `${base}_polished_white_2000x2000.jpg`);
                      }}
                    >
                      <Download size={15} /> Clean White JPG
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => {
                        const base = selectedJob.original_filename.replace(/\.[^/.]+$/, '');
                        downloadImage(selectedJob.trimmed_sticker_url || selectedJob.transparent_url, `${base}_element.png`);
                      }}
                    >
                      <Download size={15} /> Trimmed Element PNG
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => addElementToBanner(selectedJob)}
                    >
                      <Plus size={15} /> Add to Banner
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
                    Drop photos on the left to clean, polish, and auto-log them into your PNG Vault!
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ==================== TAB 2: PNG ELEMENT PACK VAULT ==================== */}
      {activeTab === 'vault' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span>PNG Element Vault — "{packCategory}" ({completedJobs.length} Cutout Elements)</span>
              <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'normal', marginTop: '2px' }}>
                All cutout PNGs are automatically trimmed and logged here. Export them as a downloadable PNG Pack or click any element to add it to your Banner Builder!
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-accent" onClick={() => downloadAllAsZip(true)} disabled={completedJobs.length === 0}>
                <Package size={16} /> Export Trimmed PNG Pack (.ZIP)
              </button>
              <button className="btn-secondary" onClick={() => downloadAllAsZip(false)} disabled={completedJobs.length === 0}>
                <Archive size={16} /> Export Full Catalog + PNGs (.ZIP)
              </button>
            </div>
          </div>

          {completedJobs.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
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
                      height: '160px',
                      backgroundImage: `url("${previewBackdropUrl}")`,
                      backgroundSize: '180px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px',
                      overflow: 'hidden'
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <img
                      src={job.trimmed_sticker_url || job.transparent_url}
                      alt={job.original_filename}
                      draggable={false}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                    />
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {job.original_filename}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn-accent"
                      style={{ flex: 1, padding: '6px 8px', fontSize: '11px' }}
                      onClick={() => addElementToBanner(job)}
                    >
                      <Plus size={13} /> Use in Banner
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 8px', fontSize: '11px' }}
                      onClick={() => {
                        const base = job.original_filename.replace(/\.[^/.]+$/, '');
                        downloadImage(job.trimmed_sticker_url || job.transparent_url, `${base}_element.png`);
                      }}
                    >
                      <Download size={13} /> PNG
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              Your PNG Element Vault is empty. Drop photos in <strong>Tab 1 (Photo Cleaner)</strong> to automatically extract and log transparent PNG elements here!
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: SOCIAL / WEB BANNER & VISUAL SENTENCE BUILDER ==================== */}
      {activeTab === 'banner' && (
        <div className="grid-layout">
          {/* LEFT CONTROLS: Format Preset, Background, Add Elements & Layer Controls */}
          <div className="card">
            <div className="card-header">
              <span>Banner &amp; Printable Scene Controls</span>
              <button className="btn-accent" onClick={exportHighResBanner}>
                <Download size={16} /> Export High-Res Banner PNG
              </button>
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

            {/* Selected Layer Scale & Delete Controls */}
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

            {/* Quick-Add Vault PNGs Strip */}
            <div className="form-group">
              <label>4. Click Any Logged PNG Element Below to Drop Onto Banner ({completedJobs.length} Available)</label>
              {completedJobs.length > 0 ? (
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '8px 0' }}>
                  {completedJobs.map((job) => (
                    <div
                      key={job.job_id}
                      onClick={() => addElementToBanner(job)}
                      title={`Click to add ${job.original_filename}`}
                      style={{
                        minWidth: '76px',
                        height: '76px',
                        background: 'rgba(255,255,255,0.9)',
                        borderRadius: '8px',
                        padding: '6px',
                        cursor: 'pointer',
                        border: '2px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <img
                        src={job.trimmed_sticker_url || job.transparent_url}
                        alt={job.original_filename}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#94a3b8', padding: '8px 0' }}>
                  Clean some photos in Tab 1 first, and they will appear here ready to drag onto your banner!
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Interactive Drag-and-Drop Banner Stage */}
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
                  background:
                    selectedBg.id === 'transparent'
                      ? `url("${previewBackdropUrl}")`
                      : selectedBg.css,
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
                            fontSize: `${Math.round(24 * layer.scale)}px`,
                            fontWeight: 800,
                            color: layer.color || '#ffffff',
                            textShadow: '0 4px 12px rgba(0,0,0,0.5)',
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#94a3b8' }}>
              <span>Tip: Click any PNG or text on the canvas to drag it or resize it with the slider on the left.</span>
              <button className="btn-accent" onClick={exportHighResBanner}>
                <Download size={15} /> Download {selectedPreset.width}×{selectedPreset.height} Banner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
