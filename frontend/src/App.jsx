import React, { useState, useRef } from 'react';
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
  Sliders,
  Sun
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
 * Multi-Stage Studio Polish, Brightening & Color Pop Pipeline:
 * 1. Auto-Levels & Shadow Lift (brightens dark outdoor/indoor shadows without blowing out highlights)
 * 2. Studio Brightness & Contrast S-Curve (makes vinyl/surfaces look glossy and polished)
 * 3. Vibrance & Color Pop (boosts muted colors so slides/products pop off the page)
 * 4. Unsharp Mask Crispness Pass (sharpens edges, stitching, and textures)
 * 5. AI Background Cutout + Smart Scene Protection
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

  // Step 1: Load AI Alpha Mask if doing background cutout
  let maskData = null;
  let keepFullScene = cleaningMode === 'polish_only' || !cutoutImg;

  if (!keepFullScene && cutoutImg) {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const maskCtx = maskCanvas.getContext('2d');
    maskCtx.drawImage(cutoutImg, 0, 0, w, h);
    maskData = maskCtx.getImageData(0, 0, w, h).data;

    // Check if AI mask accidentally erased >88% of a full room/scene
    let opaqueCount = 0;
    for (let i = 0; i < maskData.length; i += 4) {
      if (maskData[i + 3] > 60) opaqueCount++;
    }
    if (opaqueCount / (w * h) < 0.12) {
      keepFullScene = true;
    }
  }

  // Step 2: Configure Studio Polish Parameters
  const gamma = polishIntensity === 'high' ? 0.80 : polishIntensity === 'medium' ? 0.88 : 1.0;
  const contrastGain = polishIntensity === 'high' ? 1.16 : polishIntensity === 'medium' ? 1.09 : 1.0;
  const vibranceBoost = polishIntensity === 'high' ? 0.34 : polishIntensity === 'medium' ? 0.20 : 0.0;
  const specularLift = polishIntensity === 'high' ? 12 : polishIntensity === 'medium' ? 6 : 0;

  // Precompute 256-entry Gamma + S-Curve Lookup Table for fast pixel polishing
  const toneLut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    // Normalize 0..1
    let norm = v / 255.0;
    // Shadow-lifting gamma curve
    norm = Math.pow(norm, gamma);
    // Midtone contrast S-curve around 0.5
    norm = (norm - 0.5) * contrastGain + 0.5;
    // Slight highlight polish lift
    let out = norm * 255.0 + specularLift * Math.pow(norm, 2);
    toneLut[v] = Math.max(0, Math.min(255, Math.round(out)));
  }

  // Apply Studio Polish + Vibrance + Alpha Cutout per pixel
  for (let i = 0; i < data.length; i += 4) {
    // Handle alpha mask
    if (!keepFullScene && maskData) {
      let a = maskData[i + 3];
      if (a > 8) {
        // Recover soft subject edges
        a = Math.min(255, Math.round(a * 1.75));
      } else {
        data[i + 3] = 0;
        continue;
      }
      data[i + 3] = a;
    } else {
      data[i + 3] = 255;
    }

    // Apply Tone Curve (Brightening + Shadow Lift + Vinyl Gloss Contrast)
    let r = toneLut[data[i]];
    let g = toneLut[data[i + 1]];
    let b = toneLut[data[i + 2]];

    // Apply Smart Vibrance (boosts dull/muted colors more than already-saturated colors)
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

  // Step 3: Crispness / Unsharp Mask Overlay Pass
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

// Render 2000x2000 Catalog Framed outputs AND matched Before/After frames:
// - Exported downloads have ZERO watermarks (100% pure white JPG & pure transparent PNG).
// - Aligned Original 2000x2000 frame ensures Before/After slider lines up pixel-for-pixel!
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

  const canvasW = 2000;
  const canvasH = 2000;

  let bbox, newW, newH, posX, posY;

  if (framingMode === 'catalog' && cleaningMode !== 'polish_only') {
    bbox = getTransparentBoundingBox(subjectCtx, subjectCanvas.width, subjectCanvas.height);
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

  // Helper to draw soft studio contact shadow under product
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

  // 1. Aligned Original "Before" Canvas (so Before & After line up pixel-for-pixel in the slider!)
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

  // 2. Clean Transparent PNG (2000x2000) — NO WATERMARK
  const transCanvas = document.createElement('canvas');
  transCanvas.width = canvasW;
  transCanvas.height = canvasH;
  const transCtx = transCanvas.getContext('2d');
  drawContactShadow(transCtx);
  transCtx.drawImage(subjectCanvas, bbox.x, bbox.y, bbox.w, bbox.h, posX, posY, newW, newH);
  const transparentUrl = transCanvas.toDataURL('image/png');

  // 3. Clean Catalog White JPG (2000x2000) — 100% PURE WHITE, NO WATERMARK ON EXPORT
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

  return { alignedBeforeUrl, transparentUrl, catalogWhiteUrl };
}

export default function App() {
  // Cleaning Mode, Studio Polish & Framing Controls
  const [cleaningMode, setCleaningMode] = useState('cutout_and_polish'); // 'cutout_and_polish', 'polish_only', 'cutout_only'
  const [polishIntensity, setPolishIntensity] = useState('high'); // 'high', 'medium', 'off'
  const [framingMode, setFramingMode] = useState('catalog'); // 'catalog' (88% centered + floor shadow) or 'original'
  const [watermarkText, setWatermarkText] = useState('EDR PARTY RENTALS • PREVIEW ONLY');

  // Queue & History State
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [sliderPos, setSliderPos] = useState(50);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const sliderRef = useRef(null);
  const seenHashesRef = useRef(new Map());

  // Process uploaded files (1 to 100+ photos)
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
      original_url: URL.createObjectURL(file),
      aligned_before_url: null,
      status: 'queued',
      model_used:
        cleaningMode === 'polish_only'
          ? 'Studio Brighten, Color Pop & Crispness Polish'
          : 'IS-Net Cutout + Studio Brighten & Vinyl Polish',
      catalog_white_url: null,
      transparent_url: null,
      processing_time: null
    }));

    setJobs((prev) => [...newEntries, ...prev]);
    if (!selectedJob) setSelectedJob(newEntries[0]);

    for (let i = 0; i < newEntries.length; i++) {
      const entry = newEntries[i];
      const t0 = performance.now();
      setProgressMsg(`Polishing & cleaning ${i + 1} of ${newEntries.length}: ${entry.original_filename}...`);

      setJobs((prev) =>
        prev.map((j) => (j.job_id === entry.job_id ? { ...j, status: 'processing' } : j))
      );

      await new Promise((r) => setTimeout(r, 30));

      try {
        const buffer = await entry.file.arrayBuffer();
        const sha256 = `${cleaningMode}_${polishIntensity}_${framingMode}_${await hashArrayBuffer(buffer)}`;

        // SHA-256 Deduplication
        if (seenHashesRef.current.has(sha256)) {
          const canon = seenHashesRef.current.get(sha256);
          const skippedJob = {
            ...entry,
            status: 'skipped',
            model_used: `SHA-256 Duplicate of ${canon.original_filename} (0.01s)`,
            aligned_before_url: canon.aligned_before_url,
            catalog_white_url: canon.catalog_white_url,
            transparent_url: canon.transparent_url,
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
                    `Cleaning & Polishing ${i + 1}/${newEntries.length} (${entry.original_filename}) — AI ${pct}%`
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

        // Build 2000x2000 Polished & Cleaned Exports (NO watermark on exports) + Aligned Before/After Preview
        const { alignedBeforeUrl, transparentUrl, catalogWhiteUrl } = await buildCatalogOutputs(
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

  // Download single clean image (Zero Watermarks)
  const downloadImage = (dataUrl, filename) => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download all completed photos as a clean ZIP archive
  const downloadAllAsZip = async () => {
    const completed = jobs.filter((j) => j.status === 'completed' || j.status === 'skipped');
    if (completed.length === 0) return;

    const zip = new JSZip();
    completed.forEach((job) => {
      const base = job.original_filename.replace(/\.[^/.]+$/, '');
      if (job.catalog_white_url) {
        const base64White = job.catalog_white_url.split(',')[1];
        zip.file(`${base}_polished_white_2000x2000.jpg`, base64White, { base64: true });
      }
      if (job.transparent_url) {
        const base64Trans = job.transparent_url.split(',')[1];
        zip.file(`${base}_polished_transparent_2000x2000.png`, base64Trans, { base64: true });
      }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    downloadImage(url, `CleanSnap_Polished_Catalog_${completed.length}_Photos.zip`);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // Butter-smooth Pointer Events for Before/After slider
  const updateSliderFromPointer = (clientX) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  };

  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const skippedCount = jobs.filter((j) => j.status === 'skipped').length;
  const previewBackdropUrl = createPreviewBackdropPattern(watermarkText);

  return (
    <div className="app-container">
      <header>
        <div className="logo-area">
          <h1>CleanSnap AI</h1>
          <p>Automated Product Photo Cutout, Studio Brightening, Vinyl Polish &amp; 2000×2000 Framing</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="status-badge active">
            <span className="dot"></span>
            {isProcessingBatch ? 'AI Polishing Batch...' : 'Studio Polish + Cutout Ready'}
          </div>
        </div>
      </header>

      <div className="grid-layout">
        {/* LEFT COLUMN: Upload Dropzone & Studio Polish Controls */}
        <div className="card">
          <div className="card-header">
            <span>1. Drop Product Photos or Select Folder</span>
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

          {/* Drag & Drop Zone */}
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
                ? progressMsg || 'Polishing & cleaning photos...'
                : 'Drag & Drop 1 to 100+ Product Photos Here (or Click to Browse)'}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
              Cuts out background, lifts dark shadows, brightens &amp; polishes colors, sharpens details, and frames to 2000×2000 px.
            </div>
          </div>

          {/* Studio Polish & Cutout Pipeline Settings */}
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
              <Sun size={16} /> Studio Polish, Brightening &amp; Cutout Pipeline
            </div>

            <div className="form-group">
              <label>1. Processing Pipeline Mode</label>
              <select
                value={cleaningMode}
                onChange={(e) => setCleaningMode(e.target.value)}
              >
                <option value="cutout_and_polish">
                  Full Slide / Product Cleanup (Remove Background + Brighten, Polish &amp; Color Pop)
                </option>
                <option value="polish_only">
                  Studio Polish &amp; Brighten Only (Keep Full Scene/Background + Boost Lighting &amp; Crispness)
                </option>
                <option value="cutout_only">
                  Background Cutout Only (Keep Original Raw Lighting)
                </option>
              </select>
            </div>

            <div className="form-group">
              <label>2. Brightening, Vinyl Gloss &amp; Color Pop Intensity</label>
              <select
                value={polishIntensity}
                onChange={(e) => setPolishIntensity(e.target.value)}
              >
                <option value="high">
                  High Studio Polish (Lift Outdoor Shadows + Vibrant Colors + Unsharp Crispness)
                </option>
                <option value="medium">
                  Balanced Natural Polish (Gentle Brightening + Subtle Vibrance)
                </option>
                <option value="off">Off (No Color/Brightness Adjustment)</option>
              </select>
            </div>

            <div className="form-group">
              <label>3. 2000×2000 Catalog Framing</label>
              <select
                value={framingMode}
                onChange={(e) => setFramingMode(e.target.value)}
              >
                <option value="catalog">
                  Standardized 2000×2000 Catalog Square (Auto-Center 88% Occupancy + Floor Shadow)
                </option>
                <option value="original">
                  Lock Original Full-Frame Proportions
                </option>
              </select>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={13} style={{ color: '#10b981' }} />
                On-Page Anti-Theft Backdrop Text (Shown ONLY on webpage preview — NEVER in downloads)
              </label>
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="EDR PARTY RENTALS • PREVIEW ONLY"
              />
            </div>
          </div>

          {/* Batch Summary & Download All Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(15,23,42,0.5)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#94a3b8' }}>
              <span>Total: <strong style={{ color: '#fff' }}>{jobs.length}</strong></span>
              <span>Polished: <strong style={{ color: '#10b981' }}>{completedCount}</strong></span>
              <span>Skipped: <strong style={{ color: '#3b82f6' }}>{skippedCount}</strong></span>
            </div>
            {completedCount > 0 && (
              <button className="btn-accent" onClick={downloadAllAsZip} style={{ padding: '8px 14px', fontSize: '13px' }}>
                <Archive size={15} /> Download All Clean ({completedCount + skippedCount}) ZIP
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Smooth Aligned Before / After Slider & Clean Download Buttons */}
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
                {/* AFTER Layer: Polished & Cleaned Transparent PNG placed over the On-Page Watermarked Backdrop */}
                <img
                  src={selectedJob.transparent_url}
                  alt="Polished & Cleaned Subject"
                  className="slider-img"
                  draggable={false}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                />

                {/* BEFORE Layer: Aligned Original Image clipped with hardware-accelerated clipPath */}
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

                {/* Labels */}
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
                  BEFORE (Raw Dull Photo)
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
                  AFTER (Polished, Brightened &amp; Cutout)
                </span>

                {/* Smooth Slider Divider Handle */}
                <div
                  className="slider-handle"
                  style={{ left: `${sliderPos}%`, zIndex: 10, pointerEvents: 'none' }}
                >
                  <div className="slider-handle-circle">↔</div>
                </div>
              </div>

              {/* Smooth Range Scrubber for Precision Control */}
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

              {/* Official Clean Download Buttons (Zero Watermark!) */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                <button
                  className="btn-accent"
                  style={{ flex: 1 }}
                  onClick={() => {
                    const base = selectedJob.original_filename.replace(/\.[^/.]+$/, '');
                    downloadImage(selectedJob.catalog_white_url, `${base}_polished_white_2000x2000.jpg`);
                  }}
                >
                  <Download size={16} /> Download Polished White JPG (No Watermark)
                </button>
                <button
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    const base = selectedJob.original_filename.replace(/\.[^/.]+$/, '');
                    downloadImage(selectedJob.transparent_url, `${base}_polished_transparent_2000x2000.png`);
                  }}
                >
                  <Download size={16} /> Download Polished Transparent PNG
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
                {selectedJob?.status === 'processing'
                  ? `AI is cutting out, brightening & polishing ${selectedJob.original_filename}...`
                  : 'Drop a slide or product photo on the left to clean, brighten & polish it!'}
              </div>
              <div style={{ fontSize: '12px', maxWidth: '400px' }}>
                Automatically removes outdoor backgrounds, lifts dark shadows, boosts vinyl gloss &amp; color vibrance, sharpens details, and centers onto a 2000×2000 catalog canvas.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM SECTION: Processed Job Queue & Download List */}
      <div className="card">
        <div className="card-header">
          <span>3. Polished &amp; Cleaned Photo Batch Queue ({jobs.length} Files)</span>
          {completedCount > 0 && (
            <button className="btn-secondary" onClick={downloadAllAsZip}>
              <Archive size={14} /> Download All Clean ZIP
            </button>
          )}
        </div>

        <div className="history-list">
          {jobs.map((item) => (
            <div
              key={item.job_id}
              className="history-item"
              style={{
                cursor: 'pointer',
                border: selectedJob?.job_id === item.job_id ? '1px solid #3b82f6' : ''
              }}
              onClick={() => setSelectedJob(item)}
            >
              <div className="history-item-info">
                <span className="history-item-title">
                  {item.original_filename}{' '}
                  {item.processing_time && (
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'normal' }}>
                      ({item.processing_time}s)
                    </span>
                  )}
                </span>
                <span className="history-item-sub">{item.model_used}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {item.status === 'completed' && (
                  <>
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '12px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const base = item.original_filename.replace(/\.[^/.]+$/, '');
                        downloadImage(item.catalog_white_url, `${base}_polished_white_2000x2000.jpg`);
                      }}
                    >
                      <Download size={13} /> Clean JPG
                    </button>
                    <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                      <CheckCircle2 size={14} /> Completed
                    </span>
                  </>
                )}
                {item.status === 'processing' && (
                  <span style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <RefreshCw size={14} /> Polishing...
                  </span>
                )}
                {item.status === 'queued' && (
                  <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <Clock size={14} /> Queued
                  </span>
                )}
                {item.status === 'skipped' && (
                  <span style={{ color: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <Clock size={14} /> Skipped Duplicate
                  </span>
                )}
                {item.status === 'failed' && (
                  <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <AlertCircle size={14} /> Failed ({item.error_reason})
                  </span>
                )}
              </div>
            </div>
          ))}
          {jobs.length === 0 && (
            <p style={{ color: '#94a3b8', fontSize: '13px', padding: '12px' }}>
              No photos queued yet. Click <strong>Select Photos</strong>, <strong>Select Whole Folder</strong>, or drag and drop your photos into the box above!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
