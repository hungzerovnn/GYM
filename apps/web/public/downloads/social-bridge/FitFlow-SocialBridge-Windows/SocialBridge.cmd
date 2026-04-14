@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js chua co trong PATH. Hay cai Node.js truoc khi chay Social Bridge.
  pause
  exit /b 1
)
node "%SCRIPT_DIR%src\cli.mjs" %*
