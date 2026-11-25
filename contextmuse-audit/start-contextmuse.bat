@echo off
title ContextMuse — Expressive Website Audit Studio
cd /d "%~dp0"
echo ====================================================================
echo  ContextMuse — Expressive Website Audit Studio (Local Windows MVP)
echo ====================================================================
echo  Starting local audit server on http://127.0.0.1:4173
echo  Starting offline demo fixture (Atelier Nocturne) on http://127.0.0.1:4174
echo ====================================================================
start "" "http://127.0.0.1:4173"
node src\server.js
pause
