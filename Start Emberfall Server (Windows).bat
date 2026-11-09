@echo off
title Emberfall Server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Opening https://nodejs.org - install the LTS version, then run this file again.
  start "" https://nodejs.org
  pause
  exit /b
)
echo Starting Emberfall... keep this window open while people play.
start "" http://localhost:8080
node server.js
pause
