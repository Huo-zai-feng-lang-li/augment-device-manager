// 干净的启动脚本
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

console.log('🚀 启动Augment设备管理器...');

let mainWindow;

function createWindow() {
  console.log('📱 创建主窗口...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: 'Augment设备管理器',
    show: true
  });

  // 加载页面
  const htmlPath = path.join(__dirname, 'public/index.html');
  console.log('📄 加载页面:', htmlPath);
  
  mainWindow.loadFile(htmlPath);
  
  // 打开开发者工具
  mainWindow.webContents.openDevTools();
  
  console.log('✅ 窗口创建完成');
}

// 简单的IPC处理
ipcMain.handle('get-device-id-details', async () => {
  console.log('📡 收到设备ID详情请求');
  
  try {
    // 使用相对路径加载模块
    const { generateStableDeviceId, hasDeviceIdCache } = require('../shared/utils/stable-device-id');
    
    const stableDeviceId = await generateStableDeviceId();
    const hasCachedId = hasDeviceIdCache();
    
    const result = {
      success: true,
      stableDeviceId,
      deviceFingerprint: 'test-fingerprint-' + Date.now(),
      cursorTelemetry: {
        devDeviceId: 'test-cursor-id-' + Date.now(),
        machineId: 'test-machine-id',
        macMachineId: 'test-mac-machine-id',
        sessionId: 'test-session-id',
        sqmId: 'test-sqm-id'
      },
      hasCachedId,
      vmInfo: { isVM: false, type: 'physical' },
      systemInfo: {
        platform: process.platform,
        arch: process.arch,
        hostname: require('os').hostname(),
        username: require('os').userInfo().username,
        totalMemory: Math.round(require('os').totalmem() / 1024 / 1024 / 1024) + 'GB'
      },
      cleanupCapabilities: {
        stableId: true,
        fingerprint: true,
        cursorTelemetry: true,
        cache: hasCachedId
      }
    };
    
    console.log('✅ 设备ID详情获取成功');
    return result;
  } catch (error) {
    console.error('❌ 获取设备ID详情失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 应用事件
app.whenReady().then(() => {
  console.log('🎯 应用就绪');
  createWindow();
});

app.on('window-all-closed', () => {
  console.log('🔚 所有窗口已关闭');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

console.log('✅ 启动脚本加载完成');
