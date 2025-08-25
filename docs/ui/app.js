/**
 * LanBeam Main Application
 * 
 * 主应用程序，负责协调各个模块和用户界面
 */

import { LanBeamConnection, ConnectionUtils } from '../core/connection.js';
import { FileTransferEngine, TransferUtils } from '../core/transfer.js';
import { QRManualAdapter, QRUtils } from '../adapters/qr-manual.js';
import { CryptoUtils } from '../core/crypto.js';

class LanBeamApp {
  constructor() {
    // 核心组件
    this.connection = null;
    this.transferEngine = null;
    this.qrAdapter = null;
    
    // 应用状态
    this.currentMode = null; // 'send' | 'receive'
    this.currentFiles = [];
    this.isTransferring = false;
    this.deviceInfo = null;
    this.initialized = false;
    
    // UI 元素引用
    this.elements = {};
    
    // 配置
    this.config = {
      debug: true,
      chunkSize: 64 * 1024, // 64KB
      maxBufferedAmount: 1024 * 1024, // 1MB
      connectionTimeout: 30000,
      qrCodeSize: 256
    };
  }
  
  /**
   * 初始化应用程序 - 公共方法
   */
  async init() {
    if (this.initialized) {
      console.log('⚠️ App already initialized, skipping...');
      return;
    }
    
    await this._initializeApp();
  }
  
  /**
   * 初始化应用程序
   */
  async _initializeApp() {
    console.log('🚀 Initializing LanBeam...');
    
    try {
      // 检查浏览器支持
      await this._checkBrowserSupport();
      
      // 初始化 UI 元素引用
      this._initializeElements();
      
      // 设置事件监听器
      this._setupEventListeners();
      
      // 初始化组件
      await this._initializeComponents();
      
      // 获取设备信息
      await this._initializeDeviceInfo();
      
      // 显示主界面
      this._showModeSelection();
      
      this.initialized = true;
      console.log('✅ LanBeam initialized successfully');
      this._showToast('success', 'LanBeam 已准备就绪！');
      
    } catch (error) {
      console.error('❌ Failed to initialize LanBeam:', error);
      this._showToast('error', `初始化失败: ${error.message}`);
      throw error; // Re-throw to prevent multiple initialization attempts
    }
  }
  
  /**
   * 检查浏览器支持
   */
  async _checkBrowserSupport() {
    const issues = [];
    
    // WebRTC 支持
    if (!ConnectionUtils.isSupported()) {
      issues.push('WebRTC 不受支持');
    }
    
    // Web Crypto API 支持
    if (!CryptoUtils.isSupported()) {
      issues.push('Web Crypto API 不受支持');
    }
    
    // File API 支持
    if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
      issues.push('File API 不受支持');
    }
    
    // QR 码支持 - 增加重试逻辑，但不作为必须条件
    console.log('检测 QR 库支持...');
    let qrSupported = QRUtils.isQRSupported();
    if (!qrSupported) {
      // 等待库加载完成后再检测
      console.log('QR 库未就绪，等待加载...');
      await new Promise(resolve => setTimeout(resolve, 500));
      qrSupported = QRUtils.isQRSupported();
    }
    
    if (!qrSupported) {
      console.warn('QR库详细状态:');
      console.warn('- QRCode类型:', typeof QRCode);
      console.warn('- QrScanner类型:', typeof QrScanner);
      console.warn('- window.QRCode类型:', typeof window.QRCode);
      console.warn('- window.QrScanner类型:', typeof window.QrScanner);
      console.warn('⚠️ QR 库未加载，将禁用二维码功能');
      // 不再将QR库作为必须条件，允许应用在没有QR功能的情况下运行
    }
    
    // 只有关键功能缺失时才抛出错误
    if (issues.length > 0) {
      throw new Error(`浏览器不兼容: ${issues.join(', ')}`);
    }
    
    console.log('✅ Browser compatibility check passed');
    if (!qrSupported) {
      console.log('⚠️ QR functionality disabled - manual input only');
    }
  }
  
  /**
   * 初始化 UI 元素引用
   */
  _initializeElements() {
    const elementIds = [
      'loading', 'connection-status', 'mode-selection', 'send-mode', 'receive-mode',
      'transfer-progress', 'transfer-complete', 'drop-zone', 'file-input', 'file-list',
      'selected-files', 'qr-display', 'qr-code', 'qr-scanner', 'qr-video', 'code-input',
      'manual-input-area', 'current-filename', 'file-size', 'progress-fill',
      'progress-percent', 'transfer-speed', 'eta', 'file-queue', 'queue-list',
      'total-files', 'total-size', 'avg-speed', 'error-toast', 'success-toast',
      'error-message', 'success-message'
    ];
    
    elementIds.forEach(id => {
      this.elements[id] = document.getElementById(id);
    });
    
    // 按钮引用
    this.elements.selectFiles = document.getElementById('select-files');
    this.elements.generateCode = document.getElementById('generate-code');
    this.elements.copyCode = document.getElementById('copy-code');
    this.elements.pasteCode = document.getElementById('paste-code');
    this.elements.connectManual = document.getElementById('connect-manual');
    this.elements.pauseTransfer = document.getElementById('pause-transfer');
    this.elements.cancelTransfer = document.getElementById('cancel-transfer');
    
    console.log('✅ UI elements initialized');
  }
  
  /**
   * 设置事件监听器
   */
  _setupEventListeners() {
    // 模式选择
    document.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        this._selectMode(mode);
      });
    });
    
    // 返回按钮
    document.querySelectorAll('.btn-back').forEach(btn => {
      btn.addEventListener('click', () => this._showModeSelection());
    });
    
    // 文件选择
    if (this.elements.selectFiles) {
      this.elements.selectFiles.addEventListener('click', () => {
        const fileInput = this.elements.fileInput || document.getElementById('file-input');
        if (fileInput) {
          fileInput.click();
        } else {
          console.error('File input element not found');
        }
      });
    }
    
    if (this.elements.fileInput) {
      this.elements.fileInput.addEventListener('change', (e) => {
        this._handleFileSelection(e.target.files);
      });
    }
    
    // 拖拽处理
    if (this.elements.dropZone) {
      this._setupDropZone();
    }
    
    // 生成配对码
    if (this.elements.generateCode) {
      this.elements.generateCode.addEventListener('click', () => {
        this._generatePairCode();
      });
    }
    
    // 复制配对码
    if (this.elements.copyCode) {
      this.elements.copyCode.addEventListener('click', () => {
        this._copyPairCode();
      });
    }
    
    // 粘贴配对码
    if (this.elements.pasteCode) {
      this.elements.pasteCode.addEventListener('click', () => {
        this._toggleManualInput();
      });
    }
    
    // 手动连接
    if (this.elements.connectManual) {
      this.elements.connectManual.addEventListener('click', () => {
        this._connectManual();
      });
    }
    
    // 传输控制
    if (this.elements.pauseTransfer) {
      this.elements.pauseTransfer.addEventListener('click', () => {
        this._toggleTransferPause();
      });
    }
    
    if (this.elements.cancelTransfer) {
      this.elements.cancelTransfer.addEventListener('click', () => {
        this._cancelTransfer();
      });
    }
    
    // 主题切换
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this._toggleTheme());
    }
    
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._handleEscape();
      }
    });
    
    console.log('✅ Event listeners setup complete');
  }
  
  /**
   * 初始化核心组件
   */
  async _initializeComponents() {
    // 检查QR库是否可用
    const qrSupported = QRUtils.isQRSupported();
    
    // 初始化 QR 适配器（即使QR库不可用也要初始化，以支持手动输入）
    this.qrAdapter = new QRManualAdapter({
      debug: this.config.debug,
      qrCodeSize: this.config.qrCodeSize,
      qrSupported: qrSupported
    });
    
    this._setupQRAdapterEvents();
    
    if (!qrSupported) {
      console.warn('⚠️ QR functionality disabled - using fallback mode');
    }
    
    console.log('✅ Components initialized');
  }
  
  /**
   * 初始化设备信息
   */
  async _initializeDeviceInfo() {
    try {
      const networkInfo = await ConnectionUtils.getLocalNetworkInfo();
      const deviceFingerprint = await CryptoUtils.generateDeviceFingerprint();
      
      this.deviceInfo = {
        id: deviceFingerprint,
        localIP: networkInfo.localIP,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timestamp: Date.now()
      };
      
      console.log('✅ Device info:', this.deviceInfo);
    } catch (error) {
      console.warn('⚠️ Failed to get device info:', error);
    }
  }
  
  /**
   * 设置 QR 适配器事件
   */
  _setupQRAdapterEvents() {
    this.qrAdapter.addEventListener('qrGenerated', (e) => {
      const { dataURL, copyText } = e.detail;
      this._displayQRCode(dataURL, copyText);
    });
    
    this.qrAdapter.addEventListener('offerScanned', (e) => {
      this._handleOfferScanned(e.detail);
    });
    
    this.qrAdapter.addEventListener('answerScanned', (e) => {
      this._handleAnswerScanned(e.detail);
    });
    
    this.qrAdapter.addEventListener('scanError', (e) => {
      this._showToast('error', `扫码失败: ${e.detail.message}`);
    });
  }
  
  /**
   * 选择模式
   */
  _selectMode(mode) {
    console.log('📱 Selecting mode:', mode);
    this.currentMode = mode;
    
    this._hideAllSections();
    
    if (mode === 'send') {
      this.elements['send-mode']?.classList.remove('hidden');
    } else if (mode === 'receive') {
      this.elements['receive-mode']?.classList.remove('hidden');
      this._startQRScanning();
    }
  }
  
  /**
   * 显示模式选择
   */
  _showModeSelection() {
    console.log('🏠 Showing mode selection');
    this.currentMode = null;
    this._hideAllSections();
    this.elements['mode-selection']?.classList.remove('hidden');
    
    // 清理资源
    this._cleanup();
  }
  
  /**
   * 隐藏所有区域
   */
  _hideAllSections() {
    const sections = [
      'mode-selection', 'send-mode', 'receive-mode', 
      'transfer-progress', 'transfer-complete'
    ];
    
    sections.forEach(id => {
      const element = this.elements[id];
      if (element) {
        element.classList.add('hidden');
      }
    });
  }
  
  /**
   * 设置拖拽区域
   */
  _setupDropZone() {
    const dropZone = this.elements.dropZone;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('dragover');
      });
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('dragover');
      });
    });
    
    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      this._handleFileSelection(files);
    });
    
    // 点击选择文件
    dropZone.addEventListener('click', () => {
      this.elements.fileInput.click();
    });
  }
  
  /**
   * 处理文件选择
   */
  _handleFileSelection(fileList) {
    const files = Array.from(fileList);
    console.log('📁 Files selected:', files.length);
    
    if (files.length === 0) return;
    
    this.currentFiles = files;
    this._displaySelectedFiles(files);
    
    // 显示已选择文件区域
    this.elements.selectedFiles?.classList.remove('hidden');
  }
  
  /**
   * 显示已选择的文件
   */
  _displaySelectedFiles(files) {
    const fileList = this.elements.fileList;
    if (!fileList) return;
    
    fileList.innerHTML = '';
    
    files.forEach((file, index) => {
      const li = document.createElement('li');
      li.className = 'file-item';
      li.innerHTML = `
        <i class="fas ${TransferUtils.getFileIcon(file.name, file.type)}"></i>
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-size">${TransferUtils.formatFileSize(file.size)}</div>
        </div>
        <button class="file-remove" onclick="app._removeFile(${index})">
          <i class="fas fa-times"></i>
        </button>
      `;
      fileList.appendChild(li);
    });
  }
  
  /**
   * 移除文件
   */
  _removeFile(index) {
    this.currentFiles.splice(index, 1);
    
    if (this.currentFiles.length === 0) {
      this.elements.selectedFiles?.classList.add('hidden');
    } else {
      this._displaySelectedFiles(this.currentFiles);
    }
  }
  
  /**
   * 生成配对码
   */
  async _generatePairCode() {
    try {
      console.log('🔗 Generating pair code...');
      this._showLoading('生成配对码中...');
      
      // 创建连接
      this.connection = new LanBeamConnection({
        debug: this.config.debug,
        connectionTimeout: this.config.connectionTimeout
      });
      
      this._setupConnectionEvents();
      
      // 创建 Offer
      const sdpOffer = await this.connection.createOffer();
      
      // 生成二维码
      await this.qrAdapter.generateOfferQR(sdpOffer);
      
      this._hideLoading();
      
    } catch (error) {
      console.error('❌ Failed to generate pair code:', error);
      this._hideLoading();
      this._showToast('error', `生成配对码失败: ${error.message}`);
    }
  }
  
  /**
   * 显示二维码
   */
  _displayQRCode(dataURL, copyText) {
    const qrCodeElement = this.elements.qrCode;
    if (qrCodeElement) {
      qrCodeElement.innerHTML = `<img src="${dataURL}" alt="配对二维码" />`;
    }
    
    this.elements.qrDisplay?.classList.remove('hidden');
    this._currentCopyText = copyText;
  }
  
  /**
   * 复制配对码
   */
  async _copyPairCode() {
    if (this._currentCopyText) {
      const success = await this.qrAdapter.copyToClipboard(this._currentCopyText);
      if (success) {
        this._showToast('success', '配对码已复制到剪贴板');
      } else {
        this._showToast('error', '复制失败');
      }
    }
  }
  
  /**
   * 开始二维码扫描
   */
  async _startQRScanning() {
    try {
      console.log('📷 Starting QR scanning...');
      
      const hasCamera = await QRUtils.isCameraSupported();
      if (!hasCamera) {
        this._showToast('warning', '未检测到摄像头，请使用手动输入');
        return;
      }
      
      const videoElement = this.elements.qrVideo;
      if (videoElement) {
        await this.qrAdapter.startScanning(videoElement);
      }
      
    } catch (error) {
      console.error('❌ Failed to start QR scanning:', error);
      this._showToast('error', `启动扫描失败: ${error.message}`);
    }
  }
  
  /**
   * 切换手动输入
   */
  _toggleManualInput() {
    const manualArea = this.elements.manualInputArea;
    if (manualArea) {
      manualArea.classList.toggle('hidden');
      
      if (!manualArea.classList.contains('hidden')) {
        this.elements.codeInput?.focus();
      }
    }
  }
  
  /**
   * 手动连接
   */
  async _connectManual() {
    try {
      const code = this.elements.codeInput?.value.trim();
      if (!code) {
        this._showToast('error', '请输入配对码');
        return;
      }
      
      console.log('🔗 Manual connection...');
      this._showLoading('连接中...');
      
      await this.qrAdapter.handleManualCode(code);
      
    } catch (error) {
      console.error('❌ Manual connection failed:', error);
      this._hideLoading();
      this._showToast('error', `连接失败: ${error.message}`);
    }
  }
  
  /**
   * 处理扫描到的 Offer
   */
  async _handleOfferScanned(detail) {
    try {
      console.log('📥 Offer scanned from device:', detail.deviceId);
      this._showLoading('处理配对请求...');
      
      // 创建连接
      this.connection = new LanBeamConnection({
        debug: this.config.debug,
        connectionTimeout: this.config.connectionTimeout
      });
      
      this._setupConnectionEvents();
      
      // 处理 Offer 并创建 Answer
      const sdpAnswer = await this.connection.handleOffer(detail.sdp);
      
      // 生成应答二维码
      await this.qrAdapter.generateAnswerQR(sdpAnswer);
      
      // 停止扫描
      await this.qrAdapter.stopScanning();
      
      this._hideLoading();
      this._showToast('success', '请扫描应答码给发送方');
      
    } catch (error) {
      console.error('❌ Failed to handle offer:', error);
      this._hideLoading();
      this._showToast('error', `处理配对请求失败: ${error.message}`);
    }
  }
  
  /**
   * 处理扫描到的 Answer
   */
  async _handleAnswerScanned(detail) {
    try {
      console.log('📥 Answer scanned from device:', detail.deviceId);
      this._showLoading('建立连接...');
      
      if (!this.connection) {
        throw new Error('No active connection');
      }
      
      // 处理 Answer
      await this.connection.handleAnswer(detail.sdp);
      
      this._hideLoading();
      
    } catch (error) {
      console.error('❌ Failed to handle answer:', error);
      this._hideLoading();
      this._showToast('error', `建立连接失败: ${error.message}`);
    }
  }
  
  /**
   * 设置连接事件
   */
  _setupConnectionEvents() {
    if (!this.connection) return;
    
    this.connection.addEventListener('connected', (e) => {
      console.log('🔗 Connected to peer');
      this._onConnectionEstablished(e.detail);
    });
    
    this.connection.addEventListener('disconnected', () => {
      console.log('💔 Disconnected from peer');
      this._onConnectionLost();
    });
    
    this.connection.addEventListener('error', (e) => {
      console.error('💥 Connection error:', e.detail);
      this._showToast('error', `连接错误: ${e.detail.message}`);
    });
    
    this.connection.addEventListener('stateChange', (e) => {
      this._updateConnectionStatus(e.detail.newState);
    });
  }
  
  /**
   * 连接建立后的处理
   */
  _onConnectionEstablished(detail) {
    this._showToast('success', '连接建立成功！');
    
    // 初始化传输引擎
    this.transferEngine = new FileTransferEngine(this.connection, {
      debug: this.config.debug,
      chunkSize: this.config.chunkSize,
      maxBufferedAmount: this.config.maxBufferedAmount
    });
    
    this._setupTransferEvents();
    
    // 如果是发送模式，开始发送文件
    if (this.currentMode === 'send' && this.currentFiles.length > 0) {
      this._startFileSending();
    }
    
    // 更新 UI 状态
    this._updateConnectionStatus('connected');
    this._hideLoading();
  }
  
  /**
   * 连接丢失处理
   */
  _onConnectionLost() {
    this._showToast('warning', '连接已断开');
    this._updateConnectionStatus('disconnected');
    
    if (this.isTransferring) {
      this._showToast('error', '传输已中断');
    }
  }
  
  /**
   * 设置传输引擎事件
   */
  _setupTransferEvents() {
    if (!this.transferEngine) return;
    
    // 发送方事件
    this.transferEngine.addEventListener('transferStart', (e) => {
      this._showTransferProgress('发送', e.detail);
    });
    
    this.transferEngine.addEventListener('progress', (e) => {
      this._updateTransferProgress(e.detail);
    });
    
    this.transferEngine.addEventListener('transferComplete', (e) => {
      this._showTransferComplete('发送', e.detail);
    });
    
    // 接收方事件
    this.transferEngine.addEventListener('receiveStart', (e) => {
      this._showTransferProgress('接收', e.detail);
    });
    
    this.transferEngine.addEventListener('receiveProgress', (e) => {
      this._updateTransferProgress(e.detail);
    });
    
    this.transferEngine.addEventListener('receiveComplete', (e) => {
      this._showTransferComplete('接收', e.detail);
    });
    
    this.transferEngine.addEventListener('fileReceiveComplete', (e) => {
      this._saveReceivedFile(e.detail.file);
    });
    
    // 错误事件
    this.transferEngine.addEventListener('transferError', (e) => {
      this._showToast('error', `传输失败: ${e.detail.message}`);
    });
  }
  
  /**
   * 开始发送文件
   */
  async _startFileSending() {
    try {
      console.log('📤 Starting file transfer...');
      this.isTransferring = true;
      
      await this.transferEngine.sendFiles(this.currentFiles);
      
    } catch (error) {
      console.error('❌ File transfer failed:', error);
      this.isTransferring = false;
      this._showToast('error', `发送失败: ${error.message}`);
    }
  }
  
  /**
   * 显示传输进度界面
   */
  _showTransferProgress(type, detail) {
    console.log(`📊 ${type} progress started:`, detail);
    
    this._hideAllSections();
    this.elements.transferProgress?.classList.remove('hidden');
    
    // 更新标题
    const titleElement = document.getElementById('transfer-title');
    if (titleElement) {
      titleElement.textContent = `文件${type}中`;
    }
    
    // 更新文件信息
    if (detail.files && detail.files.length > 0) {
      const firstFile = detail.files[0];
      this._updateFileInfo(firstFile.name, firstFile.size);
    }
  }
  
  /**
   * 更新传输进度
   */
  _updateTransferProgress(progress) {
    // 更新当前文件信息
    if (progress.fileName) {
      this._updateFileInfo(progress.fileName, progress.fileSize);
    }
    
    // 更新进度条
    if (this.elements.progressFill) {
      this.elements.progressFill.style.width = `${progress.percentage}%`;
    }
    
    // 更新统计信息
    if (this.elements.progressPercent) {
      this.elements.progressPercent.textContent = `${Math.round(progress.percentage)}%`;
    }
    
    if (this.elements.transferSpeed) {
      this.elements.transferSpeed.textContent = TransferUtils.formatSpeed(progress.currentSpeed);
    }
    
    if (this.elements.eta) {
      this.elements.eta.textContent = TransferUtils.formatETA(progress.eta);
    }
  }
  
  /**
   * 更新文件信息
   */
  _updateFileInfo(fileName, fileSize) {
    if (this.elements.currentFilename) {
      this.elements.currentFilename.textContent = fileName;
    }
    
    if (this.elements.fileSize) {
      this.elements.fileSize.textContent = TransferUtils.formatFileSize(fileSize);
    }
    
    // 更新文件图标
    const fileIcon = document.getElementById('file-icon');
    if (fileIcon) {
      fileIcon.className = `fas ${TransferUtils.getFileIcon(fileName)}`;
    }
  }
  
  /**
   * 显示传输完成界面
   */
  _showTransferComplete(type, detail) {
    console.log(`✅ ${type} complete:`, detail);
    
    this.isTransferring = false;
    this._hideAllSections();
    this.elements.transferComplete?.classList.remove('hidden');
    
    // 更新统计信息
    if (this.elements.totalFiles) {
      this.elements.totalFiles.textContent = this.currentFiles.length.toString();
    }
    
    if (this.elements.totalSize) {
      this.elements.totalSize.textContent = TransferUtils.formatFileSize(detail.stats.totalBytes);
    }
    
    if (this.elements.avgSpeed) {
      this.elements.avgSpeed.textContent = TransferUtils.formatSpeed(detail.stats.averageSpeed);
    }
    
    this._showToast('success', `文件${type}完成！`);
  }
  
  /**
   * 保存接收的文件
   */
  async _saveReceivedFile(file) {
    try {
      console.log('💾 Saving received file:', file.name);
      
      // 如果支持 File System Access API，直接保存
      if ('showSaveFilePicker' in window) {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: file.name,
          types: [{
            description: '所有文件',
            accept: { '*/*': ['.*'] }
          }]
        });
        
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();
        
        this._showToast('success', `文件已保存: ${file.name}`);
      } else {
        // 降级方案：创建下载链接
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this._showToast('success', `开始下载: ${file.name}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to save file:', error);
      this._showToast('error', `保存文件失败: ${error.message}`);
    }
  }
  
  /**
   * 切换传输暂停/恢复
   */
  _toggleTransferPause() {
    if (!this.transferEngine) return;
    
    if (this.transferEngine.isPaused) {
      this.transferEngine.resume();
      this.elements.pauseTransfer.innerHTML = '<i class="fas fa-pause"></i> 暂停';
      this._showToast('success', '传输已恢复');
    } else {
      this.transferEngine.pause();
      this.elements.pauseTransfer.innerHTML = '<i class="fas fa-play"></i> 恢复';
      this._showToast('warning', '传输已暂停');
    }
  }
  
  /**
   * 取消传输
   */
  _cancelTransfer() {
    if (this.transferEngine) {
      this.transferEngine.cancel();
      this.isTransferring = false;
      this._showToast('warning', '传输已取消');
      this._showModeSelection();
    }
  }
  
  /**
   * 更新连接状态
   */
  _updateConnectionStatus(state) {
    const statusElement = this.elements.connectionStatus?.querySelector('.status-indicator');
    if (!statusElement) return;
    
    const statusText = statusElement.querySelector('span');
    const statusIcon = statusElement.querySelector('i');
    
    statusElement.className = 'status-indicator';
    
    switch (state) {
      case 'connected':
        statusElement.classList.add('connected');
        statusText.textContent = '已连接';
        statusIcon.className = 'fas fa-circle';
        break;
      case 'connecting':
        statusElement.classList.add('connecting');
        statusText.textContent = '连接中';
        statusIcon.className = 'fas fa-spinner fa-spin';
        break;
      case 'disconnected':
      case 'failed':
      case 'closed':
        statusElement.classList.add('offline');
        statusText.textContent = '离线模式';
        statusIcon.className = 'fas fa-circle';
        break;
    }
  }
  
  /**
   * 显示加载界面
   */
  _showLoading(message = '加载中...') {
    const loading = this.elements.loading;
    if (loading) {
      loading.querySelector('p').textContent = message;
      loading.classList.remove('hidden');
    }
  }
  
  /**
   * 隐藏加载界面
   */
  _hideLoading() {
    this.elements.loading?.classList.add('hidden');
  }
  
  /**
   * 显示提示消息
   */
  _showToast(type, message, duration = 3000) {
    const toastElement = this.elements[type + 'Toast'];
    const messageElement = this.elements[type + 'Message'];
    
    if (toastElement && messageElement) {
      messageElement.textContent = message;
      toastElement.classList.remove('hidden');
      
      setTimeout(() => {
        toastElement.classList.add('hidden');
      }, duration);
    }
    
    console.log(`🍞 Toast [${type}]:`, message);
  }
  
  /**
   * 隐藏提示消息
   */
  hideToast() {
    ['error', 'success'].forEach(type => {
      this.elements[type + 'Toast']?.classList.add('hidden');
    });
  }
  
  /**
   * 切换主题
   */
  _toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('lanbeam-theme', newTheme);
    
    const themeIcon = document.querySelector('#theme-toggle i');
    if (themeIcon) {
      themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
  }
  
  /**
   * 处理 Escape 键
   */
  _handleEscape() {
    // 隐藏提示消息
    this.hideToast();
    
    // 如果在传输中，询问是否取消
    if (this.isTransferring) {
      if (confirm('确定要取消传输吗？')) {
        this._cancelTransfer();
      }
    }
  }
  
  /**
   * 重置应用
   */
  resetApp() {
    this._cleanup();
    this._showModeSelection();
    this.currentFiles = [];
    this._showToast('success', '已重置，可以开始新的传输');
  }
  
  /**
   * 清理资源
   */
  _cleanup() {
    // 停止传输
    if (this.transferEngine) {
      this.transferEngine.cancel();
      this.transferEngine = null;
    }
    
    // 关闭连接
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    
    // 清理 QR 适配器
    if (this.qrAdapter) {
      this.qrAdapter.cleanup();
    }
    
    this.isTransferring = false;
  }
}

// 全局函数
window.showModeSelection = () => app._showModeSelection();
window.resetApp = () => app.resetApp();
window.showHelp = () => {
  window.open('https://github.com/your-username/LanBeam#使用指南', '_blank');
};
window.hideToast = () => app.hideToast();

// 初始化应用
const app = new LanBeamApp();
window.app = app; // 用于调试

// PWA 安装提示
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // 显示安装提示（可选）
  console.log('💡 PWA installation available');
});

window.addEventListener('appinstalled', () => {
  console.log('✅ PWA installed successfully');
  deferredPrompt = null;
});

// 主题初始化
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('lanbeam-theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  const themeIcon = document.querySelector('#theme-toggle i');
  if (themeIcon) {
    themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
});

console.log('🚀 LanBeam application loaded');

// 导出 LanBeamApp 类
export { LanBeamApp };
