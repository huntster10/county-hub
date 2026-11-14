@echo off
title County Hub - local server
cd /d "%~dp0"

echo.
echo  ===================================================
echo   County Hub - starting on your computer
echo  ===================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto NONODE
for /f "tokens=*" %%v in ('node -v') do echo  [OK] Node.js %%v found

if not exist ".env.local" goto MAKEENV
echo  [OK] Settings file .env.local found

if not exist "node_modules\" goto INSTALL
goto RUN

:NONODE
echo  [X] Node.js is not installed.
echo      1. Open https://nodejs.org and click the green LTS button.
echo      2. Run the installer, click Next through everything.
echo      3. Double-click this file again.
echo.
pause
exit /b 1

:MAKEENV
copy ".env.example" ".env.local" >nul
echo.
echo  [!] Created your settings file: .env.local
echo      It just opened in Notepad. Paste your Supabase values after
echo      the = signs - the same ones you typed into Vercel.
echo      Then SAVE it, close Notepad, and double-click this file again.
echo.
start notepad ".env.local"
pause
exit /b 0

:INSTALL
echo.
echo  [..] First run: downloading the project's parts - 1 to 3 minutes...
call npm install
if errorlevel 1 goto INSTALLFAIL
echo  [OK] Packages installed
goto RUN

:INSTALLFAIL
echo  [X] npm install failed. Check your internet connection and try again.
pause
exit /b 1

:RUN
echo.
echo  Starting... your browser will open at http://localhost:3000
echo  Keep this window open while you use the site.
echo  To stop the site, close this window.
echo.
start "" "http://localhost:3000"
call npm run dev
pause
