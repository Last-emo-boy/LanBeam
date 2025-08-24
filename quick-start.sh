#!/bin/bash

# LanBeam Quick Deploy Script
# For Linux/macOS/WSL

set -e  # Exit on error

echo "🚀 LanBeam Quick Deploy Script"
echo "==============================="

# Check if in correct directory
if [ ! -f "package.json" ] || [ ! -d "docs" ]; then
    echo "❌ Error: Please run this script in LanBeam project root directory"
    exit 1
fi

echo "📋 Checking environment..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found, please install Node.js first"
    echo "   Download: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi

echo "✅ npm version: $(npm -v)"

# Check git
if ! command -v git &> /dev/null; then
    echo "❌ Git not found, please install Git first"
    exit 1
fi

echo "✅ Git version: $(git --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if git initialized
if [ ! -d ".git" ]; then
    echo "🔧 Initializing Git repository..."
    git init
    git add .
    git commit -m "🎉 Initial commit: LanBeam P2P file transfer"
    
    echo "📝 Please setup GitHub remote repository:"
    echo "   1. Create new repository on GitHub (suggested name: lanbeam)"
    echo "   2. Run: git remote add origin https://github.com/yourusername/lanbeam.git"
    echo "   3. Run: git push -u origin main"
else
    echo "✅ Git repository exists"
fi

# Start development server
echo "🌐 Starting development server..."
echo "   Visit: https://localhost:8000"
echo "   Test page: https://localhost:8000/test.html"
echo ""
echo "🛑 Press Ctrl+C to stop server"
echo ""

npm run dev
