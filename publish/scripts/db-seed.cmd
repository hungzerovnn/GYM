@echo off
setlocal EnableExtensions
echo [1/1] Seed Neon data tu publish/data/import-to-neon.mjs
echo [INFO] Script se uu tien doc NEON_DATABASE_URL tu publish/api-worker/.dev.vars neu file ton tai.
cd /d "%~dp0..\.."
node publish/data/import-to-neon.mjs
if errorlevel 1 (
  echo [LỖI] seed bi loi
  exit /b 1
)
