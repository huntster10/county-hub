@echo off
title County Hub - local server
cd /d "%~dp0"

echo.
echo  ===================================================
echo   County Hub - starting on your computer
echo  ===================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [X] Node.js is not installed.
  echo      1. Open https://nodejs.org and click the green LTS button.
  echo      2. Run the installer, click Next through everything.
  echo      3. Double-click this file again.
  echo.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo  [OK] Node.js %%v found

if not exist ".env.local" (
  copy ".env.example" ".env.local" >nul
  echo.
  echo  [!] Created your settings file: .env.local
  echo      It just opened in Notepad. Fill in the Supabase values
  echo      (same ones you typed into Vercel), SAVE it, close Notepad,
  echo      then double-click this file again.
  echo.
  start notepad ".env.local"
  pause
  exit /b 0
)
echo  [OK] Settings file .env.local found

if not exist "node_modules\" (
  echo.
  echo  [..] First run: downloading the project's parts (1-3 minutes)...
  call npm install
  if errorlevel 1 (
    echo  [X] npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)
echo  [OK] Packages installed

echo.
echo  Starting... your browser will open at http://localhost:3000
echo  Keep this window open while you use the site.
echo  To stop the site, close this window.
echo.
start "" "http://localhost:3000"
call npm run dev
pause
