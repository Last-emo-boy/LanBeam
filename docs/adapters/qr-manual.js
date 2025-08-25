/**
 * QR Code Manual Signaling Adapter
 * 
 * 处理二维码生成、扫描和手动信令交换
 */

export class QRManualAdapter extends EventTarget {
  constructor(options = {}) {
    super();
    
    this.options = {
      qrCodeSize: options.qrCodeSize || 256,
      qrErrorCorrectionLevel: options.qrErrorCorrectionLevel || 'M',
      compression: options.compression !== false,
      maxQRLength: options.maxQRLength || 2000, // 二维码最大长度
      debug: options.debug || false,
      ...options
    };
    
    this.qrScanner = null;
    this.currentOffer = null;
    this.currentAnswer = null;
    
    this._setupEventHandlers();
    this._log('QR Manual Adapter initialized');
  }
  
  /**
   * 生成配对二维码（Offer）
   * @param {string} sdpOffer - SDP Offer 字符串
   * @returns {Promise<Object>} 二维码信息
   */
  async generateOfferQR(sdpOffer) {
    try {
      this._log('Generating offer QR code...');
      
      // 创建配对数据
      const pairData = {
        type: 'lanbeam-offer',
        version: '1.0',
        sdp: sdpOffer,
        timestamp: Date.now(),
        deviceId: await this._getDeviceId()
      };
      
      // 压缩数据（如果启用）
      let dataString = JSON.stringify(pairData);
      if (this.options.compression) {
        dataString = await this._compressData(dataString);
      }
      
      // 检查长度是否适合二维码
      if (dataString.length > this.options.maxQRLength) {
        throw new Error('Data too long for QR code');
      }
      
      this.currentOffer = pairData;
      
      // 生成二维码
      const qrCodeDataURL = await this._generateQRCode(dataString);
      
      this._log('Offer QR code generated');
      this.emit('qrGenerated', {
        type: 'offer',
        dataURL: qrCodeDataURL,
        data: pairData,
        rawData: dataString
      });
      
      return {
        dataURL: qrCodeDataURL,
        data: pairData,
        rawData: dataString,
        copyText: dataString
      };
      
    } catch (error) {
      this._log('Failed to generate offer QR:', error);
      throw error;
    }
  }
  
  /**
   * 生成应答二维码（Answer）
   * @param {string} sdpAnswer - SDP Answer 字符串
   * @returns {Promise<Object>} 二维码信息
   */
  async generateAnswerQR(sdpAnswer) {
    try {
      this._log('Generating answer QR code...');
      
      // 创建应答数据
      const pairData = {
        type: 'lanbeam-answer',
        version: '1.0',
        sdp: sdpAnswer,
        timestamp: Date.now(),
        deviceId: await this._getDeviceId(),
        replyTo: this.currentOffer?.deviceId || null
      };
      
      // 压缩数据
      let dataString = JSON.stringify(pairData);
      if (this.options.compression) {
        dataString = await this._compressData(dataString);
      }
      
      // 检查长度
      if (dataString.length > this.options.maxQRLength) {
        throw new Error('Data too long for QR code');
      }
      
      this.currentAnswer = pairData;
      
      // 生成二维码
      const qrCodeDataURL = await this._generateQRCode(dataString);
      
      this._log('Answer QR code generated');
      this.emit('qrGenerated', {
        type: 'answer',
        dataURL: qrCodeDataURL,
        data: pairData,
        rawData: dataString
      });
      
      return {
        dataURL: qrCodeDataURL,
        data: pairData,
        rawData: dataString,
        copyText: dataString
      };
      
    } catch (error) {
      this._log('Failed to generate answer QR:', error);
      throw error;
    }
  }
  
  /**
   * 开始扫描二维码
   * @param {HTMLVideoElement} videoElement - 视频元素
   * @returns {Promise<void>}
   */
  async startScanning(videoElement) {
    try {
      this._log('Starting QR code scanning...');
      
      if (this.qrScanner) {
        await this.stopScanning();
      }
      
      // 检查摄像头权限
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported');
      }
      
      // 请求摄像头访问
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // 优先使用后置摄像头
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      
      videoElement.srcObject = stream;
      await new Promise((resolve) => {
        videoElement.onloadedmetadata = resolve;
      });
      
      // 初始化 QR Scanner
      if (typeof QrScanner !== 'undefined') {
        this.qrScanner = new QrScanner(
          videoElement,
          (result) => this._handleQRScanResult(result),
          {
            returnDetailedScanResult: true,
            highlightScanRegion: true,
            highlightCodeOutline: true
          }
        );
        
        await this.qrScanner.start();
        
        this._log('QR scanner started');
        this.emit('scanningStarted');
      } else {
        throw new Error('QR Scanner library not loaded');
      }
      
    } catch (error) {
      this._log('Failed to start scanning:', error);
      this.emit('scanError', error);
      throw error;
    }
  }
  
  /**
   * 停止扫描
   */
  async stopScanning() {
    if (this.qrScanner) {
      this._log('Stopping QR scanner...');
      this.qrScanner.destroy();
      this.qrScanner = null;
      this.emit('scanningStopped');
      this._log('QR scanner stopped');
    }
  }
  
  /**
   * 手动处理配对码
   * @param {string} pairCode - 手动输入的配对码
   * @returns {Promise<Object>} 解析的配对数据
   */
  async handleManualCode(pairCode) {
    try {
      this._log('Processing manual pair code...');
      
      if (!pairCode || !pairCode.trim()) {
        throw new Error('Empty pair code');
      }
      
      const result = await this._parsePairData(pairCode.trim());
      this._handleQRScanResult({ data: pairCode.trim() });
      
      return result;
      
    } catch (error) {
      this._log('Failed to process manual code:', error);
      throw error;
    }
  }
  
  /**
   * 复制配对码到剪贴板
   * @param {string} text - 要复制的文本
   */
  async copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        this._log('Copied to clipboard');
        this.emit('copied', { text });
        return true;
      } else {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (success) {
          this._log('Copied to clipboard (fallback)');
          this.emit('copied', { text });
          return true;
        } else {
          throw new Error('Copy failed');
        }
      }
    } catch (error) {
      this._log('Failed to copy to clipboard:', error);
      this.emit('copyError', error);
      return false;
    }
  }
  
  /**
   * 从剪贴板读取
   */
  async readFromClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        this._log('Read from clipboard');
        return text;
      } else {
        throw new Error('Clipboard read not supported');
      }
    } catch (error) {
      this._log('Failed to read from clipboard:', error);
      throw error;
    }
  }
  
  /**
   * 清理资源
   */
  cleanup() {
    this.stopScanning();
    this.currentOffer = null;
    this.currentAnswer = null;
  }
  
  // ===== 私有方法 =====
  
  /**
   * 生成二维码
   */
  async _generateQRCode(data) {
    return new Promise((resolve, reject) => {
      if (typeof QRCode === 'undefined') {
        reject(new Error('QRCode library not loaded'));
        return;
      }
      
      // 创建临时 canvas
      const canvas = document.createElement('canvas');
      
      QRCode.toCanvas(canvas, data, {
        width: this.options.qrCodeSize,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: this.options.qrErrorCorrectionLevel
      }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(canvas.toDataURL());
        }
      });
    });
  }
  
  /**
   * 处理扫描结果
   */
  async _handleQRScanResult(result) {
    try {
      this._log('QR code scanned:', result.data.substring(0, 50) + '...');
      
      const pairData = await this._parsePairData(result.data);
      
      if (pairData.type === 'lanbeam-offer') {
        this.currentOffer = pairData;
        this.emit('offerScanned', {
          data: pairData,
          sdp: pairData.sdp,
          deviceId: pairData.deviceId
        });
      } else if (pairData.type === 'lanbeam-answer') {
        this.currentAnswer = pairData;
        this.emit('answerScanned', {
          data: pairData,
          sdp: pairData.sdp,
          deviceId: pairData.deviceId,
          replyTo: pairData.replyTo
        });
      } else {
        throw new Error('Invalid pair data type');
      }
      
    } catch (error) {
      this._log('Failed to parse QR data:', error);
      this.emit('scanError', error);
    }
  }
  
  /**
   * 解析配对数据
   */
  async _parsePairData(data) {
    try {
      // 尝试解压缩
      let jsonString = data;
      if (this.options.compression && this._isCompressed(data)) {
        jsonString = await this._decompressData(data);
      }
      
      const pairData = JSON.parse(jsonString);
      
      // 验证数据格式
      if (!pairData.type || !pairData.version || !pairData.sdp) {
        throw new Error('Invalid pair data format');
      }
      
      if (!pairData.type.startsWith('lanbeam-')) {
        throw new Error('Unknown pair data type');
      }
      
      // 检查版本兼容性
      if (pairData.version !== '1.0') {
        this._log('Warning: Version mismatch:', pairData.version);
      }
      
      // 检查时间戳（防止重放攻击）
      const now = Date.now();
      const age = now - (pairData.timestamp || 0);
      const maxAge = 10 * 60 * 1000; // 10分钟
      
      if (age > maxAge) {
        this._log('Warning: Old pair data:', age / 1000, 'seconds');
      }
      
      return pairData;
      
    } catch (error) {
      throw new Error(`Failed to parse pair data: ${error.message}`);
    }
  }
  
  /**
   * 压缩数据
   */
  async _compressData(data) {
    try {
      // 简单的 base64 + 压缩标记
      const compressed = btoa(data);
      return 'LZ:' + compressed; // 添加压缩标记
    } catch (error) {
      this._log('Compression failed:', error);
      return data;
    }
  }
  
  /**
   * 解压缩数据
   */
  async _decompressData(data) {
    try {
      if (data.startsWith('LZ:')) {
        return atob(data.substring(3));
      }
      return data;
    } catch (error) {
      this._log('Decompression failed:', error);
      throw error;
    }
  }
  
  /**
   * 检查是否为压缩数据
   */
  _isCompressed(data) {
    return typeof data === 'string' && data.startsWith('LZ:');
  }
  
  /**
   * 获取设备ID
   */
  async _getDeviceId() {
    // 尝试从本地存储获取
    let deviceId = localStorage.getItem('lanbeam_device_id');
    
    if (!deviceId) {
      // 生成新的设备ID
      deviceId = this._generateDeviceId();
      localStorage.setItem('lanbeam_device_id', deviceId);
    }
    
    return deviceId;
  }
  
  /**
   * 生成设备ID
   */
  _generateDeviceId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }
  
  /**
   * 设置事件处理器
   */
  _setupEventHandlers() {
    // 处理页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.qrScanner) {
        this.qrScanner.pause();
      } else if (!document.hidden && this.qrScanner) {
        this.qrScanner.start();
      }
    });
    
    // 处理页面卸载
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }
  
  /**
   * 发出事件
   */
  emit(eventName, data) {
    this.dispatchEvent(new CustomEvent(eventName, { detail: data }));
  }
  
  /**
   * 调试日志
   */
  _log(...args) {
    if (this.options.debug) {
      console.log('[QRManualAdapter]', ...args);
    }
  }
}

// 导出工具函数
export const QRUtils = {
  /**
   * 检测二维码库支持
   */
  isQRSupported() {
    // 多种方式检测 QRCode 库
    const hasQRCode = (typeof QRCode !== 'undefined') || 
                      (typeof window.QRCode !== 'undefined') ||
                      (window.QRCode && typeof window.QRCode === 'function');
    
    // 多种方式检测 QrScanner 库
    const hasQrScanner = (typeof QrScanner !== 'undefined') || 
                         (typeof window.QrScanner !== 'undefined') ||
                         (window.QrScanner && typeof window.QrScanner === 'function');
    
    console.log('QR 库检测结果:');
    console.log('- QRCode 可用:', hasQRCode);
    console.log('- QrScanner 可用:', hasQrScanner);
    
    return hasQRCode && hasQrScanner;
  },
  
  /**
   * 检测摄像头支持
   */
  async isCameraSupported() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'videoinput');
    } catch (error) {
      return false;
    }
  },
  
  /**
   * 请求摄像头权限
   */
  async requestCameraPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // 立即停止流
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (error) {
      console.error('Camera permission denied:', error);
      return false;
    }
  },
  
  /**
   * 估算数据的二维码大小
   */
  estimateQRSize(data) {
    // 简单的估算公式
    const length = typeof data === 'string' ? data.length : JSON.stringify(data).length;
    
    if (length < 100) return 'small';
    if (length < 500) return 'medium';
    if (length < 1000) return 'large';
    return 'too-large';
  },
  
  /**
   * 生成分片二维码（用于大数据）
   */
  async generateChunkedQR(data, maxChunkSize = 1000) {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    
    if (dataString.length <= maxChunkSize) {
      return [dataString];
    }
    
    const chunks = [];
    const totalChunks = Math.ceil(dataString.length / maxChunkSize);
    const chunkId = Math.random().toString(36).substring(2, 8);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * maxChunkSize;
      const end = Math.min(start + maxChunkSize, dataString.length);
      const chunkData = dataString.substring(start, end);
      
      const chunkInfo = {
        id: chunkId,
        index: i,
        total: totalChunks,
        data: chunkData
      };
      
      chunks.push(JSON.stringify(chunkInfo));
    }
    
    return chunks;
  },
  
  /**
   * 重组分片数据
   */
  reassembleChunks(chunks) {
    // 按 ID 分组
    const groups = new Map();
    
    for (const chunk of chunks) {
      const chunkInfo = JSON.parse(chunk);
      if (!groups.has(chunkInfo.id)) {
        groups.set(chunkInfo.id, []);
      }
      groups.get(chunkInfo.id)[chunkInfo.index] = chunkInfo;
    }
    
    // 重组每个组
    const results = [];
    
    for (const [id, chunkArray] of groups) {
      const firstChunk = chunkArray.find(c => c);
      if (!firstChunk || chunkArray.length !== firstChunk.total) {
        continue; // 不完整的组
      }
      
      let reassembled = '';
      for (let i = 0; i < firstChunk.total; i++) {
        if (!chunkArray[i]) {
          break; // 缺少分片
        }
        reassembled += chunkArray[i].data;
      }
      
      if (reassembled) {
        results.push(reassembled);
      }
    }
    
    return results;
  }
};
