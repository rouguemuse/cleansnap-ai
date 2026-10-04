@echo off
title CleanSnap AI - Automated Product Photo Cleaner
echo ========================================================
echo   Starting CleanSnap AI (Single-Process Production Engine)
echo ========================================================
echo.

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found. Please run setup first.
    pause
    exit /b 1
)

echo Checking port 8000 availability...
powershell -NoProfile -Command "$conn = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue; if ($conn) { $pids = $conn | Select-Object -ExpandProperty OwningProcess -Unique; foreach($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } }"

echo Opening CleanSnap AI in your default web browser...
start "" http://127.0.0.1:8000

echo Starting backend server on http://127.0.0.1:8000 ...
".venv\Scripts\python.exe" backend\app.py

pause
