@echo off
setlocal
cd /d "%~dp0"
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer with npm, then run this launcher again.
  pause
  exit /b 1
)
if not exist node_modules\vite\package.json (
  call npm.cmd ci
  if errorlevel 1 goto failed
)
call npm.cmd run dev -- --open
if errorlevel 1 goto failed
exit /b 0
:failed
echo Startup failed. See the message above.
pause
exit /b 1
