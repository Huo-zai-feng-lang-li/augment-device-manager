// 设置控制台编码
if (process.stdout && process.stdout.setEncoding) {
  process.stdout.setEncoding("utf8");
}
if (process.platform === "win32") {
  process.stdout.write("\x1b]0;Augment设备管理器客户端\x07");
}

// 引入所需模块
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Menu,
  Notification,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs-extra");
const os = require("os");
const WebSocket = require("ws");
const fetch = require("node-fetch");
const serverConfig = require("./config");

// 设置应用程序名称和元数据
app.setName("Augment设备管理器");
app.setAppUserModelId("com.augment.device-manager");

// Windows特定设置
if (process.platform === "win32") {
  // 设置应用程序用户模型ID
  app.setAppUserModelId("com.augment.device-manager");

  // 设置应用程序路径
  app.setPath(
    "userData",
    path.join(os.homedir(), "AppData", "Roaming", "Augment设备管理器")
  );
}

// 获取共享模块路径的辅助函数
function getSharedPath(relativePath) {
  if (app.isPackaged) {
    // 打包后的路径
    return path.join(process.resourcesPath, "shared", relativePath);
  } else {
    // 开发环境路径
    return path.join(__dirname, "../../../shared", relativePath);
  }
}

// 导入共享模块
const {
  generateDeviceFingerprint,
  validateActivationCode,
} = require(getSharedPath("crypto/encryption-simple"));
const DeviceManager = require("./device-manager");
const ServerDiscovery = require("./server-discovery");

let mainWindow;
let deviceManager;
let wsClient;

// 应用配置
const APP_CONFIG = {
  name: "Augment设备管理器",
  version: "1.0.0",
  configPath: path.join(os.homedir(), ".augment-device-manager"),
  configFile: "config.json",
};

// 创建主窗口
function createWindow() {
  console.log("🪟 开始创建主窗口...");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      zoomFactor: 1.0,
    },
    title: APP_CONFIG.name,
    resizable: true,
    minimizable: true,
    maximizable: true,
    icon: path.join(__dirname, "../public/logo.png"),
    show: false, // 先不显示，等加载完成后再显示
  });

  // 加载主页面
  mainWindow.loadFile(path.join(__dirname, "../public/index.html"));

  // 页面加载完成后显示窗口
  mainWindow.once("ready-to-show", () => {
    console.log("✅ 页面加载完成，显示窗口");
    mainWindow.show();

    // 如果是首次启动，居中显示
    if (!mainWindow.isMaximized()) {
      mainWindow.center();
    }
  });

  // 处理窗口缩放
  mainWindow.webContents.on("zoom-changed", (event, zoomDirection) => {
    const currentZoom = mainWindow.webContents.getZoomFactor();
    let newZoom = currentZoom;

    if (zoomDirection === "in") {
      newZoom = Math.min(currentZoom + 0.1, 2.0);
    } else if (zoomDirection === "out") {
      newZoom = Math.max(currentZoom - 0.1, 0.5);
    }

    mainWindow.webContents.setZoomFactor(newZoom);
  });

  // 开发模式下打开开发者工具
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }

  // 窗口关闭事件
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // 窗口最大化/还原事件
  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("window-maximized", true);
  });

  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("window-maximized", false);
  });
}

// 应用准备就绪
app.whenReady().then(() => {
  // 隐藏菜单栏
  Menu.setApplicationMenu(null);

  createWindow();
  initializeApp();

  // 初始化自动更新
  initializeAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// 初始化应用
async function initializeApp() {
  try {
    // 确保配置目录存在
    await fs.ensureDir(APP_CONFIG.configPath);

    // 尝试自动发现服务器（如果当前配置无法连接）
    await attemptServerDiscovery();

    // 初始化设备管理器
    deviceManager = new DeviceManager();

    // 初始化WebSocket连接
    initializeWebSocket();

    // 启动定期验证
    startPeriodicVerification();

    console.log("应用初始化完成");
  } catch (error) {
    console.error("应用初始化失败:", error);
  }
}

// 尝试服务器自动发现
async function attemptServerDiscovery() {
  try {
    // 首先测试当前配置是否可用
    const currentConfigWorks = await serverConfig.testConnection();

    if (currentConfigWorks) {
      console.log("✅ 当前服务器配置可用");
      return;
    }

    console.log("⚠️ 当前服务器配置无法连接，尝试自动发现...");

    // 创建服务器发现实例
    const discovery = new ServerDiscovery(serverConfig);

    // 尝试自动发现并更新配置
    const updated = await discovery.updateServerConfig(serverConfig);

    if (updated) {
      console.log("✅ 服务器配置已自动更新");

      // 通知渲染进程配置已更新
      if (mainWindow) {
        mainWindow.webContents.send("server-config-updated", {
          message: "服务器地址已自动更新",
          config: serverConfig.getConfig(),
        });
      }
    } else {
      console.log("❌ 未能自动发现可用的服务器");
    }
  } catch (error) {
    console.error("服务器自动发现失败:", error);
  }
}

// 启动定期验证激活状态
function startPeriodicVerification() {
  // 每5分钟验证一次激活状态
  setInterval(async () => {
    try {
      await verifyActivationWithServer();
    } catch (error) {
      console.error("定期验证失败:", error);
    }
  }, 5 * 60 * 1000); // 5分钟

  // 立即执行一次验证
  setTimeout(verifyActivationWithServer, 10000); // 10秒后首次验证
}

// 向服务器验证激活状态
async function verifyActivationWithServer() {
  try {
    const configPath = path.join(APP_CONFIG.configPath, APP_CONFIG.configFile);

    if (!(await fs.pathExists(configPath))) {
      return; // 没有激活信息，无需验证
    }

    const config = await fs.readJson(configPath);
    if (!config.activation) {
      return; // 没有激活信息
    }

    const deviceId = await generateDeviceFingerprint();

    // 向服务器验证
    const response = await fetch(
      serverConfig.getHttpUrl("/api/verify-activation"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: config.activation.code,
          deviceId: deviceId,
        }),
      }
    );

    const result = await response.json();

    if (!result.success || !result.valid) {
      console.log("服务器验证失败:", result.reason);

      // 清除本地激活信息
      await clearLocalActivation();

      // 通知渲染进程
      if (mainWindow) {
        mainWindow.webContents.send("activation-invalid", {
          reason: result.reason || "服务器验证失败",
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      console.log("激活状态验证通过");
    }
  } catch (error) {
    console.error("服务器验证激活状态失败:", error);
    // 网络错误不清除本地激活信息，允许离线使用
  }
}

// WebSocket重连配置
let wsReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1秒

// WebSocket连接状态管理
let wsConnectionStatus = {
  connected: false,
  lastConnectedTime: null,
  lastDisconnectedTime: null,
  connectionAttempts: 0,
  isReconnecting: false,
};

// 初始化WebSocket连接
function initializeWebSocket() {
  try {
    const wsUrl = serverConfig.getWebSocketUrl();
    console.log("连接WebSocket服务器:", wsUrl);
    wsClient = new WebSocket(wsUrl);

    wsClient.on("open", async () => {
      console.log("WebSocket连接已建立");
      wsReconnectAttempts = 0; // 重置重连计数

      // 更新连接状态
      wsConnectionStatus.connected = true;
      wsConnectionStatus.lastConnectedTime = new Date();
      wsConnectionStatus.isReconnecting = false;

      // 通知渲染进程连接状态变化
      if (mainWindow) {
        mainWindow.webContents.send("websocket-status-changed", {
          connected: true,
          timestamp: wsConnectionStatus.lastConnectedTime.toISOString(),
        });
      }

      // 注册客户端
      try {
        const deviceId = await generateDeviceFingerprint();
        console.log("生成的设备ID:", deviceId);

        const registerMessage = {
          type: "register",
          deviceId: deviceId,
        };
        console.log("发送注册消息:", registerMessage);

        wsClient.send(JSON.stringify(registerMessage));
      } catch (error) {
        console.error("生成设备ID失败:", error);
        // 使用降级方案
        const fallbackId = require("crypto").randomBytes(32).toString("hex");
        const registerMessage = {
          type: "register",
          deviceId: fallbackId,
        };
        wsClient.send(JSON.stringify(registerMessage));
      }
    });

    wsClient.on("message", (data) => {
      try {
        const message = JSON.parse(data);
        handleServerMessage(message);
      } catch (error) {
        console.error("WebSocket消息解析错误:", error);
      }
    });

    wsClient.on("close", (code, reason) => {
      console.log(`WebSocket连接已断开 (code: ${code}, reason: ${reason})`);

      // 更新连接状态
      wsConnectionStatus.connected = false;
      wsConnectionStatus.lastDisconnectedTime = new Date();

      // 通知渲染进程连接状态变化
      if (mainWindow) {
        mainWindow.webContents.send("websocket-status-changed", {
          connected: false,
          timestamp: wsConnectionStatus.lastDisconnectedTime.toISOString(),
          reason: reason || `连接断开 (code: ${code})`,
        });
      }

      scheduleReconnect();
    });

    wsClient.on("error", (error) => {
      console.error("WebSocket连接错误:", error);

      // 更新连接状态
      wsConnectionStatus.connected = false;
      wsConnectionStatus.lastDisconnectedTime = new Date();

      // 通知渲染进程连接错误
      if (mainWindow) {
        mainWindow.webContents.send("websocket-status-changed", {
          connected: false,
          timestamp: wsConnectionStatus.lastDisconnectedTime.toISOString(),
          error: error.message || "WebSocket连接错误",
        });
      }
    });
  } catch (error) {
    console.error("WebSocket初始化失败:", error);
    scheduleReconnect();
  }
}

// 安排重连
function scheduleReconnect() {
  if (wsReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error("WebSocket重连次数已达上限，停止重连");
    wsConnectionStatus.isReconnecting = false;

    // 通知渲染进程重连失败
    if (mainWindow) {
      mainWindow.webContents.send("websocket-status-changed", {
        connected: false,
        reconnectFailed: true,
        timestamp: new Date().toISOString(),
        message: "WebSocket重连次数已达上限，请检查网络连接或服务器状态",
      });
    }
    return;
  }

  wsReconnectAttempts++;
  wsConnectionStatus.isReconnecting = true;
  wsConnectionStatus.connectionAttempts++;

  const delay = Math.min(
    INITIAL_RECONNECT_DELAY * Math.pow(2, wsReconnectAttempts - 1),
    30000
  ); // 最大30秒

  console.log(`${delay / 1000}秒后尝试第${wsReconnectAttempts}次重连...`);

  // 通知渲染进程正在重连
  if (mainWindow) {
    mainWindow.webContents.send("websocket-status-changed", {
      connected: false,
      isReconnecting: true,
      reconnectAttempt: wsReconnectAttempts,
      nextRetryIn: delay,
      timestamp: new Date().toISOString(),
    });
  }

  setTimeout(initializeWebSocket, delay);
}

// 处理服务器消息
function handleServerMessage(message) {
  console.log("收到服务器消息:", message);

  switch (message.type) {
    case "registered":
      console.log("客户端注册成功");
      break;

    case "command":
      handleServerCommand(message);
      break;

    case "notification":
      handleServerNotification(message);
      break;

    case "activation_revoked":
      handleActivationRevoked(message);
      break;

    case "activation_deleted":
      handleActivationDeleted(message);
      break;

    case "activation_disabled":
      handleActivationDisabled(message);
      break;

    case "activation_enabled":
      handleActivationEnabled(message);
      break;

    case "broadcast":
      handleBroadcastMessage(message);
      break;

    default:
      console.log("未知消息类型:", message.type);
  }
}

// 处理服务器命令
async function handleServerCommand(message) {
  const { command, data } = message;

  try {
    switch (command) {
      case "cleanup":
        console.log("执行设备清理命令");
        if (deviceManager) {
          const result = await deviceManager.performCleanup();
          sendResponseToServer("command_result", {
            command: "cleanup",
            success: result.success,
            result: result,
          });
        }
        break;

      case "reset_usage":
        console.log("执行重置使用计数命令");
        if (deviceManager) {
          const result = await deviceManager.resetUsageCount();
          sendResponseToServer("command_result", {
            command: "reset_usage",
            success: result.success,
            result: result,
          });
        }
        break;

      case "show_dialog":
        console.log("显示对话框命令");
        if (mainWindow) {
          const result = await dialog.showMessageBox(mainWindow, {
            type: data.type || "info",
            title: data.title || "通知",
            message: data.message || "",
            buttons: data.buttons || ["确定"],
          });
          sendResponseToServer("command_result", {
            command: "show_dialog",
            success: true,
            result: result,
          });
        }
        break;

      default:
        console.log("未知命令:", command);
    }
  } catch (error) {
    console.error("执行命令失败:", error);
    sendResponseToServer("command_result", {
      command: command,
      success: false,
      error: error.message,
    });
  }
}

// 处理服务器通知
function handleServerNotification(message) {
  const { title, message: content, notificationType } = message;

  // 发送通知给渲染进程
  if (mainWindow) {
    mainWindow.webContents.send("server-notification", {
      title: title,
      message: content,
      type: notificationType,
    });
  }
}

// 处理激活撤销消息
function handleActivationRevoked(message) {
  const { code, reason } = message;

  console.log(`激活码 ${code} 已被撤销: ${reason}`);

  // 清除本地激活信息
  clearLocalActivation();

  // 通知渲染进程
  if (mainWindow) {
    mainWindow.webContents.send("activation-revoked", {
      code: code,
      reason: reason,
      timestamp: message.timestamp,
    });
  }
}

// 处理激活删除消息
function handleActivationDeleted(message) {
  const { code } = message;

  console.log(`激活码 ${code} 已被删除`);

  // 清除本地激活信息
  clearLocalActivation();

  // 通知渲染进程
  if (mainWindow) {
    mainWindow.webContents.send("activation-deleted", {
      code: code,
      timestamp: message.timestamp,
    });
  }
}

// 处理激活禁用消息
function handleActivationDisabled(message) {
  const { reason } = message;

  console.log(`账户已被禁用: ${reason}`);

  // 清除本地激活信息
  clearLocalActivation();

  // 通知渲染进程
  if (mainWindow) {
    mainWindow.webContents.send("activation-disabled", {
      reason: reason,
      timestamp: message.timestamp,
    });
  }
}

// 处理激活启用消息
function handleActivationEnabled(message) {
  const { reason } = message;

  console.log(`账户已被启用: ${reason}`);

  // 通知渲染进程
  if (mainWindow) {
    mainWindow.webContents.send("activation-enabled", {
      reason: reason,
      timestamp: message.timestamp,
    });
  }
}

// 处理广播消息
function handleBroadcastMessage(message) {
  const { message: content, timestamp, from, isHistorical } = message;

  if (isHistorical) {
    console.log(`收到历史广播消息: ${content}`);
  } else {
    console.log(`收到广播消息: ${content}`);
  }

  // 通知渲染进程显示广播消息
  if (mainWindow) {
    mainWindow.webContents.send("broadcast-message", {
      message: content,
      timestamp: timestamp,
      from: from,
      isHistorical: isHistorical,
    });
  }

  // 只对非历史消息显示系统通知
  if (!isHistorical) {
    try {
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: "设备管理系统广播",
          body: content,
          icon: path.join(__dirname, "../public/logo.png"),
          silent: false,
          urgency: "normal",
          timeoutType: "default",
        });

        notification.show();
      }
    } catch (error) {
      console.log("系统通知显示失败:", error.message);
    }
  }
}

// 清除本地激活信息
async function clearLocalActivation() {
  try {
    const configPath = path.join(APP_CONFIG.configPath, APP_CONFIG.configFile);

    if (await fs.pathExists(configPath)) {
      await fs.remove(configPath);
      console.log("本地激活信息已清除");
    }
  } catch (error) {
    console.error("清除本地激活信息失败:", error);
  }
}

// 向服务器发送响应
function sendResponseToServer(type, data) {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(
      JSON.stringify({
        type: type,
        data: data,
        timestamp: new Date().toISOString(),
      })
    );
  }
}

// IPC 事件处理

// 获取设备信息（增强版）
ipcMain.handle("get-device-info", async () => {
  try {
    const deviceId = await generateDeviceFingerprint();

    // 获取CPU使用率（异步）
    const systemCpuUsage = await getSystemCPUUsage();
    const processCpuUsage = getProcessCPUUsage();

    // 获取内存使用情况（确保数值类型）
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    // 基础系统信息（确保所有值都可序列化）
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      username: os.userInfo().username,
      version: os.release(),
      release: os.release(),

      // 内存信息（转换为数字）
      totalMemory: Number(totalMemory),
      freeMemory: Number(freeMemory),
      memoryUsagePercent: Math.round(
        ((totalMemory - freeMemory) / totalMemory) * 100
      ),

      // CPU信息
      cpuModel: os.cpus()[0]?.model || "Unknown",
      cpuCores: os.cpus().length,
      cpuUsage: Number(systemCpuUsage) || 0,

      // 系统运行时间
      uptime: Number(os.uptime()),

      // Node.js版本
      nodeVersion: process.version,

      // 网络状态（简单检测）
      networkStatus: "已连接",

      // 磁盘使用率
      diskUsage: Number(await getDiskUsage()) || 0,
    };

    // 进程信息（确保所有值都可序列化）
    const processInfo = {
      pid: process.pid,
      memoryUsage: Number(memoryUsage.heapUsed),
      memoryTotal: Number(memoryUsage.heapTotal),
      memoryExternal: Number(memoryUsage.external),
      cpuUsage: Number(processCpuUsage) || 0,
    };

    return {
      success: true,
      deviceId: String(deviceId),
      systemInfo,
      processInfo,
    };
  } catch (error) {
    console.error("获取设备信息失败:", error);
    return {
      success: false,
      error: error.message,
      deviceId: "error-" + Date.now(),
    };
  }
});

// 获取详细设备ID信息
ipcMain.handle("get-device-id-details", async () => {
  console.log("📡 收到设备ID详情请求");
  try {
    const path = require("path");
    const fs = require("fs-extra");

    // 导入设备ID相关工具
    const { generateStableDeviceId, hasDeviceIdCache } = require(getSharedPath(
      "utils/stable-device-id"
    ));

    const DeviceDetection = require(getSharedPath("utils/device-detection"));

    // 1. 获取稳定设备ID
    const stableDeviceId = await generateStableDeviceId();
    const hasCachedId = hasDeviceIdCache();

    // 2. 获取设备指纹
    const detector = new DeviceDetection();
    const deviceFingerprint = await detector.generateFingerprint();

    // 3. 获取Cursor遥测ID
    let cursorTelemetry = null;
    try {
      const storageJsonPath = path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "globalStorage",
        "storage.json"
      );

      if (await fs.pathExists(storageJsonPath)) {
        const data = await fs.readJson(storageJsonPath);
        cursorTelemetry = {
          devDeviceId: data["telemetry.devDeviceId"],
          machineId: data["telemetry.machineId"],
          macMachineId: data["telemetry.macMachineId"],
          sessionId: data["telemetry.sessionId"],
          sqmId: data["telemetry.sqmId"],
        };
      }
    } catch (error) {
      console.warn("获取Cursor遥测ID失败:", error.message);
    }

    // 4. 虚拟机检测
    const vmInfo = await detector.detectVirtualMachine();

    // 5. 系统基础信息
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      username: os.userInfo().username,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + "GB",
    };

    const result = {
      success: true,
      stableDeviceId,
      deviceFingerprint,
      cursorTelemetry,
      hasCachedId,
      vmInfo,
      systemInfo,
      cleanupCapabilities: {
        stableId: true, // 稳定设备ID可清理
        fingerprint: true, // 设备指纹可重新生成
        cursorTelemetry: !!cursorTelemetry, // Cursor遥测ID可清理（如果存在）
        cache: hasCachedId, // 缓存可清理（如果存在）
      },
    };
    console.log("✅ 设备ID详情获取成功");
    return result;
  } catch (error) {
    console.error("获取设备ID详情失败:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

// 获取系统CPU使用率的辅助函数
async function getSystemCPUUsage() {
  try {
    // 获取CPU信息
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    // 计算使用率
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~((100 * idle) / total);

    return Math.max(0, Math.min(100, usage));
  } catch (error) {
    return 0;
  }
}

// 获取进程CPU使用率的辅助函数
function getProcessCPUUsage() {
  try {
    // 这是一个简化的实现，实际应用中可能需要更复杂的计算
    const usage = process.cpuUsage();
    const totalUsage = (usage.user + usage.system) / 1000; // 转换为毫秒

    // 简单的百分比计算（这里需要根据实际情况调整）
    return Math.min(100, totalUsage / 10000); // 简化计算
  } catch (error) {
    return 0;
  }
}

// 获取磁盘使用率的辅助函数
async function getDiskUsage() {
  try {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    if (os.platform() === "win32") {
      // Windows系统
      try {
        const { stdout } = await execAsync(
          "wmic logicaldisk get size,freespace,caption"
        );
        const lines = stdout
          .split("\n")
          .filter((line) => line.trim() && !line.includes("Caption"));

        if (lines.length > 0) {
          const parts = lines[0].trim().split(/\s+/);
          if (parts.length >= 3) {
            const freeSpace = parseInt(parts[1]) || 0;
            const totalSpace = parseInt(parts[2]) || 1;
            if (totalSpace > 0) {
              const usedSpace = totalSpace - freeSpace;
              const usage = (usedSpace / totalSpace) * 100;
              return Math.max(0, Math.min(100, Math.round(usage)));
            }
          }
        }
      } catch (error) {
        console.warn("获取Windows磁盘使用率失败:", error.message);
      }
    } else {
      // Unix/Linux/macOS系统
      try {
        const { stdout } = await execAsync("df -h / | tail -1");
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 5) {
          const usageStr = parts[4];
          const usage = parseInt(usageStr.replace("%", ""));
          return usage;
        }
      } catch (error) {
        console.warn("获取Unix磁盘使用率失败:", error.message);
      }
    }

    // 如果无法获取，返回默认值
    return 57; // 默认57%，与UI显示一致
  } catch (error) {
    console.warn("获取磁盘使用率失败:", error.message);
    return 57;
  }
}

// 验证激活码
ipcMain.handle("validate-activation-code", async (event, code) => {
  try {
    const deviceId = await generateDeviceFingerprint();

    // 首先进行本地格式验证
    const localValidation = validateActivationCode(code, deviceId);
    if (!localValidation.valid) {
      return {
        success: false,
        error: localValidation.reason,
      };
    }

    // 向服务器验证激活码
    try {
      console.log("向服务器验证激活码:", code);
      const response = await fetch(
        serverConfig.getHttpUrl("/api/validate-code"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: code,
            deviceId: deviceId,
          }),
          timeout: 10000, // 10秒超时
        }
      );

      if (!response.ok) {
        throw new Error(`服务器响应错误: ${response.status}`);
      }

      const result = await response.json();
      console.log("服务器验证结果:", result);

      if (result.success) {
        // 保存激活信息
        await saveActivationInfo(code, {
          deviceId: deviceId,
          createdAt: new Date().toISOString(),
          expiresAt: result.expiresAt,
          version: "1.0",
        });

        return {
          success: true,
          message: "激活成功！",
          expiresAt: result.expiresAt,
        };
      } else {
        return {
          success: false,
          error: result.error || "服务器验证失败",
        };
      }
    } catch (networkError) {
      console.error("服务器连接失败:", networkError);

      // 网络错误时，提供离线模式选项
      return {
        success: false,
        error: `无法连接服务器: ${networkError.message}。请检查网络连接或服务器状态。`,
        offline: true,
      };
    }
  } catch (error) {
    console.error("激活码验证失败:", error);
    return {
      success: false,
      error: "验证失败: " + error.message,
    };
  }
});

// 检查激活状态（实时验证服务端）
ipcMain.handle("check-activation-status", async () => {
  try {
    const configPath = path.join(APP_CONFIG.configPath, APP_CONFIG.configFile);

    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);

      if (config.activation) {
        const now = new Date();
        const expiry = new Date(config.activation.expiresAt);

        // 本地过期检查
        if (now > expiry) {
          return {
            activated: false,
            expired: true,
            reason: "激活码已过期",
          };
        }

        // 实时验证服务端状态
        try {
          const deviceId = await generateDeviceFingerprint();
          const response = await fetch(
            serverConfig.getHttpUrl("/api/verify-activation"),
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                code: config.activation.code,
                deviceId: deviceId,
              }),
              timeout: 5000, // 5秒超时
            }
          );

          const result = await response.json();

          if (!result.success || !result.valid) {
            // 服务端验证失败，清除本地激活信息
            console.log("服务端验证失败，清除本地激活:", result.reason);
            await clearLocalActivation();

            return {
              activated: false,
              expired: false,
              reason: result.reason || "服务端验证失败",
              serverValidation: false,
            };
          }

          // 验证通过
          return {
            activated: true,
            expired: false,
            expiresAt: config.activation.expiresAt,
            activatedAt: config.activation.activatedAt,
            serverValidation: true,
          };
        } catch (networkError) {
          console.log("网络错误，使用本地验证:", networkError.message);

          // 网络错误时使用本地验证（离线模式）
          return {
            activated: true,
            expired: false,
            expiresAt: config.activation.expiresAt,
            activatedAt: config.activation.activatedAt,
            serverValidation: false,
            offlineMode: true,
          };
        }
      }
    }

    return { activated: false };
  } catch (error) {
    return { activated: false, error: error.message };
  }
});

// 验证激活状态（内部函数）
async function verifyActivationForOperation() {
  try {
    const configPath = path.join(APP_CONFIG.configPath, APP_CONFIG.configFile);

    if (!(await fs.pathExists(configPath))) {
      return { valid: false, reason: "未激活" };
    }

    const config = await fs.readJson(configPath);
    if (!config.activation) {
      return { valid: false, reason: "未激活" };
    }

    // 检查本地过期
    const now = new Date();
    const expiry = new Date(config.activation.expiresAt);
    if (now > expiry) {
      return { valid: false, reason: "激活已过期" };
    }

    // 验证服务端状态
    try {
      const deviceId = await generateDeviceFingerprint();
      const response = await fetch(
        serverConfig.getHttpUrl("/api/verify-activation"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: config.activation.code,
            deviceId: deviceId,
          }),
          timeout: 3000, // 3秒超时
        }
      );

      const result = await response.json();

      if (!result.success || !result.valid) {
        // 服务端验证失败，清除本地激活信息
        await clearLocalActivation();
        return { valid: false, reason: result.reason || "服务端验证失败" };
      }

      return { valid: true };
    } catch (networkError) {
      // 网络错误时允许离线使用（但会记录警告）
      console.log("网络错误，允许离线使用:", networkError.message);
      return { valid: true, offline: true };
    }
  } catch (error) {
    return { valid: false, reason: "验证失败: " + error.message };
  }
}

// 执行设备清理（需要激活验证）
ipcMain.handle("perform-device-cleanup", async (event, options = {}) => {
  try {
    // 验证激活状态
    const activation = await verifyActivationForOperation();
    if (!activation.valid) {
      return {
        success: false,
        error: `操作被拒绝: ${activation.reason}`,
        requireActivation: true,
      };
    }

    if (!deviceManager) {
      throw new Error("设备管理器未初始化");
    }

    // 传递清理选项给设备管理器 - 所有选项默认为true
    const cleanupOptions = {
      preserveActivation: options.preserveActivation ?? true,
      deepClean: options.deepClean ?? true,
      cleanCursorExtension: options.cleanCursorExtension ?? true,
      ...options,
    };

    const result = await deviceManager.performCleanup(cleanupOptions);

    // 添加激活状态信息
    if (activation.offline) {
      result.warning = "在离线模式下执行";
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

// 验证操作权限
ipcMain.handle("verify-operation-permission", async (event, operation) => {
  try {
    const configPath = path.join(APP_CONFIG.configPath, APP_CONFIG.configFile);

    if (!(await fs.pathExists(configPath))) {
      return {
        success: false,
        error: "设备未激活",
        requireActivation: true,
      };
    }

    const config = await fs.readJson(configPath);
    if (!config.activation) {
      return {
        success: false,
        error: "设备未激活",
        requireActivation: true,
      };
    }

    // 检查WebSocket连接状态（关键安全检查）
    if (!wsConnectionStatus.connected) {
      return {
        success: false,
        error:
          "无法连接到管理服务器，为确保安全，清理功能已被禁用。请检查网络连接或联系管理员。",
        requireConnection: true,
        wsStatus: {
          connected: false,
          lastDisconnectedTime: wsConnectionStatus.lastDisconnectedTime,
          connectionAttempts: wsConnectionStatus.connectionAttempts,
          isReconnecting: wsConnectionStatus.isReconnecting,
        },
      };
    }

    const deviceId = await generateDeviceFingerprint();

    // 向服务器验证权限
    try {
      const response = await fetch(
        serverConfig.getHttpUrl("/api/client/execute-operation"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: config.activation.code,
            deviceId: deviceId,
            operation: operation,
            parameters: {},
          }),
          timeout: 5000,
        }
      );

      const result = await response.json();

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          requireActivation: result.requireActivation || false,
        };
      }

      return {
        success: true,
        permissions: result.permissions,
        wsStatus: {
          connected: true,
          lastConnectedTime: wsConnectionStatus.lastConnectedTime,
        },
      };
    } catch (networkError) {
      // 网络错误时不允许操作（安全优先）
      console.log("网络错误，拒绝操作:", networkError.message);
      return {
        success: false,
        error: "无法验证操作权限：网络连接失败。为确保安全，操作已被拒绝。",
        requireConnection: true,
        networkError: networkError.message,
      };
    }
  } catch (error) {
    console.error("权限验证失败:", error);
    return {
      success: false,
      error: "权限验证失败: " + error.message,
    };
  }
});

// 获取Augment扩展信息
ipcMain.handle("get-augment-info", async () => {
  try {
    if (!deviceManager) {
      throw new Error("设备管理器未初始化");
    }

    const info = await deviceManager.getAugmentExtensionInfo();
    return info;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

// 检查管理员权限需求
ipcMain.handle("check-admin-requirements", async () => {
  try {
    if (!deviceManager) {
      throw new Error("设备管理器未初始化");
    }

    const requirements = await deviceManager.checkAdminRequirements();
    return requirements;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

// 获取系统信息
ipcMain.handle("get-system-info", async () => {
  try {
    const os = require("os");
    const fs = require("fs");
    const { promisify } = require("util");
    const { exec } = require("child_process");
    const execAsync = promisify(exec);

    // 获取CPU使用率（简化版本）
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const cpuUsage = Math.round(100 - (totalIdle / totalTick) * 100);

    // 获取内存使用率
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);

    // 获取真实磁盘使用率
    let diskUsage = 0;
    try {
      const platform = os.platform();
      if (platform === "win32") {
        // Windows系统
        const { stdout } = await execAsync(
          "wmic logicaldisk where size!=0 get size,freespace,caption /format:csv"
        );
        const lines = stdout.split("\n").filter((line) => line.includes(","));
        if (lines.length > 1) {
          const data = lines[1].split(",");
          if (data.length >= 4) {
            const freeSpace = parseInt(data[2]) || 0;
            const totalSpace = parseInt(data[3]) || 1;
            diskUsage = Math.round(
              ((totalSpace - freeSpace) / totalSpace) * 100
            );
          }
        }
      } else if (platform === "darwin") {
        // macOS系统
        const { stdout } = await execAsync("df -h / | tail -1");
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 5) {
          const usagePercent = parts[4].replace("%", "");
          diskUsage = parseInt(usagePercent) || 0;
        }
      } else {
        // Linux系统
        const { stdout } = await execAsync("df -h / | tail -1");
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 5) {
          const usagePercent = parts[4].replace("%", "");
          diskUsage = parseInt(usagePercent) || 0;
        }
      }
    } catch (diskError) {
      console.error("获取磁盘使用率失败:", diskError);
      // 使用fs.statfs作为备用方案（Node.js 19+）
      try {
        if (fs.statfs) {
          const stats = await promisify(fs.statfs)("/");
          const totalBlocks = stats.blocks;
          const freeBlocks = stats.bavail;
          diskUsage = Math.round(
            ((totalBlocks - freeBlocks) / totalBlocks) * 100
          );
        }
      } catch (statfsError) {
        console.error("备用磁盘检测失败:", statfsError);
        diskUsage = 0;
      }
    }

    return {
      cpu: Math.max(0, Math.min(100, cpuUsage || 0)),
      memory: Math.max(0, Math.min(100, memoryUsage || 0)),
      disk: Math.max(0, Math.min(100, diskUsage || 0)),
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      // 添加详细信息
      totalMemory: Math.round((totalMem / 1024 / 1024 / 1024) * 100) / 100, // GB
      freeMemory: Math.round((freeMem / 1024 / 1024 / 1024) * 100) / 100, // GB
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model || "Unknown",
    };
  } catch (error) {
    console.error("获取系统信息失败:", error);
    return {
      cpu: 0,
      memory: 0,
      disk: 0,
      platform: "unknown",
      arch: "unknown",
      hostname: "unknown",
      uptime: 0,
      totalMemory: 0,
      freeMemory: 0,
      cpuCount: 0,
      cpuModel: "Unknown",
    };
  }
});

// 重置使用计数（需要激活验证）
ipcMain.handle("reset-usage-count", async () => {
  try {
    // 验证激活状态
    const activation = await verifyActivationForOperation();
    if (!activation.valid) {
      return {
        success: false,
        error: `操作被拒绝: ${activation.reason}`,
        requireActivation: true,
      };
    }

    if (!deviceManager) {
      throw new Error("设备管理器未初始化");
    }

    const result = await deviceManager.resetUsageCount();

    // 添加激活状态信息
    if (activation.offline) {
      result.warning = "在离线模式下执行";
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

// 打开外部链接
ipcMain.handle("open-external-link", async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 显示消息对话框
ipcMain.handle("show-message-box", async (event, options) => {
  try {
    // 创建一个新的对话框窗口来确保标题正确显示
    const dialogOptions = {
      type: options.type || "info",
      title: options.title || "Augment设备管理器",
      message: options.message || "",
      detail: options.detail || "",
      buttons: options.buttons || ["确定"],
      defaultId: options.defaultId || 0,
      cancelId: options.cancelId || 0,
      noLink: options.noLink || false,
      normalizeAccessKeys: false,
    };

    const result = await dialog.showMessageBox(mainWindow, dialogOptions);
    return result;
  } catch (error) {
    console.error("显示对话框失败:", error);
    return { response: 0 };
  }
});

// 手动检查更新
ipcMain.handle("check-for-updates", async () => {
  try {
    console.log("手动检查更新...");
    const result = await autoUpdater.checkForUpdates();
    return { success: true, result };
  } catch (error) {
    console.error("检查更新失败:", error);
    return { success: false, error: error.message };
  }
});

// 获取WebSocket连接状态
ipcMain.handle("get-websocket-status", async () => {
  return {
    connected: wsConnectionStatus.connected,
    lastConnectedTime: wsConnectionStatus.lastConnectedTime,
    lastDisconnectedTime: wsConnectionStatus.lastDisconnectedTime,
    connectionAttempts: wsConnectionStatus.connectionAttempts,
    isReconnecting: wsConnectionStatus.isReconnecting,
    reconnectAttempts: wsReconnectAttempts,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
  };
});

// 测试服务器连接
ipcMain.handle("test-server-connection", async () => {
  try {
    console.log("测试服务器连接...");
    const serverUrl = serverConfig.getHttpUrl("/api/health");
    console.log("连接地址:", serverUrl);

    const response = await fetch(serverUrl, {
      method: "GET",
      timeout: 5000,
    });

    if (response.ok) {
      return {
        success: true,
        message: "服务器连接正常",
        serverUrl: serverUrl,
        status: response.status,
      };
    } else {
      return {
        success: false,
        error: `服务器响应错误: ${response.status}`,
        serverUrl: serverUrl,
      };
    }
  } catch (error) {
    console.error("服务器连接测试失败:", error);
    return {
      success: false,
      error: error.message,
      serverUrl: serverConfig.getHttpUrl(),
      details: "请检查服务器是否正在运行，以及网络连接是否正常",
    };
  }
});

// 获取应用版本信息
ipcMain.handle("get-app-version", async () => {
  return {
    version: APP_CONFIG.version,
    name: APP_CONFIG.name,
  };
});

// 更新服务器配置
ipcMain.handle("update-server-config", async (event, config) => {
  try {
    await serverConfig.updateServerConfig(
      config.host,
      config.port,
      config.protocol
    );

    // 重新初始化WebSocket连接
    if (wsClient) {
      wsClient.close();
    }
    initializeWebSocket();

    return { success: true };
  } catch (error) {
    console.error("更新服务器配置失败:", error);
    return { success: false, error: error.message };
  }
});

// 获取服务器配置
ipcMain.handle("get-server-config", async () => {
  try {
    return serverConfig.getConfig();
  } catch (error) {
    console.error("获取服务器配置失败:", error);
    return null;
  }
});

// 保存激活信息
async function saveActivationInfo(code, data) {
  const configPath = path.join(APP_CONFIG.configPath, APP_CONFIG.configFile);

  // 确保目录存在
  await fs.ensureDir(APP_CONFIG.configPath);

  // 获取设备ID（等待异步操作完成）
  const deviceId = await generateDeviceFingerprint();

  const config = {
    activation: {
      code: code,
      deviceId: deviceId,
      activatedAt: new Date().toISOString(),
      expiresAt: data.expiresAt,
      version: data.version,
    },
    lastUpdated: new Date().toISOString(),
  };

  await fs.writeJson(configPath, config, { spaces: 2 });
  console.log("激活信息已保存:", {
    code,
    deviceId: deviceId.substring(0, 16) + "...",
  });
}

// 初始化自动更新
function initializeAutoUpdater() {
  // 配置自动更新
  autoUpdater.autoDownload = false; // 不自动下载，让用户选择
  autoUpdater.autoInstallOnAppQuit = true; // 应用退出时自动安装

  // 检查更新事件
  autoUpdater.on("checking-for-update", () => {
    console.log("正在检查更新...");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("发现新版本:", info.version);
    showUpdateDialog(info);
  });

  autoUpdater.on("update-not-available", (info) => {
    console.log("当前已是最新版本");
  });

  autoUpdater.on("error", (err) => {
    console.error("更新检查失败:", err);
  });

  autoUpdater.on("download-progress", (progressObj) => {
    const percent = Math.round(progressObj.percent);
    console.log(`下载进度: ${percent}%`);

    // 发送下载进度到渲染进程
    if (mainWindow) {
      mainWindow.webContents.send("download-progress", percent);
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("更新下载完成");
    showInstallDialog();
  });

  // 启动时检查更新（延迟3秒，避免影响启动速度）
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 3000);
}

// 显示更新对话框
async function showUpdateDialog(updateInfo) {
  const result = await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "发现新版本",
    message: `发现新版本 v${updateInfo.version}`,
    detail: `当前版本: v${APP_CONFIG.version}\n新版本: v${updateInfo.version}\n\n是否现在下载更新？`,
    buttons: ["立即更新", "稍后提醒", "跳过此版本"],
    defaultId: 0,
    cancelId: 1,
  });

  if (result.response === 0) {
    // 用户选择立即更新
    console.log("开始下载更新...");
    autoUpdater.downloadUpdate();

    // 显示下载进度对话框
    showDownloadProgressDialog();
  } else if (result.response === 2) {
    // 用户选择跳过此版本
    console.log("用户跳过版本:", updateInfo.version);
  }
}

// 显示下载进度对话框
function showDownloadProgressDialog() {
  if (mainWindow) {
    mainWindow.webContents.send("show-download-progress");
  }
}

// 显示安装对话框
async function showInstallDialog() {
  const result = await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "更新下载完成",
    message: "新版本已下载完成",
    detail: "是否现在重启应用并安装更新？",
    buttons: ["立即重启", "稍后重启"],
    defaultId: 0,
    cancelId: 1,
  });

  if (result.response === 0) {
    // 用户选择立即重启
    autoUpdater.quitAndInstall();
  }
}
