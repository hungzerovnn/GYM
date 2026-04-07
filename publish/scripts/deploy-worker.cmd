@echo off
setlocal EnableExtensions
cd /d "%~dp0..\api-worker"
echo [1/1] Deploy Cloudflare Worker cho API adapter.
call npm run deploy
if errorlevel 1 (
  echo [LỖI] Deploy Worker bi loi
  exit /b 1
)
