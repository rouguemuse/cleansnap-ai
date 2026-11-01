import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Upload,
  Download,
  Shield,
  Sparkles,
  Image as ImageIcon,
  Archive
} from 'lucide-react';
import { removeBackground } from '@imgly/background-removal';
import JSZip from 'jszip';
import './App.css';

// Generate repeating diagonal SVG watermark data URL for backdrop & anti-theft overlay
function createWatermarkPatternUrl(text = 'EDR PARTY RENTALS • DO NOT COPY', opacity = 0.09, color = '#0f172a') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220">
    <g transform="rotate(-28 160 110)">
      <text x="10" y="90" fill="${color}" fill-opacity="${opacity}" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="16" letter-spacing="1.5">${text}</text>
      <text x="40" y="185" fill="${color}" fill-opacity="${opacity}" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="16" letter-spacing="1.5">${text}</text>
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

// Crop transparent bounds of an RGBA canvas
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

// Render 2000x2000 Catalog Framed outputs:
// 1. Clean Transparent PNG (with optional subtle background watermark)
// 2. Clean 2000x2000 Catalog White JPG (with optional subtle background watermark BEHIND the product)
async function buildCatalogOutputs(cutoutBlob, watermarkText, includeBgWatermarkInDownload) {
  const imgUrl = URL.createObjectURL(cutoutBlob);
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = imgUrl;
  });

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = img.width;
  tempCanvas.height = img.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(img, 0, 0);

  const bbox = getTransparentBoundingBox(tempCtx, img.width, img.height);
  const cw = bbox.w;
  const ch = bbox.h;

  const canvasW = 2000;
  const canvasH = 2000;
  const maxOccupancy = 0.88;
  const minMargin = 0.06;
  const groundLineRatio = 0.88;

  const maxAllowedW = Math.floor(canvasW * maxOccupancy);
  const maxAllowedH = Math.floor(canvasH * (groundLineRatio - minMargin));
  const scale = Math.min(maxAllowedW / cw, maxAllowedH / ch);

  const newW = Math.max(1, Math.floor(cw * scale));
  const newH = Math.max(1, Math.floor(ch * scale));
  const posX = Math.floor((canvasW - newW) / 2);
  const groundY = Math.floor(canvasH * groundLineRatio);
  const posY = Math.max(Math.floor(canvasH * minMargin), groundY - newH);

  // Helper to draw repeating diagonal watermark BEHIND the product
  const drawBackgroundWatermark = (ctx, text, opacity = 0.065) => {
    if (!text) return;
    ctx.save();
    ctx.font = '800 38px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = `rgba(15, 23, 42, ${opacity})`;
    ctx.textAlign = 'center';
    ctx.rotate((-26 * Math.PI) / 180);
    for (let y = -1200; y < 3200; y += 260) {
      for (let x = -1600; x < 3200; x += 680) {
        ctx.fillText(text.toUpperCase(), x, y);
      }
    }
    ctx.restore();
  };

  // Helper to draw grounded contact shadow
  const drawContactShadow = (ctx) => {
    ctx.save();
    const shadowX = canvasW / 2;
    const shadowY = posY + newH - Math.floor(newH * 0.015);
    const radiusX = Math.floor(newW * 0.45);
    const radiusY = Math.max(12, Math.floor(newH * 0.025));

    const grad = ctx.createRadialGradient(shadowX, shadowY, 5, shadowX, shadowY, radiusX);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.28)');
    grad.addColorStop(0.65, 'rgba(15, 23, 42, 0.10)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');

    ctx.translate(shadowX, shadowY);
    ctx.scale(1, radiusY / radiusX);
    ctx.beginPath();
    ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  };

  // 1. Transparent PNG Canvas (2000x2000)
  const transCanvas = document.createElement('canvas');
  transCanvas.width = canvasW;
  transCanvas.height = canvasH;
  const transCtx = transCanvas.getContext('2d');
  drawContactShadow(transCtx);
  transCtx.drawImage(tempCanvas, bbox.x, bbox.y, cw, ch, posX, posY, newW, newH);
  const transparentUrl = transCanvas.toDataURL('image/png');

  // 2. Catalog White JPG Canvas (2000x2000) with optional watermark BEHIND the product
  const whiteCanvas = document.createElement('canvas');
  whiteCanvas.width = canvasW;
  whiteCanvas.height = canvasH;
  const whiteCtx = whiteCanvas.getContext('2d');
  whiteCtx.fillStyle = '#ffffff';
  whiteCtx.fillRect(0, 0, canvasW, canvasH);

  if (includeBgWatermarkInDownload && watermarkText) {
    drawBackgroundWatermark(whiteCtx, watermarkText, 0.075);
  }
  drawContactShadow(whiteCtx);
  whiteCtx.drawImage(tempCanvas, bbox.x, bbox.y, cw, ch, posX, posY, newW, newH);
  const catalogWhiteUrl = whiteCanvas.toDataURL('image/jpeg', 0.95);

  URL.revokeObjectURL(imgUrl);
  return { transparentUrl, catalogWhiteUrl };
}

export default function App() {
  const [status, setStatus] = useState(null);
  const [isLocalBackend, setIsLocalBackend] = useState(false);
  const [config, setConfig] = useState({
    watch_dir: 'C:\\Users\\rougu\\Downloads\\CleanSnap_Input',
    output_dir: 'C:\\Users\\rougu\\Downloads\\CleanSnap_Output',
    model_name: 'isnet-general-use'
  });

  // Watermark & Anti-Theft Controls
  const [watermarkText, setWatermarkText] = useState('EDR PARTY RENTALS');
  const [protectPagePreview, setProtectPagePreview] = useState(true);
  const [embedBgWatermarkInDownload, setEmbedBgWatermarkInDownload] = useState(true);

  // Queue & History State
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [sliderPos, setSliderPos] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const sliderRef = useRef(null);
  const seenHashesRef = useRef(new Map());

  // Check if local Python backend is running
  const checkBackend = async () => {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error('No local backend');
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error('Not JSON');
      const data = await res.json();
      setStatus(data);
      setIsLocalBackend(true);
      if (data.config) setConfig(data.config);
    } catch {
      setIsLocalBackend(false);
    }
  };

  useEffect(() => {
    checkBackend();
  }, []);

  // Process uploaded files (1 to 100+ photos) directly in the browser with real AI segmentation
  const handleFilesSelected = async (fileList) => {
    const files = Array.from(fileList).filter((f) =>
      /\.(png|jpe?g|webp|bmp|heic|heif)$/i.test(f.name)
    );
    if (files.length === 0) {
      alert('Please select or drop image files (.png, .jpg, .jpeg, .webp).');
      return;
    }

    setIsProcessingBatch(true);

    // First create queued entries
    const newEntries = files.map((file, idx) => ({
      job_id: `job_${Date.now()}_${idx}`,
      file,
      original_filename: file.name,
      original_url: URL.createObjectURL(file),
      status: 'queued',
      model_used: 'IS-Net Browser AI (ONNX)',
      catalog_white_url: null,
      transparent_url: null,
      processing_time: null
    }));

    setJobs((prev) => [...newEntries, ...prev]);
    if (!selectedJob) setSelectedJob(newEntries[0]);

    for (let i = 0; i < newEntries.length; i++) {
      const entry = newEntries[i];
      const t0 = performance.now();
      setProgressMsg(`Cleaning photo ${i + 1} of ${newEntries.length}: ${entry.original_filename}...`);

      setJobs((prev) =>
        prev.map((j) => (j.job_id === entry.job_id ? { ...j, status: 'processing' } : j))
      );

      try {
        const buffer = await entry.file.arrayBuffer();
        const sha256 = await hashArrayBuffer(buffer);

        // Check SHA-256 Deduplication
        if (seenHashesRef.current.has(sha256)) {
          const canon = seenHashesRef.current.get(sha256);
          const skippedJob = {
            ...entry,
            status: 'skipped',
            model_used: `SHA-256 Duplicate of ${canon.original_filename} (0.01s)`,
            catalog_white_url: canon.catalog_white_url,
            transparent_url: canon.transparent_url,
            processing_time: 0.01
          };
          setJobs((prev) => prev.map((j) => (j.job_id === entry.job_id ? skippedJob : j)));
          setSelectedJob(skippedJob);
          continue;
        }

        // Run real AI background removal
        const cutoutBlob = await removeBackground(entry.file, {
          progress: (key, current, total) => {
            if (total > 0) {
              const pct = Math.round((current / total) * 100);
              setProgressMsg(
                `Cleaning ${i + 1}/${newEntries.length} (${entry.original_filename}) — AI Model ${pct}%`
              );
            }
          }
        });

        // Build 2000x2000 Catalog Framed & Background-Watermarked outputs
        const { transparentUrl, catalogWhiteUrl } = await buildCatalogOutputs(
          cutoutBlob,
          watermarkText,
          embedBgWatermarkInDownload
        );

        const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
        const completedJob = {
          ...entry,
          status: 'completed',
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
              ? { ...j, status: 'failed', error_reason: err.message || 'Segmentation error' }
              : j
          )
        );
      }
    }

    setProgressMsg('');
    setIsProcessingBatch(false);
  };

  // Download single cleaned image
  const downloadImage = (dataUrl, filename) => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download all completed photos as a ZIP archive
  const downloadAllAsZip = async () => {
    const completed = jobs.filter((j) => j.status === 'completed' || j.status === 'skipped');
    if (completed.length === 0) return;

    const zip = new JSZip();
    completed.forEach((job) => {
      const base = job.original_filename.replace(/\.[^/.]+$/, '');
      if (job.catalog_white_url) {
        const base64White = job.catalog_white_url.split(',')[1];
        zip.file(`${base}_catalog_white_2000x2000.jpg`, base64White, { base64: true });
      }
      if (job.transparent_url) {
        const base64Trans = job.transparent_url.split(',')[1];
        zip.file(`${base}_transparent_2000x2000.png`, base64Trans, { base64: true });
      }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    downloadImage(url, `CleanSnap_Catalog_Batch_${completed.length}_Photos.zip`);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // Slider drag handlers
  const handleMouseMove = (e) => {
    if (!isDraggingSlider || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  };

  useEffect(() => {
    const stopDrag = () => setIsDraggingSlider(false);
    if (isDraggingSlider) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopDrag);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', stopDrag);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', stopDrag);
    };
  }, [isDraggingSlider]);

  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const skippedCount = jobs.filter((j) => j.status === 'skipped').length;
  const bgWatermarkPattern = createWatermarkPatternUrl(`${watermarkText} • CATALOG`, 0.085, '#0f172a');
  const antiTheftOverlayPattern = createWatermarkPatternUrl(`${watermarkText} • PREVIEW ONLY`, 0.18, '#ef4444');

  return (
    <div className="app-container">
      <header>
        <div className="logo-area">
          <h1>CleanSnap AI</h1>
          <p>Automated Catalog Product Photo Cleaning, Watermarking & Framing Studio</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="status-badge active">
            <span className="dot"></span>
            {isProcessingBatch ? 'AI Processing Batch...' : 'AI Engine Ready (1–100+ Photos)'}
          </div>
        </div>
      </header>

      <div className="grid-layout">
        {/* LEFT COLUMN: Dropzone Upload, Folder Selection & Watermark Protection */}
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

          {/* Hidden Inputs for Files & Whole Folder */}
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

          {/* Interactive Drag & Drop Zone */}
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
              padding: '28px 20px',
              textAlign: 'center',
              background: 'rgba(15, 23, 42, 0.5)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Sparkles size={32} style={{ color: '#3b82f6', margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>
              {isProcessingBatch
                ? progressMsg || 'Cleaning photos with AI...'
                : 'Drag & Drop 1 to 100+ Product Photos Here (or Click to Browse)'}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
              Automatically removes grass/sky/background, frames to 2000×2000 px, and places your watermark behind the product.
            </div>
          </div>

          {/* Watermark & Anti-Theft Configuration */}
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
              <Shield size={16} /> Watermark & Anti-Theft Settings
            </div>

            <div className="form-group">
              <label>Brand Watermark Text (Placed Behind Product)</label>
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="e.g. EDR PARTY RENTALS"
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#e2e8f0' }}>
              <input
                type="checkbox"
                checked={protectPagePreview}
                onChange={(e) => setProtectPagePreview(e.target.checked)}
              />
              <span>
                <strong>Anti-Theft Page Shield:</strong> Block right-click saving &amp; show protective watermark over on-page preview
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#e2e8f0' }}>
              <input
                type="checkbox"
                checked={embedBgWatermarkInDownload}
                onChange={(e) => setEmbedBgWatermarkInDownload(e.target.checked)}
              />
              <span>
                <strong>Include Background Watermark in Downloaded JPG:</strong> Keeps subtle brand pattern behind the bounce house
              </span>
            </label>
          </div>

          {/* Batch Summary & Download All Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(15,23,42,0.5)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#94a3b8' }}>
              <span>Total: <strong style={{ color: '#fff' }}>{jobs.length}</strong></span>
              <span>Cleaned: <strong style={{ color: '#10b981' }}>{completedCount}</strong></span>
              <span>Duplicates Skipped: <strong style={{ color: '#3b82f6' }}>{skippedCount}</strong></span>
            </div>
            {completedCount > 0 && (
              <button className="btn-accent" onClick={downloadAllAsZip} style={{ padding: '8px 14px', fontSize: '13px' }}>
                <Archive size={15} /> Download All ({completedCount + skippedCount}) as ZIP
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Protected Before / After Split Preview & Official Download Buttons */}
        <div className="card">
          <div className="card-header">
            <span>2. Protected Preview &amp; Official Download</span>
            {selectedJob && (
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>{selectedJob.original_filename}</span>
            )}
          </div>

          {selectedJob && selectedJob.catalog_white_url ? (
            <>
              <div
                className="slider-container"
                ref={sliderRef}
                onMouseDown={() => setIsDraggingSlider(true)}
                onTouchStart={() => setIsDraggingSlider(true)}
                onContextMenu={(e) => {
                  if (protectPagePreview) e.preventDefault();
                }}
                style={{
                  backgroundImage: `url("${bgWatermarkPattern}")`,
                  backgroundColor: '#ffffff'
                }}
              >
                {/* AFTER: Cleaned Transparent Cutout over Watermarked White Backdrop */}
                <img
                  src={selectedJob.transparent_url || selectedJob.catalog_white_url}
                  alt="Cleaned Product"
                  className="slider-img"
                  draggable={false}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                />

                {/* BEFORE: Raw Original Photo Overlay */}
                <div
                  className="slider-overlay"
                  style={{ width: `${sliderPos}%`, background: '#0f172a' }}
                >
                  <img
                    src={selectedJob.original_url}
                    alt="Original Raw"
                    className="slider-img"
                    draggable={false}
                    style={{
                      width: sliderRef.current?.clientWidth || '600px',
                      pointerEvents: 'none',
                      userSelect: 'none'
                    }}
                  />
                </div>

                {/* Anti-Theft Protective Shield Overlay (prevents right-clicking or screenshotting clean image) */}
                {protectPagePreview && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundImage: `url("${antiTheftOverlayPattern}")`,
                      pointerEvents: 'none',
                      zIndex: 5
                    }}
                  />
                )}

                {/* Slider Handle */}
                <div className="slider-handle" style={{ left: `${sliderPos}%`, zIndex: 10 }}>
                  <div className="slider-handle-circle">↔</div>
                </div>
              </div>

              {/* Official Download Buttons */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                <button
                  className="btn-accent"
                  style={{ flex: 1 }}
                  onClick={() => {
                    const base = selectedJob.original_filename.replace(/\.[^/.]+$/, '');
                    downloadImage(selectedJob.catalog_white_url, `${base}_catalog_2000x2000.jpg`);
                  }}
                >
                  <Download size={16} /> Download 2000×2000 Catalog JPG
                </button>
                <button
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    const base = selectedJob.original_filename.replace(/\.[^/.]+$/, '');
                    downloadImage(selectedJob.transparent_url, `${base}_transparent_2000x2000.png`);
                  }}
                >
                  <Download size={16} /> Download Transparent PNG
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
                  ? `AI is cleaning ${selectedJob.original_filename}...`
                  : 'Drop a photo on the left to clean & preview it here!'}
              </div>
              <div style={{ fontSize: '12px', maxWidth: '360px' }}>
                Once cleaned, your bounce house is placed over your custom watermark backdrop with anti-theft page protection enabled, and ready for 1-click download.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM SECTION: Processed Job Queue & Download List */}
      <div className="card">
        <div className="card-header">
          <span>3. Cleaned Photo Batch Queue ({jobs.length} Files)</span>
          {completedCount > 0 && (
            <button className="btn-secondary" onClick={downloadAllAsZip}>
              <Archive size={14} /> Download All ZIP
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
                        downloadImage(item.catalog_white_url, `${base}_catalog_2000x2000.jpg`);
                      }}
                    >
                      <Download size={13} /> Download JPG
                    </button>
                    <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                      <CheckCircle2 size={14} /> Completed
                    </span>
                  </>
                )}
                {item.status === 'processing' && (
                  <span style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <RefreshCw size={14} /> Cleaning...
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
              No photos queued yet. Click <strong>Select Photos</strong>, <strong>Select Whole Folder</strong>, or drag and drop your bounce house photos into the box above!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
