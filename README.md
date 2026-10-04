# CleanSnap AI - Automated Product Photo Cleaner

An automated, background-monitored product photo cleaning desktop web app built for high-volume party rental inflatables, bounce houses, water slides, and e-commerce inventory catalogs.

## Features

- **Set & Forget Folder Watcher**: Automatically monitors a target folder (e.g. `C:\Users\rougu\Downloads\CleanSnap_Input`). When 1 or 100+ photos are added, it detects file copy stability, cleans them in the background, and outputs studio-ready catalog photos.
- **100% Local & Free AI Processing**: Powered by local AI segmentation models (`isnet-general-use` primary, `u2net` fallback) with zero cloud subscriptions or upload limits.
- **Catalog Framing Standard**: Enforces 2000×2000 canvas, max 88% product occupancy, min 6% margin, grounded line alignment, and realistic soft floor contact shadows.
- **Content-Hash Deduplication (SHA-256)**: Unique `job_id` tracking in SQLite database. Skips identical file contents in 0.01 seconds without executing redundant AI inference.
- **Native Windows Folder Selection**: Click `[Browse]` in the web UI to open the official Windows File Explorer directory selection dialog.
- **Interactive Before & After Studio**: Side-by-side split slider to compare raw outdoor photos with clean catalog white JPEGs and transparent PNGs.

## How to Run

1. **Launch App**: Double-click [`start_app.bat`](file:///c:/Users/rougu/Documents/antigravity/bold-oppenheimer/start_app.bat)
2. **Access Web UI**: The browser automatically opens to `http://localhost:8000`
3. **Set Folders & Toggle Watcher**: Click `[Browse]` to pick your Watched Input and Cleaned Output directories, then click **Start Watcher**.
