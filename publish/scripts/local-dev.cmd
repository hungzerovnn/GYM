@echo off
setlocal EnableExtensions
cd /d "%~dp0..\.."
echo [1/3] Mo frontend dev o cua so rieng...
start "fitflow-web" cmd /k "cd /d %cd% && npm run dev:web"
echo [2/3] Mo api local o cua so rieng...
start "fitflow-api" cmd /k "cd /d %cd% && npm run dev:api"
echo [3/3] Chay worker local trong cua so hien tai...
cd /d "%~dp0..\api-worker"
call npm run dev
