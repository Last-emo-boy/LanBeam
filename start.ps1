# LanBeam Quick Start (PowerShell)
# UTF-8 compatible, works on all systems

Write-Host ""
Write-Host "==========================================" -ForegroundColor Blue
Write-Host "   LanBeam - P2P File Transfer Tool" -ForegroundColor Blue  
Write-Host "==========================================" -ForegroundColor Blue
Write-Host ""

# Check directory
if (-not (Test-Path "package.json") -or -not (Test-Path "docs")) {
    Write-Host "ERROR: Run this script in LanBeam project root" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[1/5] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node -v
    Write-Host "OK: Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js not found" -ForegroundColor Red
    Write-Host "Please download from: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[2/5] Checking npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm -v
    Write-Host "OK: npm $npmVersion found" -ForegroundColor Green
} catch {
    Write-Host "ERROR: npm not found" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[3/5] Installing dependencies..." -ForegroundColor Yellow
try {
    npm install | Out-Null
    Write-Host "OK: Dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[4/5] Checking Git..." -ForegroundColor Yellow
if (-not (Test-Path ".git")) {
    Write-Host "Initializing Git repository..." -ForegroundColor Yellow
    git init | Out-Null
    git add . | Out-Null
    git commit -m "Initial commit: LanBeam P2P file transfer" | Out-Null
    Write-Host ""
    Write-Host "NEXT STEPS:" -ForegroundColor Cyan
    Write-Host "1. Create repository on GitHub" -ForegroundColor White
    Write-Host "2. git remote add origin https://github.com/username/lanbeam.git" -ForegroundColor White
    Write-Host "3. git push -u origin main" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "OK: Git repository exists" -ForegroundColor Green
}

Write-Host "[5/5] Starting development server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "SUCCESS! LanBeam is starting..." -ForegroundColor Green
Write-Host ""
Write-Host "Open in browser:" -ForegroundColor Cyan
Write-Host " - Main app: https://localhost:8000" -ForegroundColor White
Write-Host " - Test page: https://localhost:8000/test.html" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

npm run dev
