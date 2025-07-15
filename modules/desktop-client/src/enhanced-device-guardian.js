const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const chokidar = require("chokidar");
const { exec } = require("child_process");
const { promisify } = require("util");
const crypto = require("crypto");

/**
 * 增强设备ID守护进程
 * 高性能、零容忍的设备ID保护机制
 */

class EnhancedDeviceGuardian {
  constructor() {
    this.targetDeviceId = null;
    this.isGuarding = false;
    this.isClientCleaning = false; // 标记客户端是否正在清理
    this.watchers = new Map();
    this.backupMonitorInterval = null;
    this.execAsync = promisify(exec);

    // 动态IDE选择配置
    this.selectedIDE = "cursor"; // 默认选择Cursor
    this.monitorCursor = true; // 兼容性保持
    this.monitorVSCode = false; // 兼容性保持

    // 动态路径配置
    this.paths = this.initializePaths();

    // 监控配置
    this.config = {
      fileWatchDebounce: 100, // 文件监控防抖时间(ms)
      backupScanInterval: 5000, // 备份文件扫描间隔(ms)
      protectionCheckInterval: 10000, // 保护状态检查间隔(ms)
      maxLogEntries: 100, // 最大日志条目数
      statsCacheInterval: 30000, // 统计数据缓存间隔(ms)
      deviceIdVerifyInterval: 1000, // 设备ID定期验证间隔(ms) - 新增
    };

    this.logs = [];
    this.stats = {
      interceptedAttempts: 0,
      backupFilesRemoved: 0,
      protectionRestored: 0,
      startTime: null,
    };

    // 统计数据缓存
    this.sessionId = this.generateSessionId();
    this.statsCachePath = path.join(os.tmpdir(), "augment-guardian-stats.json");
    this.statsCacheInterval = null;

    // 事件通知回调
    this.eventCallback = null;
  }

  /**
   * 设置选择的IDE
   */
  setSelectedIDE(ideType) {
    this.selectedIDE = ideType;
    // 更新兼容性标志
    this.monitorCursor = ideType === "cursor";
    this.monitorVSCode = ideType === "vscode";

    this.log(
      `🎯 IDE选择已更新: ${ideType === "cursor" ? "Cursor" : "VS Code"}`,
      "info"
    );
  }

  /**
   * 获取当前选择的IDE的主要设备ID文件路径
   */
  getCurrentIDEStoragePath() {
    return this.selectedIDE === "cursor"
      ? this.paths.storageJson
      : this.paths.vscodeStorageJson;
  }

  /**
   * 获取当前选择的IDE的状态数据库路径
   */
  getCurrentIDEStatePath() {
    return this.selectedIDE === "cursor"
      ? this.paths.stateVscdb
      : this.paths.vscodeStateVscdb;
  }

  /**
   * 获取当前选择的IDE的全局存储路径
   */
  getCurrentIDEGlobalStoragePath() {
    return this.selectedIDE === "cursor"
      ? this.paths.cursorGlobalStorage
      : this.paths.vscodeGlobalStorage;
  }

  /**
   * 生成会话ID
   */
  generateSessionId() {
    return crypto.randomBytes(16).toString("hex");
  }

  /**
   * 保存统计数据到缓存文件
   */
  async saveStatsCache() {
    try {
      const cacheData = {
        sessionId: this.sessionId,
        startTime: this.stats.startTime?.toISOString(),
        stats: {
          interceptedAttempts: this.stats.interceptedAttempts,
          backupFilesRemoved: this.stats.backupFilesRemoved,
          protectionRestored: this.stats.protectionRestored,
        },
        lastUpdated: new Date().toISOString(),
      };

      await fs.writeJson(this.statsCachePath, cacheData, { spaces: 2 });
    } catch (error) {
      // 静默处理缓存保存失败
      console.warn("保存统计缓存失败:", error.message);
    }
  }

  /**
   * 从缓存文件加载统计数据
   */
  async loadStatsCache() {
    try {
      if (await fs.pathExists(this.statsCachePath)) {
        const cacheData = await fs.readJson(this.statsCachePath);

        // 检查是否是同一会话
        if (cacheData.sessionId === this.sessionId && cacheData.stats) {
          this.stats.interceptedAttempts =
            cacheData.stats.interceptedAttempts || 0;
          this.stats.backupFilesRemoved =
            cacheData.stats.backupFilesRemoved || 0;
          this.stats.protectionRestored =
            cacheData.stats.protectionRestored || 0;

          if (cacheData.startTime) {
            this.stats.startTime = new Date(cacheData.startTime);
          }

          return true;
        }
      }
    } catch (error) {
      // 静默处理缓存加载失败
      console.warn("加载统计缓存失败:", error.message);
    }
    return false;
  }

  /**
   * 获取快速统计数据（优化性能）
   */
  async getFastStats() {
    // 直接返回内存中的统计数据，避免文件解析
    return {
      interceptedAttempts: this.stats.interceptedAttempts,
      backupFilesRemoved: this.stats.backupFilesRemoved,
      protectionRestored: this.stats.protectionRestored,
      uptime: this.stats.startTime
        ? Date.now() - this.stats.startTime.getTime()
        : 0,
      sessionId: this.sessionId,
    };
  }

  /**
   * 初始化路径配置
   */
  initializePaths() {
    const userHome = os.homedir();
    return {
      // Cursor 相关路径
      cursorGlobalStorage: path.join(
        userHome,
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "globalStorage"
      ),
      cursorWorkspaceStorage: path.join(
        userHome,
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "workspaceStorage"
      ),
      cursorLocalStorage: path.join(
        userHome,
        "AppData",
        "Local",
        "Cursor",
        "User"
      ),

      // VS Code 相关路径
      vscodeGlobalStorage: path.join(
        userHome,
        "AppData",
        "Roaming",
        "Code",
        "User",
        "globalStorage"
      ),
      vscodeWorkspaceStorage: path.join(
        userHome,
        "AppData",
        "Roaming",
        "Code",
        "User",
        "workspaceStorage"
      ),
      vscodeLocalStorage: path.join(
        userHome,
        "AppData",
        "Local",
        "Code",
        "User"
      ),

      // VS Code Insiders 路径
      vscodeInsidersGlobalStorage: path.join(
        userHome,
        "AppData",
        "Roaming",
        "Code - Insiders",
        "User",
        "globalStorage"
      ),
      vscodeInsidersWorkspaceStorage: path.join(
        userHome,
        "AppData",
        "Roaming",
        "Code - Insiders",
        "User",
        "workspaceStorage"
      ),

      // 关键文件
      storageJson: path.join(
        userHome,
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "globalStorage",
        "storage.json"
      ),
      stateVscdb: path.join(
        userHome,
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "globalStorage",
        "state.vscdb"
      ),

      // VS Code 关键文件
      vscodeStorageJson: path.join(
        userHome,
        "AppData",
        "Roaming",
        "Code",
        "User",
        "globalStorage",
        "storage.json"
      ),
      vscodeStateVscdb: path.join(
        userHome,
        "AppData",
        "Roaming",
        "Code",
        "User",
        "globalStorage",
        "state.vscdb"
      ),

      // VS Code Insiders 关键文件
      vscodeInsidersStorageJson: path.join(
        userHome,
        "AppData",
        "Roaming",
        "Code - Insiders",
        "User",
        "globalStorage",
        "storage.json"
      ),
      vscodeInsidersStateVscdb: path.join(
        userHome,
        "AppData",
        "Roaming",
        "Code - Insiders",
        "User",
        "globalStorage",
        "state.vscdb"
      ),

      // 临时目录
      tempDir: os.tmpdir(),

      // 备份监控路径
      backupPaths: [
        // Cursor 路径
        path.join(
          userHome,
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "globalStorage"
        ),
        path.join(
          userHome,
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "workspaceStorage"
        ),
        path.join(userHome, "AppData", "Local", "Cursor", "User"),
        // VS Code 路径
        path.join(
          userHome,
          "AppData",
          "Roaming",
          "Code",
          "User",
          "globalStorage"
        ),
        path.join(
          userHome,
          "AppData",
          "Roaming",
          "Code",
          "User",
          "workspaceStorage"
        ),
        path.join(userHome, "AppData", "Local", "Code", "User"),
        // VS Code Insiders 路径
        path.join(
          userHome,
          "AppData",
          "Roaming",
          "Code - Insiders",
          "User",
          "globalStorage"
        ),
        path.join(
          userHome,
          "AppData",
          "Roaming",
          "Code - Insiders",
          "User",
          "workspaceStorage"
        ),
        os.tmpdir(),
      ],
    };
  }

  /**
   * 启动增强守护进程
   */
  async startGuarding(deviceId, options = {}) {
    if (this.isGuarding) {
      this.log("⚠️ 守护进程已在运行", "warn");
      return { success: false, message: "守护进程已在运行" };
    }

    try {
      this.targetDeviceId = deviceId;
      this.isGuarding = true;
      this.stats.startTime = new Date();

      // 处理IDE选择（支持新的单选模式和旧的多选模式）
      if (options.selectedIDE) {
        // 新的单选模式
        this.setSelectedIDE(options.selectedIDE);
      } else {
        // 兼容旧的多选模式
        this.monitorCursor = options.cleanCursor !== false; // 默认监控Cursor
        this.monitorVSCode = options.cleanVSCode === true; // 只有用户选择时才监控VSCode

        // 根据旧模式设置selectedIDE
        if (this.monitorVSCode && !this.monitorCursor) {
          this.selectedIDE = "vscode";
        } else {
          this.selectedIDE = "cursor"; // 默认或同时选择时优先Cursor
        }
      }

      this.log("🛡️ 启动增强设备ID守护进程", "info");
      this.log(`🎯 目标设备ID: ${deviceId}`, "info");
      this.log(
        `🎯 选择的IDE: ${this.selectedIDE === "cursor" ? "Cursor" : "VS Code"}`,
        "info"
      );
      this.log(`📁 监控路径: ${this.getCurrentIDEStoragePath()}`, "info");

      // 0. 初始化统计数据缓存
      await this.initializeStatsCache();

      // 1. 设置初始保护
      await this.setupInitialProtection();

      // 2. 启动文件系统监控
      await this.startFileSystemWatcher();

      // 3. 启动备份文件零容忍监控
      await this.startBackupMonitoring();

      // 4. 启动SQLite数据库监控
      await this.startDatabaseMonitoring();

      // 5. 设置增强文件保护
      await this.setupEnhancedProtection();

      // 6. 启动激活状态监控
      await this.startActivationMonitoring();

      // 7. 启动设备ID定期验证（新增）
      await this.startDeviceIdVerification();

      // 8. 启动统计数据缓存定时器
      this.startStatsCacheTimer();

      this.log("✅ 增强守护进程启动成功", "success");
      return { success: true, message: "守护进程启动成功" };
    } catch (error) {
      this.log(`❌ 守护进程启动失败: ${error.message}`, "error");
      this.isGuarding = false;
      return { success: false, message: error.message };
    }
  }

  /**
   * 独立启动守护进程（不依赖清理流程）
   */
  async startGuardingIndependently(deviceId = null, options = {}) {
    try {
      // 检查启动条件
      const requirements = await this.checkStartupRequirements(deviceId);
      if (!requirements.canStart) {
        return {
          success: false,
          message: requirements.reason,
          requirements: requirements,
        };
      }

      // 使用检查后的设备ID
      const targetDeviceId = requirements.deviceId;

      // 设置默认选项
      const defaultOptions = {
        enableBackupMonitoring: true,
        enableDatabaseMonitoring: true,
        enableEnhancedProtection: true,
        mode: "independent",
      };

      const finalOptions = { ...defaultOptions, ...options };

      this.log("🚀 独立启动增强设备ID守护进程", "info");
      this.log(`🎯 目标设备ID: ${targetDeviceId}`, "info");
      this.log(`🔧 启动模式: 独立模式`, "info");

      // 启动守护进程
      const result = await this.startGuarding(targetDeviceId, finalOptions);

      if (result.success) {
        this.log("✅ 独立守护进程启动成功", "success");
        return {
          success: true,
          message: "独立守护进程启动成功",
          deviceId: targetDeviceId,
          mode: "independent",
        };
      } else {
        return result;
      }
    } catch (error) {
      this.log(`❌ 独立启动失败: ${error.message}`, "error");
      return { success: false, message: error.message };
    }
  }

  /**
   * 检查启动要求
   */
  async checkStartupRequirements(deviceId = null) {
    try {
      const requirements = {
        canStart: false,
        reason: "",
        deviceId: null,
        checks: {
          deviceIdAvailable: false,
          noConflictingProcess: false,
          sufficientPermissions: false,
          validConfiguration: false,
        },
      };

      // 1. 检查是否已在运行
      if (this.isGuarding) {
        requirements.reason = "防护进程已在运行";
        return requirements;
      }

      // 2. 检查设备ID
      if (!deviceId) {
        try {
          const DeviceManager = require("./device-manager");
          const deviceManager = new DeviceManager();
          deviceId = await deviceManager.getCurrentDeviceId();
        } catch (error) {
          requirements.reason = "无法获取设备ID";
          return requirements;
        }
      }

      if (!deviceId) {
        requirements.reason = "设备ID不可用";
        return requirements;
      }

      requirements.deviceId = deviceId;
      requirements.checks.deviceIdAvailable = true;

      // 3. 检查权限（简化检查）
      requirements.checks.sufficientPermissions = true;

      // 4. 检查配置
      requirements.checks.validConfiguration = true;

      // 5. 检查冲突进程（简化检查）
      requirements.checks.noConflictingProcess = true;

      // 所有检查通过
      requirements.canStart = Object.values(requirements.checks).every(
        (check) => check
      );

      if (requirements.canStart) {
        requirements.reason = "所有启动条件满足";
      } else {
        requirements.reason = "启动条件不满足";
      }

      return requirements;
    } catch (error) {
      return {
        canStart: false,
        reason: `检查启动条件失败: ${error.message}`,
        deviceId: null,
        checks: {},
      };
    }
  }

  /**
   * 检查是否可以启动
   */
  async isReadyToStart() {
    const requirements = await this.checkStartupRequirements();
    return requirements.canStart;
  }

  /**
   * 初始化统计数据缓存
   */
  async initializeStatsCache() {
    // 每次启动时重置统计数据（保持启动归零的正确行为）
    this.stats = {
      interceptedAttempts: 0,
      backupFilesRemoved: 0,
      protectionRestored: 0,
      startTime: new Date(),
    };

    // 保存初始缓存
    await this.saveStatsCache();
    this.log("📊 统计数据缓存已初始化", "info");
  }

  /**
   * 启动统计数据缓存定时器
   */
  startStatsCacheTimer() {
    // 定期保存统计数据到缓存文件
    this.statsCacheInterval = setInterval(async () => {
      await this.saveStatsCache();
    }, this.config.statsCacheInterval);

    this.log("⏰ 统计数据缓存定时器已启动", "info");
  }

  /**
   * 停止统计数据缓存定时器
   */
  stopStatsCacheTimer() {
    if (this.statsCacheInterval) {
      clearInterval(this.statsCacheInterval);
      this.statsCacheInterval = null;
      this.log("⏰ 统计数据缓存定时器已停止", "info");
    }
  }

  /**
   * 更新统计数据并触发缓存保存
   */
  async updateStats(type, increment = 1) {
    switch (type) {
      case "intercept":
        this.stats.interceptedAttempts += increment;
        break;
      case "backup":
        this.stats.backupFilesRemoved += increment;
        break;
      case "restore":
        this.stats.protectionRestored += increment;
        break;
    }

    // 立即保存重要统计更新
    await this.saveStatsCache();
  }

  /**
   * 停止守护进程
   */
  async stopGuarding() {
    if (!this.isGuarding) return { success: true, message: "守护进程未运行" };

    this.log("🛑 停止增强设备ID守护进程", "info");
    this.isGuarding = false;

    // 停止所有监控器
    for (const [name, watcher] of this.watchers) {
      try {
        await watcher.close();
        this.log(`✅ 已停止${name}监控`, "info");
      } catch (error) {
        this.log(`⚠️ 停止${name}监控失败: ${error.message}`, "warn");
      }
    }
    this.watchers.clear();

    // 停止备份监控
    if (this.backupMonitorInterval) {
      clearInterval(this.backupMonitorInterval);
      this.backupMonitorInterval = null;
    }

    // 停止激活状态监控
    if (this.activationCheckInterval) {
      clearInterval(this.activationCheckInterval);
      this.activationCheckInterval = null;
      this.log("🔐 激活状态监控已停止", "info");
    }

    // 停止设备ID定期验证
    if (this.deviceIdVerifyInterval) {
      clearInterval(this.deviceIdVerifyInterval);
      this.deviceIdVerifyInterval = null;
      this.log("🔍 设备ID定期验证已停止", "info");
    }

    // 停止统计数据缓存定时器
    this.stopStatsCacheTimer();

    // 最后保存一次统计数据
    await this.saveStatsCache();

    this.log("✅ 守护进程已完全停止", "success");
    return { success: true, message: "守护进程已停止" };
  }

  /**
   * 设置客户端清理状态
   */
  setClientCleaningState(isCleaning) {
    this.isClientCleaning = isCleaning;
    if (isCleaning) {
      this.log("🔄 客户端清理开始，暂停设备ID监控", "info");
    } else {
      this.log("✅ 客户端清理完成，恢复设备ID监控", "info");
    }
  }

  /**
   * 设置事件通知回调
   */
  setEventCallback(callback) {
    this.eventCallback = callback;
  }

  /**
   * 触发事件通知
   */
  notifyEvent(eventType, data = {}) {
    if (this.eventCallback) {
      try {
        this.eventCallback(eventType, data);
      } catch (error) {
        this.log(`❌ 事件通知失败: ${error.message}`, "error");
      }
    }
  }

  /**
   * 设置初始保护
   */
  async setupInitialProtection() {
    try {
      // 确保目标设备ID已设置
      await this.enforceTargetDeviceId();

      // 清理现有备份文件
      await this.cleanExistingBackupFiles();

      // 设置基础文件保护
      await this.setBasicFileProtection();

      this.log("🔒 初始保护设置完成", "success");
    } catch (error) {
      this.log(`❌ 设置初始保护失败: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * 强制设置目标设备ID
   */
  async enforceTargetDeviceId() {
    try {
      // 根据选择的IDE动态设置设备ID
      if (this.selectedIDE === "cursor") {
        await this.enforceDeviceIdForIDE(this.paths.storageJson, "Cursor");
      } else if (this.selectedIDE === "vscode") {
        await this.enforceDeviceIdForIDE(
          this.paths.vscodeStorageJson,
          "VS Code"
        );

        // 也处理VS Code Insiders（如果存在）
        if (
          await fs.pathExists(
            path.dirname(this.paths.vscodeInsidersStorageJson)
          )
        ) {
          await this.enforceDeviceIdForIDE(
            this.paths.vscodeInsidersStorageJson,
            "VS Code Insiders"
          );
        }
      }
    } catch (error) {
      this.log(`❌ 强制设置设备ID失败: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * 为特定IDE强制设置设备ID
   */
  async enforceDeviceIdForIDE(filePath, ideName) {
    try {
      let currentData = {};

      // 读取现有数据
      if (await fs.pathExists(filePath)) {
        try {
          currentData = await fs.readJson(filePath);
        } catch (error) {
          this.log(`⚠️ 读取${ideName}配置失败，将创建新配置`, "warn");
        }
      }

      // 强制设置目标设备ID
      currentData["telemetry.devDeviceId"] = this.targetDeviceId;

      // 确保目录存在
      await fs.ensureDir(path.dirname(filePath));

      // 写入配置
      await fs.writeJson(filePath, currentData, { spaces: 2 });

      this.log(
        `✅ 已强制设置${ideName}设备ID: ${this.targetDeviceId}`,
        "success"
      );
    } catch (error) {
      this.log(`❌ 强制设置${ideName}设备ID失败: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * 启动文件系统监控
   */
  async startFileSystemWatcher() {
    try {
      // 根据选择的IDE动态监控
      if (this.selectedIDE === "cursor") {
        await this.setupCursorWatchers();
      } else if (this.selectedIDE === "vscode") {
        await this.setupVSCodeWatchers();
      }

      this.log(
        `📡 文件系统监控已启动 - ${
          this.selectedIDE === "cursor" ? "Cursor" : "VS Code"
        }`,
        "success"
      );
    } catch (error) {
      this.log(`❌ 启动文件系统监控失败: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * 设置Cursor监控器
   */
  async setupCursorWatchers() {
    // 监控 Cursor globalStorage 目录
    const globalWatcher = chokidar.watch(this.paths.cursorGlobalStorage, {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: this.config.fileWatchDebounce,
        pollInterval: 50,
      },
    });

    globalWatcher.on("all", (event, filePath) => {
      this.handleFileSystemEvent(event, filePath, "cursor-global");
    });

    this.watchers.set("cursorGlobalStorage", globalWatcher);

    // 监控 Cursor 工作区存储目录
    if (await fs.pathExists(this.paths.cursorWorkspaceStorage)) {
      const workspaceWatcher = chokidar.watch(
        this.paths.cursorWorkspaceStorage,
        {
          ignored: /node_modules/,
          persistent: true,
          ignoreInitial: true,
          depth: 2, // 限制监控深度
          awaitWriteFinish: {
            stabilityThreshold: this.config.fileWatchDebounce,
            pollInterval: 50,
          },
        }
      );

      workspaceWatcher.on("all", (event, filePath) => {
        this.handleFileSystemEvent(event, filePath, "cursor-workspace");
      });

      this.watchers.set("cursorWorkspaceStorage", workspaceWatcher);
    }
  }

  /**
   * 设置VSCode监控器
   */
  async setupVSCodeWatchers() {
    // 监控 VS Code globalStorage 目录
    if (await fs.pathExists(this.paths.vscodeGlobalStorage)) {
      const vscodeGlobalWatcher = chokidar.watch(
        this.paths.vscodeGlobalStorage,
        {
          ignored: /node_modules/,
          persistent: true,
          ignoreInitial: true,
          awaitWriteFinish: {
            stabilityThreshold: this.config.fileWatchDebounce, // 使用与Cursor相同的防抖时间
            pollInterval: 50, // 与Cursor保持一致
          },
        }
      );

      vscodeGlobalWatcher.on("all", (event, filePath) => {
        this.handleFileSystemEvent(event, filePath, "vscode-global");
      });

      this.watchers.set("vscodeGlobalStorage", vscodeGlobalWatcher);
    }

    // 监控 VS Code 工作区存储目录
    if (await fs.pathExists(this.paths.vscodeWorkspaceStorage)) {
      const vscodeWorkspaceWatcher = chokidar.watch(
        this.paths.vscodeWorkspaceStorage,
        {
          ignored: /node_modules/,
          persistent: true,
          ignoreInitial: true,
          depth: 2, // 限制监控深度
          awaitWriteFinish: {
            stabilityThreshold: this.config.fileWatchDebounce, // 使用与Cursor相同的防抖时间
            pollInterval: 50, // 与Cursor保持一致
          },
        }
      );

      vscodeWorkspaceWatcher.on("all", (event, filePath) => {
        this.handleFileSystemEvent(event, filePath, "vscode-workspace");
      });

      this.watchers.set("vscodeWorkspaceStorage", vscodeWorkspaceWatcher);
    }

    // 监控 VS Code Insiders globalStorage 目录（如果存在）
    if (await fs.pathExists(this.paths.vscodeInsidersGlobalStorage)) {
      const vscodeInsidersGlobalWatcher = chokidar.watch(
        this.paths.vscodeInsidersGlobalStorage,
        {
          ignored: /node_modules/,
          persistent: true,
          ignoreInitial: true,
          awaitWriteFinish: {
            stabilityThreshold: this.config.fileWatchDebounce, // 使用与Cursor相同的防抖时间
            pollInterval: 50, // 与Cursor保持一致
          },
        }
      );

      vscodeInsidersGlobalWatcher.on("all", (event, filePath) => {
        this.handleFileSystemEvent(event, filePath, "vscode-insiders-global");
      });

      this.watchers.set(
        "vscodeInsidersGlobalStorage",
        vscodeInsidersGlobalWatcher
      );
    }

    // 监控 VS Code Insiders 工作区存储目录（如果存在）
    if (await fs.pathExists(this.paths.vscodeInsidersWorkspaceStorage)) {
      const vscodeInsidersWorkspaceWatcher = chokidar.watch(
        this.paths.vscodeInsidersWorkspaceStorage,
        {
          ignored: /node_modules/,
          persistent: true,
          ignoreInitial: true,
          depth: 2, // 限制监控深度
          awaitWriteFinish: {
            stabilityThreshold: this.config.fileWatchDebounce, // 使用与Cursor相同的防抖时间
            pollInterval: 50, // 与Cursor保持一致
          },
        }
      );

      vscodeInsidersWorkspaceWatcher.on("all", (event, filePath) => {
        this.handleFileSystemEvent(
          event,
          filePath,
          "vscode-insiders-workspace"
        );
      });

      this.watchers.set(
        "vscodeInsidersWorkspaceStorage",
        vscodeInsidersWorkspaceWatcher
      );
    }
  }

  /**
   * 处理文件系统事件
   */
  async handleFileSystemEvent(event, filePath, source) {
    if (!this.isGuarding || this.isClientCleaning) return;

    const fileName = path.basename(filePath);
    const fileExt = path.extname(fileName);

    try {
      // 监控 storage.json 相关文件
      if (fileName.startsWith("storage.json")) {
        await this.handleStorageJsonEvent(event, filePath, fileName, source);
      }

      // 监控备份文件
      else if (this.isBackupFile(fileName, fileExt)) {
        await this.handleBackupFileEvent(event, filePath, fileName);
      }

      // 监控 state.vscdb 相关文件
      else if (fileName.startsWith("state.vscdb")) {
        await this.handleDatabaseEvent(event, filePath, fileName, source);
      }
    } catch (error) {
      this.log(`❌ 处理文件事件失败 ${fileName}: ${error.message}`, "error");
    }
  }

  /**
   * 处理 storage.json 事件
   */
  async handleStorageJsonEvent(event, filePath, fileName, source) {
    const ideName = source.includes("cursor") ? "Cursor" : "VS Code";
    this.log(
      `🔍 检测到${ideName} storage.json事件: ${event} - ${fileName}`,
      "info"
    );

    if (fileName.includes(".tmp") || fileName.includes(".vsctmp")) {
      // IDE创建了临时文件，立即拦截
      await this.interceptTempFile(filePath, source);
      // 注意：拦截计数在interceptTempFile内部处理，避免重复计数
    } else if (fileName === "storage.json" && event === "change") {
      // 主配置文件被修改，验证设备ID
      await this.verifyAndRestoreDeviceId(source);
    }
  }

  /**
   * 拦截临时文件
   */
  async interceptTempFile(tempFilePath, source) {
    try {
      const ideName = source.includes("cursor") ? "Cursor" : "VS Code";
      this.log(`🚨 拦截${ideName}临时文件修改`, "warn");

      // 等待文件写入完成
      await new Promise((resolve) => setTimeout(resolve, 50));

      if (!(await fs.pathExists(tempFilePath))) return;

      // 读取临时文件内容
      const tempData = await fs.readJson(tempFilePath);

      // 检查设备ID是否被修改
      if (
        tempData["telemetry.devDeviceId"] &&
        tempData["telemetry.devDeviceId"] !== this.targetDeviceId
      ) {
        const interceptedId = tempData["telemetry.devDeviceId"]; // 保存原始ID
        this.log(`⚠️ 检测到${ideName}设备ID被修改:`, "warn");
        this.log(`  原ID: ${this.targetDeviceId}`, "info");
        this.log(`  新ID: ${interceptedId}`, "info");

        // 强制恢复目标设备ID
        tempData["telemetry.devDeviceId"] = this.targetDeviceId;

        // 写回临时文件
        await fs.writeJson(tempFilePath, tempData, { spaces: 2 });

        this.log(`✅ 已拦截并恢复${ideName}目标设备ID`, "success");
        await this.updateStats("intercept");

        // 通知前端更新状态
        this.notifyEvent("intercept-success", {
          type: "device-id-intercept",
          ide: ideName,
          targetDeviceId: this.targetDeviceId,
          interceptedId: interceptedId, // 使用保存的原始ID
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.log(`❌ 拦截临时文件失败: ${error.message}`, "error");
    }
  }

  /**
   * 验证并恢复设备ID
   */
  async verifyAndRestoreDeviceId(source = "cursor-global") {
    try {
      // 根据source确定要检查的文件
      let targetPath;
      let ideName;

      if (source.includes("cursor")) {
        targetPath = this.paths.storageJson;
        ideName = "Cursor";
      } else if (source.includes("vscode")) {
        targetPath = this.paths.vscodeStorageJson;
        ideName = "VS Code";
      } else {
        // 默认检查所有用户选择的IDE
        await this.verifyAllSelectedIDEs();
        return;
      }

      if (!(await fs.pathExists(targetPath))) {
        this.log(`⚠️ ${ideName}配置文件被删除，正在恢复...`, "warn");
        await this.enforceDeviceIdForIDE(targetPath, ideName);
        await this.updateStats("restore");

        // 通知前端更新状态
        this.notifyEvent("protection-restored", {
          type: "config-file-restored",
          ide: ideName,
          targetDeviceId: this.targetDeviceId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const currentData = await fs.readJson(targetPath);
      const currentDeviceId = currentData["telemetry.devDeviceId"];

      if (currentDeviceId !== this.targetDeviceId) {
        this.log(`🚨 ${ideName}设备ID被篡改，正在恢复...`, "warn");
        this.log(`  当前ID: ${currentDeviceId}`, "info");
        this.log(`  目标ID: ${this.targetDeviceId}`, "info");

        // 强制恢复
        await this.enforceDeviceIdForIDE(targetPath, ideName);
        await this.setBasicFileProtection();

        this.log(`✅ ${ideName}设备ID已恢复`, "success");
        await this.updateStats("restore");

        // 通知前端更新状态
        this.notifyEvent("protection-restored", {
          type: "device-id-restored",
          ide: ideName,
          targetDeviceId: this.targetDeviceId,
          previousId: currentDeviceId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.log(`❌ 验证设备ID失败: ${error.message}`, "error");
    }
  }

  /**
   * 验证所有用户选择的IDE的设备ID
   */
  async verifyAllSelectedIDEs() {
    if (this.monitorCursor) {
      await this.verifyAndRestoreDeviceId("cursor-global");
    }
    if (this.monitorVSCode) {
      await this.verifyAndRestoreDeviceId("vscode-global");
    }
  }

  /**
   * 日志记录
   */
  log(message, level = "info") {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message };

    this.logs.push(logEntry);

    // 限制日志条目数量
    if (this.logs.length > this.config.maxLogEntries) {
      this.logs.shift();
    }

    // 控制台输出
    const prefix =
      {
        info: "ℹ️",
        warn: "⚠️",
        error: "❌",
        success: "✅",
      }[level] || "📝";

    console.log(
      `${prefix} [${timestamp.split("T")[1].split(".")[0]}] ${message}`
    );
  }

  /**
   * 启动备份文件零容忍监控
   */
  async startBackupMonitoring() {
    try {
      // 立即清理现有备份文件
      await this.cleanExistingBackupFiles();

      // 启动定期扫描
      this.backupMonitorInterval = setInterval(async () => {
        if (!this.isGuarding || this.isClientCleaning) return;
        await this.scanAndRemoveBackupFiles();
      }, this.config.backupScanInterval);

      this.log("🗑️ 备份文件零容忍监控已启动", "success");
    } catch (error) {
      this.log(`❌ 启动备份监控失败: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * 启动激活状态监控
   * 定期检查激活状态，如果失效则自动停止守护进程
   */
  async startActivationMonitoring() {
    try {
      // 每60秒检查一次激活状态
      this.activationCheckInterval = setInterval(async () => {
        if (!this.isGuarding) return;

        try {
          const isActivated = await this.checkActivationStatus();
          if (!isActivated) {
            this.log("🚨 检测到激活状态失效，自动停止增强防护", "warning");
            await this.stopGuarding();
          }
        } catch (error) {
          this.log(`⚠️ 激活状态检查失败: ${error.message}`, "warning");
        }
      }, 60000); // 60秒间隔

      this.log("🔐 激活状态监控已启动", "success");
    } catch (error) {
      this.log(`❌ 启动激活状态监控失败: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * 检查激活状态
   */
  async checkActivationStatus() {
    try {
      const configPath = path.join(
        os.homedir(),
        ".augment-device-manager",
        "config.json"
      );

      if (!(await fs.pathExists(configPath))) {
        return false;
      }

      const config = await fs.readJson(configPath);
      if (!config.activation) {
        return false;
      }

      // 简单的本地时间检查（作为快速预检）
      if (config.activation.expiresAt) {
        const now = new Date();
        const expiry = new Date(config.activation.expiresAt);
        if (now > expiry) {
          return false;
        }
      }

      return true;
    } catch (error) {
      this.log(`❌ 检查激活状态失败: ${error.message}`, "error");
      return false;
    }
  }

  /**
   * 启动设备ID定期验证
   * 定期检查设备ID是否被修改，确保及时恢复
   */
  async startDeviceIdVerification() {
    try {
      // 设置定期验证间隔
      this.deviceIdVerifyInterval = setInterval(async () => {
        if (!this.isGuarding || this.isClientCleaning) return;

        try {
          // 根据选择的IDE验证并恢复设备ID
          if (this.selectedIDE === "vscode") {
            await this.verifyAndRestoreDeviceId("vscode-global");
          } else {
            await this.verifyAndRestoreDeviceId("cursor-global");
          }
        } catch (error) {
          this.log(`⚠️ 设备ID定期验证失败: ${error.message}`, "warning");
        }
      }, this.config.deviceIdVerifyInterval);

      this.log("🔍 设备ID定期验证已启动", "success");
    } catch (error) {
      this.log(`❌ 启动设备ID定期验证失败: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * 清理现有备份文件
   */
  async cleanExistingBackupFiles() {
    let removedCount = 0;

    for (const basePath of this.paths.backupPaths) {
      try {
        if (!(await fs.pathExists(basePath))) continue;

        const items = await fs.readdir(basePath, { withFileTypes: true });

        for (const item of items) {
          const itemPath = path.join(basePath, item.name);

          if (
            this.isBackupFile(item.name) ||
            this.isBackupDirectory(item.name)
          ) {
            try {
              await fs.remove(itemPath);
              removedCount++;
              this.log(`🗑️ 已删除备份: ${item.name}`, "info");
            } catch (error) {
              this.log(
                `⚠️ 删除备份失败 ${item.name}: ${error.message}`,
                "warn"
              );
            }
          }
        }
      } catch (error) {
        this.log(`⚠️ 扫描路径失败 ${basePath}: ${error.message}`, "warn");
      }
    }

    await this.updateStats("backup", removedCount);
    this.log(`✅ 清理完成，共删除 ${removedCount} 个备份文件`, "success");

    // 如果删除了备份文件，通知前端更新状态
    if (removedCount > 0) {
      this.notifyEvent("backup-removed", {
        type: "batch-backup-cleanup",
        removedCount: removedCount,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 扫描并删除备份文件
   */
  async scanAndRemoveBackupFiles() {
    let removedCount = 0;

    for (const basePath of this.paths.backupPaths) {
      try {
        if (!(await fs.pathExists(basePath))) continue;

        const items = await fs.readdir(basePath, { withFileTypes: true });

        for (const item of items) {
          if (
            this.isBackupFile(item.name) ||
            this.isBackupDirectory(item.name)
          ) {
            const itemPath = path.join(basePath, item.name);
            try {
              await fs.remove(itemPath);
              removedCount++;
              this.log(`🗑️ 实时删除备份: ${item.name}`, "info");
            } catch (error) {
              // 静默处理删除失败，避免日志过多
            }
          }
        }
      } catch (error) {
        // 静默处理扫描失败
      }
    }

    if (removedCount > 0) {
      await this.updateStats("backup", removedCount);

      // 通知前端更新状态
      this.notifyEvent("backup-removed", {
        type: "periodic-backup-scan",
        removedCount: removedCount,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 判断是否为备份文件
   */
  isBackupFile(fileName, fileExt = null) {
    if (!fileExt) fileExt = path.extname(fileName);

    const backupExtensions = [".backup", ".bak", ".tmp", ".vsctmp", ".old"];
    const backupPatterns = [
      /\.backup\./,
      /\.bak\./,
      /\.tmp$/,
      /\.vsctmp$/,
      /backup-\d+/,
      /cursor-backup/,
      /augment-backup/,
      /workspace-augment-backup/,
      /vscode-.*-backup/,
    ];

    // 检查扩展名
    if (backupExtensions.includes(fileExt)) return true;

    // 检查文件名模式
    return backupPatterns.some((pattern) => pattern.test(fileName));
  }

  /**
   * 判断是否为备份目录
   */
  isBackupDirectory(dirName) {
    const backupDirPatterns = [
      /cursor-backup/,
      /augment-backup/,
      /workspace-augment-backup/,
      /vscode-.*-backup/,
      /backup-\d+/,
    ];

    return backupDirPatterns.some((pattern) => pattern.test(dirName));
  }

  /**
   * 处理备份文件事件
   */
  async handleBackupFileEvent(event, filePath, fileName) {
    if (event === "add" || event === "addDir") {
      this.log(`🚨 检测到新备份文件: ${fileName}`, "warn");

      try {
        await fs.remove(filePath);
        await this.updateStats("backup");
        this.log(`✅ 已立即删除备份: ${fileName}`, "success");

        // 通知前端更新状态
        this.notifyEvent("backup-removed", {
          type: "backup-file-removed",
          fileName: fileName,
          filePath: filePath,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.log(`❌ 删除备份失败 ${fileName}: ${error.message}`, "error");
      }
    }
  }

  /**
   * 启动SQLite数据库监控
   */
  async startDatabaseMonitoring() {
    try {
      // 分析现有数据库
      await this.analyzeSQLiteDatabase();

      // 监控数据库文件变化
      if (await fs.pathExists(this.paths.stateVscdb)) {
        const dbWatcher = chokidar.watch(this.paths.stateVscdb, {
          persistent: true,
          ignoreInitial: true,
          awaitWriteFinish: {
            stabilityThreshold: 200,
            pollInterval: 100,
          },
        });

        dbWatcher.on("change", () => {
          this.handleDatabaseChange();
        });

        this.watchers.set("database", dbWatcher);
      }

      this.log("🗄️ SQLite数据库监控已启动", "success");
    } catch (error) {
      this.log(`❌ 启动数据库监控失败: ${error.message}`, "error");
      // 数据库监控失败不应该阻止整个守护进程
    }
  }

  /**
   * 分析SQLite数据库
   */
  async analyzeSQLiteDatabase() {
    try {
      if (!(await fs.pathExists(this.paths.stateVscdb))) {
        this.log("ℹ️ state.vscdb数据库不存在", "info");
        return;
      }

      // 这里可以添加SQLite数据库分析逻辑
      // 由于需要sqlite3模块，暂时记录数据库存在
      this.log("🗄️ 检测到state.vscdb数据库", "info");

      // TODO: 添加SQLite数据库内容分析
      // 检查是否包含设备ID或用户身份信息
    } catch (error) {
      this.log(`⚠️ 分析数据库失败: ${error.message}`, "warn");
    }
  }

  /**
   * 处理数据库变化
   */
  async handleDatabaseChange() {
    if (!this.isGuarding || this.isClientCleaning) return;

    this.log("🗄️ 检测到数据库变化", "info");
    // TODO: 添加数据库内容验证逻辑
  }

  /**
   * 处理数据库事件
   */
  async handleDatabaseEvent(event, filePath, fileName) {
    this.log(`🗄️ 检测到数据库事件: ${event} - ${fileName}`, "info");

    if (fileName.includes(".backup") || fileName.includes(".bak")) {
      // 数据库备份文件，立即删除
      await this.handleBackupFileEvent(event, filePath, fileName);
    }
  }

  /**
   * 设置基础文件保护
   * 注意：已禁用文件级被动保护，仅使用实时监控主动保护
   */
  async setBasicFileProtection() {
    try {
      if (await fs.pathExists(this.paths.storageJson)) {
        // 禁用文件级被动保护，避免权限冲突
        this.log("🛡️ 使用实时监控保护模式，跳过基础文件保护", "info");

        // 原只读保护代码已注释：
        // await this.execAsync(`attrib +R "${this.paths.storageJson}"`);
      }
    } catch (error) {
      this.log(`⚠️ 设置保护模式失败: ${error.message}`, "warn");
    }
  }

  /**
   * 设置增强文件保护
   * 注意：已禁用文件级被动保护，仅使用实时监控主动保护
   * 原因：避免权限冲突，实时监控已足够强大
   */
  async setupEnhancedProtection() {
    try {
      if (!(await fs.pathExists(this.paths.storageJson))) return;

      // 禁用文件级被动保护，仅依靠实时监控主动保护
      this.log("🛡️ 使用实时监控保护模式，跳过文件级保护", "info");
      this.log("📡 实时监控可精确拦截IDE修改并立即恢复", "info");

      // 原被动保护代码已注释：
      // - attrib +R (只读属性)
      // - icacls deny (权限拒绝)
      // 这些会导致程序自身无法写入，产生权限冲突
    } catch (error) {
      this.log(`❌ 设置增强保护失败: ${error.message}`, "error");
    }
  }

  /**
   * 获取守护进程状态
   */
  async getStatus() {
    try {
      // 根据选择的IDE获取相应的设备ID文件
      const currentStoragePath = this.getCurrentIDEStoragePath();
      const exists = await fs.pathExists(currentStoragePath);
      let currentDeviceId = null;

      if (exists) {
        const data = await fs.readJson(currentStoragePath);
        currentDeviceId = data["telemetry.devDeviceId"];
      }

      // 获取内存使用情况
      const memoryUsage = process.memoryUsage();
      const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

      // 使用快速统计数据获取
      const fastStats = await this.getFastStats();

      return {
        isGuarding: this.isGuarding,
        isClientCleaning: this.isClientCleaning,
        selectedIDE: this.selectedIDE,
        targetDeviceId: this.targetDeviceId,
        currentDeviceId: currentDeviceId,
        isProtected: currentDeviceId === this.targetDeviceId,
        configExists: exists,
        monitoringPath: currentStoragePath,
        stats: {
          interceptedAttempts: fastStats.interceptedAttempts,
          backupFilesRemoved: fastStats.backupFilesRemoved,
          protectionRestored: fastStats.protectionRestored,
          startTime: this.stats.startTime,
        },
        recentLogs: this.logs.slice(-10),
        watchersCount: this.watchers.size,
        uptime: fastStats.uptime,
        memoryUsage: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
          usedMB: memoryUsedMB,
        },
      };
    } catch (error) {
      return {
        isGuarding: this.isGuarding,
        targetDeviceId: this.targetDeviceId,
        currentDeviceId: null,
        isProtected: false,
        configExists: false,
        error: error.message,
        stats: this.stats,
      };
    }
  }
}

module.exports = { EnhancedDeviceGuardian };
