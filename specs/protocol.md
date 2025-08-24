# LanBeam 协议规范

## 版本信息
- 协议版本: 1.0
- 文档版本: 0.1.0
- 更新日期: 2024-08-24

## 概述

LanBeam 协议是一个基于 WebRTC DataChannel 的点对点文件传输协议，设计用于局域网环境下的高效、安全文件传输。

## 信令协议

### 配对数据格式

#### Offer 数据结构
```json
{
  "type": "lanbeam-offer",
  "version": "1.0",
  "sdp": "SDP_OFFER_STRING",
  "timestamp": 1692867200000,
  "deviceId": "ABC123XYZ"
}
```

#### Answer 数据结构
```json
{
  "type": "lanbeam-answer", 
  "version": "1.0",
  "sdp": "SDP_ANSWER_STRING",
  "timestamp": 1692867260000,
  "deviceId": "XYZ789ABC",
  "replyTo": "ABC123XYZ"
}
```

### 字段说明

- `type`: 数据类型，固定为 "lanbeam-offer" 或 "lanbeam-answer"
- `version`: 协议版本号
- `sdp`: WebRTC SDP 数据
- `timestamp`: Unix 时间戳（毫秒）
- `deviceId`: 设备唯一标识符（8位随机字符串）
- `replyTo`: 应答时指向原 offer 的设备ID

## 传输协议

### 消息类型

#### 1. 传输开始 (transfer_start)
```json
{
  "type": "transfer_start",
  "fileCount": 3,
  "totalSize": 1024000,
  "files": [
    {
      "name": "document.pdf",
      "size": 512000,
      "type": "application/pdf", 
      "lastModified": 1692867200000
    }
  ]
}
```

#### 2. 文件开始 (file_start)
```json
{
  "type": "file_start",
  "fileIndex": 0,
  "name": "document.pdf",
  "size": 512000,
  "type": "application/pdf",
  "lastModified": 1692867200000,
  "checksum": "sha256_hash_string",
  "chunkSize": 65536
}
```

#### 3. 数据分片 (chunk)
```json
{
  "type": "chunk",
  "fileIndex": 0,
  "chunkIndex": 0,
  "totalChunks": 8,
  "checksum": "crc32_checksum",
  "dataSize": 65536
}
```
*注：实际二进制数据在单独的 DataChannel 消息中发送*

#### 4. 文件结束 (file_end)
```json
{
  "type": "file_end",
  "fileIndex": 0,
  "checksum": "sha256_hash_string"
}
```

#### 5. 传输完成 (transfer_complete)
```json
{
  "type": "transfer_complete",
  "stats": {
    "bytesTransferred": 1024000,
    "totalBytes": 1024000,
    "averageSpeed": 850000,
    "startTime": 1692867200000
  }
}
```

#### 6. 传输取消 (transfer_cancel)
```json
{
  "type": "transfer_cancel"
}
```

### 传输流程

1. **建立连接**
   - 通过二维码交换 WebRTC SDP
   - 建立 DataChannel 连接

2. **开始传输**
   - 发送方发送 `transfer_start` 消息
   - 包含所有文件的元数据

3. **逐文件传输**
   - 对每个文件：
     - 发送 `file_start` 消息
     - 分片发送文件数据（`chunk` + 二进制数据）
     - 发送 `file_end` 消息

4. **完成传输**
   - 发送 `transfer_complete` 消息
   - 关闭连接

## 数据完整性

### 校验算法

- **文件级校验**: SHA-256 哈希
- **分片级校验**: CRC32 校验和

### 校验流程

1. 发送前计算文件 SHA-256 哈希
2. 每个分片计算 CRC32 校验和
3. 接收方验证每个分片的 CRC32
4. 文件接收完成后验证 SHA-256

## 错误处理

### 重传机制

- 分片 CRC32 校验失败时请求重传
- 最大重试次数: 3次
- 重试间隔: 1秒

### 错误类型

1. **连接错误** - WebRTC 连接失败
2. **校验错误** - 数据完整性校验失败  
3. **超时错误** - 传输超时
4. **取消错误** - 用户主动取消

## 安全特性

### 加密传输

- WebRTC 原生端到端加密
- 可选的会话级额外加密层

### 隐私保护

- 不依赖外部服务器
- 数据不经过第三方
- 本地生成设备指纹

## 性能优化

### 分片策略

- 默认分片大小: 64KB
- 根据网络状况动态调整
- 背压控制防止内存溢出

### 并发控制

- 串行文件传输
- 分片级并行处理
- 流式读写减少内存占用

## 版本兼容性

### 向后兼容

- 协议版本检查
- 优雅降级机制
- 特性协商

### 升级路径

- 新版本保持对旧版本支持
- 废弃特性逐步移除
- 迁移指南提供

## 扩展点

### 插件接口

- 自定义信令适配器
- 自定义加密算法
- 自定义压缩算法

### 未来特性

- 断点续传优化
- 多路径传输
- 自适应比特率
- 群组传输
