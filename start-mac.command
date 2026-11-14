#!/bin/bash
# County Hub - double-click to start on your Mac
cd "$(dirname "$0")"

echo
echo " ==================================================="
echo "  County Hub - starting on your computer"
echo " ==================================================="
echo

if ! command -v node >/dev/null 2>&1; then
  echo " [X] Node.js is not installed."
  echo "     1. Open https://nodejs.org and click the green LTS button."
  echo "     2. Run the installer."
  echo "     3. Double-click this file again."
  echo
  read -r -p "Press Enter to close..."
  exit 1
fi
echo " [OK] Node.js $(node -v) found"

if [ ! -f ".env.local" ]; then
  cp ".env.example" ".env.local"
  echo
  echo " [!] Created your settings file: .env.local"
  echo "     It just opened in TextEdit. Fill in the Supabase values"
  echo "     (same ones you typed into Vercel), SAVE it, close TextEdit,"
  echo "     then double-click this file again."
  echo
  open -e ".env.local"
  read -r -p "Press Enter to close..."
  exit 0
fi
echo " [OK] Settings file .env.local found"

if [ ! -d "node_modules" ]; then
  echo
  echo " [..] First run: downloading the project's parts (1-3 minutes)..."
  npm install || { echo " [X] npm install failed. Check your internet and try again."; read -r -p "Press Enter to close..."; exit 1; }
fi
echo " [OK] Packages installed"

echo
echo " Starting... your browser will open at http://localhost:3000"
echo " Keep this window open while you use the site."
echo " To stop the site, close this window (or press Ctrl+C)."
echo
(sleep 4 && open "http://localhost:3000") &
npm run dev
