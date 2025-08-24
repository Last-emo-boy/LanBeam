# 🚀 LanBeam GitHub Pages 部署脚本
# 自动化部署到 GitHub Pages

param(
    [string]$RepoUrl = "",
    [string]$Message = "Deploy LanBeam to GitHub Pages"
)

Write-Host ""
Write-Host "🚀 LanBeam GitHub Pages 部署向导" -ForegroundColor Blue
Write-Host "=================================" -ForegroundColor Blue
Write-Host ""

# 检查是否在正确目录
if (-not (Test-Path "package.json") -or -not (Test-Path "docs")) {
    Write-Host "❌ 错误：请在 LanBeam 项目根目录运行此脚本" -ForegroundColor Red
    Read-Host "按 Enter 键退出"
    exit 1
}

# 检查必要工具
Write-Host "📋 检查环境..." -ForegroundColor Yellow

# 检查 Git
try {
    $gitVersion = git --version
    Write-Host "✅ Git 已安装: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ 未找到 Git，请先安装 Git" -ForegroundColor Red
    Write-Host "   下载地址：https://git-scm.com/" -ForegroundColor Yellow
    Read-Host "按 Enter 键退出"
    exit 1
}

# 检查 Node.js
try {
    $nodeVersion = node -v
    Write-Host "✅ Node.js 已安装: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ 未找到 Node.js，请先安装 Node.js" -ForegroundColor Red
    Write-Host "   下载地址：https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "按 Enter 键退出"
    exit 1
}

Write-Host ""
Write-Host "📦 步骤 1: 准备项目文件" -ForegroundColor Cyan
Write-Host "------------------------" -ForegroundColor Cyan

# 安装依赖
Write-Host "安装 npm 依赖..." -ForegroundColor Yellow
try {
    npm install | Out-Null
    Write-Host "✅ 依赖安装完成" -ForegroundColor Green
} catch {
    Write-Host "❌ 依赖安装失败" -ForegroundColor Red
    Read-Host "按 Enter 键退出"
    exit 1
}

Write-Host ""
Write-Host "🔧 步骤 2: 配置 Git 仓库" -ForegroundColor Cyan
Write-Host "------------------------" -ForegroundColor Cyan

# 初始化 Git（如果需要）
if (-not (Test-Path ".git")) {
    Write-Host "初始化 Git 仓库..." -ForegroundColor Yellow
    git init | Out-Null
    Write-Host "✅ Git 仓库已初始化" -ForegroundColor Green
}

# 添加所有文件
Write-Host "添加项目文件到 Git..." -ForegroundColor Yellow
git add . | Out-Null

# 检查是否有变更需要提交
$status = git status --porcelain
if ($status) {
    Write-Host "提交项目文件..." -ForegroundColor Yellow
    git commit -m "$Message" | Out-Null
    Write-Host "✅ 文件已提交" -ForegroundColor Green
} else {
    Write-Host "✅ 没有新的变更需要提交" -ForegroundColor Green
}

# 检查远程仓库
$remotes = git remote
if (-not $remotes -contains "origin") {
    if ($RepoUrl) {
        Write-Host "设置远程仓库: $RepoUrl" -ForegroundColor Yellow
        git remote add origin $RepoUrl | Out-Null
        Write-Host "✅ 远程仓库已设置" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "📝 需要设置 GitHub 远程仓库" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "请按照以下步骤操作："
        Write-Host "1. 访问 https://github.com/new" -ForegroundColor White
        Write-Host "2. 创建新仓库，建议命名为 'lanbeam'" -ForegroundColor White
        Write-Host "3. 选择 Public（GitHub Pages 免费版需要公开仓库）" -ForegroundColor White
        Write-Host "4. 不要添加 README、.gitignore 或 LICENSE（我们已经有了）" -ForegroundColor White
        Write-Host ""
        
        do {
            $repoUrl = Read-Host "请输入您的 GitHub 仓库 URL（例如：https://github.com/username/lanbeam.git）"
        } while (-not $repoUrl)
        
        Write-Host "设置远程仓库..." -ForegroundColor Yellow
        git remote add origin $repoUrl | Out-Null
        Write-Host "✅ 远程仓库已设置" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "📤 步骤 3: 推送到 GitHub" -ForegroundColor Cyan
Write-Host "------------------------" -ForegroundColor Cyan

# 推送到 GitHub
Write-Host "推送代码到 GitHub..." -ForegroundColor Yellow
try {
    # 检查当前分支
    $currentBranch = git branch --show-current
    if (-not $currentBranch) {
        $currentBranch = "main"
        git branch -M main | Out-Null
    }
    
    # 推送代码
    git push -u origin $currentBranch 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 代码已推送到 GitHub" -ForegroundColor Green
    } else {
        Write-Host "⚠️  推送可能需要认证，请按提示操作" -ForegroundColor Yellow
        git push -u origin $currentBranch
    }
} catch {
    Write-Host "❌ 推送失败，请检查网络连接和仓库权限" -ForegroundColor Red
    Read-Host "按 Enter 键继续"
}

Write-Host ""
Write-Host "🌐 步骤 4: 启用 GitHub Pages" -ForegroundColor Cyan
Write-Host "---------------------------" -ForegroundColor Cyan

Write-Host ""
Write-Host "现在需要在 GitHub 网站上启用 Pages：" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 打开您的 GitHub 仓库页面" -ForegroundColor White
Write-Host "2. 点击 'Settings' 选项卡" -ForegroundColor White
Write-Host "3. 在左侧菜单找到 'Pages'" -ForegroundColor White
Write-Host "4. 在 'Source' 部分选择 'GitHub Actions'" -ForegroundColor White
Write-Host "5. 等待 Actions 工作流完成（约 1-2 分钟）" -ForegroundColor White
Write-Host ""

# 获取仓库信息
$remoteUrl = git remote get-url origin 2>$null
if ($remoteUrl) {
    # 解析 GitHub 用户名和仓库名
    if ($remoteUrl -match "github\.com[:/](.+)/(.+)\.git$" -or $remoteUrl -match "github\.com[:/](.+)/(.+)$") {
        $username = $matches[1]
        $reponame = $matches[2] -replace "\.git$", ""
        
        $repoUrl = "https://github.com/$username/$reponame"
        $pagesUrl = "https://$username.github.io/$reponame"
        
        Write-Host "🔗 有用的链接：" -ForegroundColor Cyan
        Write-Host "   仓库地址: $repoUrl" -ForegroundColor White
        Write-Host "   设置页面: $repoUrl/settings/pages" -ForegroundColor White
        Write-Host "   应用地址: $pagesUrl" -ForegroundColor White
        Write-Host "   测试页面: $pagesUrl/test.html" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "✅ 部署配置完成！" -ForegroundColor Green
Write-Host ""
Write-Host "🎉 接下来：" -ForegroundColor Yellow
Write-Host "1. 访问仓库设置页面启用 GitHub Pages" -ForegroundColor White
Write-Host "2. 等待 Actions 工作流完成" -ForegroundColor White
Write-Host "3. 访问应用地址开始使用 LanBeam！" -ForegroundColor White
Write-Host ""

Read-Host "按 Enter 键退出"
