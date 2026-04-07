@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local-dev.ps1"
if errorlevel 1 (
  echo.
  echo FitFlow startup failed.
  pause
  exit /b 1
)
exit /b 0
