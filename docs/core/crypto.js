/**
 * Cryptography Utilities
 * 
 * 提供文件校验、数据加密等安全功能
 */

export class LanBeamCrypto {
  constructor() {
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
  }
  
  /**
   * 计算文件的 SHA-256 哈希值
   * @param {File|Blob|ArrayBuffer} data - 要计算哈希的数据
   * @returns {Promise<string>} 十六进制哈希字符串
   */
  async calculateSHA256(data) {
    let buffer;
    
    if (data instanceof File || data instanceof Blob) {
      buffer = await data.arrayBuffer();
    } else if (data instanceof ArrayBuffer) {
      buffer = data;
    } else {
      throw new Error('Unsupported data type for SHA-256 calculation');
    }
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  }
  
  /**
   * 计算数据的 CRC32 校验和
   * @param {ArrayBuffer|Uint8Array} data - 要计算校验和的数据
   * @returns {Promise<number>} CRC32 校验和
   */
  async calculateCRC32(data) {
    let bytes;
    
    if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      bytes = data;
    } else {
      throw new Error('Unsupported data type for CRC32 calculation');
    }
    
    // CRC32 查找表
    if (!this._crc32Table) {
      this._crc32Table = this._makeCRC32Table();
    }
    
    let crc = 0 ^ (-1);
    
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ this._crc32Table[(crc ^ bytes[i]) & 0xFF];
    }
    
    return (crc ^ (-1)) >>> 0;
  }
  
  /**
   * 生成随机的会话密钥
   * @param {number} length - 密钥长度（字节）
   * @returns {Uint8Array} 随机密钥
   */
  generateSessionKey(length = 32) {
    return crypto.getRandomValues(new Uint8Array(length));
  }
  
  /**
   * 使用 AES-GCM 加密数据
   * @param {ArrayBuffer|Uint8Array} data - 要加密的数据
   * @param {Uint8Array} key - 加密密钥
   * @returns {Promise<Object>} 包含加密数据和 IV 的对象
   */
  async encryptAES(data, key) {
    // 生成随机 IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // 导入密钥
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    // 加密数据
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      data
    );
    
    return {
      data: encrypted,
      iv: iv
    };
  }
  
  /**
   * 使用 AES-GCM 解密数据
   * @param {ArrayBuffer} encryptedData - 加密的数据
   * @param {Uint8Array} key - 解密密钥
   * @param {Uint8Array} iv - 初始化向量
   * @returns {Promise<ArrayBuffer>} 解密后的数据
   */
  async decryptAES(encryptedData, key, iv) {
    // 导入密钥
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    // 解密数据
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      encryptedData
    );
    
    return decrypted;
  }
  
  /**
   * 生成 ECDH 密钥对
   * @returns {Promise<Object>} 包含公钥和私钥的对象
   */
  async generateECDHKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      ['deriveKey']
    );
    
    // 导出公钥
    const publicKeyData = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    
    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      publicKeyData: new Uint8Array(publicKeyData)
    };
  }
  
  /**
   * 使用 ECDH 派生共享密钥
   * @param {CryptoKey} privateKey - 本地私钥
   * @param {ArrayBuffer|Uint8Array} remotePublicKeyData - 远程公钥数据
   * @returns {Promise<CryptoKey>} 派生的共享密钥
   */
  async deriveSharedKey(privateKey, remotePublicKeyData) {
    // 导入远程公钥
    const remotePublicKey = await crypto.subtle.importKey(
      'raw',
      remotePublicKeyData,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      []
    );
    
    // 派生共享密钥
    const sharedKey = await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: remotePublicKey
      },
      privateKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );
    
    return sharedKey;
  }
  
  /**
   * 生成数字签名
   * @param {ArrayBuffer|Uint8Array} data - 要签名的数据
   * @param {CryptoKey} privateKey - 签名私钥
   * @returns {Promise<ArrayBuffer>} 数字签名
   */
  async sign(data, privateKey) {
    const signature = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      privateKey,
      data
    );
    
    return signature;
  }
  
  /**
   * 验证数字签名
   * @param {ArrayBuffer|Uint8Array} data - 原始数据
   * @param {ArrayBuffer} signature - 数字签名
   * @param {CryptoKey} publicKey - 验证公钥
   * @returns {Promise<boolean>} 签名是否有效
   */
  async verify(data, signature, publicKey) {
    const isValid = await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      publicKey,
      signature,
      data
    );
    
    return isValid;
  }
  
  /**
   * 安全地比较两个数组
   * @param {Uint8Array} a - 数组 A
   * @param {Uint8Array} b - 数组 B
   * @returns {boolean} 是否相等
   */
  constantTimeCompare(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    
    return result === 0;
  }
  
  /**
   * 将字节数组转换为十六进制字符串
   * @param {Uint8Array} bytes - 字节数组
   * @returns {string} 十六进制字符串
   */
  bytesToHex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * 将十六进制字符串转换为字节数组
   * @param {string} hex - 十六进制字符串
   * @returns {Uint8Array} 字节数组
   */
  hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
  
  /**
   * Base64 编码
   * @param {ArrayBuffer|Uint8Array} data - 要编码的数据
   * @returns {string} Base64 字符串
   */
  toBase64(data) {
    let bytes;
    if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else {
      bytes = data;
    }
    
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
  }
  
  /**
   * Base64 解码
   * @param {string} base64 - Base64 字符串
   * @returns {Uint8Array} 解码后的字节数组
   */
  fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    return bytes;
  }
  
  /**
   * 压缩数据（简单的 gzip 实现）
   * @param {ArrayBuffer|Uint8Array} data - 要压缩的数据
   * @returns {Promise<Uint8Array>} 压缩后的数据
   */
  async compress(data) {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    const chunks = [];
    
    // 启动读取
    const readPromise = (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
    })();
    
    // 写入数据
    await writer.write(data);
    await writer.close();
    
    // 等待读取完成
    await readPromise;
    
    // 合并所有块
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  }
  
  /**
   * 解压缩数据
   * @param {ArrayBuffer|Uint8Array} compressedData - 压缩的数据
   * @returns {Promise<Uint8Array>} 解压后的数据
   */
  async decompress(compressedData) {
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    const chunks = [];
    
    // 启动读取
    const readPromise = (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
    })();
    
    // 写入数据
    await writer.write(compressedData);
    await writer.close();
    
    // 等待读取完成
    await readPromise;
    
    // 合并所有块
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  }
  
  // ===== 私有方法 =====
  
  /**
   * 生成 CRC32 查找表
   */
  _makeCRC32Table() {
    const table = [];
    
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    
    return table;
  }
}

// 导出密码学工具函数
export const CryptoUtils = {
  /**
   * 检测 Web Crypto API 支持
   */
  isSupported() {
    // 检查基本的 crypto 对象
    if (typeof crypto === 'undefined') {
      console.warn('crypto 对象不存在');
      return false;
    }
    
    // 检查 subtle 属性
    if (typeof crypto.subtle === 'undefined') {
      console.warn('crypto.subtle 不存在 - 可能需要 HTTPS');
      return false;
    }
    
    // 检查协议 - Web Crypto API 在 HTTP 下不可用（除了 localhost）
    const isSecureContext = window.isSecureContext || 
                           location.protocol === 'https:' || 
                           location.hostname === 'localhost' ||
                           location.hostname === '127.0.0.1';
    
    if (!isSecureContext) {
      console.warn('Web Crypto API 需要安全上下文 (HTTPS)');
      return false;
    }
    
    return true;
  },
  
  /**
   * 生成安全随机字符串
   * @param {number} length - 字符串长度
   * @returns {string} 随机字符串
   */
  generateRandomString(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomValues = crypto.getRandomValues(new Uint8Array(length));
    
    return Array.from(randomValues, byte => chars[byte % chars.length]).join('');
  },
  
  /**
   * 生成设备指纹
   * @returns {Promise<string>} 设备指纹哈希
   */
  async generateDeviceFingerprint() {
    const data = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory || 0,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      timestamp: Math.floor(Date.now() / (1000 * 60 * 60)) // 小时级精度
    };
    
    const crypto = new LanBeamCrypto();
    const dataString = JSON.stringify(data);
    const hash = await crypto.calculateSHA256(crypto.encoder.encode(dataString));
    
    return hash.substring(0, 16); // 返回前16个字符
  },
  
  /**
   * 验证文件完整性
   * @param {File} file - 文件对象
   * @param {string} expectedHash - 期望的哈希值
   * @returns {Promise<boolean>} 文件是否完整
   */
  async verifyFileIntegrity(file, expectedHash) {
    try {
      const crypto = new LanBeamCrypto();
      const actualHash = await crypto.calculateSHA256(file);
      return actualHash === expectedHash;
    } catch (error) {
      console.error('File integrity verification failed:', error);
      return false;
    }
  },
  
  /**
   * 安全地清除敏感数据
   * @param {Uint8Array} data - 要清除的数据
   */
  secureWipe(data) {
    if (data instanceof Uint8Array) {
      // 用随机数据覆写
      crypto.getRandomValues(data);
      // 再用零覆写
      data.fill(0);
    }
  }
};
