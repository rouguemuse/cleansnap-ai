@echo off
title CleanSnap AI - CLI Batch Cleaner
echo ========================================================
echo   CleanSnap AI - CLI Batch Product Photo Cleaner
echo ========================================================
echo.

cd /d "%~dp0"

if "%~1"=="" (
    echo Usage: drag and drop a folder or image file onto this script, or run:
    echo   run_cli.bat "C:\Path\To\Images"
    echo.
    pause
    exit /b 1
)

".venv\Scripts\python.exe" backend\processors\product_cleaner.py "%~1" --output "%~1\Cleaned_Output"

echo.
echo Processed outputs saved to "%~1\Cleaned_Output"
pause
