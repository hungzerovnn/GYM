@echo off
setlocal

if /I "%~1"=="--run" goto run

start "GYM License Tool" cmd /k call "%~f0" --run %*
exit /b

:run
shift /1
cd /d "%~dp0"
npm --prefix apps/api exec -- tsx tools/license-keygen/cli.ts %*
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if "%EXIT_CODE%"=="0" (
  echo Da tao key xong. Cua so dang duoc giu lai de ban copy ma.
  if exist "data\license\keygen-last-result.txt" (
    start "" notepad "data\license\keygen-last-result.txt"
  )
) else (
  echo Co loi xay ra. Cua so dang duoc giu lai de ban xem thong bao.
)
echo.
pause
exit /b %EXIT_CODE%
