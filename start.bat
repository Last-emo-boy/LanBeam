@echo off
REM LanBeam Quick Start (English Version)
REM No encoding issues, works on all Windows systems

echo.
echo ==========================================
echo   LanBeam - P2P File Transfer Tool
echo ==========================================
echo.

REM Check directory
if not exist "package.json" (
    echo ERROR: Run this script in LanBeam project root
    pause
    exit /b 1
)

echo [1/5] Checking Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found
    echo Please download from: https://nodejs.org/
    pause
    exit /b 1
)
echo OK: Node.js found

echo [2/5] Checking npm...
npm -v >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm not found
    pause
    exit /b 1
)
echo OK: npm found

echo [3/5] Installing dependencies...
npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo OK: Dependencies installed

echo [4/5] Checking Git...
if not exist ".git" (
    echo Initializing Git repository...
    git init
    git add .
    git commit -m "Initial commit: LanBeam P2P file transfer"
    echo.
    echo NEXT STEPS:
    echo 1. Create repository on GitHub
    echo 2. git remote add origin https://github.com/username/lanbeam.git
    echo 3. git push -u origin main
    echo.
)

echo [5/5] Starting development server...
echo.
echo SUCCESS! LanBeam is starting...
echo.
echo Open in browser:
echo  - Main app: https://localhost:8000
echo  - Test page: https://localhost:8000/test.html
echo.
echo Press Ctrl+C to stop the server
echo.

npm run dev
