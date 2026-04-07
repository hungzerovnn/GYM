@echo off
setlocal EnableExtensions
cd /d "%~dp0..\web"
echo [1/1] Deploy Pages proxy len Cloudflare Pages.
call npm run deploy
if errorlevel 1 (
  echo [LOI] Deploy Pages proxy bi loi
  exit /b 1
)
