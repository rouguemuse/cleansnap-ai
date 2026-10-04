import os
import sys
import subprocess
import logging
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from processors.product_cleaner import ProductCleanerProcessor
from hashing import ProcessRegistry
from batch import BatchEngine
from watcher import CleanSnapWatcher

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("app")

app = FastAPI(title="CleanSnap AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_WATCH_DIR = os.path.abspath(os.path.join(r"C:\Users\rougu\Downloads", "CleanSnap_Input"))
DEFAULT_OUTPUT_DIR = os.path.abspath(os.path.join(r"C:\Users\rougu\Downloads", "CleanSnap_Output"))
DB_PATH = os.path.join(BASE_DIR, "clean_snap.db")

registry = ProcessRegistry(db_path=DB_PATH)
batch_engine = BatchEngine(registry=registry, primary_model="isnet-general-use", fallback_model="u2net")

watcher_config = {
    "watch_dir": DEFAULT_WATCH_DIR,
    "output_dir": DEFAULT_OUTPUT_DIR,
    "model_name": "isnet-general-use",
    "enhance_color": True,
    "add_shadow": True
}

watcher = CleanSnapWatcher(
    watch_dir=watcher_config["watch_dir"],
    output_dir=watcher_config["output_dir"],
    batch_engine=batch_engine
)

class ConfigRequest(BaseModel):
    watch_dir: Optional[str] = None
    output_dir: Optional[str] = None
    model_name: Optional[str] = None
    enhance_color: Optional[bool] = None
    add_shadow: Optional[bool] = None

class BatchProcessRequest(BaseModel):
    file_paths: List[str]
    model_name: Optional[str] = None

@app.get("/api/status")
def get_status():
    records = registry.get_all_jobs()
    completed = [r for r in records if r["status"] == "completed"]
    skipped = [r for r in records if r["status"] == "skipped"]
    failed = [r for r in records if r["status"] == "failed"]
    return {
        "watcher_running": watcher.is_running,
        "config": watcher_config,
        "stats": {
            "total_processed": len(records),
            "completed": len(completed),
            "skipped": len(skipped),
            "failed": len(failed)
        }
    }

@app.post("/api/watcher/toggle")
def toggle_watcher(enable: bool):
    if enable:
        if not watcher.is_running:
            watcher.watch_dir = watcher_config["watch_dir"]
            watcher.output_dir = watcher_config["output_dir"]
            watcher.start()
    else:
        if watcher.is_running:
            watcher.stop()
    return {"watcher_running": watcher.is_running}

@app.post("/api/watcher/config")
def update_config(req: ConfigRequest):
    if req.watch_dir:
        watcher_config["watch_dir"] = os.path.abspath(req.watch_dir)
    if req.output_dir:
        watcher_config["output_dir"] = os.path.abspath(req.output_dir)
    if req.model_name:
        watcher_config["model_name"] = req.model_name
        batch_engine.primary_model = req.model_name
    if req.enhance_color is not None:
        watcher_config["enhance_color"] = req.enhance_color
    if req.add_shadow is not None:
        watcher_config["add_shadow"] = req.add_shadow

    if watcher.is_running:
        watcher.stop()
        watcher.watch_dir = watcher_config["watch_dir"]
        watcher.output_dir = watcher_config["output_dir"]
        watcher.start()

    return {"status": "success", "config": watcher_config}

@app.post("/api/dialog/browse-folder")
def browse_folder(initial_dir: Optional[str] = None):
    """
    Opens native Windows folder picker dialog via PowerShell System.Windows.Forms.FolderBrowserDialog.
    """
    try:
        init_path = initial_dir if (initial_dir and os.path.exists(initial_dir)) else r"C:\Users\rougu\Downloads"
        ps_script = (
            "[System.Reflection.Assembly]::LoadWithPartialName('System.windows.forms') | Out-Null; "
            f"$f = New-Object System.Windows.Forms.FolderBrowserDialog; "
            f"$f.SelectedPath = '{init_path}'; "
            "if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }"
        )
        res = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_script],
            capture_output=True,
            text=True,
            timeout=60
        )
        folder = res.stdout.strip()
        if folder and os.path.isdir(folder):
            return {"folder": os.path.abspath(folder)}
        else:
            return {"folder": None}
    except Exception as e:
        logger.error(f"Native folder dialog error: {e}")
        return {"folder": None}

@app.post("/api/clean-batch")
def clean_batch(req: BatchProcessRequest):
    output_dir = watcher_config["output_dir"]
    if req.model_name:
        batch_engine.primary_model = req.model_name

    summary = batch_engine.process_batch(
        file_paths=req.file_paths,
        output_dir=output_dir
    )
    return summary

@app.get("/api/history")
def get_history():
    return registry.get_all_jobs()

@app.get("/api/image-preview")
def get_image_preview(path: str = Query(...)):
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)

frontend_dist = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
