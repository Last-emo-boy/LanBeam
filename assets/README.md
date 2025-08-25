# LanBeam Assets

这个文件夹包含应用程序的静态资源文件。

## 需要添加的文件

### PWA 图标
- `icon-72x72.png` - 72x72 应用图标
- `icon-96x96.png` - 96x96 应用图标  
- `icon-128x128.png` - 128x128 应用图标
- `icon-144x144.png` - 144x144 应用图标
- `icon-152x152.png` - 152x152 应用图标
- `icon-192x192.png` - 192x192 应用图标
- `icon-384x384.png` - 384x384 应用图标
- `icon-512x512.png` - 512x512 应用图标

### Favicon
- `favicon-16x16.png` - 16x16 网站图标
- `favicon-32x32.png` - 32x32 网站图标
- `apple-touch-icon.png` - 苹果设备图标

### 截图（用于 PWA manifest）
- `screenshot-wide.png` - 宽屏截图 (1280x720)
- `screenshot-narrow.png` - 窄屏截图 (390x844)

### 演示图片（可选）
- `demo.gif` - 应用演示动图

## 图标设计建议

### 主色调
- 主色：`#1976d2` (蓝色)
- 辅助色：`#03dac6` (青色)
- 背景：白色或透明

### 设计元素
- WiFi 信号图标
- 传输箭头
- 简洁现代的设计风格
- 圆角矩形背景（适配 iOS）

## 生成图标的方法

### 在线工具
- [PWA Builder](https://www.pwabuilder.com/imageGenerator) - PWA 图标生成器
- [Favicon Generator](https://favicon.io/) - Favicon 生成器
- [App Icon Generator](https://appicon.co/) - 多尺寸图标生成

### 本地工具
使用 ImageMagick 批量生成：

```bash
# 从 SVG 生成多尺寸 PNG
convert icon.svg -resize 72x72 icon-72x72.png
convert icon.svg -resize 96x96 icon-96x96.png
convert icon.svg -resize 128x128 icon-128x128.png
convert icon.svg -resize 144x144 icon-144x144.png
convert icon.svg -resize 152x152 icon-152x152.png
convert icon.svg -resize 192x192 icon-192x192.png
convert icon.svg -resize 384x384 icon-384x384.png
convert icon.svg -resize 512x512 icon-512x512.png
```

## 临时解决方案

在生成正式图标之前，可以使用以下占位符：

1. 创建纯色背景的简单图标
2. 使用 Font Awesome 图标作为占位符
3. 从现有的开源图标库选择类似图标

这些文件添加后，PWA 功能将完全正常工作。
