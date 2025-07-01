const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const chokidar = require("chokidar");
const { exec } = require("child_process");
const { promisify } = require("util");

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

    // 动态路径配置
    this.paths = this.initializePaths();

    // 监控配置
    this.config = {
      fileWatchDebounce: 100, // 文件监控防抖时间(ms)
      backupScanInterval: 5000, // 备份文件扫描间隔(ms)
      protectionCheckInterval: 10000, // 保护状态检查间隔(ms)
      maxLogEntries: 100, // 最大日志条目数
    };

    this.logs = [];
    this.stats = {
      interceptedAttempts: 0,
      backupFilesRemoved: 0,
      protectionRestored: 0,
      startTime: null,
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

      // 临时目录
      tempDir: os.tmpdir(),

      // 备份监控路径
      backupPaths: [
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

      this.log("🛡️ 启动增强设备ID守护进程", "info");
      this.log(`🎯 目标设备ID: ${deviceId}`, "info");

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

      this.log("✅ 增强守护进程启动成功", "success");
      return { success: true, message: "守护进程启动成功" };
    } catch (error) {
      this.log(`❌ 守护进程启动失败: ${error.message}`, "error");
      this.isGuarding = false;
      return { success: false, message: error.message };
    }
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
      let currentData = {};

      // 读取现有数据
      if (await fs.pathExists(this.paths.storageJson)) {
        try {
          currentData = await fs.readJson(this.paths.storageJson);
        } catch (error) {
          this.log("⚠️ 读取现有配置失败，将创建新配置", "warn");
        }
      }

      // 强制设置目标设备ID
      currentData["telemetry.devDeviceId"] = this.targetDeviceId;

      // 确保目录存在
      await fs.ensureDir(path.dirname(this.paths.storageJson));

      // 写入配置
      await fs.writeJson(this.paths.storageJson, currentData, { spaces: 2 });

      this.log(`✅ 已强制设置设备ID: ${this.targetDeviceId}`, "success");
    } catch (error) {
      this.log(`❌ 强制设置设备ID失败: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * 启动文件系统监控
   */
  async startFileSystemWatcher() {
    try {
      // 监控 globalStorage 目录
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
        this.handleFileSystemEvent(event, filePath, "global");
      });

      this.watchers.set("globalStorage", globalWatcher);

      // 监控工作区存储目录
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
          this.handleFileSystemEvent(event, filePath, "workspace");
        });

        this.watchers.set("workspaceStorage", workspaceWatcher);
      }

      this.log("👁️ 文件系统监控已启动", "success");
    } catch (error) {
      this.log(`❌ 启动文件系统监控失败: ${error.message}`, "error");
      throw error;
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
        await this.handleStorageJsonEvent(event, filePath, fileName);
      }

      // 监控备份文件
      else if (this.isBackupFile(fileName, fileExt)) {
        await this.handleBackupFileEvent(event, filePath, fileName);
      }

      // 监控 state.vscdb 相关文件
      else if (fileName.startsWith("state.vscdb")) {
        await this.handleDatabaseEvent(event, filePath, fileName);
      }
    } catch (error) {
      this.log(`❌ 处理文件事件失败 ${fileName}: ${error.message}`, "error");
    }
  }

  /**
   * 处理 storage.json 事件
   */
  async handleStorageJsonEvent(event, filePath, fileName) {
    this.log(`🔍 检测到storage.json事件: ${event} - ${fileName}`, "info");

    if (fileName.includes(".tmp") || fileName.includes(".vsctmp")) {
      // IDE创建了临时文件，立即拦截
      await this.interceptTempFile(filePath);
      this.stats.interceptedAttempts++;
    } else if (fileName === "storage.json" && event === "change") {
      // 主配置文件被修改，验证设备ID
      await this.verifyAndRestoreDeviceId();
    }
  }

  /**
   * 拦截临时文件
   */
  async interceptTempFile(tempFilePath) {
    try {
      this.log("🚨 拦截IDE临时文件修改", "warn");

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
        this.log(`⚠️ 检测到设备ID被修改:`, "warn");
        this.log(`  原ID: ${this.targetDeviceId}`, "info");
        this.log(`  新ID: ${tempData["telemetry.devDeviceId"]}`, "info");

        // 强制恢复目标设备ID
        tempData["telemetry.devDeviceId"] = this.targetDeviceId;

        // 写回临时文件
        await fs.writeJson(tempFilePath, tempData, { spaces: 2 });

        this.log("✅ 已拦截并恢复目标设备ID", "success");
        this.stats.interceptedAttempts++;
      }
    } catch (error) {
      this.log(`❌ 拦截临时文件失败: ${error.message}`, "error");
    }
  }

  /**
   * 验证并恢复设备ID
   */
  async verifyAndRestoreDeviceId() {
    try {
      if (!(await fs.pathExists(this.paths.storageJson))) {
        this.log("⚠️ 配置文件被删除，正在恢复...", "warn");
        await this.enforceTargetDeviceId();
        this.stats.protectionRestored++;
        return;
      }

      const currentData = await fs.readJson(this.paths.storageJson);
      const currentDeviceId = currentData["telemetry.devDeviceId"];

      if (currentDeviceId !== this.targetDeviceId) {
        this.log("🚨 设备ID被篡改，正在恢复...", "warn");
        this.log(`  当前ID: ${currentDeviceId}`, "info");
        this.log(`  目标ID: ${this.targetDeviceId}`, "info");

        // 强制恢复
        await this.enforceTargetDeviceId();
        await this.setBasicFileProtection();

        this.log("✅ 设备ID已恢复", "success");
        this.stats.protectionRestored++;
      }
    } catch (error) {
      this.log(`❌ 验证设备ID失败: ${error.message}`, "error");
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

    this.stats.backupFilesRemoved += removedCount;
    this.log(`✅ 清理完成，共删除 ${removedCount} 个备份文件`, "success");
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
      this.stats.backupFilesRemoved += removedCount;
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
        this.stats.backupFilesRemoved++;
        this.log(`✅ 已立即删除备份: ${fileName}`, "success");
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
   */
  async setBasicFileProtection() {
    try {
      if (await fs.pathExists(this.paths.storageJson)) {
        await this.execAsync(`attrib +R "${this.paths.storageJson}"`);
        this.log("🔒 已设置storage.json只读保护", "success");
      }
    } catch (error) {
      this.log(`⚠️ 设置文件保护失败: ${error.message}`, "warn");
    }
  }

  /**
   * 设置增强文件保护
   */
  async setupEnhancedProtection() {
    try {
      if (!(await fs.pathExists(this.paths.storageJson))) return;

      // Windows增强保护
      if (process.platform === "win32") {
        try {
          // 设置只读属性
          await this.execAsync(`attrib +R "${this.paths.storageJson}"`);

          // 设置NTFS权限 - 拒绝所有用户写入
          await this.execAsync(
            `icacls "${this.paths.storageJson}" /deny *S-1-1-0:(W,D,DC,WD,AD,WA)`
          );

          this.log("🛡️ 已设置增强文件保护", "success");
        } catch (error) {
          this.log(`⚠️ 增强保护设置失败: ${error.message}`, "warn");
        }
      }
    } catch (error) {
      this.log(`❌ 设置增强保护失败: ${error.message}`, "error");
    }
  }

  /**
   * 获取守护进程状态
   */
  async getStatus() {
    try {
      const exists = await fs.pathExists(this.paths.storageJson);
      let currentDeviceId = null;

      if (exists) {
        const data = await fs.readJson(this.paths.storageJson);
        currentDeviceId = data["telemetry.devDeviceId"];
      }

      return {
        isGuarding: this.isGuarding,
        isClientCleaning: this.isClientCleaning,
        targetDeviceId: this.targetDeviceId,
        currentDeviceId: currentDeviceId,
        isProtected: currentDeviceId === this.targetDeviceId,
        configExists: exists,
        stats: this.stats,
        recentLogs: this.logs.slice(-10),
        watchersCount: this.watchers.size,
        uptime: this.stats.startTime
          ? Date.now() - this.stats.startTime.getTime()
          : 0,
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
