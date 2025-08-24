@echo off
chcp 65001 > nul
REM LanBeam Quick Deploy Script (Windows)

echo 🚀 LanBeam Quick Deploy Script
echo ===============================

REM Check if in correct directory
if not exist "package.json" (
    echo ❌ Error: Please run this script in LanBeam project root directory
    pause
    exit /b 1
)

if not exist "docs" (
    echo ❌ Error: Please run this script in LanBeam project root directory
    pause
    exit /b 1
)

echo 📋 Checking environment...

REM Check Node.js
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found, please install Node.js first
    echo    Download: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js installed
node -v

REM Check npm
npm -v >nul 2>&1
if errorlevel 1 (
    echo ❌ npm not found
    pause
    exit /b 1
)

echo ✅ npm installed
npm -v

REM Check git
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git not found, please install Git first
    echo    Download: https://git-scm.com/
    pause
    exit /b 1
)

echo ✅ Git installed
git --version

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Check if git initialized
if not exist ".git" (
    echo 🔧 Initializing Git repository...
    git init
    git add .
    git commit -m "🎉 Initial commit: LanBeam P2P file transfer"
    
    echo 📝 Please setup GitHub remote repository:
    echo    1. Create new repository on GitHub (suggested name: lanbeam)
    echo    2. Run: git remote add origin https://github.com/yourusername/lanbeam.git
    echo    3. Run: git push -u origin main
) else (
    echo ✅ Git repository exists
)

REM Start development server
echo 🌐 Starting development server...
echo    Visit: https://localhost:8000
echo    Test page: https://localhost:8000/test.html
echo.
echo 🛑 Press Ctrl+C to stop server
echo.

npm run dev
