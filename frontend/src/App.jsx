import React, { useState, useEffect, useRef } from 'react';
import { Folder, Play, Square, RefreshCw, CheckCircle2, AlertCircle, Clock, Cloud } from 'lucide-react';
import './App.css';

const DEMO_HISTORY = [
  {
    job_id: 'job_9f8a12b4c3d1',
    original_filename: 'princess12.12.png',
    model_used: 'isnet-general-use',
    source_path: 'C:\\Users\\rougu\\Downloads\\CleanSnap_Input\\princess12.12.png',
    catalog_white_path: 'demo_princess',
    status: 'completed',
    color: '#ec4899'
  },
  {
    job_id: 'job_4e2c89d1a0b7',
    original_filename: 'greenslide28.14.png',
    model_used: 'isnet-general-use',
    source_path: 'C:\\Users\\rougu\\Downloads\\CleanSnap_Input\\greenslide28.14.png',
    catalog_white_path: 'demo_greenslide',
    status: 'completed',
    color: '#10b981'
  },
  {
    job_id: 'job_7b3f65c9e1a2',
    original_filename: 'sunshine20.16.20.png',
    model_used: 'isnet-general-use',
    source_path: 'C:\\Users\\rougu\\Downloads\\CleanSnap_Input\\sunshine20.16.20.png',
    catalog_white_path: 'demo_sunshine',
    status: 'completed',
    color: '#f59e0b'
  },
  {
    job_id: 'job_2d1a08f4b6c9',
    original_filename: 'renamed_princess_copy.png',
    model_used: 'SHA-256 Deduplicated (0.01s)',
    source_path: 'C:\\Users\\rougu\\Downloads\\CleanSnap_Input\\renamed_princess_copy.png',
    catalog_white_path: 'demo_princess',
    status: 'skipped',
    color: '#ec4899'
  }
];

function DemoInflatableSvg({ color = '#ec4899', isCleaned = true }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isCleaned
          ? '#ffffff'
          : 'linear-gradient(180deg, #38bdf8 0%, #0284c7 55%, #15803d 55%, #166534 100%)',
        position: 'relative'
      }}
    >
      <svg viewBox="0 0 240 240" style={{ width: '82%', height: '82%' }}>
        {!isCleaned && (
          <>
            <circle cx="30" cy="125" r="28" fill="#14532d" opacity="0.85" />
            <circle cx="210" cy="120" r="32" fill="#14532d" opacity="0.85" />
            <rect x="0" y="132" width="240" height="4" fill="#78350f" opacity="0.5" />
          </>
        )}
        {isCleaned && (
          <ellipse cx="120" cy="205" rx="82" ry="12" fill="rgba(15, 23, 42, 0.2)" />
        )}
        {/* Left & Right Pillars */}
        <path d="M50 200 L50 95 L72 60 L94 95 L94 200 Z" fill={color} />
        <path d="M146 200 L146 95 L168 60 L190 95 L190 200 Z" fill={color} />
        {/* Center Bounce Wall */}
        <rect x="84" y="105" width="72" height="95" rx="6" fill="#6366f1" />
        {/* Mesh Netting Window */}
        <rect x="94" y="116" width="52" height="32" rx="4" fill="#1e1b4b" />
        <line x1="94" y1="126" x2="146" y2="126" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        <line x1="94" y1="136" x2="146" y2="136" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        <line x1="110" y1="116" x2="110" y2="148" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        <line x1="130" y1="116" x2="130" y2="148" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        {/* Entrance Arch */}
        <path d="M100 200 C100 162, 140 162, 140 200 Z" fill="#0f172a" />
        {/* Top Emblem */}
        <circle cx="120" cy="58" r="16" fill="#f43f5e" />
      </svg>
      <span
        style={{
          position: 'absolute',
          bottom: '12px',
          right: isCleaned ? '14px' : 'auto',
          left: isCleaned ? 'auto' : '14px',
          background: 'rgba(15, 23, 42, 0.78)',
          color: '#f8fafc',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 600
        }}
      >
        {isCleaned ? 'AFTER: 2000×2000 Catalog White' : 'BEFORE: Raw Outdoor Photo'}
      </span>
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState(null);
  const [isCloudDemo, setIsCloudDemo] = useState(false);
  const [config, setConfig] = useState({
    watch_dir: 'C:\\Users\\rougu\\Downloads\\CleanSnap_Input',
    output_dir: 'C:\\Users\\rougu\\Downloads\\CleanSnap_Output',
    model_name: 'isnet-general-use',
    enhance_color: true,
    add_shadow: true
  });
  const [history, setHistory] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error('No local backend');
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) throw new Error('Not JSON');
      const data = await res.json();
      setStatus(data);
      setIsCloudDemo(false);
      if (data.config) {
        setConfig(data.config);
      }
    } catch {
      if (!isCloudDemo) {
        setIsCloudDemo(true);
        setStatus({
          watcher_running: true,
          stats: { total_processed: 4, completed: 3, skipped: 1, failed: 0 }
        });
      }
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      if (!res.ok) throw new Error('No local backend');
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) throw new Error('Not JSON');
      const data = await res.json();
      setHistory(data);
      if (data.length > 0 && !selectedItem) {
        setSelectedItem(data[0]);
      }
    } catch {
      setHistory((prev) => {
        if (prev.length === 0) {
          setSelectedItem(DEMO_HISTORY[0]);
          return DEMO_HISTORY;
        }
        return prev;
      });
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchHistory();
    const interval = setInterval(() => {
      if (!isCloudDemo) {
        fetchStatus();
        fetchHistory();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isCloudDemo]);

  const handleBrowseFolder = async (field) => {
    if (isCloudDemo) {
      alert('In Local Desktop Mode (start_app.bat), this button opens the native Windows Folder Picker Dialog.');
      return;
    }
    try {
      const initial = config[field] || '';
      const res = await fetch('/api/dialog/browse-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_dir: initial })
      });
      const data = await res.json();
      if (data.folder) {
        const newConfig = { ...config, [field]: data.folder };
        setConfig(newConfig);
        await saveConfig(newConfig);
      }
    } catch (err) {
      alert('Error selecting folder: ' + err.message);
    }
  };

  const saveConfig = async (cfgToSave) => {
    if (isCloudDemo) return;
    try {
      await fetch('/api/watcher/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfgToSave || config)
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  };

  const toggleWatcher = async () => {
    if (isCloudDemo) {
      setStatus((prev) => ({
        ...prev,
        watcher_running: !prev?.watcher_running
      }));
      return;
    }
    try {
      const enable = !status?.watcher_running;
      await fetch(`/api/watcher/toggle?enable=${enable}`, { method: 'POST' });
      fetchStatus();
    } catch (err) {
      alert('Error toggling watcher: ' + err.message);
    }
  };

  const sliderRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!isDraggingSlider || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    setSliderPos(percent);
  };

  const handleMouseUp = () => {
    setIsDraggingSlider(false);
  };

  useEffect(() => {
    if (isDraggingSlider) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDraggingSlider]);

  const isDemoItem = selectedItem?.catalog_white_path?.startsWith('demo_');

  return (
    <div className="app-container">
      <header>
        <div className="logo-area">
          <h1>CleanSnap AI</h1>
          <p>Automated Catalog Product Photo Cleaning & Framing Studio</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isCloudDemo && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 600,
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.3)'
              }}
            >
              <Cloud size={14} /> Interactive Cloud Demo
            </div>
          )}
          <div className={`status-badge ${status?.watcher_running ? 'active' : 'stopped'}`}>
            <span className="dot"></span>
            {status?.watcher_running ? 'Watcher ACTIVE (Set & Forget)' : 'Watcher PAUSED'}
          </div>
        </div>
      </header>

      <div className="grid-layout">
        {/* LEFT COLUMN: Folder Controls & Engine Settings */}
        <div className="card">
          <div className="card-header">
            <span>Folder Watcher & Segmentation Engine</span>
            <button
              className={status?.watcher_running ? 'btn-danger' : 'btn-accent'}
              onClick={toggleWatcher}
            >
              {status?.watcher_running ? <Square size={16} /> : <Play size={16} />}
              {status?.watcher_running ? 'Stop Watcher' : 'Start Watcher'}
            </button>
          </div>

          <div className="form-group">
            <label>Watched Folder (To Clean)</label>
            <div className="input-with-button">
              <input
                type="text"
                value={config.watch_dir}
                onChange={(e) => setConfig({ ...config, watch_dir: e.target.value })}
                onBlur={() => saveConfig()}
              />
              <button className="btn-secondary" onClick={() => handleBrowseFolder('watch_dir')}>
                <Folder size={16} /> Browse
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Output Folder (Cleaned Catalog Photos)</label>
            <div className="input-with-button">
              <input
                type="text"
                value={config.output_dir}
                onChange={(e) => setConfig({ ...config, output_dir: e.target.value })}
                onBlur={() => saveConfig()}
              />
              <button className="btn-secondary" onClick={() => handleBrowseFolder('output_dir')}>
                <Folder size={16} /> Browse
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Swappable Segmentation Engine</label>
            <select
              value={config.model_name}
              onChange={(e) => {
                const newCfg = { ...config, model_name: e.target.value };
                setConfig(newCfg);
                saveConfig(newCfg);
              }}
            >
              <option value="isnet-general-use">IS-Net (Primary - Best Mesh & Detail)</option>
              <option value="u2net">U²-Net (Fast Standard Fallback)</option>
              <option value="birefnet-general">BiRefNet General (High Res)</option>
            </select>
          </div>

          <div style={{ marginTop: '8px', padding: '14px', background: 'rgba(15,23,42,0.5)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#94a3b8' }}>
              <span>Total Jobs Recorded: <strong>{status?.stats?.total_processed || 0}</strong></span>
              <span>Completed: <strong style={{ color: '#10b981' }}>{status?.stats?.completed || 0}</strong></span>
              <span>Skipped: <strong style={{ color: '#3b82f6' }}>{status?.stats?.skipped || 0}</strong></span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Before / After Split Slider */}
        <div className="card">
          <div className="card-header">
            <span>Before / After Catalog Preview (Drag Slider)</span>
            {selectedItem && <span style={{ fontSize: '12px', color: '#94a3b8' }}>{selectedItem.original_filename}</span>}
          </div>

          {selectedItem && selectedItem.catalog_white_path ? (
            <div
              className="slider-container"
              ref={sliderRef}
              onMouseDown={() => setIsDraggingSlider(true)}
              onTouchStart={() => setIsDraggingSlider(true)}
            >
              {isDemoItem ? (
                <>
                  <div className="slider-img">
                    <DemoInflatableSvg color={selectedItem.color} isCleaned={true} />
                  </div>
                  <div className="slider-overlay" style={{ width: `${sliderPos}%` }}>
                    <div
                      className="slider-img"
                      style={{ width: sliderRef.current?.clientWidth || '600px' }}
                    >
                      <DemoInflatableSvg color={selectedItem.color} isCleaned={false} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* After: Catalog White Output */}
                  <img
                    src={`/api/image-preview?path=${encodeURIComponent(selectedItem.catalog_white_path)}`}
                    alt="Catalog White"
                    className="slider-img"
                  />

                  {/* Before: Original Source Image Overlay */}
                  <div className="slider-overlay" style={{ width: `${sliderPos}%` }}>
                    <img
                      src={`/api/image-preview?path=${encodeURIComponent(selectedItem.source_path)}`}
                      alt="Original"
                      className="slider-img"
                      style={{ width: sliderRef.current?.clientWidth || '100%' }}
                    />
                  </div>
                </>
              )}

              {/* Slider Handle */}
              <div className="slider-handle" style={{ left: `${sliderPos}%` }}>
                <div className="slider-handle-circle">↔</div>
              </div>
            </div>
          ) : (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              No photo selected for preview yet
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM SECTION: Processed Job History */}
      <div className="card">
        <div className="card-header">
          <span>Processed Catalog Inventory History (SQLite Jobs)</span>
          <button className="btn-secondary" onClick={fetchHistory}><RefreshCw size={14} /> Refresh</button>
        </div>

        <div className="history-list">
          {history.map((item) => (
            <div
              key={item.job_id}
              className="history-item"
              style={{ cursor: 'pointer', border: selectedItem?.job_id === item.job_id ? '1px solid #3b82f6' : '' }}
              onClick={() => setSelectedItem(item)}
            >
              <div className="history-item-info">
                <span className="history-item-title">{item.original_filename} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>({item.job_id})</span></span>
                <span className="history-item-sub">Model: {item.model_used || 'N/A'} • Path: {item.source_path}</span>
              </div>
              <div>
                {item.status === 'completed' && (
                  <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <CheckCircle2 size={14} /> Completed
                  </span>
                )}
                {item.status === 'skipped' && (
                  <span style={{ color: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <Clock size={14} /> Skipped Duplicate
                  </span>
                )}
                {item.status === 'failed' && (
                  <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <AlertCircle size={14} /> Failed
                  </span>
                )}
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <p style={{ color: '#94a3b8', fontSize: '13px', padding: '12px' }}>No jobs recorded yet. Start the watcher or drop photos into your watched folder!</p>
          )}
        </div>
      </div>
    </div>
  );
}
