import React, { useState, useEffect, useRef } from 'react';
import { Folder, Play, Square, RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import './App.css';

export default function App() {
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState({
    watch_dir: '',
    output_dir: '',
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
      const data = await res.json();
      setStatus(data);
      if (data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data);
      if (data.length > 0 && !selectedItem) {
        setSelectedItem(data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchHistory();
    const interval = setInterval(() => {
      fetchStatus();
      fetchHistory();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleBrowseFolder = async (field) => {
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
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
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
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSlider]);

  return (
    <div className="app-container">
      <header>
        <div className="logo-area">
          <h1>CleanSnap AI</h1>
          <p>Automated Catalog Product Photo Cleaning & Framing Studio</p>
        </div>
        <div className={`status-badge ${status?.watcher_running ? 'active' : 'stopped'}`}>
          <span className="dot"></span>
          {status?.watcher_running ? 'Watcher ACTIVE (Set & Forget)' : 'Watcher PAUSED'}
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
            <span>Before / After Catalog Preview</span>
            {selectedItem && <span style={{ fontSize: '12px', color: '#94a3b8' }}>{selectedItem.original_filename}</span>}
          </div>

          {selectedItem && selectedItem.catalog_white_path ? (
            <div
              className="slider-container"
              ref={sliderRef}
              onMouseDown={() => setIsDraggingSlider(true)}
            >
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
