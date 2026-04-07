@echo off
setlocal EnableExtensions
cd /d "%~dp0..\web"
echo [1/1] Build Pages proxy -> publish/web/dist
call npm run build
if errorlevel 1 (
  echo [LOI] Build Pages proxy bi loi
  exit /b 1
)
