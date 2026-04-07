@echo off
setlocal EnableExtensions
echo [1/3] Chay npm install o root...
cd /d "%~dp0..\.."
npm install
if errorlevel 1 (
  echo [LỖI] npm install bi loi
  exit /b 1
)

echo [2/3] Chay npm install cho apps/web...
cd /d "%~dp0..\..\apps\web"
npm install
if errorlevel 1 (
  echo [LỖI] install apps/web bi loi
  exit /b 1
)

echo [3/3] Chay npm install cho apps/api...
cd /d "%~dp0..\..\apps\api"
npm install
if errorlevel 1 (
  echo [LỖI] install apps/api bi loi
  exit /b 1
)

echo [4/4] Chay npm install cho publish components...
cd /d "%~dp0..\api-worker"
npm install
if errorlevel 1 (
  echo [LỖI] install api-worker bi loi
  exit /b 1
)
cd /d "%~dp0..\web"
npm install
if errorlevel 1 (
  echo [LỖI] install publish/web bi loi
  exit /b 1
)

echo [OK] Install xong.
