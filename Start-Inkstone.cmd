@echo off
chcp 65001 >nul
cd /d "%~dp0"

where pnpm.cmd >nul 2>nul
if errorlevel 1 (
  echo pnpm was not found. Install Node.js and pnpm, then run pnpm setup first.
  pause
  exit /b 1
)

call pnpm.cmd start
set "INKSTONE_EXIT=%ERRORLEVEL%"
echo.
echo Inkstone has stopped. Press any key to close this window.
pause >nul
exit /b %INKSTONE_EXIT%
