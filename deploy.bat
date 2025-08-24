@echo off
chcp 65001 > nul
REM LanBeam GitHub Pages Deploy Script

echo.
echo ==========================================
echo   LanBeam GitHub Pages Deploy Wizard
echo ==========================================
echo.

REM Check directory
if not exist "package.json" (
    echo ERROR: Run this script in LanBeam project root
    pause
    exit /b 1
)

echo [Step 1/4] Checking environment...
echo.

REM Check Git
git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git not found
    echo Please download from: https://git-scm.com/
    pause
    exit /b 1
)
echo OK: Git found

REM Check Node.js
node -v >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found
    echo Please download from: https://nodejs.org/
    pause
    exit /b 1
)
echo OK: Node.js found

echo.
echo [Step 2/4] Installing dependencies...
npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo OK: Dependencies installed

echo.
echo [Step 3/4] Setting up Git repository...

REM Initialize Git if needed
if not exist ".git" (
    echo Initializing Git repository...
    git init
)

REM Add and commit files
echo Adding files to Git...
git add .
git status --porcelain >nul 2>&1
if not errorlevel 1 (
    echo Committing files...
    git commit -m "Deploy LanBeam to GitHub Pages"
)

REM Check for remote repository
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo.
    echo SETUP REQUIRED: GitHub Repository
    echo ================================
    echo.
    echo Please follow these steps:
    echo 1. Visit https://github.com/new
    echo 2. Create new repository named 'lanbeam'
    echo 3. Select 'Public' (required for free GitHub Pages^)
    echo 4. Do NOT add README, .gitignore, or LICENSE
    echo.
    set /p REPO_URL="Enter your GitHub repository URL: "
    
    echo Setting up remote repository...
    git remote add origin "!REPO_URL!"
    if errorlevel 1 (
        echo ERROR: Failed to add remote repository
        pause
        exit /b 1
    )
)

echo.
echo [Step 4/4] Pushing to GitHub...
echo.

REM Push to GitHub
git branch -M main 2>nul
echo Pushing code to GitHub...
git push -u origin main
if errorlevel 1 (
    echo WARNING: Push may require authentication
    echo Please follow the prompts if any appear
    pause
)

echo.
echo ==========================================
echo   Deployment Configuration Complete!
echo ==========================================
echo.
echo NEXT STEPS:
echo 1. Open your GitHub repository in browser
echo 2. Go to Settings ^> Pages
echo 3. Set Source to "GitHub Actions"
echo 4. Wait for Actions workflow to complete
echo 5. Visit your app at: https://username.github.io/lanbeam
echo.
echo Your LanBeam app will be live in 1-2 minutes!
echo.
pause
