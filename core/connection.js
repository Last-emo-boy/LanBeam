/**
 * WebRTC DataChannel Connection Manager
 * 
 * 管理 P2P 连接的建立、维护和断开
 * 支持局域网直连，无需 STUN/TURN 服务器
 */

export class LanBeamConnection extends EventTarget {
  constructor(options = {}) {
    super();
    
    // 配置选项
    this.options = {
      // ICE 配置（局域网模式，不使用 STUN/TURN）
      iceServers: options.iceServers || [],
      // DataChannel 配置
      channelConfig: {
        ordered: true, // 有序传输
        maxPacketLifeTime: null, // 无超时
        maxRetransmits: 3, // 重传3次
        protocol: 'lanbeam-v1',
        negotiated: false,
        id: null,
        ...options.channelConfig
      },
      // 连接超时（毫秒）
      connectionTimeout: options.connectionTimeout || 30000,
      // ICE 收集超时（毫秒）
      iceGatheringTimeout: options.iceGatheringTimeout || 10000,
      // 调试模式
      debug: options.debug || false,
      ...options
    };
    
    // 连接状态
    this.state = 'disconnected'; // disconnected, connecting, connected, failed, closed
    this.isOfferer = false;
    
    // WebRTC 对象
    this.peerConnection = null;
    this.dataChannel = null;
    this.localDescription = null;
    this.remoteDescription = null;
    
    // 定时器
    this.connectionTimer = null;
    this.iceGatheringTimer = null;
    
    // 事件监听器
    this.eventListeners = new Map();
    
    this._setupEventHandlers();
    this._log('Connection manager initialized');
  }
  
  /**
   * 创建 Offer（发起方）
   * @returns {Promise<string>} SDP Offer 字符串
   */
  async createOffer() {
    try {
      this._log('Creating offer...');
      this.isOfferer = true;
      this._setState('connecting');
      
      await this._createPeerConnection();
      this._createDataChannel();
      
      // 创建 offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      this.localDescription = offer;
      
      // 等待 ICE 候选收集完成
      await this._waitForIceGathering();
      
      // 返回压缩的 SDP
      const compressedSdp = this._compressSdp(this.peerConnection.localDescription.sdp);
      this._log('Offer created successfully');
      
      this.emit('offerReady', {
        sdp: compressedSdp,
        type: 'offer'
      });
      
      return compressedSdp;
      
    } catch (error) {
      this._log('Failed to create offer:', error);
      this._setState('failed');
      throw error;
    }
  }
  
  /**
   * 处理 Offer 并创建 Answer（接收方）
   * @param {string} offerSdp - 压缩的 SDP Offer
   * @returns {Promise<string>} SDP Answer 字符串
   */
  async handleOffer(offerSdp) {
    try {
      this._log('Handling offer...');
      this.isOfferer = false;
      this._setState('connecting');
      
      await this._createPeerConnection();
      
      // 解压缩并设置远程描述
      const decompressedSdp = this._decompressSdp(offerSdp);
      const remoteOffer = {
        type: 'offer',
        sdp: decompressedSdp
      };
      
      await this.peerConnection.setRemoteDescription(remoteOffer);
      this.remoteDescription = remoteOffer;
      
      // 创建 answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.localDescription = answer;
      
      // 等待 ICE 候选收集完成
      await this._waitForIceGathering();
      
      // 返回压缩的 SDP
      const compressedSdp = this._compressSdp(this.peerConnection.localDescription.sdp);
      this._log('Answer created successfully');
      
      this.emit('answerReady', {
        sdp: compressedSdp,
        type: 'answer'
      });
      
      return compressedSdp;
      
    } catch (error) {
      this._log('Failed to handle offer:', error);
      this._setState('failed');
      throw error;
    }
  }
  
  /**
   * 处理 Answer（发起方）
   * @param {string} answerSdp - 压缩的 SDP Answer
   */
  async handleAnswer(answerSdp) {
    try {
      this._log('Handling answer...');
      
      if (!this.isOfferer || !this.peerConnection) {
        throw new Error('Invalid state for handling answer');
      }
      
      // 解压缩并设置远程描述
      const decompressedSdp = this._decompressSdp(answerSdp);
      const remoteAnswer = {
        type: 'answer',
        sdp: decompressedSdp
      };
      
      await this.peerConnection.setRemoteDescription(remoteAnswer);
      this.remoteDescription = remoteAnswer;
      
      this._log('Answer handled successfully');
      
    } catch (error) {
      this._log('Failed to handle answer:', error);
      this._setState('failed');
      throw error;
    }
  }
  
  /**
   * 发送数据
   * @param {*} data - 要发送的数据
   */
  send(data) {
    if (this.state !== 'connected' || !this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Connection not ready for sending data');
    }
    
    try {
      let message;
      if (typeof data === 'string') {
        message = data;
      } else {
        message = JSON.stringify(data);
      }
      
      this.dataChannel.send(message);
      this._log('Data sent:', message.length, 'bytes');
      
    } catch (error) {
      this._log('Failed to send data:', error);
      throw error;
    }
  }
  
  /**
   * 发送二进制数据
   * @param {ArrayBuffer|Uint8Array} data - 二进制数据
   */
  sendBinary(data) {
    if (this.state !== 'connected' || !this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Connection not ready for sending data');
    }
    
    try {
      this.dataChannel.send(data);
      this._log('Binary data sent:', data.byteLength, 'bytes');
      
    } catch (error) {
      this._log('Failed to send binary data:', error);
      throw error;
    }
  }
  
  /**
   * 获取连接统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStats() {
    if (!this.peerConnection) {
      return null;
    }
    
    try {
      const stats = await this.peerConnection.getStats();
      const result = {
        connection: {},
        dataChannel: {},
        candidate: {}
      };
      
      stats.forEach((report) => {
        if (report.type === 'data-channel') {
          result.dataChannel = {
            state: report.state,
            bytesReceived: report.bytesReceived || 0,
            bytesSent: report.bytesSent || 0,
            messagesReceived: report.messagesReceived || 0,
            messagesSent: report.messagesSent || 0
          };
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          result.connection = {
            bytesReceived: report.bytesReceived || 0,
            bytesSent: report.bytesSent || 0,
            rtt: report.currentRoundTripTime || 0,
            availableOutgoingBitrate: report.availableOutgoingBitrate || 0
          };
        } else if (report.type === 'local-candidate' && report.candidateType === 'host') {
          result.candidate.local = {
            ip: report.ip,
            port: report.port,
            protocol: report.protocol
          };
        }
      });
      
      return result;
      
    } catch (error) {
      this._log('Failed to get stats:', error);
      return null;
    }
  }
  
  /**
   * 获取缓冲区信息
   * @returns {Object} 缓冲区状态
   */
  getBufferedAmount() {
    if (!this.dataChannel) {
      return { bufferedAmount: 0, bufferedAmountLowThreshold: 0 };
    }
    
    return {
      bufferedAmount: this.dataChannel.bufferedAmount,
      bufferedAmountLowThreshold: this.dataChannel.bufferedAmountLowThreshold
    };
  }
  
  /**
   * 设置缓冲区低水位阈值
   * @param {number} threshold - 阈值（字节）
   */
  setBufferedAmountLowThreshold(threshold) {
    if (this.dataChannel) {
      this.dataChannel.bufferedAmountLowThreshold = threshold;
    }
  }
  
  /**
   * 关闭连接
   */
  close() {
    this._log('Closing connection...');
    this._setState('closed');
    
    // 清理定时器
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
    
    if (this.iceGatheringTimer) {
      clearTimeout(this.iceGatheringTimer);
      this.iceGatheringTimer = null;
    }
    
    // 关闭 DataChannel
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    
    // 关闭 PeerConnection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.emit('closed');
    this._log('Connection closed');
  }
  
  /**
   * 重新连接
   */
  async reconnect() {
    this._log('Reconnecting...');
    this.close();
    
    // 重置状态
    this.state = 'disconnected';
    this.localDescription = null;
    this.remoteDescription = null;
    
    this.emit('reconnecting');
  }
  
  // ===== 私有方法 =====
  
  /**
   * 创建 PeerConnection
   */
  async _createPeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    
    const config = {
      iceServers: this.options.iceServers,
      iceTransportPolicy: 'all',
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require'
    };
    
    this.peerConnection = new RTCPeerConnection(config);
    this._log('PeerConnection created with config:', config);
    
    // 设置事件监听器
    this.peerConnection.addEventListener('icecandidate', this._handleIceCandidate.bind(this));
    this.peerConnection.addEventListener('icegatheringstatechange', this._handleIceGatheringStateChange.bind(this));
    this.peerConnection.addEventListener('iceconnectionstatechange', this._handleIceConnectionStateChange.bind(this));
    this.peerConnection.addEventListener('connectionstatechange', this._handleConnectionStateChange.bind(this));
    this.peerConnection.addEventListener('datachannel', this._handleDataChannel.bind(this));
    
    // 设置连接超时
    this.connectionTimer = setTimeout(() => {
      if (this.state === 'connecting') {
        this._log('Connection timeout');
        this._setState('failed');
      }
    }, this.options.connectionTimeout);
  }
  
  /**
   * 创建 DataChannel（仅发起方）
   */
  _createDataChannel() {
    if (!this.isOfferer || !this.peerConnection) {
      return;
    }
    
    this.dataChannel = this.peerConnection.createDataChannel('lanbeam', this.options.channelConfig);
    this._setupDataChannelEvents(this.dataChannel);
    this._log('DataChannel created');
  }
  
  /**
   * 设置 DataChannel 事件
   */
  _setupDataChannelEvents(channel) {
    channel.addEventListener('open', () => {
      this._log('DataChannel opened');
      this._setState('connected');
      this.emit('connected', {
        channel: channel,
        isOfferer: this.isOfferer
      });
    });
    
    channel.addEventListener('close', () => {
      this._log('DataChannel closed');
      if (this.state !== 'closed') {
        this._setState('disconnected');
        this.emit('disconnected');
      }
    });
    
    channel.addEventListener('error', (event) => {
      this._log('DataChannel error:', event.error);
      this.emit('error', event.error);
    });
    
    channel.addEventListener('message', (event) => {
      this._log('DataChannel message received:', event.data.length || event.data.byteLength, 'bytes');
      this.emit('message', {
        data: event.data,
        isBinary: event.data instanceof ArrayBuffer
      });
    });
    
    channel.addEventListener('bufferedamountlow', () => {
      this._log('DataChannel buffer low');
      this.emit('bufferLow');
    });
  }
  
  /**
   * 等待 ICE 候选收集完成
   */
  _waitForIceGathering() {
    return new Promise((resolve, reject) => {
      if (this.peerConnection.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      
      // 设置超时
      this.iceGatheringTimer = setTimeout(() => {
        this._log('ICE gathering timeout');
        resolve(); // 即使超时也继续，使用已收集的候选
      }, this.options.iceGatheringTimeout);
      
      const handleStateChange = () => {
        if (this.peerConnection.iceGatheringState === 'complete') {
          if (this.iceGatheringTimer) {
            clearTimeout(this.iceGatheringTimer);
            this.iceGatheringTimer = null;
          }
          resolve();
        }
      };
      
      this.peerConnection.addEventListener('icegatheringstatechange', handleStateChange);
    });
  }
  
  /**
   * SDP 压缩（移除空白和注释）
   */
  _compressSdp(sdp) {
    return sdp
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('a=candidate') || line.includes('typ host'))
      .map(line => line.trim())
      .join('\n');
  }
  
  /**
   * SDP 解压缩
   */
  _decompressSdp(compressedSdp) {
    return compressedSdp;
  }
  
  /**
   * 设置事件处理器
   */
  _setupEventHandlers() {
    // Window 事件监听
    window.addEventListener('beforeunload', () => {
      this.close();
    });
    
    // 网络状态变化
    window.addEventListener('online', () => {
      this.emit('networkChange', { online: true });
    });
    
    window.addEventListener('offline', () => {
      this.emit('networkChange', { online: false });
    });
  }
  
  /**
   * 处理 ICE 候选
   */
  _handleIceCandidate(event) {
    if (event.candidate) {
      this._log('ICE candidate:', event.candidate.candidate);
      this.emit('iceCandidate', event.candidate);
    } else {
      this._log('ICE candidate gathering complete');
    }
  }
  
  /**
   * 处理 ICE 收集状态变化
   */
  _handleIceGatheringStateChange() {
    this._log('ICE gathering state:', this.peerConnection.iceGatheringState);
    this.emit('iceGatheringStateChange', this.peerConnection.iceGatheringState);
  }
  
  /**
   * 处理 ICE 连接状态变化
   */
  _handleIceConnectionStateChange() {
    const state = this.peerConnection.iceConnectionState;
    this._log('ICE connection state:', state);
    
    if (state === 'connected' || state === 'completed') {
      if (this.connectionTimer) {
        clearTimeout(this.connectionTimer);
        this.connectionTimer = null;
      }
    } else if (state === 'failed' || state === 'disconnected') {
      this._setState('failed');
    }
    
    this.emit('iceConnectionStateChange', state);
  }
  
  /**
   * 处理连接状态变化
   */
  _handleConnectionStateChange() {
    const state = this.peerConnection.connectionState;
    this._log('Connection state:', state);
    
    if (state === 'failed' || state === 'closed') {
      this._setState('failed');
    }
    
    this.emit('connectionStateChange', state);
  }
  
  /**
   * 处理传入的 DataChannel
   */
  _handleDataChannel(event) {
    if (!this.isOfferer) {
      this._log('DataChannel received');
      this.dataChannel = event.channel;
      this._setupDataChannelEvents(this.dataChannel);
    }
  }
  
  /**
   * 设置连接状态
   */
  _setState(newState) {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this._log('State changed:', oldState, '->', newState);
      this.emit('stateChange', {
        oldState,
        newState,
        timestamp: Date.now()
      });
    }
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
      console.log('[LanBeamConnection]', ...args);
    }
  }
}

// 导出工具函数
export const ConnectionUtils = {
  /**
   * 检测 WebRTC 支持
   */
  isSupported() {
    return typeof RTCPeerConnection !== 'undefined' && 
           typeof RTCDataChannel !== 'undefined';
  },
  
  /**
   * 获取本地网络信息
   */
  async getLocalNetworkInfo() {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      const dc = pc.createDataChannel('test');
      
      return new Promise((resolve) => {
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate;
            const match = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (match && match[1] && !match[1].startsWith('169.254')) {
              pc.close();
              resolve({
                localIP: match[1],
                supported: true
              });
            }
          }
        };
        
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        
        setTimeout(() => {
          pc.close();
          resolve({
            localIP: null,
            supported: true
          });
        }, 3000);
      });
    } catch (error) {
      return {
        localIP: null,
        supported: false,
        error: error.message
      };
    }
  },
  
  /**
   * 生成设备指纹
   */
  async generateDeviceFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('LanBeam Device Fingerprint', 2, 2);
    
    const fingerprint = {
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      canvas: canvas.toDataURL(),
      timestamp: Date.now()
    };
    
    // 生成简单的设备 ID
    const str = JSON.stringify(fingerprint);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为 32 位整数
    }
    
    return {
      id: Math.abs(hash).toString(36),
      fingerprint
    };
  }
};
