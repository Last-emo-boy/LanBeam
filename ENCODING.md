# 🔤 编码问题解决指南

## 问题描述

如果您看到类似这样的乱码：`馃殌 LanBeam 蹇€熼儴缃茶剼鏈?`，说明遇到了文件编码问题。

## 🛠️ 解决方案

### 1. Windows 命令行编码

Windows 默认使用 GBK 编码，需要切换到 UTF-8：

```cmd
# 临时切换到 UTF-8 编码
chcp 65001

# 然后运行脚本
.\quick-start.bat
```

或者使用 PowerShell（推荐）：

```powershell
# PowerShell 默认支持 UTF-8
.\quick-start.bat
```

### 2. 编辑器设置

确保您的编辑器使用 UTF-8 编码：

**VS Code:**
- 右下角点击编码显示
- 选择 "UTF-8"
- 保存文件

**记事本:**
- 另存为 → 编码选择 "UTF-8"

**其他编辑器:**
- 查找编码设置，选择 UTF-8

### 3. Git 配置

配置 Git 使用 UTF-8：

```bash
git config --global core.quotepath false
git config --global gui.encoding utf-8
git config --global i18n.commit.encoding utf-8
git config --global i18n.logoutputencoding utf-8
```

### 4. 浏览器设置

现代浏览器通常自动识别 UTF-8，但如果遇到问题：

- Chrome: 右键 → 编码 → Unicode (UTF-8)
- Firefox: 视图 → 文本编码 → Unicode
- Edge: 自动检测

## 🔍 验证编码

使用提供的测试文件验证编码是否正确：

1. **英文测试**: `demo.txt`
2. **中文测试**: `demo-chinese.txt`

如果中文测试文件显示正常，说明编码问题已解决。

## 📋 最佳实践

### 开发环境

1. **统一编码**: 所有文件使用 UTF-8 无 BOM 编码
2. **编辑器配置**: 设置默认编码为 UTF-8
3. **版本控制**: 配置 Git 正确处理 UTF-8

### 文件传输

LanBeam 本身完全支持 UTF-8 编码：

- ✅ 文件名支持中文
- ✅ 文件内容支持中文  
- ✅ 界面显示中文
- ✅ 日志输出中文

### Web 环境

所有 HTML 文件都包含正确的编码声明：

```html
<meta charset="UTF-8">
<html lang="zh-CN">
```

## 🚀 快速修复

如果遇到编码问题，按以下步骤操作：

1. **检查终端编码**:
   ```cmd
   chcp 65001
   ```

2. **使用 PowerShell**:
   ```powershell
   # PowerShell 通常没有编码问题
   ./quick-start.bat
   ```

3. **检查文件编码**:
   - 在 VS Code 中检查右下角编码显示
   - 确保显示 "UTF-8"

4. **重新保存文件**:
   - 如果编码不对，选择 UTF-8 重新保存

5. **清理缓存**:
   ```bash
   # 清理可能的编码缓存
   git rm --cached -r .
   git add .
   git commit -m "Fix encoding issues"
   ```

## ✅ 验证成功

编码问题解决后，您应该能看到：

- ✅ 脚本输出正常的中文字符
- ✅ 浏览器正确显示中文界面
- ✅ 文件传输中文名称正常
- ✅ 调试日志中文输出正常

---

如果仍有编码问题，请检查您的系统语言设置和区域配置。
