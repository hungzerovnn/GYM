@echo off
setlocal EnableExtensions
cd /d "%~dp0..\web"
echo [1/1] Deploy frontend Next.js len Cloudflare Workers.
call npm run deploy:worker
if errorlevel 1 (
  echo [LOI] Deploy frontend worker bi loi
  exit /b 1
)
