# LanBeam Icons

由于版权和兼容性考虑，本项目不包含预制图标。请按照以下步骤生成应用图标。

## 🎨 图标要求

### PWA 图标规范

根据 `manifest.json` 配置，需要以下尺寸的图标：

```
docs/icons/
├── icon-72x72.png     (72x72)
├── icon-96x96.png     (96x96)
├── icon-128x128.png   (128x128)
├── icon-144x144.png   (144x144)
├── icon-152x152.png   (152x152)
├── icon-192x192.png   (192x192)
├── icon-384x384.png   (384x384)
└── icon-512x512.png   (512x512)
```

### 设计建议

推荐的图标设计元素：
- **主色调**：#1976d2（蓝色，与应用主题一致）
- **背景**：纯色或渐变
- **图形**：简洁的传输/连接相关图标
- **风格**：现代、扁平化设计

## 🛠️ 生成图标

### 方法 1：在线工具（推荐）

使用 PWA 图标生成器：

1. **PWA Builder Icon Generator**
   - 访问：https://www.pwabuilder.com/imageGenerator
   - 上传 512x512 的源图标
   - 下载生成的图标包
   - 解压到 `docs/icons/` 目录

2. **Favicon.io PWA Generator**
   - 访问：https://favicon.io/favicon-generator/
   - 创建或上传图标
   - 选择 PWA 图标包
   - 重命名文件以匹配规范

3. **App Icon Generator**
   - 访问：https://appicon.co/
   - 上传高分辨率图标
   - 选择 Web/PWA 平台
   - 下载并整理文件

### 方法 2：设计工具

使用 Figma、Sketch、Adobe XD 等：

1. 创建 512x512 的设计文件
2. 设计简洁的 LanBeam 图标
3. 导出所需的各种尺寸
4. 保存为 PNG 格式

### 方法 3：代码生成（临时方案）

如果需要快速测试，可以生成简单的纯色图标：

```html
<!-- 创建临时图标的 HTML -->
<!DOCTYPE html>
<html>
<head>
    <title>LanBeam 图标生成器</title>
    <style>
        canvas { border: 1px solid #ccc; margin: 10px; }
    </style>
</head>
<body>
    <h1>LanBeam 图标生成器</h1>
    <div id="canvases"></div>
    <button onclick="downloadAll()">下载所有图标</button>
    
    <script>
        const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
        const canvases = [];
        
        function createIcon(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');
            
            // 背景渐变
            const gradient = ctx.createLinearGradient(0, 0, size, size);
            gradient.addColorStop(0, '#1976d2');
            gradient.addColorStop(1, '#1565c0');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);
            
            // 绘制传输图标
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'white';
            ctx.lineWidth = size / 32;
            
            const center = size / 2;
            const radius = size / 4;
            
            // 绘制两个圆圈表示设备
            ctx.beginPath();
            ctx.arc(center - radius/2, center, radius/3, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(center + radius/2, center, radius/3, 0, Math.PI * 2);
            ctx.fill();
            
            // 绘制连接线
            ctx.beginPath();
            ctx.moveTo(center - radius/6, center);
            ctx.lineTo(center + radius/6, center);
            ctx.stroke();
            
            // 绘制箭头
            ctx.beginPath();
            ctx.moveTo(center + radius/6 - size/32, center - size/32);
            ctx.lineTo(center + radius/6, center);
            ctx.lineTo(center + radius/6 - size/32, center + size/32);
            ctx.stroke();
            
            return canvas;
        }
        
        // 生成所有尺寸的图标
        sizes.forEach(size => {
            const canvas = createIcon(size);
            canvas.title = `${size}x${size}`;
            document.getElementById('canvases').appendChild(canvas);
            canvases.push({ canvas, size });
        });
        
        function downloadAll() {
            canvases.forEach(({ canvas, size }) => {
                const link = document.createElement('a');
                link.download = `icon-${size}x${size}.png`;
                link.href = canvas.toDataURL();
                link.click();
            });
        }
    </script>
</body>
</html>
```

将以上代码保存为 `icon-generator.html`，在浏览器中打开即可生成临时图标。

## 📱 图标测试

生成图标后，测试 PWA 安装：

1. 部署应用到 GitHub Pages
2. 在移动设备上访问应用
3. 查看是否出现"安装应用"提示
4. 安装后检查图标是否正确显示

## 🎯 高级定制

### 自适应图标（Android）

为了更好的 Android 体验，可以创建自适应图标：

- 创建带透明边距的图标
- 确保核心图形在安全区域内
- 测试不同形状的裁剪效果

### iOS 优化

为 iOS Safari 添加特殊支持：

```html
<link rel="apple-touch-icon" href="icons/icon-180x180.png">
<link rel="apple-touch-icon" sizes="152x152" href="icons/icon-152x152.png">
<link rel="apple-touch-icon" sizes="180x180" href="icons/icon-180x180.png">
```

### favicon

创建网站图标：

```html
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="icons/favicon-16x16.png">
```

## ✅ 验证清单

完成图标设置后，请确认：

- [ ] 所有必需尺寸的图标已生成
- [ ] 图标文件放置在正确位置 (`docs/icons/`)
- [ ] 图标格式为 PNG
- [ ] PWA 安装提示正常显示
- [ ] 安装后图标显示正确
- [ ] 不同设备上图标都清晰可见

## 📞 获取帮助

如果在图标生成过程中遇到问题：

1. 查看浏览器控制台错误信息
2. 验证文件路径和命名
3. 检查图标尺寸和格式
4. 测试不同的生成工具

---

完成图标设置后，您的 LanBeam 应用将拥有完整的 PWA 体验！
