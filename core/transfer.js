/**
 * File Transfer Engine
 * 
 * 负责文件的分片传输、背压控制、断点续传和校验
 */

import { LanBeamCrypto } from './crypto.js';

export class FileTransferEngine extends EventTarget {
  constructor(connection, options = {}) {
    super();
    
    this.connection = connection;
    this.crypto = new LanBeamCrypto();
    
    // 配置选项
    this.options = {
      chunkSize: options.chunkSize || 64 * 1024, // 64KB
      maxBufferedAmount: options.maxBufferedAmount || 1024 * 1024, // 1MB
      checksumEnabled: options.checksumEnabled !== false,
      compressionEnabled: options.compressionEnabled || false,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      progressUpdateInterval: options.progressUpdateInterval || 100,
      debug: options.debug || false,
      ...options
    };
    
    // 传输状态
    this.isActive = false;
    this.isPaused = false;
    this.currentTransfer = null;
    this.transferQueue = [];
    
    // 统计信息
    this.stats = {
      bytesTransferred: 0,
      totalBytes: 0,
      startTime: 0,
      lastUpdateTime: 0,
      currentSpeed: 0,
      averageSpeed: 0,
      eta: 0
    };
    
    // 接收缓冲区
    this.receiveBuffer = new Map();
    this.receivedChunks = new Map();
    
    this._setupConnectionHandlers();
    this._log('Transfer engine initialized');
  }
  
  /**
   * 发送文件
   * @param {File|File[]} files - 文件或文件数组
   * @param {Object} options - 传输选项
   * @returns {Promise} 传输结果
   */
  async sendFiles(files, options = {}) {
    try {
      this._log('Starting file transfer...');
      
      if (this.isActive) {
        throw new Error('Transfer already in progress');
      }
      
      if (this.connection.state !== 'connected') {
        throw new Error('Connection not ready');
      }
      
      // 规范化文件数组
      const fileArray = Array.isArray(files) ? files : [files];
      if (fileArray.length === 0) {
        throw new Error('No files to transfer');
      }
      
      this.isActive = true;
      this.isPaused = false;
      this._resetStats();
      
      // 计算总大小
      this.stats.totalBytes = fileArray.reduce((sum, file) => sum + file.size, 0);
      this.stats.startTime = Date.now();
      
      // 发送传输开始信号
      await this._sendControlMessage({
        type: 'transfer_start',
        fileCount: fileArray.length,
        totalSize: this.stats.totalBytes,
        files: fileArray.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        }))
      });
      
      this.emit('transferStart', {
        fileCount: fileArray.length,
        totalSize: this.stats.totalBytes
      });
      
      // 依次发送每个文件
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        await this._sendFile(file, { fileIndex: i, ...options });
        
        if (!this.isActive) {
          break; // 传输被取消
        }
      }
      
      // 发送传输完成信号
      if (this.isActive) {
        await this._sendControlMessage({
          type: 'transfer_complete',
          stats: this.stats
        });
        
        this.emit('transferComplete', {
          stats: this.stats,
          duration: Date.now() - this.stats.startTime
        });
      }
      
      this.isActive = false;
      this._log('File transfer completed');
      
    } catch (error) {
      this.isActive = false;
      this._log('Transfer failed:', error);
      this.emit('transferError', error);
      throw error;
    }
  }
  
  /**
   * 暂停传输
   */
  pause() {
    if (this.isActive && !this.isPaused) {
      this.isPaused = true;
      this.emit('transferPaused');
      this._log('Transfer paused');
    }
  }
  
  /**
   * 恢复传输
   */
  resume() {
    if (this.isActive && this.isPaused) {
      this.isPaused = false;
      this.emit('transferResumed');
      this._log('Transfer resumed');
    }
  }
  
  /**
   * 取消传输
   */
  cancel() {
    if (this.isActive) {
      this.isActive = false;
      this.isPaused = false;
      
      this._sendControlMessage({
        type: 'transfer_cancel'
      }).catch(() => {}); // 忽略发送错误
      
      this.emit('transferCancelled');
      this._log('Transfer cancelled');
    }
  }
  
  /**
   * 获取传输统计信息
   */
  getStats() {
    if (this.stats.startTime > 0) {
      const elapsed = Date.now() - this.stats.startTime;
      this.stats.averageSpeed = elapsed > 0 ? this.stats.bytesTransferred / (elapsed / 1000) : 0;
      
      if (this.stats.currentSpeed > 0) {
        const remaining = this.stats.totalBytes - this.stats.bytesTransferred;
        this.stats.eta = remaining / this.stats.currentSpeed;
      }
    }
    
    return { ...this.stats };
  }
  
  // ===== 私有方法 =====
  
  /**
   * 发送单个文件
   */
  async _sendFile(file, options = {}) {
    this._log(`Sending file: ${file.name} (${file.size} bytes)`);
    
    this.currentTransfer = {
      file,
      fileIndex: options.fileIndex || 0,
      bytesTransferred: 0,
      chunks: [],
      checksum: null
    };
    
    this.emit('fileStart', {
      file,
      fileIndex: options.fileIndex || 0
    });
    
    try {
      // 计算文件校验和（如果启用）
      if (this.options.checksumEnabled) {
        this.currentTransfer.checksum = await this.crypto.calculateSHA256(file);
        this._log('File checksum:', this.currentTransfer.checksum);
      }
      
      // 发送文件头信息
      await this._sendControlMessage({
        type: 'file_start',
        fileIndex: options.fileIndex || 0,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        checksum: this.currentTransfer.checksum,
        chunkSize: this.options.chunkSize
      });
      
      // 分片发送
      await this._sendFileInChunks(file);
      
      // 发送文件结束信号
      await this._sendControlMessage({
        type: 'file_end',
        fileIndex: options.fileIndex || 0,
        checksum: this.currentTransfer.checksum
      });
      
      this.emit('fileComplete', {
        file,
        fileIndex: options.fileIndex || 0,
        checksum: this.currentTransfer.checksum
      });
      
    } catch (error) {
      this.emit('fileError', {
        file,
        fileIndex: options.fileIndex || 0,
        error
      });
      throw error;
    }
  }
  
  /**
   * 分片发送文件
   */
  async _sendFileInChunks(file) {
    const totalChunks = Math.ceil(file.size / this.options.chunkSize);
    let chunkIndex = 0;
    
    while (chunkIndex < totalChunks && this.isActive) {
      // 检查暂停状态
      while (this.isPaused && this.isActive) {
        await this._sleep(100);
      }
      
      if (!this.isActive) break;
      
      // 等待缓冲区空闲
      await this._waitForBufferSpace();
      
      // 读取分片
      const start = chunkIndex * this.options.chunkSize;
      const end = Math.min(start + this.options.chunkSize, file.size);
      const chunk = file.slice(start, end);
      const chunkData = await this._readChunk(chunk);
      
      // 计算分片校验和
      let chunkChecksum = null;
      if (this.options.checksumEnabled) {
        chunkChecksum = await this.crypto.calculateCRC32(chunkData);
      }
      
      // 发送分片
      await this._sendChunk({
        fileIndex: this.currentTransfer.fileIndex,
        chunkIndex,
        totalChunks,
        data: chunkData,
        checksum: chunkChecksum
      });
      
      // 更新统计信息
      const chunkSize = chunkData.byteLength;
      this.stats.bytesTransferred += chunkSize;
      this.currentTransfer.bytesTransferred += chunkSize;
      
      // 更新速度统计
      this._updateSpeedStats();
      
      // 发出进度事件
      this.emit('progress', {
        fileIndex: this.currentTransfer.fileIndex,
        fileName: this.currentTransfer.file.name,
        chunkIndex,
        totalChunks,
        bytesTransferred: this.currentTransfer.bytesTransferred,
        fileSize: this.currentTransfer.file.size,
        totalBytesTransferred: this.stats.bytesTransferred,
        totalSize: this.stats.totalBytes,
        currentSpeed: this.stats.currentSpeed,
        averageSpeed: this.stats.averageSpeed,
        eta: this.stats.eta,
        percentage: (this.stats.bytesTransferred / this.stats.totalBytes) * 100
      });
      
      chunkIndex++;
    }
  }
  
  /**
   * 发送分片数据
   */
  async _sendChunk(chunk) {
    const message = {
      type: 'chunk',
      ...chunk
    };
    
    // 序列化消息
    const messageData = JSON.stringify({
      type: message.type,
      fileIndex: message.fileIndex,
      chunkIndex: message.chunkIndex,
      totalChunks: message.totalChunks,
      checksum: message.checksum,
      dataSize: message.data.byteLength
    });
    
    // 发送消息头
    this.connection.send(messageData);
    
    // 发送二进制数据
    this.connection.sendBinary(message.data);
    
    this._log(`Sent chunk ${message.chunkIndex}/${message.totalChunks} (${message.data.byteLength} bytes)`);
  }
  
  /**
   * 发送控制消息
   */
  async _sendControlMessage(message) {
    const data = JSON.stringify(message);
    this.connection.send(data);
    this._log('Sent control message:', message.type);
  }
  
  /**
   * 等待缓冲区有空间
   */
  async _waitForBufferSpace() {
    while (this.connection.getBufferedAmount().bufferedAmount > this.options.maxBufferedAmount) {
      await this._sleep(10);
    }
  }
  
  /**
   * 读取分片数据
   */
  _readChunk(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }
  
  /**
   * 设置连接事件处理器
   */
  _setupConnectionHandlers() {
    this.connection.addEventListener('message', (event) => {
      this._handleMessage(event.detail);
    });
    
    this.connection.addEventListener('disconnected', () => {
      if (this.isActive) {
        this.emit('transferInterrupted', new Error('Connection lost'));
      }
    });
  }
  
  /**
   * 处理接收到的消息
   */
  _handleMessage(message) {
    if (message.isBinary) {
      // 二进制数据（分片）
      this._handleChunkData(message.data);
    } else {
      // JSON 消息
      try {
        const data = JSON.parse(message.data);
        this._handleControlMessage(data);
      } catch (error) {
        this._log('Failed to parse message:', error);
      }
    }
  }
  
  /**
   * 处理控制消息
   */
  async _handleControlMessage(message) {
    this._log('Received control message:', message.type);
    
    switch (message.type) {
      case 'transfer_start':
        await this._handleTransferStart(message);
        break;
        
      case 'file_start':
        await this._handleFileStart(message);
        break;
        
      case 'chunk':
        await this._handleChunkHeader(message);
        break;
        
      case 'file_end':
        await this._handleFileEnd(message);
        break;
        
      case 'transfer_complete':
        await this._handleTransferComplete(message);
        break;
        
      case 'transfer_cancel':
        this.emit('transferCancelled');
        break;
        
      default:
        this._log('Unknown message type:', message.type);
    }
  }
  
  /**
   * 处理传输开始
   */
  async _handleTransferStart(message) {
    this._resetStats();
    this.stats.totalBytes = message.totalSize;
    this.stats.startTime = Date.now();
    
    this.emit('receiveStart', {
      fileCount: message.fileCount,
      totalSize: message.totalSize,
      files: message.files
    });
  }
  
  /**
   * 处理文件开始
   */
  async _handleFileStart(message) {
    this.currentTransfer = {
      fileIndex: message.fileIndex,
      name: message.name,
      size: message.size,
      type: message.type,
      lastModified: message.lastModified,
      checksum: message.checksum,
      chunkSize: message.chunkSize,
      receivedChunks: new Map(),
      receivedSize: 0,
      expectedChunks: Math.ceil(message.size / message.chunkSize)
    };
    
    this.emit('fileReceiveStart', {
      fileIndex: message.fileIndex,
      name: message.name,
      size: message.size,
      type: message.type
    });
  }
  
  /**
   * 处理分片头信息
   */
  async _handleChunkHeader(message) {
    // 等待二进制数据
    this._expectedChunkData = message;
  }
  
  /**
   * 处理分片数据
   */
  async _handleChunkData(arrayBuffer) {
    if (!this._expectedChunkData) {
      this._log('Received unexpected chunk data');
      return;
    }
    
    const chunkInfo = this._expectedChunkData;
    this._expectedChunkData = null;
    
    // 校验分片大小
    if (arrayBuffer.byteLength !== chunkInfo.dataSize) {
      this._log('Chunk size mismatch:', arrayBuffer.byteLength, '!=', chunkInfo.dataSize);
      return;
    }
    
    // 校验分片校验和
    if (chunkInfo.checksum && this.options.checksumEnabled) {
      const calculatedChecksum = await this.crypto.calculateCRC32(arrayBuffer);
      if (calculatedChecksum !== chunkInfo.checksum) {
        this._log('Chunk checksum mismatch:', calculatedChecksum, '!=', chunkInfo.checksum);
        return;
      }
    }
    
    // 存储分片
    const chunkKey = `${chunkInfo.fileIndex}_${chunkInfo.chunkIndex}`;
    this.receiveBuffer.set(chunkKey, arrayBuffer);
    this.currentTransfer.receivedChunks.set(chunkInfo.chunkIndex, arrayBuffer);
    this.currentTransfer.receivedSize += arrayBuffer.byteLength;
    
    // 更新统计信息
    this.stats.bytesTransferred += arrayBuffer.byteLength;
    this._updateSpeedStats();
    
    // 发出进度事件
    this.emit('receiveProgress', {
      fileIndex: chunkInfo.fileIndex,
      fileName: this.currentTransfer.name,
      chunkIndex: chunkInfo.chunkIndex,
      totalChunks: chunkInfo.totalChunks,
      receivedSize: this.currentTransfer.receivedSize,
      fileSize: this.currentTransfer.size,
      totalBytesReceived: this.stats.bytesTransferred,
      totalSize: this.stats.totalBytes,
      currentSpeed: this.stats.currentSpeed,
      averageSpeed: this.stats.averageSpeed,
      eta: this.stats.eta,
      percentage: (this.stats.bytesTransferred / this.stats.totalBytes) * 100
    });
    
    this._log(`Received chunk ${chunkInfo.chunkIndex}/${chunkInfo.totalChunks} (${arrayBuffer.byteLength} bytes)`);
  }
  
  /**
   * 处理文件结束
   */
  async _handleFileEnd(message) {
    if (!this.currentTransfer) {
      return;
    }
    
    try {
      // 重组文件
      const fileData = await this._assembleFile(this.currentTransfer);
      
      // 校验文件完整性
      if (message.checksum && this.options.checksumEnabled) {
        const calculatedChecksum = await this.crypto.calculateSHA256(fileData);
        if (calculatedChecksum !== message.checksum) {
          throw new Error('File checksum verification failed');
        }
      }
      
      // 创建文件对象
      const file = new File([fileData], this.currentTransfer.name, {
        type: this.currentTransfer.type,
        lastModified: this.currentTransfer.lastModified
      });
      
      this.emit('fileReceiveComplete', {
        fileIndex: message.fileIndex,
        file,
        checksum: message.checksum
      });
      
      // 清理缓存
      this._cleanupFileBuffer(message.fileIndex);
      
    } catch (error) {
      this.emit('fileReceiveError', {
        fileIndex: message.fileIndex,
        error
      });
    }
  }
  
  /**
   * 处理传输完成
   */
  async _handleTransferComplete(message) {
    this.emit('receiveComplete', {
      stats: this.stats,
      duration: Date.now() - this.stats.startTime
    });
  }
  
  /**
   * 重组文件
   */
  async _assembleFile(transfer) {
    const chunks = [];
    
    for (let i = 0; i < transfer.expectedChunks; i++) {
      const chunk = transfer.receivedChunks.get(i);
      if (!chunk) {
        throw new Error(`Missing chunk ${i}`);
      }
      chunks.push(chunk);
    }
    
    return new Blob(chunks);
  }
  
  /**
   * 清理文件缓存
   */
  _cleanupFileBuffer(fileIndex) {
    const keysToDelete = [];
    for (const key of this.receiveBuffer.keys()) {
      if (key.startsWith(`${fileIndex}_`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.receiveBuffer.delete(key));
  }
  
  /**
   * 更新速度统计
   */
  _updateSpeedStats() {
    const now = Date.now();
    
    if (this.stats.lastUpdateTime > 0) {
      const timeDiff = now - this.stats.lastUpdateTime;
      if (timeDiff >= this.options.progressUpdateInterval) {
        const byteDiff = this.stats.bytesTransferred - (this._lastBytesTransferred || 0);
        this.stats.currentSpeed = byteDiff / (timeDiff / 1000);
        this._lastBytesTransferred = this.stats.bytesTransferred;
        this.stats.lastUpdateTime = now;
      }
    } else {
      this.stats.lastUpdateTime = now;
      this._lastBytesTransferred = this.stats.bytesTransferred;
    }
  }
  
  /**
   * 重置统计信息
   */
  _resetStats() {
    this.stats = {
      bytesTransferred: 0,
      totalBytes: 0,
      startTime: 0,
      lastUpdateTime: 0,
      currentSpeed: 0,
      averageSpeed: 0,
      eta: 0
    };
    this._lastBytesTransferred = 0;
  }
  
  /**
   * 等待指定时间
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 调试日志
   */
  _log(...args) {
    if (this.options.debug) {
      console.log('[FileTransferEngine]', ...args);
    }
  }
}

// 导出工具函数
export const TransferUtils = {
  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
  },
  
  /**
   * 格式化传输速率
   */
  formatSpeed(bytesPerSecond) {
    return this.formatFileSize(bytesPerSecond) + '/s';
  },
  
  /**
   * 格式化剩余时间
   */
  formatETA(seconds) {
    if (!seconds || seconds === Infinity) return '未知';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else if (minutes > 0) {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${secs}s`;
    }
  },
  
  /**
   * 检测文件类型图标
   */
  getFileIcon(filename, mimeType) {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    // 图片文件
    if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
      return 'fa-image';
    }
    
    // 视频文件
    if (mimeType?.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(ext)) {
      return 'fa-video';
    }
    
    // 音频文件
    if (mimeType?.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'].includes(ext)) {
      return 'fa-music';
    }
    
    // 文档文件
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) {
      return 'fa-file-text';
    }
    
    // 表格文件
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return 'fa-file-excel';
    }
    
    // 压缩文件
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return 'fa-file-archive';
    }
    
    // 代码文件
    if (['js', 'ts', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php', 'go', 'rs'].includes(ext)) {
      return 'fa-file-code';
    }
    
    return 'fa-file';
  }
};
