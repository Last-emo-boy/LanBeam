# 🚀 LanBeam 部署指南

本指南将帮助您将 LanBeam 部署到 GitHub Pages，让用户可以在任何设备上访问您的 P2P 文件传输服务。

## 📋 部署前准备

### 1. 创建 GitHub 仓库

1. 在 GitHub 上创建新仓库，名称建议为 `lanbeam`
2. 确保仓库是公开的（GitHub Pages 免费版需要公开仓库）
3. 初始化时不要添加 README、.gitignore 或 license（我们已经有了）

### 2. 本地代码准备

```bash
# 初始化 git 仓库
git init

# 添加所有文件
git add .

# 提交代码
git commit -m "🎉 Initial commit: LanBeam P2P file transfer"

# 添加远程仓库
git remote add origin https://github.com/你的用户名/lanbeam.git

# 推送到 GitHub
git push -u origin main
```

## 🔧 GitHub Pages 配置

### 方法 1：自动部署（推荐）

我们已经配置了 GitHub Actions 自动部署。推送代码后：

1. 进入仓库的 **Settings** → **Pages**
2. 在 **Source** 部分选择 **GitHub Actions**
3. 等待 Actions 完成部署（约 1-2 分钟）
4. 访问 `https://你的用户名.github.io/lanbeam` 即可使用

### 方法 2：手动部署

如果不想使用 Actions：

```bash
# 安装依赖
npm install

# 部署到 gh-pages 分支
npm run deploy
```

然后在仓库设置中将 Pages 源设置为 `gh-pages` 分支。

## 🌐 访问应用

部署成功后，您的 LanBeam 应用将可在以下地址访问：
- `https://你的用户名.github.io/lanbeam`

### 测试页面

访问测试页面检查功能：
- `https://你的用户名.github.io/lanbeam/test.html`

## 📱 PWA 安装

用户可以将 LanBeam 安装为原生应用：

1. 在支持的浏览器中访问应用
2. 点击地址栏的"安装"按钮
3. 或通过浏览器菜单选择"添加到主屏幕"/"安装应用"

## 🔒 HTTPS 要求

- GitHub Pages 自动提供 HTTPS
- WebRTC 需要 HTTPS 环境才能正常工作
- 本地开发可使用 `localhost`，部署必须使用 HTTPS

## 🎯 自定义域名（可选）

如果您有自定义域名：

1. 在仓库根目录创建 `CNAME` 文件
2. 内容为您的域名，如 `lanbeam.example.com`
3. 在域名提供商处设置 CNAME 记录指向 `你的用户名.github.io`
4. 在 GitHub Pages 设置中启用 "Enforce HTTPS"

## 🛠️ 本地开发

```bash
# 启动开发服务器
npm run dev

# 在浏览器中打开 https://localhost:8000
```

**注意**：本地开发必须使用 HTTPS，因为 WebRTC 需要安全上下文。

## 🔍 故障排除

### 常见问题

1. **应用无法加载**
   - 检查 GitHub Actions 是否成功运行
   - 确认 Pages 设置正确
   - 等待 DNS 传播（最多 10 分钟）

2. **WebRTC 连接失败**
   - 确认使用 HTTPS 访问
   - 检查浏览器控制台错误信息
   - 访问测试页面进行诊断

3. **QR 码扫描不工作**
   - 确认允许摄像头权限
   - 检查浏览器兼容性
   - 尝试使用手动输入模式

4. **文件传输中断**
   - 检查网络连接稳定性
   - 确认两台设备在同一局域网
   - 尝试较小的文件测试

### 调试信息

- 打开浏览器开发者工具查看详细日志
- 使用测试页面检查各项功能
- 检查 Service Worker 是否正确注册

## 📊 监控和分析

GitHub Pages 提供基本的访问统计。您可以：

1. 查看仓库的 **Insights** → **Traffic**
2. 添加 Google Analytics（在 `index.html` 中）
3. 监控 GitHub Actions 的部署状态

## 🔄 更新应用

更新代码时，只需推送到 `main` 分支：

```bash
git add .
git commit -m "✨ 添加新功能"
git push origin main
```

GitHub Actions 会自动重新部署应用。

## 🎉 完成！

现在您的 LanBeam 应用已成功部署到 GitHub Pages！用户可以：

- ✅ 在任何设备上访问应用
- ✅ 通过 QR 码配对设备
- ✅ 在局域网内快速传输文件
- ✅ 安装为 PWA 离线使用
- ✅ 享受安全的 P2P 传输

---

如有问题，请查看 [项目文档](./README.md) 或提交 Issue。
