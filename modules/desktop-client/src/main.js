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

// 记录软件启动时间
const APP_START_TIME = Date.now();

// 处理Node.js弃用警告，提供更友好的提示
process.on("warning", (warning) => {
  if (warning.name === "DeprecationWarning") {
    // 过滤掉常见的弃用警告，避免控制台噪音
    if (warning.message.includes("util._extend")) {
      console.log("ℹ️ 检测到依赖包使用了过时的API，建议更新相关依赖包");
      return;
    }

    console.log(`⚠️ 弃用警告: ${warning.message}`);
    console.log("💡 建议更新相关依赖包以避免未来兼容性问题");
  } else {
    console.warn("⚠️ 系统警告:", warning.message);
  }
});

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

/**
 * 确保所有防护进程都停止
 * 在客户端启动和关闭时调用
 */
async function ensureAllGuardianProcessesStopped() {
  try {
    console.log("🔍 检查防护进程状态...");

    // 添加超时机制，避免卡住
    const stopWithTimeout = async (operation, timeoutMs = 5000) => {
      return Promise.race([
        operation(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("操作超时")), timeoutMs)
        ),
      ]);
    };

    // 如果设备管理器已初始化，使用它来停止防护
    if (deviceManager) {
      try {
        await stopWithTimeout(async () => {
          const results = { actions: [], errors: [] };

          // 停止内置守护进程
          await deviceManager.stopEnhancedGuardian(results);

          // 停止独立守护服务
          await deviceManager.stopStandaloneService(results);

          console.log("✅ 通过设备管理器停止防护完成");
          if (results.actions.length > 0) {
            console.log("停止操作:", results.actions.join(", "));
          }
          if (results.errors.length > 0) {
            console.warn("停止错误:", results.errors.join(", "));
          }
        }, 3000);
      } catch (error) {
        console.warn("通过设备管理器停止防护失败:", error.message);
      }
    }

    // 强制停止所有Node.js守护进程
    await stopWithTimeout(async () => {
      await forceStopAllGuardianProcesses();
    }, 5000);

    // 清理防护进程配置文件，避免旧配置干扰
    await stopWithTimeout(async () => {
      await cleanupGuardianConfigFiles();
    }, 2000);
  } catch (error) {
    console.error("确保防护进程停止失败:", error);
  }
}

/**
 * 强制停止所有守护进程
 */
async function forceStopAllGuardianProcesses() {
  try {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    console.log("🔍 扫描并强制停止所有守护进程...");

    if (process.platform === "win32") {
      // Windows系统 - 查找并终止守护进程
      try {
        // 获取所有Node.js进程的详细信息
        const { stdout } = await execAsync(
          "wmic process where \"name='node.exe'\" get processid,commandline"
        );
        const lines = stdout.split("\n");
        const guardianProcesses = [];

        for (const line of lines) {
          if (
            line.includes("guardian-service-worker.js") ||
            line.includes("enhanced-device-guardian") ||
            line.includes("device-id-guardian") ||
            line.includes("standalone-guardian-service")
          ) {
            // 提取PID - 改进的正则表达式
            const pidMatch = line.trim().match(/\s+(\d+)\s*$/);
            if (pidMatch) {
              guardianProcesses.push(pidMatch[1]);
              console.log(`发现守护进程 PID: ${pidMatch[1]}`);
            }
          }
        }

        if (guardianProcesses.length > 0) {
          console.log(
            `🎯 发现 ${guardianProcesses.length} 个守护进程，正在终止...`
          );

          for (const pid of guardianProcesses) {
            try {
              await execAsync(`taskkill /F /PID ${pid}`);
              console.log(`✅ 已终止守护进程 PID: ${pid}`);
            } catch (error) {
              console.log(`⚠️ 终止进程 ${pid} 失败: ${error.message}`);
            }
          }
        } else {
          console.log("✅ 未发现运行中的守护进程");
        }
      } catch (error) {
        console.warn("扫描守护进程失败:", error.message);
      }
    } else {
      // Unix/Linux/macOS系统
      try {
        await execAsync(
          "pkill -f 'guardian-service-worker\\|enhanced-device-guardian\\|device-id-guardian\\|standalone-guardian-service'"
        );
        console.log("✅ 已终止所有守护进程");
      } catch (error) {
        if (error.code === 1) {
          console.log("✅ 未发现运行中的守护进程");
        } else {
          console.warn("终止守护进程失败:", error.message);
        }
      }
    }
  } catch (error) {
    console.error("强制停止守护进程失败:", error);
  }
}

/**
 * 清理防护进程配置文件
 * 避免旧配置文件干扰新的防护进程启动
 */
async function cleanupGuardianConfigFiles() {
  try {
    console.log("🧹 清理防护进程配置文件...");

    const configPaths = [
      path.join(os.tmpdir(), "augment-guardian-config.json"),
      path.join(os.tmpdir(), "augment-guardian.pid"),
      path.join(os.tmpdir(), "augment-guardian.log"),
      path.join(os.tmpdir(), "augment-guardian-stats.json"),
      path.join(os.homedir(), ".augment", "guardian-service", "config.json"),
      path.join(os.homedir(), ".augment", "guardian-service", "guardian.pid"),
    ];

    let cleanedCount = 0;
    for (const configPath of configPaths) {
      try {
        if (await fs.pathExists(configPath)) {
          await fs.remove(configPath);
          console.log(`✅ 已清理: ${path.basename(configPath)}`);
          cleanedCount++;
        }
      } catch (error) {
        console.log(
          `⚠️ 清理失败 ${path.basename(configPath)}: ${error.message}`
        );
      }
    }

    if (cleanedCount > 0) {
      console.log(`✅ 已清理 ${cleanedCount} 个配置文件`);
    } else {
      console.log("✅ 无需清理配置文件");
    }
  } catch (error) {
    console.error("清理防护进程配置文件失败:", error);
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
    // 异步停止防护进程然后退出
    (async () => {
      try {
        // 🛑 关闭客户端时确保所有防护进程都被关闭
        console.log("🛑 关闭客户端时停止所有防护进程...");
        await ensureAllGuardianProcessesStopped();
        console.log("✅ 防护进程停止完成");
      } catch (error) {
        console.error("停止防护进程失败:", error);
      } finally {
        app.quit();
      }
    })();
  } else {
    // macOS上只是隐藏窗口，也要停止防护进程
    (async () => {
      try {
        console.log("🛑 macOS窗口关闭时停止防护进程...");
        await ensureAllGuardianProcessesStopped();
      } catch (error) {
        console.error("停止防护进程失败:", error);
      }
    })();
  }
});

// 应用退出前的清理
let isQuitting = false;
app.on("before-quit", (event) => {
  if (!isQuitting) {
    console.log("🛑 应用退出前清理...");

    // 阻止默认退出，先进行清理
    event.preventDefault();
    isQuitting = true;

    // 异步执行清理操作
    (async () => {
      try {
        // 确保所有防护进程都停止
        await ensureAllGuardianProcessesStopped();
        console.log("✅ 清理完成，退出应用");
      } catch (error) {
        console.error("退出前清理失败:", error);
      } finally {
        // 无论成功失败都要退出
        app.exit(0);
      }
    })();
  }
});

// 添加进程退出信号处理，确保在任何情况下都能停止防护进程
process.on("SIGINT", async () => {
  console.log("🛑 收到SIGINT信号，停止防护进程...");
  try {
    await ensureAllGuardianProcessesStopped();
  } catch (error) {
    console.error("停止防护进程失败:", error);
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("🛑 收到SIGTERM信号，停止防护进程...");
  try {
    await ensureAllGuardianProcessesStopped();
  } catch (error) {
    console.error("停止防护进程失败:", error);
  }
  process.exit(0);
});

// 初始化应用
async function initializeApp() {
  try {
    // 确保配置目录存在
    await fs.ensureDir(APP_CONFIG.configPath);

    // 🛑 启动时确保所有防护进程都停止
    console.log("🛑 启动时检查并停止所有防护进程...");
    await ensureAllGuardianProcessesStopped();

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
    console.log("\n🔍 开始服务器连接检测...\n");

    // 首先测试当前配置是否可用
    const currentConfigWorks = await serverConfig.testConnection();

    if (currentConfigWorks) {
      console.log("✅ 当前服务器配置可用，无需自动发现\n");
      return;
    }

    console.log("⚠️ 当前服务器配置无法连接，启动自动发现功能...");
    console.log(`   当前配置: ${serverConfig.getHttpUrl()}\n`);

    // 创建服务器发现实例
    const discovery = new ServerDiscovery(serverConfig);

    // 尝试自动发现并更新配置
    const updated = await discovery.updateServerConfig(serverConfig);

    if (updated) {
      const newConfig = serverConfig.getConfig();
      console.log("\n✅ 服务器配置已自动更新");
      console.log(`   新配置: ${serverConfig.getHttpUrl()}\n`);

      // 通知渲染进程配置已更新
      if (mainWindow) {
        mainWindow.webContents.send("server-config-updated", {
          message: "服务器地址已自动更新，连接已恢复",
          config: newConfig,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      console.log("\n❌ 自动发现失败：未找到可用的服务器");
      console.log("\n💡 请检查：");
      console.log("   • 后端服务是否正常启动");
      console.log("   • 网络连接是否正常");
      console.log("   • 防火墙是否阻止连接\n");

      // 通知渲染进程发现失败
      if (mainWindow) {
        mainWindow.webContents.send("server-discovery-failed", {
          message: "无法找到可用的服务器，请检查网络连接和服务器状态",
          suggestions: [
            "确认后端服务正在运行",
            "检查网络连接是否正常",
            "确认防火墙设置是否正确",
          ],
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    const errorMessage = `服务器自动发现过程异常: ${error.message}`;
    console.error("\n❌", errorMessage);
    console.log("💡 建议手动检查服务器配置和网络连接\n");

    // 通知渲染进程发现异常
    if (mainWindow) {
      mainWindow.webContents.send("server-discovery-error", {
        message: errorMessage,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
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
      await clearLocalActivation(result.reason || "服务器验证失败");

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
  isInitializing: true, // 添加初始化状态标记
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
      wsConnectionStatus.isInitializing = false; // 初始化完成

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
      const friendlyReason = getWebSocketCloseReason(code, reason);
      console.log(`🔌 WebSocket连接已断开: ${friendlyReason}`);

      // 更新连接状态
      wsConnectionStatus.connected = false;
      wsConnectionStatus.lastDisconnectedTime = new Date();
      wsConnectionStatus.isInitializing = false; // 不再是初始化状态

      // 通知渲染进程连接状态变化
      if (mainWindow) {
        mainWindow.webContents.send("websocket-status-changed", {
          connected: false,
          timestamp: wsConnectionStatus.lastDisconnectedTime.toISOString(),
          reason: friendlyReason,
          code: code,
        });
      }

      scheduleReconnect();
    });

    wsClient.on("error", (error) => {
      const friendlyError = getWebSocketErrorMessage(error);
      console.error("❌ WebSocket连接错误:", friendlyError);

      // 更新连接状态
      wsConnectionStatus.connected = false;
      wsConnectionStatus.lastDisconnectedTime = new Date();
      wsConnectionStatus.isInitializing = false; // 不再是初始化状态

      // 通知渲染进程连接错误
      if (mainWindow) {
        mainWindow.webContents.send("websocket-status-changed", {
          connected: false,
          timestamp: wsConnectionStatus.lastDisconnectedTime.toISOString(),
          error: friendlyError,
          originalError: error.message,
        });
      }
    });
  } catch (error) {
    const friendlyError = getWebSocketErrorMessage(error);
    console.error("❌ WebSocket初始化失败:", friendlyError);
    scheduleReconnect();
  }
}

// 获取友好的WebSocket关闭原因
function getWebSocketCloseReason(code, reason) {
  const codeMessages = {
    1000: "正常关闭",
    1001: "端点离开（如页面刷新）",
    1002: "协议错误",
    1003: "不支持的数据类型",
    1005: "未收到状态码",
    1006: "连接异常关闭",
    1007: "数据格式错误",
    1008: "策略违规",
    1009: "消息过大",
    1010: "扩展协商失败",
    1011: "服务器内部错误",
    1012: "服务重启",
    1013: "稍后重试",
    1014: "网关错误",
    1015: "TLS握手失败",
  };

  const codeMessage = codeMessages[code] || `未知错误码 ${code}`;
  const reasonText = reason ? ` (${reason})` : "";

  return `${codeMessage}${reasonText}`;
}

// 获取友好的WebSocket错误信息
function getWebSocketErrorMessage(error) {
  if (error.code === "ECONNREFUSED") {
    return `无法连接到WebSocket服务器
    └─ 原因: 服务器未启动或端口被占用
    └─ 建议: 检查后端服务是否正常运行`;
  }

  if (error.code === "ENOTFOUND") {
    return `WebSocket服务器域名解析失败
    └─ 原因: 无法解析服务器地址
    └─ 建议: 检查网络连接和服务器配置`;
  }

  if (error.code === "ETIMEDOUT") {
    return `WebSocket连接超时
    └─ 原因: 网络延迟过高或服务器响应缓慢
    └─ 建议: 检查网络连接质量`;
  }

  if (error.message && error.message.includes("Unexpected server response")) {
    return `WebSocket握手失败
    └─ 原因: 服务器响应异常，可能不支持WebSocket
    └─ 建议: 确认服务器WebSocket服务正常`;
  }

  return `WebSocket连接异常
    └─ 详情: ${error.message || "未知错误"}
    └─ 建议: 检查网络连接和服务器状态`;
}

// 安排重连
function scheduleReconnect() {
  if (wsReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error("\n❌ WebSocket重连失败：已达到最大重试次数");
    console.log("\n💡 故障排查建议：");
    console.log("   • 检查后端服务是否正常运行");
    console.log("   • 确认网络连接是否稳定");
    console.log("   • 检查防火墙或代理设置");
    console.log("   • 尝试重启应用程序\n");

    wsConnectionStatus.isReconnecting = false;

    // 通知渲染进程重连失败
    if (mainWindow) {
      mainWindow.webContents.send("websocket-status-changed", {
        connected: false,
        reconnectFailed: true,
        timestamp: new Date().toISOString(),
        message: `WebSocket连接失败：已尝试 ${MAX_RECONNECT_ATTEMPTS} 次重连`,
        suggestions: [
          "检查后端服务是否正常运行",
          "确认网络连接是否稳定",
          "检查防火墙或代理设置",
          "尝试重启应用程序",
        ],
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

  console.log(
    `\n🔄 准备第 ${wsReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} 次重连 (${
      delay / 1000
    }秒后)\n`
  );

  // 通知渲染进程正在重连
  if (mainWindow) {
    mainWindow.webContents.send("websocket-status-changed", {
      connected: false,
      isReconnecting: true,
      reconnectAttempt: wsReconnectAttempts,
      maxAttempts: MAX_RECONNECT_ATTEMPTS,
      nextRetryIn: delay,
      timestamp: new Date().toISOString(),
      message: `正在尝试重连... (${wsReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
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
  clearLocalActivation(reason);

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
  clearLocalActivation("激活码已被删除");

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
  clearLocalActivation(reason);

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
async function clearLocalActivation(reason = null) {
  try {
    const configPath = path.join(APP_CONFIG.configPath, APP_CONFIG.configFile);

    if (await fs.pathExists(configPath)) {
      await fs.remove(configPath);
      console.log("本地激活信息已清除");

      // 🚨 激活失效时自动停止增强防护
      console.log("🛑 激活失效，自动停止增强防护...");
      try {
        if (deviceManager) {
          const results = { actions: [], errors: [] };

          // 停止内置守护进程
          await deviceManager.stopEnhancedGuardian(results);

          // 停止独立守护服务
          await deviceManager.stopStandaloneService(results);

          console.log("✅ 增强防护已自动停止");

          // 记录停止结果
          if (results.actions.length > 0) {
            console.log("停止操作:", results.actions.join(", "));
          }
          if (results.errors.length > 0) {
            console.warn("停止错误:", results.errors.join(", "));
          }
        }
      } catch (guardianError) {
        console.error("自动停止增强防护失败:", guardianError.message);
      }

      // 如果是激活码过期，通知渲染进程
      if (reason && (reason.includes("过期") || reason.includes("expired"))) {
        console.log("🚨 激活码过期，通知渲染进程退出激活状态");
        if (mainWindow) {
          mainWindow.webContents.send("activation-expired", {
            reason: reason,
            timestamp: new Date().toISOString(),
            requireReactivation: true,
          });
        }
      }
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

// 设置选择的IDE类型
ipcMain.handle("set-selected-ide", async (event, ideType) => {
  console.log(`🎯 设置选择的IDE: ${ideType}`);
  global.selectedIDE = ideType;
  return { success: true, selectedIDE: ideType };
});

// 获取当前选择的IDE类型
ipcMain.handle("get-selected-ide", async () => {
  const selectedIDE = global.selectedIDE || "cursor";
  console.log(`📡 获取当前选择的IDE: ${selectedIDE}`);
  return { success: true, selectedIDE };
});

// 获取详细设备ID信息
ipcMain.handle("get-device-id-details", async () => {
  console.log("📡 收到设备ID详情请求");
  try {
    const path = require("path");
    const fs = require("fs-extra");

    // 导入设备ID相关工具
    const {
      generateStableDeviceId,
      hasDeviceIdCache,
      generateIDESpecificDeviceId,
      hasIDESpecificCache,
    } = require(getSharedPath("utils/stable-device-id"));

    const DeviceDetection = require(getSharedPath("utils/device-detection"));

    // 获取当前选择的IDE类型
    const selectedIDE = global.selectedIDE || "cursor"; // 默认为cursor

    // 1. 获取稳定设备ID（根据选择的IDE）
    const stableDeviceId = await generateIDESpecificDeviceId(selectedIDE);
    const hasCachedId = hasIDESpecificCache(selectedIDE);

    // 2. 获取设备指纹（根据选择的IDE）
    const detector = new DeviceDetection();
    const deviceFingerprint = await detector.generateFingerprint(selectedIDE);

    // 3. 获取Cursor遥测ID（使用动态路径检测）
    let cursorTelemetry = null;
    try {
      const DeviceManager = require("./device-manager");
      const deviceManager = new DeviceManager();
      const cursorPaths = deviceManager.getCursorPaths();

      if (await fs.pathExists(cursorPaths.storageJson)) {
        const data = await fs.readJson(cursorPaths.storageJson);
        cursorTelemetry = {
          devDeviceId: data["telemetry.devDeviceId"],
          machineId: data["telemetry.machineId"],
          macMachineId: data["telemetry.macMachineId"],
          sessionId: data["telemetry.sessionId"],
          sqmId: data["telemetry.sqmId"],
        };
        console.log(`📋 Cursor配置文件路径: ${cursorPaths.storageJson}`);
      }
    } catch (error) {
      console.warn("获取Cursor遥测ID失败:", error.message);
    }

    // 4. 获取VSCode遥测ID（使用动态路径检测，支持多个变体）
    let vscodeTelemetry = null;
    try {
      const DeviceManager = require("./device-manager");
      const deviceManager = new DeviceManager();
      const vscodePaths = deviceManager.getVSCodePaths();

      // 尝试从所有VS Code变体中读取遥测ID
      if (vscodePaths.variants) {
        for (const [variantName, config] of Object.entries(
          vscodePaths.variants
        )) {
          const storageJsonPath = path.join(
            config.globalStorage,
            "storage.json"
          );

          if (await fs.pathExists(storageJsonPath)) {
            try {
              const data = await fs.readJson(storageJsonPath);
              if (data["telemetry.devDeviceId"]) {
                vscodeTelemetry = {
                  devDeviceId: data["telemetry.devDeviceId"],
                  machineId: data["telemetry.machineId"],
                  macMachineId: data["telemetry.macMachineId"],
                  sessionId: data["telemetry.sessionId"],
                  sqmId: data["telemetry.sqmId"],
                  variant: variantName, // 记录是哪个变体
                };
                console.log(
                  `📋 VS Code (${variantName}) 配置文件路径: ${storageJsonPath}`
                );
                break; // 找到第一个有效的变体就停止
              }
            } catch (error) {
              console.warn(
                `读取VS Code ${variantName}遥测ID失败:`,
                error.message
              );
              continue;
            }
          }
        }
      }
    } catch (error) {
      console.warn("获取VSCode遥测ID失败:", error.message);
    }

    // 5. 虚拟机检测
    const vmInfo = await detector.detectVirtualMachine();

    // 6. 系统基础信息
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
      vscodeTelemetry,
      hasCachedId,
      vmInfo,
      systemInfo,
      cleanupCapabilities: {
        stableId: true, // 稳定设备ID可清理
        fingerprint: true, // 设备指纹可重新生成
        cursorTelemetry: !!cursorTelemetry, // Cursor遥测ID可清理（如果存在）
        vscodeTelemetry: !!vscodeTelemetry, // VSCode遥测ID可清理（如果存在）
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
        // 🚨 重要修复：移除本地时间过期检查，直接使用服务端在线时间验证
        // 原因：本地时间可能被修改，导致错误的过期判断
        console.log("⏰ 跳过本地时间检查，使用服务端在线时间验证...");

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
            await clearLocalActivation(result.reason || "服务端验证失败");

            return {
              activated: false,
              expired: result.reason && result.reason.includes("过期"),
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

    // 使用在线北京时间验证过期 - 简化且可靠
    const BeijingTimeAPI = require("./beijing-time-api");
    const beijingTimeAPI = new BeijingTimeAPI();

    const expirationCheck = await beijingTimeAPI.validateExpiration(
      config.activation.expiresAt
    );

    if (!expirationCheck.valid) {
      console.warn("⚠️ 激活码验证失败:", expirationCheck.reason);

      // 检查是否是网络错误导致的安全阻止
      if (expirationCheck.securityBlock) {
        return {
          valid: false,
          reason: expirationCheck.reason,
          networkError: true,
          securityIssue: true, // 标记为安全问题
        };
      }

      // 🚨 激活码过期时，清除本地激活信息并触发退出激活状态
      if (expirationCheck.expired) {
        console.log("🚨 激活码已过期，清除本地激活信息并退出激活状态");
        await clearLocalActivation(expirationCheck.reason || "激活码已过期");
      }

      return {
        valid: false,
        reason: expirationCheck.reason,
        expired: true,
      };
    }

    console.log("✅ 激活码验证通过 - 基于在线北京时间");

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
        await clearLocalActivation(result.reason || "服务端验证失败");
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
        securityIssue: activation.securityIssue || false, // 传递安全问题标志
        expired: activation.expired || false, // 传递过期标志
      };
    }

    if (!deviceManager) {
      throw new Error("设备管理器未初始化");
    }

    // 传递清理选项给设备管理器 - 根据用户选择决定默认值
    const cleanupOptions = {
      preserveActivation: options.preserveActivation ?? true,
      deepClean: options.deepClean ?? true,
      // 只有用户选择Cursor时才清理Cursor扩展
      cleanCursorExtension:
        options.cleanCursor === true
          ? options.cleanCursorExtension ?? true
          : false,
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
ipcMain.handle("get-augment-info", async (event, options = {}) => {
  try {
    // 如果设备管理器还未初始化，等待一段时间后重试
    if (!deviceManager) {
      console.log("⏳ 设备管理器未初始化，等待初始化完成...");

      // 等待最多5秒，每100ms检查一次
      let retryCount = 0;
      const maxRetries = 50; // 5秒 / 100ms = 50次

      while (!deviceManager && retryCount < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        retryCount++;
      }

      if (!deviceManager) {
        throw new Error("设备管理器初始化超时，请稍后重试");
      }

      console.log("✅ 设备管理器初始化完成，继续获取扩展信息");
    }

    // 根据选择的IDE获取对应的扩展信息
    const selectedIDE = options.selectedIDE || "cursor";
    const info = await deviceManager.getAugmentExtensionInfo(selectedIDE);
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

    // 计算软件运行时间（秒）
    const appUptime = Math.floor((Date.now() - APP_START_TIME) / 1000);

    return {
      cpu: Math.max(0, Math.min(100, cpuUsage || 0)),
      memory: Math.max(0, Math.min(100, memoryUsage || 0)),
      disk: Math.max(0, Math.min(100, diskUsage || 0)),
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      appUptime: appUptime, // 软件运行时间（秒）
      // 添加详细信息
      totalMemory: Math.round((totalMem / 1024 / 1024 / 1024) * 100) / 100, // GB
      freeMemory: Math.round((freeMem / 1024 / 1024 / 1024) * 100) / 100, // GB
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model || "Unknown",
    };
  } catch (error) {
    console.error("获取系统信息失败:", error);
    // 即使出错也要计算软件运行时间
    const appUptime = Math.floor((Date.now() - APP_START_TIME) / 1000);

    return {
      cpu: 0,
      memory: 0,
      disk: 0,
      platform: "unknown",
      arch: "unknown",
      hostname: "unknown",
      uptime: 0,
      appUptime: appUptime, // 软件运行时间（秒）
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

// 退出激活
ipcMain.handle("deactivate-device", async () => {
  try {
    console.log("🚪 用户请求退出激活");

    // 清除本地激活信息
    await clearLocalActivation("用户主动退出激活");

    // 通知渲染进程激活状态已清除
    if (mainWindow) {
      mainWindow.webContents.send("activation-cleared", {
        reason: "用户主动退出激活",
        timestamp: new Date().toISOString(),
      });
    }

    return {
      success: true,
      message: "已成功退出激活状态",
    };
  } catch (error) {
    console.error("退出激活失败:", error);
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
    isInitializing: wsConnectionStatus.isInitializing,
    reconnectAttempts: wsReconnectAttempts,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
  };
});

// 获取增强防护状态
ipcMain.handle("get-enhanced-guardian-status", async (event, options = {}) => {
  try {
    // 检查deviceManager是否已初始化
    if (!deviceManager) {
      console.warn("⏳ 设备管理器未初始化，等待初始化完成...");
      return {
        isGuarding: false,
        mode: "none",
        error: "设备管理器未初始化",
      };
    }

    // 如果传递了IDE选择，更新增强防护的IDE配置
    if (options.selectedIDE && deviceManager.enhancedGuardian) {
      deviceManager.enhancedGuardian.setSelectedIDE(options.selectedIDE);
    }

    return await deviceManager.getEnhancedGuardianStatus();
  } catch (error) {
    console.error("获取增强防护状态失败:", error);
    return {
      isGuarding: false,
      mode: "none",
      error: error.message,
    };
  }
});

// 独立启动增强防护（需要激活验证）
ipcMain.handle(
  "start-enhanced-guardian-independent",
  async (event, options = {}) => {
    try {
      // 验证激活状态
      const activation = await verifyActivationForOperation();
      if (!activation.valid) {
        return {
          success: false,
          error: `防护启动被拒绝: ${activation.reason}`,
          requireActivation: true,
          securityIssue: activation.securityIssue || false,
        };
      }

      const result = await deviceManager.startEnhancedGuardianIndependently(
        options
      );

      // 添加激活状态信息
      if (activation.offline) {
        result.warning = "在离线模式下启动防护";
      }

      return result;
    } catch (error) {
      console.error("独立启动增强防护失败:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
);

// 检查增强防护启动要求
ipcMain.handle("check-guardian-startup-requirements", async () => {
  try {
    const status = await deviceManager.getGuardianStartupStatus();
    return status;
  } catch (error) {
    console.error("检查增强防护启动要求失败:", error);
    return {
      canStart: false,
      reason: error.message,
      requirements: {},
      currentStatus: { isGuarding: false },
      deviceId: null,
    };
  }
});

// 关闭IDE进程 - 统一逻辑确保Cursor和VS Code完全一致
ipcMain.handle("close-ide-processes", async (event, ideType) => {
  try {
    console.log(`🚫 关闭 ${ideType} IDE 进程...`);

    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    // 统一的进程名称映射，确保两个IDE逻辑一致
    const ideProcessMap = {
      cursor: {
        processNames: ["Cursor.exe", "cursor.exe"],
        displayName: "Cursor",
      },
      vscode: {
        processNames: ["Code.exe", "code.exe"],
        displayName: "VS Code",
      },
    };

    const ideConfig = ideProcessMap[ideType];
    if (!ideConfig) {
      throw new Error(`不支持的IDE类型: ${ideType}`);
    }

    console.log(
      `🔍 查找 ${ideConfig.displayName} 进程: ${ideConfig.processNames.join(
        ", "
      )}`
    );

    let closedCount = 0;
    let foundProcesses = [];

    // 统一的进程关闭逻辑
    for (const processName of ideConfig.processNames) {
      try {
        // 先检查进程是否存在
        const checkResult = await execAsync(
          `tasklist /FI "IMAGENAME eq ${processName}" /FO CSV`
        );
        const processLines = checkResult.stdout
          .split("\n")
          .filter(
            (line) => line.includes(processName) && !line.includes("INFO:")
          );

        if (processLines.length > 0) {
          foundProcesses.push(processName);
          console.log(
            `🎯 发现 ${processName} 进程 (${processLines.length} 个)`
          );

          // 强制关闭进程
          await execAsync(`taskkill /F /IM ${processName}`);
          closedCount++;
          console.log(`✅ 已关闭 ${processName}`);
        } else {
          console.log(`ℹ️ ${processName} 未运行`);
        }
      } catch (error) {
        // 进程可能不存在或已关闭，这是正常的
        console.log(`ℹ️ ${processName} 未运行或已关闭: ${error.message}`);
      }
    }

    // 等待进程完全关闭
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 验证进程是否真正关闭
    let remainingProcesses = [];
    for (const processName of ideConfig.processNames) {
      try {
        const verifyResult = await execAsync(
          `tasklist /FI "IMAGENAME eq ${processName}" /FO CSV`
        );
        const remainingLines = verifyResult.stdout
          .split("\n")
          .filter(
            (line) => line.includes(processName) && !line.includes("INFO:")
          );
        if (remainingLines.length > 0) {
          remainingProcesses.push(processName);
        }
      } catch (error) {
        // 查询失败通常意味着进程已关闭
      }
    }

    const result = {
      success: true,
      message: `${ideConfig.displayName} IDE 进程已关闭`,
      closedCount: closedCount,
      foundProcesses: foundProcesses,
      remainingProcesses: remainingProcesses,
    };

    if (remainingProcesses.length > 0) {
      console.log(`⚠️ 仍有进程未关闭: ${remainingProcesses.join(", ")}`);
      result.warning = `部分进程可能仍在运行: ${remainingProcesses.join(", ")}`;
    } else {
      console.log(`✅ 所有 ${ideConfig.displayName} 进程已完全关闭`);
    }

    return result;
  } catch (error) {
    console.error(`关闭 ${ideType} IDE 失败:`, error);
    return {
      success: false,
      message: `关闭 ${ideType} IDE 失败: ${error.message}`,
    };
  }
});

// IDE路径缓存
const idePathCache = new Map();

// 动态检测IDE安装路径的通用函数
async function detectIDEInstallPath(ideType) {
  const { exec } = require("child_process");
  const { promisify } = require("util");
  const execAsync = promisify(exec);
  const fs = require("fs");
  const path = require("path");
  const os = require("os");

  console.log(`🔍 动态检测 ${ideType} 安装路径...`);

  // 检查缓存
  const cacheKey = `${ideType}_path`;
  if (idePathCache.has(cacheKey)) {
    const cachedPath = idePathCache.get(cacheKey);
    if (fs.existsSync(cachedPath)) {
      console.log(`✅ 使用缓存路径 ${ideType}: ${cachedPath}`);
      return cachedPath;
    } else {
      console.log(`⚠️ 缓存路径已失效，重新检测: ${cachedPath}`);
      idePathCache.delete(cacheKey);
    }
  }

  // 获取当前用户名和常见路径
  const username = os.userInfo().username;
  const userProfile = os.homedir();

  let searchPaths = [];
  let processName = "";
  let executableName = "";

  if (ideType === "cursor") {
    processName = "Cursor.exe";
    executableName = "Cursor.exe";
    searchPaths = [
      // 用户特定路径
      path.join(
        userProfile,
        "AppData",
        "Local",
        "Programs",
        "cursor",
        "Cursor.exe"
      ),
      path.join(userProfile, "AppData", "Local", "cursor", "Cursor.exe"),
      path.join(userProfile, "AppData", "Roaming", "cursor", "Cursor.exe"),
      // 系统路径
      "C:\\Program Files\\Cursor\\Cursor.exe",
      "C:\\Program Files (x86)\\Cursor\\Cursor.exe",
      // 其他可能的路径
      "D:\\Program Files\\Cursor\\Cursor.exe",
      "E:\\cursor\\Cursor.exe",
      "F:\\cursor\\Cursor.exe",
    ];
  } else if (ideType === "vscode") {
    processName = "Code.exe";
    executableName = "Code.exe";
    searchPaths = [
      // 用户特定路径
      path.join(
        userProfile,
        "AppData",
        "Local",
        "Programs",
        "Microsoft VS Code",
        "Code.exe"
      ),
      path.join(userProfile, "AppData", "Roaming", "Code", "Code.exe"),
      // 系统路径
      "C:\\Program Files\\Microsoft VS Code\\Code.exe",
      "C:\\Program Files (x86)\\Microsoft VS Code\\Code.exe",
      // 其他可能的路径 (扩展更多盘符和路径)
      "D:\\Program Files\\Microsoft VS Code\\Code.exe",
      "D:\\Microsoft VS Code\\Code.exe",
      "E:\\Program Files\\Microsoft VS Code\\Code.exe",
      "E:\\Microsoft VS Code\\Code.exe", // 用户实际安装路径
      "F:\\Program Files\\Microsoft VS Code\\Code.exe",
      "F:\\Microsoft VS Code\\Code.exe",
      "G:\\Microsoft VS Code\\Code.exe",
      "H:\\Microsoft VS Code\\Code.exe",
    ];
  }

  // 方法1: 检查当前运行的进程路径 (最准确的方法)
  try {
    console.log(`🔍 通过运行进程检测 ${ideType} 路径...`);
    const result = await execAsync(
      `wmic process where "name='${processName}'" get ExecutablePath /format:csv`
    );
    const lines = result.stdout
      .split("\n")
      .filter((line) => line.trim() && !line.includes("ExecutablePath"));
    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length >= 2) {
        const execPath = parts[1].trim();
        if (execPath && fs.existsSync(execPath)) {
          console.log(`✅ 通过运行进程找到 ${ideType}: ${execPath}`);
          // 缓存找到的路径
          idePathCache.set(`${ideType}_path`, execPath);
          return execPath;
        }
      }
    }
    console.log(`ℹ️ ${ideType} 当前未运行，继续其他检测方法...`);
  } catch (error) {
    console.log(`⚠️ 通过进程查找失败:`, error.message);
  }

  // 方法1.5: 通过PowerShell获取进程路径 (更可靠)
  try {
    console.log(`🔍 通过PowerShell检测 ${ideType} 进程路径...`);
    const psResult = await execAsync(
      `powershell -Command "Get-Process -Name '${processName.replace(
        ".exe",
        ""
      )}' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path"`
    );
    const paths = psResult.stdout.split("\n").filter((line) => line.trim());
    for (const execPath of paths) {
      const trimmedPath = execPath.trim();
      if (trimmedPath && fs.existsSync(trimmedPath)) {
        console.log(`✅ 通过PowerShell找到 ${ideType}: ${trimmedPath}`);
        return trimmedPath;
      }
    }
  } catch (error) {
    console.log(`⚠️ PowerShell进程查找失败:`, error.message);
  }

  // 方法2: 遍历搜索路径
  for (const searchPath of searchPaths) {
    try {
      if (fs.existsSync(searchPath)) {
        console.log(`✅ 通过路径搜索找到 ${ideType}: ${searchPath}`);
        return searchPath;
      }
    } catch (error) {
      console.log(`⚠️ 检查路径 ${searchPath} 失败:`, error.message);
    }
  }

  // 方法3: 通过注册表查找 (改进版)
  try {
    let regQueries = [];
    if (ideType === "vscode") {
      // VS Code特定的注册表查询
      regQueries = [
        'reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s /f "Visual Studio Code" 2>nul',
        'reg query "HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s /f "Visual Studio Code" 2>nul',
        'reg query "HKEY_LOCAL_MACHINE\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s /f "Visual Studio Code" 2>nul',
      ];
    } else if (ideType === "cursor") {
      // Cursor特定的注册表查询
      regQueries = [
        'reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s /f "Cursor" 2>nul',
        'reg query "HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s /f "Cursor" 2>nul',
      ];
    }

    for (const regQuery of regQueries) {
      try {
        const regResult = await execAsync(regQuery);
        const lines = regResult.stdout.split("\n");
        for (const line of lines) {
          if (
            line.includes("InstallLocation") ||
            line.includes("DisplayIcon")
          ) {
            const match = line.match(/REG_SZ\s+(.+)/);
            if (match) {
              let installPath = match[1].trim();
              // 处理DisplayIcon路径（可能包含可执行文件名）
              if (
                line.includes("DisplayIcon") &&
                installPath.includes(executableName)
              ) {
                installPath = path.dirname(installPath);
              }
              const execPath = path.join(installPath, executableName);
              if (fs.existsSync(execPath)) {
                console.log(`✅ 通过注册表找到 ${ideType}: ${execPath}`);
                return execPath;
              }
            }
          }
        }
      } catch (queryError) {
        console.log(`⚠️ 注册表查询失败: ${queryError.message}`);
      }
    }
  } catch (error) {
    console.log(`⚠️ 注册表查找失败:`, error.message);
  }

  // 方法4: 通过Windows应用程序路径查找
  try {
    if (ideType === "vscode") {
      const appPathResult = await execAsync(
        'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Code.exe" /ve 2>nul'
      );
      const match = appPathResult.stdout.match(/REG_SZ\s+(.+)/);
      if (match) {
        const execPath = match[1].trim();
        if (fs.existsSync(execPath)) {
          console.log(`✅ 通过应用程序路径找到 VS Code: ${execPath}`);
          return execPath;
        }
      }
    }
  } catch (error) {
    console.log(`⚠️ 应用程序路径查找失败:`, error.message);
  }

  // 方法5: 全盘智能搜索 (最后的手段)
  try {
    console.log(`🔍 开始全盘智能搜索 ${ideType}...`);
    const drives = await getAvailableDrives();
    console.log(`📀 检测到可用驱动器: ${drives.join(", ")}`);

    for (const drive of drives) {
      try {
        console.log(`🔍 搜索驱动器 ${drive} ...`);
        const searchResult = await searchIDEInDrive(
          drive,
          ideType,
          executableName
        );
        if (searchResult) {
          console.log(`✅ 全盘搜索找到 ${ideType}: ${searchResult}`);
          // 缓存找到的路径
          idePathCache.set(`${ideType}_path`, searchResult);
          return searchResult;
        }
      } catch (driveError) {
        console.log(`⚠️ 搜索驱动器 ${drive} 失败:`, driveError.message);
      }
    }
  } catch (error) {
    console.log(`⚠️ 全盘搜索失败:`, error.message);
  }

  console.log(`❌ 未找到 ${ideType} 安装路径`);
  return null;
}

// 获取可用驱动器列表
async function getAvailableDrives() {
  try {
    const result = await execAsync(
      "wmic logicaldisk get size,freespace,caption"
    );
    const lines = result.stdout
      .split("\n")
      .filter((line) => line.trim() && line.includes(":"));
    const drives = lines
      .map((line) => {
        const match = line.match(/([A-Z]:)/);
        return match ? match[1] : null;
      })
      .filter(Boolean);
    return drives.length > 0 ? drives : ["C:", "D:", "E:", "F:"];
  } catch (error) {
    console.log("⚠️ 获取驱动器列表失败，使用默认列表");
    return ["C:", "D:", "E:", "F:", "G:", "H:"];
  }
}

// 在指定驱动器中搜索IDE
async function searchIDEInDrive(drive, ideType, executableName) {
  const commonPaths = [
    `${drive}\\Program Files\\`,
    `${drive}\\Program Files (x86)\\`,
    `${drive}\\`,
  ];

  const searchPatterns =
    ideType === "vscode"
      ? ["Microsoft VS Code", "Visual Studio Code", "VSCode", "Code"]
      : ["Cursor", "cursor"];

  for (const basePath of commonPaths) {
    for (const pattern of searchPatterns) {
      try {
        const searchPath = path.join(basePath, pattern, executableName);
        if (fs.existsSync(searchPath)) {
          return searchPath;
        }

        // 也尝试直接在基础路径下查找
        const directPath = path.join(basePath, executableName);
        if (fs.existsSync(directPath)) {
          return directPath;
        }
      } catch (error) {
        // 继续搜索
      }
    }
  }

  return null;
}

// 重启IDE
ipcMain.handle("restart-ide", async (event, ideType) => {
  try {
    console.log(`🔄 重启 ${ideType} IDE...`);

    const { exec, spawn } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    // 智能启动逻辑，根据IDE类型选择最佳方法
    let startupMethods = [];

    if (ideType === "cursor") {
      // Cursor可以使用命令行启动
      startupMethods = [
        {
          name: "命令行启动",
          execute: async () => {
            await execAsync("cursor", { timeout: 5000 });
            return `Cursor 已启动 (命令行)`;
          },
        },
        {
          name: "start命令启动",
          execute: async () => {
            await execAsync('start "" cursor', { timeout: 5000 });
            return `Cursor 已启动 (start命令)`;
          },
        },
        {
          name: "动态路径启动",
          execute: async () => {
            const detectedPath = await detectIDEInstallPath("cursor");
            if (detectedPath) {
              spawn(detectedPath, [], { detached: true, stdio: "ignore" });
              return `Cursor 已启动: ${detectedPath}`;
            } else {
              throw new Error(`未找到 Cursor 安装路径`);
            }
          },
        },
      ];
    } else if (ideType === "vscode") {
      // VS Code优先使用动态路径检测，因为命令行被Cursor覆盖
      startupMethods = [
        {
          name: "动态路径启动",
          execute: async () => {
            const detectedPath = await detectIDEInstallPath("vscode");
            if (detectedPath) {
              console.log(`🎯 使用检测到的VS Code路径: ${detectedPath}`);
              spawn(detectedPath, [], { detached: true, stdio: "ignore" });
              return `VS Code 已启动: ${detectedPath}`;
            } else {
              throw new Error(`未找到 VS Code 安装路径`);
            }
          },
        },
        {
          name: "备用命令行启动",
          execute: async () => {
            // 作为备用方案，但可能启动Cursor
            console.log(`⚠️ 警告: code命令可能被Cursor覆盖`);
            await execAsync("code", { timeout: 5000 });
            return `VS Code 已启动 (命令行 - 可能不准确)`;
          },
        },
        {
          name: "备用start命令启动",
          execute: async () => {
            // 作为备用方案，但可能启动Cursor
            console.log(`⚠️ 警告: code命令可能被Cursor覆盖`);
            await execAsync('start "" code', { timeout: 5000 });
            return `VS Code 已启动 (start命令 - 可能不准确)`;
          },
        },
      ];
    }

    // 依次尝试每种启动方法
    for (const method of startupMethods) {
      try {
        console.log(`🔄 尝试${method.name}...`);
        const result = await method.execute();
        console.log(`✅ ${result}`);
        return {
          success: true,
          message: `${ideType} IDE 已重启`,
          method: method.name,
        };
      } catch (error) {
        console.log(`⚠️ ${method.name}失败:`, error.message);
      }
    }

    return {
      success: false,
      message: `无法启动 ${ideType} IDE，请手动启动`,
    };
  } catch (error) {
    console.error(`重启 ${ideType} IDE 失败:`, error);
    return {
      success: false,
      message: `重启 ${ideType} IDE 失败: ${error.message}`,
    };
  }
});

// 停止增强防护服务
ipcMain.handle("stop-enhanced-guardian", async () => {
  try {
    const results = { actions: [], errors: [] };

    // 停止内置守护进程
    await deviceManager.stopEnhancedGuardian(results);

    // 停止独立服务
    await deviceManager.stopStandaloneService(results);

    return {
      success: true,
      message: "增强防护服务已停止",
      actions: results.actions,
      errors: results.errors,
    };
  } catch (error) {
    console.error("停止增强防护服务失败:", error);
    return {
      success: false,
      message: error.message,
    };
  }
});

// 停止所有node进程
ipcMain.handle("stop-all-node-processes", async () => {
  try {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);
    const results = { actions: [], errors: [] };

    console.log("🛑 开始停止所有Node.js进程...");

    if (process.platform === "win32") {
      // Windows系统
      try {
        // 强制终止所有node.exe进程
        await execAsync("taskkill /F /IM node.exe 2>nul");
        results.actions.push("✅ 已终止所有Node.js进程");
        console.log("✅ Windows: 已终止所有Node.js进程");
      } catch (error) {
        if (error.message.includes("找不到该进程")) {
          results.actions.push("ℹ️ 未发现运行中的Node.js进程");
          console.log("ℹ️ Windows: 未发现运行中的Node.js进程");
        } else {
          results.errors.push(`终止Node.js进程失败: ${error.message}`);
          console.error("❌ Windows: 终止Node.js进程失败:", error.message);
        }
      }
    } else {
      // Unix/Linux/macOS系统
      try {
        await execAsync("pkill -f node");
        results.actions.push("✅ 已终止所有Node.js进程");
        console.log("✅ Unix: 已终止所有Node.js进程");
      } catch (error) {
        if (error.code === 1) {
          // pkill返回1表示没有找到匹配的进程
          results.actions.push("ℹ️ 未发现运行中的Node.js进程");
          console.log("ℹ️ Unix: 未发现运行中的Node.js进程");
        } else {
          results.errors.push(`终止Node.js进程失败: ${error.message}`);
          console.error("❌ Unix: 终止Node.js进程失败:", error.message);
        }
      }
    }

    return {
      success: true,
      message: "Node.js进程停止操作完成",
      actions: results.actions,
      errors: results.errors,
    };
  } catch (error) {
    console.error("停止所有Node.js进程失败:", error);
    return {
      success: false,
      message: error.message,
    };
  }
});

// 测试服务器连接
ipcMain.handle("test-server-connection", async () => {
  try {
    console.log("\n🔍 开始测试服务器连接...");
    const serverUrl = serverConfig.getHttpUrl("/api/health");
    console.log(`   目标地址: ${serverUrl}\n`);

    const response = await fetch(serverUrl, {
      method: "GET",
      timeout: 5000,
    });

    if (response.ok) {
      console.log("✅ 服务器连接测试成功\n");
      return {
        success: true,
        message: "服务器连接正常",
        serverUrl: serverUrl,
        status: response.status,
        timestamp: new Date().toISOString(),
      };
    } else {
      const errorMsg = `服务器响应异常 (HTTP ${response.status})`;
      console.log(`❌ ${errorMsg}\n`);
      return {
        success: false,
        error: errorMsg,
        serverUrl: serverUrl,
        status: response.status,
        suggestions: [
          "检查服务器是否正常运行",
          "确认API服务是否可用",
          "查看服务器日志获取详细信息",
        ],
      };
    }
  } catch (error) {
    const friendlyError = getFriendlyServerTestError(
      error,
      serverConfig.getHttpUrl()
    );
    console.error("\n❌ 服务器连接测试失败:", friendlyError.message);

    return {
      success: false,
      error: friendlyError.message,
      serverUrl: serverConfig.getHttpUrl(),
      details: friendlyError.details,
      suggestions: friendlyError.suggestions,
      timestamp: new Date().toISOString(),
    };
  }
});

// 获取友好的服务器测试错误信息
function getFriendlyServerTestError(error, serverUrl) {
  if (error.code === "ECONNREFUSED") {
    return {
      message: "无法连接到服务器",
      details: `服务器 ${serverUrl} 拒绝连接`,
      suggestions: [
        "确认后端服务是否正在运行",
        "检查端口是否被占用或被防火墙阻止",
        "验证服务器地址配置是否正确",
      ],
    };
  }

  if (error.code === "ENOTFOUND") {
    return {
      message: "服务器地址解析失败",
      details: `无法解析服务器地址 ${serverUrl}`,
      suggestions: [
        "检查网络连接是否正常",
        "确认服务器地址是否正确",
        "尝试使用IP地址代替域名",
      ],
    };
  }

  if (error.code === "ETIMEDOUT" || error.message.includes("timeout")) {
    return {
      message: "服务器连接超时",
      details: `连接 ${serverUrl} 超时`,
      suggestions: [
        "检查网络连接质量",
        "确认服务器是否响应缓慢",
        "稍后重试连接",
      ],
    };
  }

  if (error.message.includes("fetch failed")) {
    return {
      message: "网络请求失败",
      details: `无法访问 ${serverUrl}`,
      suggestions: [
        "检查网络连接状态",
        "确认服务器是否可达",
        "检查代理或防火墙设置",
      ],
    };
  }

  return {
    message: "服务器连接异常",
    details: error.message || "未知错误",
    suggestions: ["检查网络连接", "确认服务器配置", "查看详细日志获取更多信息"],
  };
}

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
