// 简化的Electron测试
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

console.log('🚀 启动简化的Electron测试...');

let mainWindow;

function createWindow() {
  console.log('📱 创建主窗口...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // 加载简单的HTML页面
  mainWindow.loadFile(path.join(__dirname, 'public/index.html'));
  
  console.log('✅ 主窗口创建完成');
}

// 测试IPC处理
ipcMain.handle("test-ipc", async () => {
  console.log('📡 收到IPC测试请求');
  return { success: true, message: "IPC正常工作" };
});

// 简化的设备ID详情功能
ipcMain.handle("get-device-id-details", async () => {
  console.log('📡 收到设备ID详情请求');
  
  try {
    return {
      success: true,
      stableDeviceId: "test-stable-id-" + Date.now(),
      deviceFingerprint: "test-fingerprint-" + Date.now(),
      cursorTelemetry: {
        devDeviceId: "test-cursor-id-" + Date.now(),
        machineId: "test-machine-id",
        macMachineId: "test-mac-machine-id",
        sessionId: "test-session-id",
        sqmId: "test-sqm-id"
      },
      hasCachedId: true,
      vmInfo: { isVM: false, type: "physical" },
      systemInfo: {
        platform: "win32",
        arch: "x64",
        hostname: "test-host",
        username: "test-user",
        totalMemory: "16GB"
      },
      cleanupCapabilities: {
        stableId: true,
        fingerprint: true,
        cursorTelemetry: true,
        cache: true
      }
    };
  } catch (error) {
    console.error('❌ 获取设备ID详情失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

app.whenReady().then(() => {
  console.log('🎯 Electron应用就绪');
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  console.log('🔚 所有窗口已关闭');
  if (process.platform !== 'darwin') app.quit();
});

console.log('✅ 主进程脚本加载完成');
