const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");
const { promisify } = require("util");
const { app } = require("electron");
const AdminHelper = require("./admin-helper");
// const { DeviceIdGuardian } = require("./device-id-guardian"); // 已禁用设备ID守护功能
const { EnhancedDeviceGuardian } = require("./enhanced-device-guardian");
const { StandaloneGuardianService } = require("./standalone-guardian-service");

const execAsync = promisify(exec);

// 获取共享模块路径的辅助函数
function getSharedPath(relativePath) {
  try {
    if (app && app.isPackaged) {
      // 打包后的路径
      return path.join(process.resourcesPath, "shared", relativePath);
    } else {
      // 开发环境路径
      return path.join(__dirname, "../../shared", relativePath);
    }
  } catch (error) {
    // 如果app未定义（如测试环境），使用开发环境路径
    return path.join(__dirname, "../../shared", relativePath);
  }
}

class DeviceManager {
  constructor() {
    this.platform = os.platform();
    this.cursorPaths = this.getCursorPaths();
    this.adminHelper = new AdminHelper();
    // this.deviceIdGuardian = new DeviceIdGuardian(); // 已禁用，改用一次性文件保护
    this.enhancedGuardian = new EnhancedDeviceGuardian();
    this.standaloneService = new StandaloneGuardianService();

    // 设置增强守护进程的事件回调
    this.setupGuardianEventCallback();
  }

  /**
   * 设置守护进程事件回调
   */
  setupGuardianEventCallback() {
    this.enhancedGuardian.setEventCallback((eventType, data) => {
      if (
        eventType === "intercept-success" ||
        eventType === "protection-restored" ||
        eventType === "backup-removed"
      ) {
        // 通知主进程，主进程再通知前端刷新状态
        this.notifyMainProcess("guardian-event", {
          type: eventType,
          data: data,
        });
      }
    });
  }

  /**
   * 通知主进程
   */
  notifyMainProcess(eventType, data) {
    try {
      // 如果在主进程中，直接处理
      if (typeof process !== "undefined" && process.type === "browser") {
        const { BrowserWindow } = require("electron");
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
          mainWindow.webContents.send(eventType, data);
        }
      }
    } catch (error) {
      console.error("通知主进程失败:", error);
    }
  }

  // 获取Cursor相关路径
  getCursorPaths() {
    const userHome = os.homedir();
    const paths = {};

    if (this.platform === "win32") {
      paths.extensions = path.join(userHome, ".cursor", "extensions");
      paths.globalStorage = path.join(
        userHome,
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "globalStorage"
      );
      paths.augmentExtension = path.join(
        paths.extensions,
        "augment.vscode-augment-*"
      );
      paths.augmentStorage = path.join(
        paths.globalStorage,
        "augment.vscode-augment"
      );
      paths.stateDb = path.join(paths.globalStorage, "state.vscdb");
      paths.settingsJson = path.join(
        userHome,
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "settings.json"
      );
    } else if (this.platform === "darwin") {
      paths.extensions = path.join(userHome, ".cursor", "extensions");
      paths.globalStorage = path.join(
        userHome,
        "Library",
        "Application Support",
        "Cursor",
        "User",
        "globalStorage"
      );
      paths.augmentExtension = path.join(
        paths.extensions,
        "augment.vscode-augment-*"
      );
      paths.augmentStorage = path.join(
        paths.globalStorage,
        "augment.vscode-augment"
      );
      paths.stateDb = path.join(paths.globalStorage, "state.vscdb");
      paths.settingsJson = path.join(
        userHome,
        "Library",
        "Application Support",
        "Cursor",
        "User",
        "settings.json"
      );
    } else {
      // Linux
      paths.extensions = path.join(userHome, ".cursor", "extensions");
      paths.globalStorage = path.join(
        userHome,
        ".config",
        "Cursor",
        "User",
        "globalStorage"
      );
      paths.augmentExtension = path.join(
        paths.extensions,
        "augment.vscode-augment-*"
      );
      paths.augmentStorage = path.join(
        paths.globalStorage,
        "augment.vscode-augment"
      );
      paths.stateDb = path.join(paths.globalStorage, "state.vscdb");
      paths.settingsJson = path.join(
        userHome,
        ".config",
        "Cursor",
        "User",
        "settings.json"
      );
    }

    return paths;
  }

  // 获取VS Code路径配置
  getVSCodePaths() {
    const userHome = os.homedir();
    const paths = {};

    if (this.platform === "win32") {
      // 检测多个VS Code变体
      const variants = [
        { name: "stable", appData: "Code", config: ".vscode" },
        {
          name: "insiders",
          appData: "Code - Insiders",
          config: ".vscode-insiders",
        },
        { name: "oss", appData: "Code - OSS", config: ".vscode-oss" },
      ];

      paths.variants = {};
      for (const variant of variants) {
        paths.variants[variant.name] = {
          globalStorage: path.join(
            userHome,
            "AppData",
            "Roaming",
            variant.appData,
            "User",
            "globalStorage"
          ),
          extensions: path.join(userHome, variant.config, "extensions"),
          stateDb: path.join(
            userHome,
            "AppData",
            "Roaming",
            variant.appData,
            "User",
            "globalStorage",
            "state.vscdb"
          ),
          augmentStorage: path.join(
            userHome,
            "AppData",
            "Roaming",
            variant.appData,
            "User",
            "globalStorage",
            "augment.vscode-augment"
          ),
          workspaceStorage: path.join(
            userHome,
            "AppData",
            "Roaming",
            variant.appData,
            "User",
            "workspaceStorage"
          ),
          storageJson: path.join(
            userHome,
            "AppData",
            "Roaming",
            variant.appData,
            "User",
            "globalStorage",
            "storage.json"
          ),
          settingsJson: path.join(
            userHome,
            "AppData",
            "Roaming",
            variant.appData,
            "User",
            "settings.json"
          ),
        };
      }
    } else if (this.platform === "darwin") {
      // macOS路径
      const variants = [
        { name: "stable", appData: "Code", config: ".vscode" },
        {
          name: "insiders",
          appData: "Code - Insiders",
          config: ".vscode-insiders",
        },
        { name: "oss", appData: "Code - OSS", config: ".vscode-oss" },
      ];

      paths.variants = {};
      for (const variant of variants) {
        paths.variants[variant.name] = {
          globalStorage: path.join(
            userHome,
            "Library",
            "Application Support",
            variant.appData,
            "User",
            "globalStorage"
          ),
          extensions: path.join(userHome, variant.config, "extensions"),
          stateDb: path.join(
            userHome,
            "Library",
            "Application Support",
            variant.appData,
            "User",
            "globalStorage",
            "state.vscdb"
          ),
          augmentStorage: path.join(
            userHome,
            "Library",
            "Application Support",
            variant.appData,
            "User",
            "globalStorage",
            "augment.vscode-augment"
          ),
          workspaceStorage: path.join(
            userHome,
            "Library",
            "Application Support",
            variant.appData,
            "User",
            "workspaceStorage"
          ),
          storageJson: path.join(
            userHome,
            "Library",
            "Application Support",
            variant.appData,
            "User",
            "globalStorage",
            "storage.json"
          ),
          settingsJson: path.join(
            userHome,
            "Library",
            "Application Support",
            variant.appData,
            "User",
            "settings.json"
          ),
        };
      }
    } else {
      // Linux路径
      const variants = [
        { name: "stable", appData: "Code", config: ".vscode" },
        {
          name: "insiders",
          appData: "Code - Insiders",
          config: ".vscode-insiders",
        },
        { name: "oss", appData: "Code - OSS", config: ".vscode-oss" },
      ];

      paths.variants = {};
      for (const variant of variants) {
        paths.variants[variant.name] = {
          globalStorage: path.join(
            userHome,
            ".config",
            variant.appData,
            "User",
            "globalStorage"
          ),
          extensions: path.join(userHome, variant.config, "extensions"),
          stateDb: path.join(
            userHome,
            ".config",
            variant.appData,
            "User",
            "globalStorage",
            "state.vscdb"
          ),
          augmentStorage: path.join(
            userHome,
            ".config",
            variant.appData,
            "User",
            "globalStorage",
            "augment.vscode-augment"
          ),
          workspaceStorage: path.join(
            userHome,
            ".config",
            variant.appData,
            "User",
            "workspaceStorage"
          ),
          storageJson: path.join(
            userHome,
            ".config",
            variant.appData,
            "User",
            "globalStorage",
            "storage.json"
          ),
          settingsJson: path.join(
            userHome,
            ".config",
            variant.appData,
            "User",
            "settings.json"
          ),
        };
      }
    }

    return paths;
  }

  // 获取Augment扩展信息
  async getAugmentExtensionInfo() {
    try {
      const info = {
        installed: false,
        version: null,
        path: null,
        storageExists: false,
        storagePath: null,
      };

      // 检查扩展是否安装
      if (await fs.pathExists(this.cursorPaths.extensions)) {
        const extensions = await fs.readdir(this.cursorPaths.extensions);
        const augmentExt = extensions.find((ext) =>
          ext.startsWith("augment.vscode-augment-")
        );

        if (augmentExt) {
          info.installed = true;
          info.version = augmentExt.replace("augment.vscode-augment-", "");
          info.path = path.join(this.cursorPaths.extensions, augmentExt);
        }
      }

      // 检查存储目录
      if (await fs.pathExists(this.cursorPaths.augmentStorage)) {
        info.storageExists = true;
        info.storagePath = this.cursorPaths.augmentStorage;
      }

      return {
        success: true,
        data: info,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // 执行设备清理
  async performCleanup(options = {}) {
    try {
      const results = {
        success: true,
        actions: [],
        errors: [],
        options: options, // 保存选项供后续使用
      };

      // 🔄 第1步：清理前先关闭相关IDE，避免文件占用问题
      await this.closeIDEsBeforeCleanup(results, options);

      // 🛑 第2步：停止增强防护，避免防护机制干扰清理过程
      await this.stopEnhancedProtectionBeforeCleanup(results);

      // 根据清理模式调整选项并执行对应的清理策略
      if (options.intelligentMode) {
        results.actions.push("🧠 使用智能清理模式 - 精准清理设备身份");
        return await this.performIntelligentCleanup(results, options);
      } else if (options.standardMode) {
        results.actions.push("🔧 使用标准清理模式 - 深度清理保留核心配置");
        return await this.performStandardModeCleanup(results, options);
      } else if (options.completeMode) {
        results.actions.push("💥 使用完全清理模式 - 彻底重置仅保护MCP");
        return await this.performCompleteModeCleanup(results, options);
      }

      // 检查是否启用智能管理员权限清理
      if (options.useSmartAdminCleanup && this.platform === "win32") {
        return await this.performSmartAdminCleanup(options);
      }

      // 检查是否启用PowerShell辅助清理
      if (options.usePowerShellAssist && this.platform === "win32") {
        return await this.performPowerShellAssistedCleanup(options);
      }

      // 0. 如果需要清理Cursor扩展，先强制关闭Cursor IDE
      if (options.cleanCursorExtension && options.autoRestartCursor) {
        await this.forceCloseCursorIDE(results);
        // 等待进程完全终止
        await new Promise((resolve) => setTimeout(resolve, 5000));
        results.actions.push("⏳ 等待5秒确保进程完全终止...");
      }

      // 1. 保护MCP配置（传统清理模式也需要保护）
      const mcpConfigs = await this.protectMCPConfigUniversal(results);

      // 2. 清理本地激活信息（根据选项决定是否保留）
      await this.cleanActivationData(results, options);

      // 2. 清理Augment存储数据
      await this.cleanAugmentStorage(results);

      // 3. 清理SQLite状态数据库
      await this.cleanStateDatabase(results, options);

      // 4. 清理注册表（仅Windows）
      if (this.platform === "win32") {
        await this.cleanWindowsRegistry(results);
      }

      // 5. 清理系统临时文件
      await this.cleanTempFiles(results);

      // 6. 清理浏览器相关数据
      await this.cleanBrowserData(results);

      // 7. 清理Cursor IDE扩展数据（独立于激活状态保留）
      if (options.cleanCursor && options.cleanCursorExtension) {
        await this.cleanCursorExtensionData(results, options);
      }

      // 8. 清理VS Code数据（新增功能）
      if (options.cleanVSCode) {
        await this.performVSCodeCleanup(results, options);
      }

      // 8. 重新生成设备指纹（可选，仅在不保留激活状态时）
      await this.regenerateDeviceFingerprint(results, options);

      // 9. 执行多轮深度清理验证
      if (options.cleanCursorExtension) {
        await this.performDeepCleanupVerification(results, options);

        // 激进模式：多轮清理
        if (options.aggressiveMode || options.multiRoundClean) {
          await this.performMultiRoundCleanup(results, options);
        }
      }

      // 10. 如果关闭了Cursor IDE，延迟重新启动它并持续监控
      if (options.cleanCursorExtension && options.autoRestartCursor) {
        results.actions.push("⏳ 延迟3秒后启动Cursor IDE，确保清理完全生效...");
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await this.startCursorIDE(results);

        // 启动持续监控，防止Cursor恢复旧数据
        const monitoringTime = options.extendedMonitoring ? 60000 : 30000;
        await this.startContinuousMonitoring(results, monitoringTime, options);
      }

      // 11. 启动设备ID守护者，防止IDE自动恢复旧ID（已禁用，改用一次性禁用storage.json）
      // if (options.cleanCursor || options.cleanCursorExtension) {
      //   await this.startDeviceIdGuardian(results, options);
      // }

      // 替代方案：一次性禁用storage.json文件
      if (options.cleanCursor || options.cleanCursorExtension) {
        await this.disableStorageJson(results, options);
      }

      // 12. 启动增强设备ID守护进程（可选）
      if (
        options.enableEnhancedGuardian &&
        (options.cleanCursor || options.cleanCursorExtension)
      ) {
        await this.startEnhancedGuardian(results, options);
      }

      // 13. 恢复MCP配置（传统清理模式也需要恢复）
      await this.restoreMCPConfigUniversal(results, mcpConfigs);

      return results;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        actions: [],
        errors: [error.message],
      };
    }
  }

  // 清理激活数据（根据选项决定是否保留激活状态）
  async cleanActivationData(results, options = {}) {
    try {
      const configDir = path.join(os.homedir(), ".augment-device-manager");
      const configFile = path.join(configDir, "config.json");

      if (await fs.pathExists(configFile)) {
        // 读取当前配置文件
        const config = await fs.readJson(configFile);
        results.actions.push("已读取当前配置文件");

        // 备份完整配置文件（可选）
        if (!options.skipBackup) {
          const backupPath = configFile + ".backup." + Date.now();
          await fs.copy(configFile, backupPath);
          results.actions.push(`已备份配置文件到: ${backupPath}`);
        } else {
          results.actions.push("🚫 跳过配置文件备份");
        }

        let newConfig = {};

        // 如果选择保留激活状态，保存激活信息
        if (options.preserveActivation && config.activation) {
          newConfig.activation = { ...config.activation };
          results.actions.push("已保存激活配置");

          // 验证激活信息的完整性
          if (config.activation.code && config.activation.deviceId) {
            results.actions.push("✅ 激活信息完整性验证通过");
          } else {
            results.errors.push("⚠️ 激活信息不完整，可能需要重新激活");
          }
        }

        // 保留服务器配置（如果存在）
        if (config.server) {
          newConfig.server = { ...config.server };
          results.actions.push("已保存服务器配置");
        }

        // 保留其他重要配置
        if (config.lastUpdated) {
          newConfig.lastUpdated = config.lastUpdated;
        }

        // 写入清理后的配置
        await fs.writeJson(configFile, newConfig, { spaces: 2 });
        results.actions.push("已写入清理后的配置文件");

        // 验证激活状态是否正确保留
        if (options.preserveActivation && config.activation) {
          try {
            // 等待文件系统操作完成
            await new Promise((resolve) => setTimeout(resolve, 200));

            // 重新读取配置文件验证
            const verifiedConfig = await fs.readJson(configFile);
            if (
              verifiedConfig.activation &&
              verifiedConfig.activation.code === config.activation.code &&
              verifiedConfig.activation.deviceId === config.activation.deviceId
            ) {
              results.actions.push("✅ 激活状态验证成功，已正确保留");
            } else {
              results.errors.push("⚠️ 激活状态验证失败，可能需要重新激活");
            }
          } catch (verifyError) {
            results.errors.push(`激活状态验证出错: ${verifyError.message}`);
          }
        }

        // 清理配置目录中的其他文件（保留主配置文件和稳定设备ID缓存）
        try {
          const files = await fs.readdir(configDir);
          for (const file of files) {
            // 保留的文件列表
            const preservedFiles = [
              "config.json",
              ...(file.includes(".backup.") ? [file] : []),
              ...(options.preserveActivation
                ? [
                    "stable-device-id.cache",
                    "stable-device-id.backup",
                    "device-fingerprint.cache",
                  ]
                : []),
            ];

            if (!preservedFiles.includes(file)) {
              const filePath = path.join(configDir, file);
              const stats = await fs.stat(filePath);

              if (stats.isFile()) {
                await fs.remove(filePath);
                results.actions.push(`已清理文件: ${file}`);
              } else if (stats.isDirectory()) {
                await fs.remove(filePath);
                results.actions.push(`已清理目录: ${file}`);
              }
            } else if (
              options.preserveActivation &&
              !options.aggressiveMode && // 激进模式下不保留设备ID缓存
              [
                "stable-device-id.cache",
                "stable-device-id.backup",
                "device-fingerprint.cache",
              ].includes(file)
            ) {
              results.actions.push(`已保留设备ID缓存: ${file}`);
            } else if (
              options.preserveActivation &&
              options.aggressiveMode &&
              [
                "stable-device-id.cache",
                "stable-device-id.backup",
                "device-fingerprint.cache",
              ].includes(file)
            ) {
              // 激进模式：清理设备ID缓存但保留激活状态
              const filePath = path.join(configDir, file);
              await fs.remove(filePath);
              results.actions.push(`🔥 激进模式：已清理设备ID缓存: ${file}`);
            }
          }
        } catch (cleanError) {
          results.errors.push(
            `清理配置目录其他文件失败: ${cleanError.message}`
          );
        }

        if (options.preserveActivation) {
          results.actions.push("已清理设备数据，保留激活状态和服务器配置");
        } else {
          results.actions.push("已清理设备激活信息，保留服务器配置");
        }
      } else {
        results.actions.push("未找到配置文件，跳过清理");
      }

      // 清理可能的其他激活相关文件（如果不保留激活状态）
      if (!options.preserveActivation) {
        const possiblePaths = [
          path.join(os.homedir(), ".augment"),
          path.join(os.homedir(), ".cursor-augment"),
          path.join(os.homedir(), "AppData", "Local", "augment-device-manager"), // Windows
          path.join(
            os.homedir(),
            "Library",
            "Application Support",
            "augment-device-manager"
          ), // macOS
        ];

        for (const possiblePath of possiblePaths) {
          try {
            if (await fs.pathExists(possiblePath)) {
              await fs.remove(possiblePath);
              results.actions.push(`已清理: ${possiblePath}`);
            }
          } catch (error) {
            results.errors.push(`清理 ${possiblePath} 失败: ${error.message}`);
          }
        }
      } else {
        results.actions.push("保留激活状态模式：跳过清理其他激活相关文件");
      }
    } catch (error) {
      results.errors.push(`清理激活数据失败: ${error.message}`);
    }
  }

  // 清理Augment存储数据
  async cleanAugmentStorage(results) {
    try {
      if (await fs.pathExists(this.cursorPaths.augmentStorage)) {
        // 检查目录大小，避免误删重要数据
        const stats = await fs.stat(this.cursorPaths.augmentStorage);
        if (stats.isDirectory()) {
          const files = await fs.readdir(this.cursorPaths.augmentStorage);

          // 创建备份目录
          const backupDir = path.join(
            os.tmpdir(),
            `augment-backup-${Date.now()}`
          );
          await fs.ensureDir(backupDir);

          // 只清理特定的Augment相关文件，但保护MCP配置相关目录和文件
          const augmentFiles = files.filter(
            (file) =>
              (file.toLowerCase().includes("augment") ||
                file.toLowerCase().includes("device") ||
                file.toLowerCase().includes("license") ||
                file.endsWith(".tmp") ||
                file.endsWith(".cache")) &&
              file !== "augment.vscode-augment" && // 保护MCP配置目录
              file !== "augment-global-state" // 保护MCP配置子目录
          );

          if (augmentFiles.length > 0) {
            // 备份要删除的文件
            for (const file of augmentFiles) {
              const srcPath = path.join(this.cursorPaths.augmentStorage, file);
              const backupPath = path.join(backupDir, file);
              try {
                await fs.copy(srcPath, backupPath);
                await fs.remove(srcPath);
                results.actions.push(`已清理文件: ${file}`);
              } catch (error) {
                results.errors.push(`清理文件失败 ${file}: ${error.message}`);
              }
            }
            results.actions.push(`备份保存至: ${backupDir}`);
          } else {
            results.actions.push("未发现需要清理的Augment文件");
          }
        }
      } else {
        results.actions.push("Augment存储目录不存在，跳过清理");
      }
    } catch (error) {
      results.errors.push(`清理Augment存储失败: ${error.message}`);
    }
  }

  // 清理状态数据库
  async cleanStateDatabase(results, options = {}) {
    try {
      if (await fs.pathExists(this.cursorPaths.stateDb)) {
        // 备份数据库
        const backupPath = this.cursorPaths.stateDb + ".backup." + Date.now();
        await fs.copy(this.cursorPaths.stateDb, backupPath);

        // 这里可以选择删除整个数据库或者只清理特定表
        // 为了安全起见，我们只备份，不删除整个数据库
        results.actions.push("已备份状态数据库");
        results.actions.push(`备份保存至: ${backupPath}`);

        // 如果需要清理特定数据，可以使用SQLite操作
        await this.cleanSqliteAugmentData(results, options);
      } else {
        results.actions.push("状态数据库不存在，跳过清理");
      }
    } catch (error) {
      results.errors.push(`清理状态数据库失败: ${error.message}`);
    }
  }

  // 清理SQLite中的Augment相关数据
  async cleanSqliteAugmentData(results, options = {}) {
    try {
      if (!(await fs.pathExists(this.cursorPaths.stateDb))) {
        results.actions.push("SQLite状态数据库不存在，跳过清理");
        return;
      }

      // 尝试使用sql.js进行SQLite操作
      try {
        const initSqlJs = require("sql.js");
        const SQL = await initSqlJs();

        // 读取数据库文件
        const dbBuffer = await fs.readFile(this.cursorPaths.stateDb);
        const db = new SQL.Database(dbBuffer);

        let cleanedTables = 0;
        let cleanedRecords = 0;

        try {
          // 获取所有表名
          const tablesResult = db.exec(
            "SELECT name FROM sqlite_master WHERE type='table'"
          );

          if (tablesResult.length > 0) {
            const tables = tablesResult[0].values.map((row) => row[0]);

            for (const tableName of tables) {
              // 跳过系统表
              if (tableName.startsWith("sqlite_")) {
                continue;
              }

              try {
                // 获取表结构
                const columnsResult = db.exec(
                  `PRAGMA table_info(${tableName})`
                );
                if (columnsResult.length === 0) continue;

                const columnNames = columnsResult[0].values.map((row) =>
                  row[1].toLowerCase()
                );

                // 查找包含Augment相关信息的记录
                const augmentKeywords = [
                  "augment",
                  "device",
                  "license",
                  "activation",
                  "extension",
                  "bubble", // 聊天气泡
                  "checkpoint", // 检查点
                  "message", // 消息
                  "composer", // 代码生成器
                  "session", // 会话
                  "auth", // 认证
                  "token", // 令牌
                  "user", // 用户
                ];
                let whereConditions = [];

                // 特殊处理：直接清理已知的用户身份相关记录
                const directCleanupPatterns = [
                  "bubbleId:",
                  "checkpointId:",
                  "messageRequestContext:",
                  "composerData:",
                  "cursorAuth",
                  "userSession",
                ];

                // 构建查询条件
                for (const keyword of augmentKeywords) {
                  for (const columnName of columnNames) {
                    if (
                      columnName.includes("data") ||
                      columnName.includes("value") ||
                      columnName.includes("content") ||
                      columnName.includes("json")
                    ) {
                      whereConditions.push(
                        `LOWER(${columnName}) LIKE '%${keyword}%'`
                      );
                    }
                  }
                }

                if (whereConditions.length > 0) {
                  const whereClause = whereConditions.join(" OR ");

                  // 先查询要删除的记录数量
                  const countQuery = `SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClause}`;
                  const countResult = db.exec(countQuery);

                  if (
                    countResult.length > 0 &&
                    countResult[0].values.length > 0
                  ) {
                    const count = countResult[0].values[0][0];

                    if (count > 0) {
                      // 删除匹配的记录
                      const deleteQuery = `DELETE FROM ${tableName} WHERE ${whereClause}`;
                      db.run(deleteQuery);

                      cleanedRecords += count;
                      cleanedTables++;

                      results.actions.push(
                        `已清理表 ${tableName}: ${count} 条记录`
                      );
                    }
                  }
                }
              } catch (tableError) {
                // 某些表可能有权限问题或结构问题，记录但不中断整个过程
                results.errors.push(
                  `清理表 ${tableName} 时出错: ${tableError.message}`
                );
              }
            }
          }

          // 特别清理cursorDiskKV表中的用户会话数据
          await this.cleanCursorDiskKVTable(db, results);

          if (cleanedTables > 0) {
            // 保存修改后的数据库
            const modifiedDbBuffer = db.export();
            await fs.writeFile(this.cursorPaths.stateDb, modifiedDbBuffer);

            results.actions.push(
              `SQLite清理完成: 清理了 ${cleanedTables} 个表，共 ${cleanedRecords} 条记录`
            );
          } else {
            results.actions.push("SQLite数据库中未找到Augment相关数据");
          }
        } finally {
          db.close();
        }
      } catch (sqlError) {
        if (sqlError.message.includes("Cannot find module")) {
          results.actions.push(
            "SQLite数据清理已跳过（缺少sql.js模块，请运行 npm install sql.js）"
          );
        } else {
          // 如果sql.js操作失败，尝试简单的文件操作
          results.actions.push("SQLite数据清理使用备用方案");

          // 创建数据库备份
          const backupPath = this.cursorPaths.stateDb + ".backup." + Date.now();
          await fs.copy(this.cursorPaths.stateDb, backupPath);
          results.actions.push(`已创建数据库备份: ${backupPath}`);

          // 只有在不保留Cursor登录时才删除数据库文件
          if (!options.skipCursorLogin) {
            // 简单清理：删除数据库文件（让Cursor重新创建）
            await fs.remove(this.cursorPaths.stateDb);
            results.actions.push("已删除状态数据库文件（将自动重新创建）");
          } else {
            results.actions.push("保留登录模式：跳过删除数据库文件");
          }
        }
      }
    } catch (error) {
      results.errors.push(`SQLite数据清理失败: ${error.message}`);
    }
  }

  // 清理Windows注册表
  async cleanWindowsRegistry(results) {
    try {
      if (this.platform !== "win32") return;

      // 清理可能的注册表项
      const registryKeys = [
        "HKEY_CURRENT_USER\\Software\\Augment",
        "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Augment",
      ];

      for (const key of registryKeys) {
        try {
          await execAsync(`reg delete "${key}" /f`);
          results.actions.push(`已清理注册表项: ${key}`);
        } catch (error) {
          // 注册表项可能不存在，这是正常的
          if (!error.message.includes("找不到指定的注册表项")) {
            results.errors.push(`清理注册表项失败 ${key}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      results.errors.push(`注册表清理失败: ${error.message}`);
    }
  }

  // 清理临时文件
  async cleanTempFiles(results) {
    try {
      const tempDirs = [
        os.tmpdir(),
        path.join(os.homedir(), "AppData", "Local", "Temp"), // Windows
      ];

      for (const tempDir of tempDirs) {
        if (await fs.pathExists(tempDir)) {
          const files = await fs.readdir(tempDir);
          const augmentFiles = files.filter(
            (file) =>
              file.toLowerCase().includes("augment") ||
              file.toLowerCase().includes("cursor")
          );

          for (const file of augmentFiles) {
            try {
              const filePath = path.join(tempDir, file);
              const stat = await fs.stat(filePath);

              // 只删除较旧的文件（超过1小时）
              const oneHourAgo = Date.now() - 60 * 60 * 1000;
              if (stat.mtime.getTime() < oneHourAgo) {
                await fs.remove(filePath);
                results.actions.push(`已清理临时文件: ${file}`);
              }
            } catch (error) {
              // 文件可能正在使用，跳过
            }
          }
        }
      }
    } catch (error) {
      results.errors.push(`清理临时文件失败: ${error.message}`);
    }
  }

  // 重置使用计数（保护MCP配置）
  async resetUsageCount() {
    try {
      const results = {
        success: true,
        actions: [],
        errors: [],
      };

      // 使用通用保护机制保护所有MCP配置
      const mcpConfigs = await this.protectMCPConfigUniversal(results);

      // 重新创建干净的存储目录（只重置Cursor，不影响VS Code）
      if (await fs.pathExists(this.cursorPaths.augmentStorage)) {
        await fs.remove(this.cursorPaths.augmentStorage);
      }

      await fs.ensureDir(this.cursorPaths.augmentStorage);
      results.actions.push("已重置Cursor Augment存储目录");

      // 创建新的配置文件（如果需要）
      const newConfigPath = path.join(
        this.cursorPaths.augmentStorage,
        "augment-global-state"
      );
      await fs.ensureDir(newConfigPath);

      // 写入基础配置
      let deviceId = "test-device-id";
      try {
        deviceId = require(getSharedPath(
          "crypto/encryption"
        )).generateDeviceFingerprint();
      } catch (error) {
        // 在测试环境中使用默认值
        results.actions.push(`⚠️ 使用默认设备ID（测试环境）: ${error.message}`);
      }

      const basicConfig = {
        version: "1.0.0",
        resetAt: new Date().toISOString(),
        deviceId: deviceId,
      };

      await fs.writeJson(path.join(newConfigPath, "config.json"), basicConfig, {
        spaces: 2,
      });
      results.actions.push("已创建新的配置文件");

      // 恢复所有MCP配置文件
      await this.restoreMCPConfigUniversal(results, mcpConfigs);

      return results;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        actions: [],
        errors: [error.message],
      };
    }
  }

  // 检查Cursor是否正在运行
  async isCursorRunning() {
    try {
      if (this.platform === "win32") {
        const { stdout } = await execAsync(
          'tasklist /FI "IMAGENAME eq Cursor.exe"'
        );
        return stdout.includes("Cursor.exe");
      } else if (this.platform === "darwin") {
        const { stdout } = await execAsync("ps aux | grep -i cursor");
        return stdout.includes("Cursor");
      } else {
        const { stdout } = await execAsync("ps aux | grep -i cursor");
        return stdout.includes("cursor");
      }
    } catch (error) {
      return false;
    }
  }

  // 清理浏览器相关数据
  async cleanBrowserData(results) {
    try {
      // 清理可能的浏览器扩展数据
      const browserPaths = [];

      if (this.platform === "win32") {
        // Windows Chrome/Edge 扩展数据路径
        browserPaths.push(
          path.join(
            os.homedir(),
            "AppData",
            "Local",
            "Google",
            "Chrome",
            "User Data",
            "Default",
            "Local Extension Settings"
          ),
          path.join(
            os.homedir(),
            "AppData",
            "Local",
            "Microsoft",
            "Edge",
            "User Data",
            "Default",
            "Local Extension Settings"
          )
        );
      } else if (this.platform === "darwin") {
        // macOS Chrome/Safari 扩展数据路径
        browserPaths.push(
          path.join(
            os.homedir(),
            "Library",
            "Application Support",
            "Google",
            "Chrome",
            "Default",
            "Local Extension Settings"
          ),
          path.join(
            os.homedir(),
            "Library",
            "Application Support",
            "Microsoft Edge",
            "Default",
            "Local Extension Settings"
          )
        );
      } else {
        // Linux Chrome 扩展数据路径
        browserPaths.push(
          path.join(
            os.homedir(),
            ".config",
            "google-chrome",
            "Default",
            "Local Extension Settings"
          ),
          path.join(
            os.homedir(),
            ".config",
            "microsoft-edge",
            "Default",
            "Local Extension Settings"
          )
        );
      }

      for (const browserPath of browserPaths) {
        try {
          if (await fs.pathExists(browserPath)) {
            const extensions = await fs.readdir(browserPath);
            // 查找可能的 Augment 扩展
            const augmentExtensions = extensions.filter(
              (ext) =>
                ext.toLowerCase().includes("augment") ||
                ext.toLowerCase().includes("cursor")
            );

            for (const ext of augmentExtensions) {
              const extPath = path.join(browserPath, ext);
              try {
                await fs.remove(extPath);
                results.actions.push(`已清理浏览器扩展数据: ${ext}`);
              } catch (error) {
                results.errors.push(`清理扩展 ${ext} 失败: ${error.message}`);
              }
            }
          }
        } catch (error) {
          // 路径不存在或无权限，跳过
        }
      }

      results.actions.push("浏览器数据清理完成");
    } catch (error) {
      results.errors.push(`清理浏览器数据失败: ${error.message}`);
    }
  }

  // 重新生成设备指纹
  async regenerateDeviceFingerprint(results, options = {}) {
    try {
      // 如果保留激活状态且不是激进模式，则不清理设备指纹缓存
      if (options.preserveActivation && !options.aggressiveMode) {
        results.actions.push("保留激活状态模式：跳过设备指纹重置");
        return;
      }

      // 激进模式：即使保留激活状态也要重新生成设备指纹
      if (options.aggressiveMode) {
        results.actions.push("🔥 激进模式：强制重新生成设备指纹");
      }

      // 清理缓存的指纹数据，确保下次生成新的设备标识（增强版）
      const fingerprintPaths = [
        path.join(
          os.homedir(),
          ".augment-device-manager",
          "device-fingerprint"
        ),
        path.join(
          os.homedir(),
          ".augment-device-manager",
          "device-fingerprint.cache"
        ),
        // 清理稳定设备ID缓存（仅在不保留激活状态时）
        path.join(
          os.homedir(),
          ".augment-device-manager",
          "stable-device-id.cache"
        ),
        path.join(
          os.homedir(),
          ".augment-device-manager",
          "stable-device-id.backup"
        ),
        path.join(os.homedir(), ".augment", "fingerprint"),
        path.join(os.homedir(), ".cursor-augment", "device-id"),
        path.join(
          os.homedir(),
          "AppData",
          "Local",
          "Cursor",
          "User",
          "globalStorage",
          "augment.device-id"
        ),
        path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "globalStorage",
          "augment.device-id"
        ),
        path.join(
          os.homedir(),
          "AppData",
          "Local",
          "Cursor",
          "logs",
          "device-fingerprint"
        ),
        path.join(os.tmpdir(), "augment-hw-cache"),
        path.join(os.tmpdir(), "cursor-hw-fingerprint"),
        path.join(os.homedir(), ".cache", "augment-hardware"),
      ];

      for (const fingerprintPath of fingerprintPaths) {
        try {
          if (await fs.pathExists(fingerprintPath)) {
            await fs.remove(fingerprintPath);
            results.actions.push(
              `已清理设备指纹缓存: ${path.basename(fingerprintPath)}`
            );
          }
        } catch (error) {
          // 大部分路径可能不存在，这是正常的，只记录实际的错误
          if (!error.message.includes("ENOENT")) {
            results.errors.push(
              `清理指纹缓存失败 ${path.basename(fingerprintPath)}: ${
                error.message
              }`
            );
          }
        }
      }

      // 额外清理可能的扩展存储
      await this.clearExtensionStorage(results, options);

      // 清理稳定设备ID缓存（重要：确保设备指纹真正更新）
      try {
        const { clearDeviceIdCache } = require(getSharedPath(
          "utils/stable-device-id"
        ));
        const cleared = clearDeviceIdCache();
        if (cleared) {
          results.actions.push("✅ 已清理稳定设备ID缓存");
        }
      } catch (error) {
        results.errors.push(`清理稳定设备ID缓存失败: ${error.message}`);
      }

      // 激进模式：强制生成新的稳定设备ID
      if (options.aggressiveMode) {
        try {
          const { StableDeviceId } = require(getSharedPath(
            "utils/stable-device-id"
          ));
          const deviceIdGenerator = new StableDeviceId();
          const newDeviceId =
            await deviceIdGenerator.forceGenerateNewDeviceId();
          results.actions.push(
            `🔥 激进模式：强制生成新设备ID: ${newDeviceId.substring(0, 16)}...`
          );
        } catch (error) {
          results.errors.push(`强制生成新设备ID失败: ${error.message}`);
        }
      } else {
        // 非激进模式：也要强制生成新设备ID以确保变化
        try {
          const { StableDeviceId } = require(getSharedPath(
            "utils/stable-device-id"
          ));
          const deviceIdGenerator = new StableDeviceId();
          const newDeviceId =
            await deviceIdGenerator.forceGenerateNewDeviceId();
          results.actions.push(
            `🔄 强制生成新设备ID: ${newDeviceId.substring(0, 16)}...`
          );
        } catch (error) {
          results.errors.push(`生成新设备ID失败: ${error.message}`);
        }
      }

      results.actions.push("设备指纹已完全重置，扩展将无法识别为旧设备");
    } catch (error) {
      results.errors.push(`重新生成设备指纹失败: ${error.message}`);
    }
  }

  // 清理扩展存储（深度清理）
  async clearExtensionStorage(results, options = {}) {
    try {
      // 注意：Cursor IDE扩展清理已在主流程中独立处理

      const extensionStoragePaths = [
        // Cursor 扩展全局存储
        path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "globalStorage"
        ),
        path.join(
          os.homedir(),
          "AppData",
          "Local",
          "Cursor",
          "User",
          "globalStorage"
        ),
        // VSCode 兼容存储
        path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Code",
          "User",
          "globalStorage"
        ),
        path.join(
          os.homedir(),
          "AppData",
          "Local",
          "Code",
          "User",
          "globalStorage"
        ),
        // macOS 路径
        path.join(
          os.homedir(),
          "Library",
          "Application Support",
          "Cursor",
          "User",
          "globalStorage"
        ),
        path.join(
          os.homedir(),
          "Library",
          "Application Support",
          "Code",
          "User",
          "globalStorage"
        ),
      ];

      for (const storagePath of extensionStoragePaths) {
        try {
          if (await fs.pathExists(storagePath)) {
            const files = await fs.readdir(storagePath);
            const augmentFiles = files.filter(
              (file) =>
                file.includes("augment") ||
                file.includes("device") ||
                file.includes("license") ||
                file.includes("activation")
            );

            for (const file of augmentFiles) {
              try {
                const filePath = path.join(storagePath, file);
                await fs.remove(filePath);
                results.actions.push(`已清理扩展存储: ${file}`);
              } catch (error) {
                // 忽略单个文件清理失败
              }
            }
          }
        } catch (error) {
          // 忽略路径不存在的错误
        }
      }

      results.actions.push("扩展存储数据已深度清理");
    } catch (error) {
      results.errors.push(`清理扩展存储失败: ${error.message}`);
    }
  }

  // 保护Cursor IDE MCP配置
  async protectCursorMCPConfig(results) {
    try {
      if (!(await fs.pathExists(this.cursorPaths.settingsJson))) {
        return null;
      }

      const settingsContent = await fs.readJson(this.cursorPaths.settingsJson);

      // 提取MCP配置
      const mcpConfig = {};
      if (settingsContent.mcpServers) {
        mcpConfig.mcpServers = settingsContent.mcpServers;
        results.actions.push(`🛡️ 已保护Cursor IDE MCP配置`);
      }

      return mcpConfig;
    } catch (error) {
      results.actions.push(`⚠️ 保护Cursor MCP配置时出错: ${error.message}`);
      return null;
    }
  }

  // 恢复Cursor IDE MCP配置
  async restoreCursorMCPConfig(results, mcpConfig) {
    try {
      if (!mcpConfig || !mcpConfig.mcpServers) {
        results.actions.push(`⚠️ 无MCP配置需要恢复`);
        return;
      }

      // 确保settings.json存在
      await fs.ensureFile(this.cursorPaths.settingsJson);

      let settingsContent = {};
      if (await fs.pathExists(this.cursorPaths.settingsJson)) {
        try {
          settingsContent = await fs.readJson(this.cursorPaths.settingsJson);
        } catch (error) {
          // 如果文件损坏，创建新的
          settingsContent = {};
        }
      }

      // 恢复MCP配置（合并而不是覆盖）
      if (!settingsContent.mcpServers) {
        settingsContent.mcpServers = {};
      }
      Object.assign(settingsContent.mcpServers, mcpConfig.mcpServers);

      await fs.writeJson(this.cursorPaths.settingsJson, settingsContent, {
        spaces: 2,
      });
      results.actions.push(
        `🔄 已恢复Cursor IDE MCP配置 (${
          Object.keys(mcpConfig.mcpServers).length
        }个服务器)`
      );
    } catch (error) {
      results.actions.push(`⚠️ 恢复Cursor MCP配置时出错: ${error.message}`);
    }
  }

  // 专门清理Cursor IDE扩展数据，让其认为是新设备（保护MCP配置）
  async cleanCursorExtensionData(results, options = {}) {
    try {
      // 1. 清理Augment扩展的特定存储数据（已包含MCP保护）
      await this.cleanAugmentExtensionStorage(results, options);

      const cursorPaths = [
        // Cursor全局存储
        path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "globalStorage",
          "storage.json"
        ),
        path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "globalStorage",
          "state.vscdb"
        ),
        path.join(
          os.homedir(),
          "AppData",
          "Local",
          "Cursor",
          "User",
          "globalStorage",
          "storage.json"
        ),
        path.join(
          os.homedir(),
          "AppData",
          "Local",
          "Cursor",
          "User",
          "globalStorage",
          "state.vscdb"
        ),

        // Cursor工作区存储
        path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "workspaceStorage"
        ),
        path.join(
          os.homedir(),
          "AppData",
          "Local",
          "Cursor",
          "User",
          "workspaceStorage"
        ),

        // Cursor缓存和日志
        path.join(os.homedir(), "AppData", "Roaming", "Cursor", "logs"),
        path.join(os.homedir(), "AppData", "Local", "Cursor", "logs"),
        path.join(os.homedir(), "AppData", "Local", "Cursor", "CachedData"),

        // macOS路径
        path.join(
          os.homedir(),
          "Library",
          "Application Support",
          "Cursor",
          "User",
          "globalStorage"
        ),
        path.join(
          os.homedir(),
          "Library",
          "Application Support",
          "Cursor",
          "User",
          "workspaceStorage"
        ),
        path.join(os.homedir(), "Library", "Logs", "Cursor"),

        // Linux路径
        path.join(os.homedir(), ".config", "Cursor", "User", "globalStorage"),
        path.join(
          os.homedir(),
          ".config",
          "Cursor",
          "User",
          "workspaceStorage"
        ),
        path.join(os.homedir(), ".config", "Cursor", "logs"),
      ];

      // 备份重要文件（可选）
      let backupDir = null;
      if (!options.skipBackup) {
        backupDir = path.join(os.tmpdir(), `cursor-backup-${Date.now()}`);
        await fs.ensureDir(backupDir);
        results.actions.push("📁 已创建备份目录");
      } else {
        results.actions.push("🚫 跳过备份文件创建（防止IDE恢复）");
      }

      // 根据resetCursorCompletely和skipCursorLogin选项决定清理策略
      if (options.resetCursorCompletely) {
        // 完全重置模式：清理所有Cursor IDE数据
        results.actions.push("🔄 启用完全重置模式，清理所有Cursor IDE数据...");
        await this.performCompleteCursorReset(
          results,
          cursorPaths,
          backupDir,
          options
        );
      } else if (options.skipCursorLogin) {
        // 保留登录模式：选择性清理
        results.actions.push("🔐 启用登录保留模式，选择性清理...");

        for (const cursorPath of cursorPaths) {
          try {
            if (await fs.pathExists(cursorPath)) {
              const stats = await fs.stat(cursorPath);
              const pathName = path.basename(cursorPath);

              // 跳过关键登录文件
              if (
                pathName === "globalStorage" ||
                pathName === "storage.json" ||
                pathName === "state.vscdb"
              ) {
                results.actions.push(`🛡️ 保留登录文件: ${pathName}`);
                continue;
              }

              if (stats.isFile()) {
                // 备份并删除非关键文件（可选备份）
                const fileName = path.basename(cursorPath);
                if (!options.skipBackup && backupDir) {
                  const backupPath = path.join(backupDir, fileName);
                  await fs.copy(cursorPath, backupPath);
                }
                await fs.remove(cursorPath);
                results.actions.push(`已清理Cursor文件: ${fileName}`);
              } else if (stats.isDirectory()) {
                // 备份并删除非关键目录（可选备份）
                const dirName = path.basename(cursorPath);
                if (!options.skipBackup && backupDir) {
                  const backupPath = path.join(backupDir, dirName);
                  await fs.copy(cursorPath, backupPath);
                }
                await fs.remove(cursorPath);
                results.actions.push(`已清理Cursor目录: ${dirName}`);
              }
            }
          } catch (error) {
            if (!error.message.includes("ENOENT")) {
              results.errors.push(
                `清理Cursor路径失败 ${path.basename(cursorPath)}: ${
                  error.message
                }`
              );
            }
          }
        }

        // 选择性清理storage.json中的遥测ID
        await this.selectiveCleanStorageJson(results);
      } else {
        // 完整清理模式：清理所有文件
        for (const cursorPath of cursorPaths) {
          try {
            if (await fs.pathExists(cursorPath)) {
              const stats = await fs.stat(cursorPath);

              if (stats.isFile()) {
                // 备份单个文件（可选）
                const fileName = path.basename(cursorPath);
                if (!options.skipBackup && backupDir) {
                  const backupPath = path.join(backupDir, fileName);
                  await fs.copy(cursorPath, backupPath);
                }

                // 删除原文件
                await fs.remove(cursorPath);
                results.actions.push(`已清理Cursor文件: ${fileName}`);
              } else if (stats.isDirectory()) {
                // 备份整个目录（可选）
                const dirName = path.basename(cursorPath);
                if (!options.skipBackup && backupDir) {
                  const backupPath = path.join(backupDir, dirName);
                  await fs.copy(cursorPath, backupPath);
                }

                // 删除原目录
                await fs.remove(cursorPath);
                results.actions.push(`已清理Cursor目录: ${dirName}`);
              }
            }
          } catch (error) {
            // 忽略单个路径的清理失败
            if (!error.message.includes("ENOENT")) {
              results.errors.push(
                `清理Cursor路径失败 ${path.basename(cursorPath)}: ${
                  error.message
                }`
              );
            }
          }
        }
      }

      // 重新生成Cursor专用的设备标识
      try {
        const { generateCursorDeviceId } = require(getSharedPath(
          "utils/stable-device-id"
        ));
        const newCursorDeviceId = await generateCursorDeviceId();

        // 创建新的storage.json文件，包含新的设备标识
        const currentTime = new Date().toUTCString();

        // 基础遥测数据
        const newStorageData = {
          "telemetry.machineId": newCursorDeviceId,
          "telemetry.macMachineId": newCursorDeviceId.substring(0, 64),
          "telemetry.devDeviceId": `${newCursorDeviceId.substring(
            0,
            8
          )}-${newCursorDeviceId.substring(
            8,
            12
          )}-${newCursorDeviceId.substring(
            12,
            16
          )}-${newCursorDeviceId.substring(
            16,
            20
          )}-${newCursorDeviceId.substring(20, 32)}`,
          "telemetry.sqmId": `{${newCursorDeviceId
            .substring(0, 8)
            .toUpperCase()}-${newCursorDeviceId
            .substring(8, 12)
            .toUpperCase()}-${newCursorDeviceId
            .substring(12, 16)
            .toUpperCase()}-${newCursorDeviceId
            .substring(16, 20)
            .toUpperCase()}-${newCursorDeviceId
            .substring(20, 32)
            .toUpperCase()}}`,
          // 重置时间戳，让系统认为是新的首次会话
          "telemetry.firstSessionDate": currentTime,
          "telemetry.currentSessionDate": currentTime,
        };

        // 如果需要保留Cursor登录信息，从备份中恢复
        if (options.skipCursorLogin && backupData) {
          // 保留Cursor登录相关的数据
          const cursorLoginKeys = [
            "cursorAuth/accessToken",
            "cursorAuth/refreshToken",
            "cursorAuth/cachedEmail",
            "cursorAuth/cachedSignUpType",
            "cursorAuth/stripeMembershipType",
            "cursorAuth/onboardingDate",
            "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser",
          ];

          cursorLoginKeys.forEach((key) => {
            if (backupData[key]) {
              newStorageData[key] = backupData[key];
            }
          });

          results.actions.push("✅ 已保留Cursor IDE登录信息");
        }

        // 重新创建storage.json文件
        const storageJsonPath = path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "globalStorage",
          "storage.json"
        );
        await fs.ensureDir(path.dirname(storageJsonPath));
        await fs.writeJson(storageJsonPath, newStorageData, { spaces: 4 });

        results.actions.push(
          `✅ 已生成新的Cursor设备标识: ${newCursorDeviceId.substring(
            0,
            16
          )}...`
        );
        results.actions.push(`📁 备份保存至: ${backupDir}`);
      } catch (deviceIdError) {
        results.errors.push(`生成新Cursor设备ID失败: ${deviceIdError.message}`);
      }

      // MCP配置已在cleanAugmentExtensionStorage中自动保护和恢复

      results.actions.push("🎯 Cursor IDE扩展数据已完全重置，将被识别为新设备");
    } catch (error) {
      results.errors.push(`清理Cursor扩展数据失败: ${error.message}`);
    }
  }

  // 通用MCP配置保护函数 - 自动检测所有可能的MCP配置路径
  async protectMCPConfigUniversal(results) {
    const mcpConfigs = new Map();

    // 定义所有可能的MCP配置路径
    const possibleMCPPaths = [
      // Windows路径
      path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "globalStorage",
        "augment.vscode-augment",
        "augment-global-state",
        "mcpServers.json"
      ),
      path.join(
        os.homedir(),
        "AppData",
        "Local",
        "Cursor",
        "User",
        "globalStorage",
        "augment.vscode-augment",
        "augment-global-state",
        "mcpServers.json"
      ),
      // macOS路径
      path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "Cursor",
        "User",
        "globalStorage",
        "augment.vscode-augment",
        "augment-global-state",
        "mcpServers.json"
      ),
      // Linux路径
      path.join(
        os.homedir(),
        ".config",
        "Cursor",
        "User",
        "globalStorage",
        "augment.vscode-augment",
        "augment-global-state",
        "mcpServers.json"
      ),
      // VS Code Windows路径
      path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Code",
        "User",
        "globalStorage",
        "augment.vscode-augment",
        "augment-global-state",
        "mcpServers.json"
      ),
      path.join(
        os.homedir(),
        "AppData",
        "Local",
        "Code",
        "User",
        "globalStorage",
        "augment.vscode-augment",
        "augment-global-state",
        "mcpServers.json"
      ),
      // VS Code macOS路径
      path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "Code",
        "User",
        "globalStorage",
        "augment.vscode-augment",
        "augment-global-state",
        "mcpServers.json"
      ),
      // VS Code Linux路径
      path.join(
        os.homedir(),
        ".config",
        "Code",
        "User",
        "globalStorage",
        "augment.vscode-augment",
        "augment-global-state",
        "mcpServers.json"
      ),
      // VS Code Insiders Windows路径
      path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Code - Insiders",
        "User",
        "globalStorage",
        "augment.vscode-augment",
        "augment-global-state",
        "mcpServers.json"
      ),
      // VS Code Insiders macOS路径
      path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "Code - Insiders",
        "User",
        "globalStorage",
        "augment.vscode-augment",
        "augment-global-state",
        "mcpServers.json"
      ),
      // VS Code Insiders Linux路径
      path.join(
        os.homedir(),
        ".config",
        "Code - Insiders",
        "User",
        "globalStorage",
        "augment.vscode-augment",
        "augment-global-state",
        "mcpServers.json"
      ),
    ];

    // 检测并保护所有存在的MCP配置
    for (const mcpPath of possibleMCPPaths) {
      try {
        if (await fs.pathExists(mcpPath)) {
          const mcpConfig = await fs.readJson(mcpPath);
          mcpConfigs.set(mcpPath, mcpConfig);
          results.actions.push(`🛡️ 已保护MCP配置: ${mcpPath}`);
        }
      } catch (error) {
        results.actions.push(`⚠️ 读取MCP配置失败 ${mcpPath}: ${error.message}`);
      }
    }

    return mcpConfigs;
  }

  // 通用MCP配置恢复函数
  async restoreMCPConfigUniversal(results, mcpConfigs) {
    if (!mcpConfigs || mcpConfigs.size === 0) {
      return;
    }

    for (const [mcpPath, mcpConfig] of mcpConfigs) {
      try {
        await fs.ensureDir(path.dirname(mcpPath));
        await fs.writeJson(mcpPath, mcpConfig, { spaces: 2 });
        results.actions.push(`🔄 已恢复MCP配置: ${mcpPath}`);
      } catch (error) {
        results.actions.push(`⚠️ 恢复MCP配置失败 ${mcpPath}: ${error.message}`);
      }
    }
  }

  // 专门清理Augment扩展的存储数据（包括登录会话，保护MCP配置）
  async cleanAugmentExtensionStorage(results, options = {}) {
    try {
      // 1. 首先使用通用保护机制保护所有MCP配置
      const mcpConfigs = await this.protectMCPConfigUniversal(results);

      const augmentStoragePaths = [
        // Augment扩展的globalStorage目录
        path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "globalStorage",
          "augment.vscode-augment"
        ),
        path.join(
          os.homedir(),
          "AppData",
          "Local",
          "Cursor",
          "User",
          "globalStorage",
          "augment.vscode-augment"
        ),
        // macOS路径
        path.join(
          os.homedir(),
          "Library",
          "Application Support",
          "Cursor",
          "User",
          "globalStorage",
          "augment.vscode-augment"
        ),
        // Linux路径
        path.join(
          os.homedir(),
          ".config",
          "Cursor",
          "User",
          "globalStorage",
          "augment.vscode-augment"
        ),
      ];

      let cleanedCount = 0;

      for (const augmentPath of augmentStoragePaths) {
        try {
          if (await fs.pathExists(augmentPath)) {
            // 1. 备份Augment扩展数据（可选）
            if (!options.skipBackup) {
              const backupDir = path.join(
                os.tmpdir(),
                `augment-backup-${Date.now()}`
              );
              await fs.ensureDir(backupDir);
              const backupPath = path.join(backupDir, "augment.vscode-augment");
              await fs.copy(augmentPath, backupPath);
              results.actions.push(`📁 Augment数据备份至: ${backupPath}`);
            }

            // 2. 删除Augment扩展存储目录
            await fs.remove(augmentPath);
            results.actions.push(
              `✅ 已清理Augment扩展存储: ${path.basename(augmentPath)}`
            );

            cleanedCount++;
          }
        } catch (error) {
          if (!error.message.includes("ENOENT")) {
            results.errors.push(
              `清理Augment扩展存储失败 ${path.basename(augmentPath)}: ${
                error.message
              }`
            );
          }
        }
      }

      // 3. 恢复所有MCP配置
      await this.restoreMCPConfigUniversal(results, mcpConfigs);

      // 清理state.vscdb中的Augment会话数据
      await this.cleanAugmentSessionsFromDatabase(results, options);

      // 清理工作区存储中的Augment数据
      await this.cleanAugmentWorkspaceStorage(results);

      // 清理缓存和日志文件
      await this.cleanCacheAndLogs(results);

      if (cleanedCount > 0) {
        results.actions.push("🔓 Augment扩展登录状态已清除，需要重新登录");
      } else {
        results.actions.push("ℹ️ 未发现Augment扩展存储数据");
      }
    } catch (error) {
      results.errors.push(`清理Augment扩展存储失败: ${error.message}`);
    }
  }

  // 清理state.vscdb数据库中的Augment会话数据
  async cleanAugmentSessionsFromDatabase(results, options = {}) {
    try {
      const stateDbPath = path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "globalStorage",
        "state.vscdb"
      );

      if (!(await fs.pathExists(stateDbPath))) {
        return;
      }

      // 使用sql.js清理Augment相关的会话数据
      try {
        const initSqlJs = require("sql.js");
        const SQL = await initSqlJs();

        const data = await fs.readFile(stateDbPath);
        const db = new SQL.Database(data);

        // 删除Augment相关的用户识别数据（保留Cursor IDE登录信息）
        const deleteQueries = options.skipCursorLogin
          ? [
              // 仅清理Augment相关数据
              "DELETE FROM ItemTable WHERE key LIKE '%augment%'",
              "DELETE FROM ItemTable WHERE key LIKE '%Augment%'",

              // 清理扩展会话数据（不影响Cursor IDE登录）
              "DELETE FROM ItemTable WHERE key LIKE '%secret://%' AND key LIKE '%augment%'",
              "DELETE FROM ItemTable WHERE key LIKE '%sessions%' AND key LIKE '%augment%'",

              // 仅清理特定的遥测ID（保留其他系统ID）
              "DELETE FROM ItemTable WHERE key = 'telemetry.devDeviceId'",
              "DELETE FROM ItemTable WHERE key = 'telemetry.machineId'",
              "DELETE FROM ItemTable WHERE key = 'telemetry.macMachineId'",
              "DELETE FROM ItemTable WHERE key = 'telemetry.sqmId'",

              // 注意：保留MCP服务配置，不进行清理
            ]
          : [
              // 完整清理模式（包括Cursor IDE登录）
              "DELETE FROM ItemTable WHERE key LIKE '%augment%'",
              "DELETE FROM ItemTable WHERE key LIKE '%Augment%'",

              // 用户认证相关
              "DELETE FROM ItemTable WHERE key LIKE '%cursorAuth%'",
              "DELETE FROM ItemTable WHERE key LIKE '%applicationUser%'",
              "DELETE FROM ItemTable WHERE key LIKE '%stripeMembershipType%'",
              "DELETE FROM ItemTable WHERE key LIKE '%secret://%'",
              "DELETE FROM ItemTable WHERE key LIKE '%auth%'",
              "DELETE FROM ItemTable WHERE key LIKE '%token%'",
              "DELETE FROM ItemTable WHERE key LIKE '%login%'",
              "DELETE FROM ItemTable WHERE key LIKE '%account%'",

              // 服务和会话相关
              "DELETE FROM ItemTable WHERE key LIKE '%serviceMachineId%'",
              "DELETE FROM ItemTable WHERE key LIKE '%sessions%'",
              "DELETE FROM ItemTable WHERE key LIKE '%interactive.sessions%'",
              "DELETE FROM ItemTable WHERE key LIKE '%user%'",

              // 遥测和设备相关
              "DELETE FROM ItemTable WHERE key LIKE '%telemetry%'",
              "DELETE FROM ItemTable WHERE key LIKE '%machine%'",
              "DELETE FROM ItemTable WHERE key LIKE '%device%'",

              // 扩展相关状态
              "DELETE FROM ItemTable WHERE key LIKE '%extension%'",
              "DELETE FROM ItemTable WHERE key LIKE '%workbench%'",

              // 注意：保留MCP服务配置，不进行清理
            ];

        let deletedCount = 0;
        for (const query of deleteQueries) {
          try {
            const result = db.run(query);
            if (result.changes > 0) {
              deletedCount += result.changes;
            }
          } catch (error) {
            // 忽略单个查询的失败
          }
        }

        // 保存修改后的数据库
        const newData = db.export();
        await fs.writeFile(stateDbPath, newData);
        db.close();

        if (deletedCount > 0) {
          results.actions.push(
            `🗑️ 已从数据库清理 ${deletedCount} 条Augment会话记录`
          );
        }
      } catch (sqlError) {
        // 如果sql.js操作失败，记录但不阻止其他清理操作
        results.actions.push("⚠️ 数据库会话清理跳过（sql.js不可用）");
      }
    } catch (error) {
      results.errors.push(`清理Augment数据库会话失败: ${error.message}`);
    }
  }

  // 清理工作区存储中的Augment数据
  async cleanAugmentWorkspaceStorage(results) {
    try {
      const workspaceStoragePath = path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "workspaceStorage"
      );

      if (!(await fs.pathExists(workspaceStoragePath))) {
        return;
      }

      const workspaces = await fs.readdir(workspaceStoragePath);
      let cleanedWorkspaces = 0;

      for (const workspace of workspaces) {
        const workspacePath = path.join(workspaceStoragePath, workspace);
        const augmentWorkspacePath = path.join(
          workspacePath,
          "augment.vscode-augment"
        );

        if (await fs.pathExists(augmentWorkspacePath)) {
          try {
            // 备份工作区Augment数据（可选）
            if (!options.skipBackup) {
              const backupDir = path.join(
                os.tmpdir(),
                `workspace-augment-backup-${Date.now()}`
              );
              await fs.ensureDir(backupDir);
              const backupPath = path.join(
                backupDir,
                `${workspace}-augment.vscode-augment`
              );
              await fs.copy(augmentWorkspacePath, backupPath);
              results.actions.push(`📁 工作区数据备份至: ${backupPath}`);
            }

            // 删除工作区Augment数据
            await fs.remove(augmentWorkspacePath);
            results.actions.push(
              `✅ 已清理工作区Augment数据: ${workspace.substring(0, 16)}...`
            );
            cleanedWorkspaces++;
          } catch (error) {
            results.errors.push(
              `清理工作区Augment数据失败 ${workspace}: ${error.message}`
            );
          }
        }
      }

      if (cleanedWorkspaces > 0) {
        results.actions.push(
          `🗑️ 已清理 ${cleanedWorkspaces} 个工作区的Augment数据`
        );
      } else {
        results.actions.push("ℹ️ 工作区中无Augment数据需要清理");
      }
    } catch (error) {
      results.errors.push(`清理工作区Augment数据失败: ${error.message}`);
    }
  }

  // 清理缓存和日志文件
  async cleanCacheAndLogs(results) {
    try {
      const pathsToClean = [
        // 缓存目录
        path.join(os.homedir(), "AppData", "Roaming", "Cursor", "Cache"),
        path.join(os.homedir(), "AppData", "Local", "Cursor", "Cache"),
        path.join(os.homedir(), "AppData", "Roaming", "Cursor", "CachedData"),

        // 日志目录
        path.join(os.homedir(), "AppData", "Roaming", "Cursor", "logs"),
        path.join(os.homedir(), "AppData", "Local", "Cursor", "logs"),

        // 其他可能包含用户信息的目录
        path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "History"
        ),
        path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "globalStorage",
          "backups"
        ),
      ];

      let cleanedCount = 0;

      for (const pathToClean of pathsToClean) {
        try {
          if (await fs.pathExists(pathToClean)) {
            // 备份目录（可选）
            if (!options.skipBackup) {
              const backupDir = path.join(
                os.tmpdir(),
                `cursor-backup-${Date.now()}-${Math.random()
                  .toString(36)
                  .substr(2, 9)}`
              );
              await fs.ensureDir(backupDir);
              const backupPath = path.join(
                backupDir,
                path.basename(pathToClean)
              );

              try {
                await fs.copy(pathToClean, backupPath);
                results.actions.push(
                  `📁 ${path.basename(pathToClean)}备份至: ${backupPath}`
                );
              } catch (backupError) {
                // 备份失败不阻止清理
                results.actions.push(
                  `⚠️ ${path.basename(pathToClean)}备份失败，继续清理`
                );
              }
            }

            // 删除原目录
            await fs.remove(pathToClean);
            results.actions.push(`✅ 已清理${path.basename(pathToClean)}目录`);
            cleanedCount++;
          }
        } catch (error) {
          if (!error.message.includes("ENOENT")) {
            results.errors.push(
              `清理${path.basename(pathToClean)}失败: ${error.message}`
            );
          }
        }
      }

      if (cleanedCount > 0) {
        results.actions.push(`🗑️ 已清理 ${cleanedCount} 个缓存/日志目录`);
      } else {
        results.actions.push("ℹ️ 无缓存/日志目录需要清理");
      }
    } catch (error) {
      results.errors.push(`清理缓存和日志失败: ${error.message}`);
    }
  }

  // 强制关闭Cursor IDE（更彻底）
  async forceCloseCursorIDE(results) {
    try {
      results.actions.push("🔄 强制关闭Cursor IDE...");

      if (this.platform === "win32") {
        // Windows: 多种方法强制关闭
        const killCommands = [
          'taskkill /f /im "Cursor.exe" /t',
          'taskkill /f /im "cursor.exe" /t',
          "wmic process where \"name='Cursor.exe'\" delete",
          "wmic process where \"name='cursor.exe'\" delete",
        ];

        for (const cmd of killCommands) {
          try {
            await execAsync(cmd);
            results.actions.push(`✅ 执行关闭命令: ${cmd}`);
          } catch (error) {
            // 忽略单个命令的失败
          }
        }

        // 等待进程完全终止
        await new Promise((resolve) => setTimeout(resolve, 3000));
        results.actions.push("✅ Cursor IDE已强制关闭");
      } else if (this.platform === "darwin") {
        // macOS: 强制关闭
        await execAsync('pkill -9 -f "Cursor"');
        await execAsync("killall -9 Cursor");
        results.actions.push("✅ Cursor IDE已强制关闭 (macOS)");
      } else {
        // Linux: 强制关闭
        await execAsync('pkill -9 -f "cursor"');
        await execAsync("killall -9 cursor");
        results.actions.push("✅ Cursor IDE已强制关闭 (Linux)");
      }
    } catch (error) {
      // 如果关闭失败，记录但不阻止清理操作
      if (
        error.message.includes("not found") ||
        error.message.includes("找不到")
      ) {
        results.actions.push("ℹ️ Cursor IDE未运行或已关闭");
      } else {
        results.actions.push(`⚠️ 强制关闭可能不完整: ${error.message}`);
      }
    }
  }

  // 关闭Cursor IDE
  async closeCursorIDE(results) {
    try {
      results.actions.push("🔄 正在关闭Cursor IDE...");

      if (this.platform === "win32") {
        // Windows: 使用taskkill强制关闭所有Cursor进程
        await execAsync('taskkill /f /im "Cursor.exe" /t');
        results.actions.push("✅ Cursor IDE已关闭");

        // 等待进程完全终止
        await new Promise((resolve) => setTimeout(resolve, 3000));
        results.actions.push("⏳ 等待进程完全终止...");
      } else if (this.platform === "darwin") {
        // macOS: 使用pkill
        await execAsync('pkill -f "Cursor"');
        results.actions.push("✅ Cursor IDE已关闭 (macOS)");
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } else {
        // Linux: 使用pkill
        await execAsync('pkill -f "cursor"');
        results.actions.push("✅ Cursor IDE已关闭 (Linux)");
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    } catch (error) {
      // 如果关闭失败，记录但不阻止清理操作
      if (
        error.message.includes("not found") ||
        error.message.includes("找不到")
      ) {
        results.actions.push("ℹ️ Cursor IDE未运行或已关闭");
      } else {
        results.errors.push(`关闭Cursor IDE失败: ${error.message}`);
      }
    }
  }

  // 启动Cursor IDE
  async startCursorIDE(results) {
    try {
      results.actions.push("🚀 正在启动Cursor IDE...");

      if (this.platform === "win32") {
        // Windows: 智能检测Cursor安装路径
        const cursorPath = await this.findCursorPath();

        if (cursorPath) {
          // 使用spawn启动，不等待
          const { spawn } = require("child_process");
          spawn(cursorPath, [], {
            detached: true,
            stdio: "ignore",
          }).unref();
          results.actions.push(`✅ Cursor IDE已启动: ${cursorPath}`);
        } else {
          results.errors.push("❌ 未找到Cursor IDE安装路径");
        }
      } else if (this.platform === "darwin") {
        // macOS: 智能检测并启动
        const cursorPath = await this.findCursorPathMacOS();
        if (cursorPath) {
          await execAsync(`open "${cursorPath}"`);
          results.actions.push(`✅ Cursor IDE已启动 (macOS): ${cursorPath}`);
        } else {
          // 备用方案：使用应用名称启动
          await execAsync('open -a "Cursor"');
          results.actions.push("✅ Cursor IDE已启动 (macOS - 备用方案)");
        }
      } else {
        // Linux: 智能检测并启动
        const cursorPath = await this.findCursorPathLinux();
        if (cursorPath) {
          const { spawn } = require("child_process");
          spawn(cursorPath, [], {
            detached: true,
            stdio: "ignore",
          }).unref();
          results.actions.push(`✅ Cursor IDE已启动 (Linux): ${cursorPath}`);
        } else {
          // 备用方案：使用cursor命令
          const { spawn } = require("child_process");
          spawn("cursor", [], {
            detached: true,
            stdio: "ignore",
          }).unref();
          results.actions.push("✅ Cursor IDE已启动 (Linux - 备用方案)");
        }
      }

      results.actions.push("⏳ Cursor IDE启动中，请稍候...");
    } catch (error) {
      results.errors.push(`启动Cursor IDE失败: ${error.message}`);
    }
  }

  // 强制关闭VS Code IDE
  async forceCloseVSCodeIDE(results) {
    try {
      results.actions.push("🔄 正在强制关闭VS Code IDE...");

      if (this.platform === "win32") {
        // Windows: 强制关闭所有VS Code进程
        await execAsync('taskkill /f /im "Code.exe" /t');
        await execAsync('taskkill /f /im "code.exe" /t');

        // 等待进程完全终止
        await new Promise((resolve) => setTimeout(resolve, 3000));
        results.actions.push("✅ VS Code IDE已强制关闭");
      } else if (this.platform === "darwin") {
        // macOS: 强制关闭
        await execAsync('pkill -9 -f "Visual Studio Code"');
        await execAsync("killall -9 'Visual Studio Code'");
        results.actions.push("✅ VS Code IDE已强制关闭 (macOS)");
      } else {
        // Linux: 强制关闭
        await execAsync('pkill -9 -f "code"');
        await execAsync("killall -9 code");
        results.actions.push("✅ VS Code IDE已强制关闭 (Linux)");
      }
    } catch (error) {
      // 如果关闭失败，记录但不阻止清理操作
      if (
        error.message.includes("not found") ||
        error.message.includes("找不到")
      ) {
        results.actions.push("ℹ️ VS Code IDE未运行或已关闭");
      } else {
        results.actions.push(`⚠️ 强制关闭VS Code可能不完整: ${error.message}`);
      }
    }
  }

  // 启动VS Code IDE
  async startVSCodeIDE(results) {
    try {
      results.actions.push("🚀 正在启动VS Code IDE...");

      if (this.platform === "win32") {
        // Windows: 智能检测VS Code安装路径
        const vscodePath = await this.findVSCodePath();

        if (vscodePath) {
          // 使用spawn启动，不等待
          const { spawn } = require("child_process");
          spawn(vscodePath, [], {
            detached: true,
            stdio: "ignore",
          }).unref();
          results.actions.push(`✅ VS Code IDE已启动: ${vscodePath}`);
        } else {
          results.errors.push("❌ 未找到VS Code IDE安装路径");
        }
      } else if (this.platform === "darwin") {
        // macOS: 智能检测并启动
        const vscodePath = await this.findVSCodePathMacOS();
        if (vscodePath) {
          await execAsync(`open "${vscodePath}"`);
          results.actions.push(`✅ VS Code IDE已启动 (macOS): ${vscodePath}`);
        } else {
          // 备用方案：使用应用名称启动
          await execAsync('open -a "Visual Studio Code"');
          results.actions.push("✅ VS Code IDE已启动 (macOS - 备用方案)");
        }
      } else {
        // Linux: 智能检测并启动
        const vscodePath = await this.findVSCodePathLinux();
        if (vscodePath) {
          const { spawn } = require("child_process");
          spawn(vscodePath, [], {
            detached: true,
            stdio: "ignore",
          }).unref();
          results.actions.push(`✅ VS Code IDE已启动 (Linux): ${vscodePath}`);
        } else {
          // 备用方案：使用code命令
          const { spawn } = require("child_process");
          spawn("code", [], {
            detached: true,
            stdio: "ignore",
          }).unref();
          results.actions.push("✅ VS Code IDE已启动 (Linux - 备用方案)");
        }
      }

      results.actions.push("⏳ VS Code IDE启动中，请稍候...");
    } catch (error) {
      results.errors.push(`启动VS Code IDE失败: ${error.message}`);
    }
  }

  // 统一的IDE关闭方法（清理前调用）
  async closeIDEsBeforeCleanup(results, options = {}) {
    try {
      results.actions.push("🔄 第1步：清理前关闭相关IDE，避免文件占用问题");

      let needCloseAnyIDE = false;

      // 根据用户选择决定关闭哪些IDE
      if (options.cleanCursor) {
        needCloseAnyIDE = true;
        await this.forceCloseCursorIDE(results);
      }

      if (options.cleanVSCode) {
        needCloseAnyIDE = true;
        await this.forceCloseVSCodeIDE(results);
      }

      if (!needCloseAnyIDE) {
        results.actions.push("ℹ️ 未选择清理任何IDE，跳过IDE关闭步骤");
        return;
      }

      // 等待所有IDE进程完全终止
      results.actions.push("⏳ 等待5秒确保所有IDE进程完全终止...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      results.actions.push("✅ IDE关闭完成，可以安全进行清理操作");
    } catch (error) {
      results.errors.push(`关闭IDE失败: ${error.message}`);
      // 不阻止清理操作继续进行
    }
  }

  // 统一的IDE启动方法（清理后调用）
  async startIDEsAfterCleanup(results, options = {}) {
    try {
      results.actions.push("🚀 最后步骤：重新启动IDE，应用清理结果");

      let needStartAnyIDE = false;

      // 根据用户选择决定启动哪些IDE
      if (options.cleanCursor && options.autoRestartIDE !== false) {
        needStartAnyIDE = true;
        await this.startCursorIDE(results);
      }

      if (options.cleanVSCode && options.autoRestartIDE !== false) {
        needStartAnyIDE = true;
        await this.startVSCodeIDE(results);
      }

      if (!needStartAnyIDE) {
        results.actions.push("ℹ️ 未配置自动重启IDE或未选择清理任何IDE");
        return;
      }

      results.actions.push("✅ IDE重启完成，新的设备身份已生效");
    } catch (error) {
      results.errors.push(`启动IDE失败: ${error.message}`);
      // 不影响清理操作的成功状态
    }
  }

  // 查找VS Code安装路径（Windows）
  async findVSCodePath() {
    const possiblePaths = [
      // 用户安装路径
      path.join(
        os.homedir(),
        "AppData",
        "Local",
        "Programs",
        "Microsoft VS Code",
        "Code.exe"
      ),
      // 系统安装路径
      "C:\\Program Files\\Microsoft VS Code\\Code.exe",
      "C:\\Program Files (x86)\\Microsoft VS Code\\Code.exe",
      // Portable版本
      path.join(process.cwd(), "VSCode-win32-x64", "Code.exe"),
    ];

    for (const vscodePath of possiblePaths) {
      try {
        if (await fs.pathExists(vscodePath)) {
          return vscodePath;
        }
      } catch (error) {
        // 继续检查下一个路径
      }
    }

    return null;
  }

  // 查找VS Code安装路径（macOS）
  async findVSCodePathMacOS() {
    const possiblePaths = [
      "/Applications/Visual Studio Code.app",
      path.join(os.homedir(), "Applications", "Visual Studio Code.app"),
    ];

    for (const vscodePath of possiblePaths) {
      try {
        if (await fs.pathExists(vscodePath)) {
          return vscodePath;
        }
      } catch (error) {
        // 继续检查下一个路径
      }
    }

    return null;
  }

  // 查找VS Code安装路径（Linux）
  async findVSCodePathLinux() {
    const possiblePaths = [
      "/usr/bin/code",
      "/usr/local/bin/code",
      "/snap/bin/code",
      "/opt/visual-studio-code/code",
      path.join(os.homedir(), ".local", "bin", "code"),
    ];

    for (const vscodePath of possiblePaths) {
      try {
        if (await fs.pathExists(vscodePath)) {
          return vscodePath;
        }
      } catch (error) {
        // 继续检查下一个路径
      }
    }

    return null;
  }

  // 智能检测Cursor IDE安装路径
  async findCursorPath() {
    try {
      // 方法1: 使用where命令查找cursor命令
      try {
        const { stdout } = await execAsync("where cursor");
        const lines = stdout.trim().split("\n");

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.endsWith(".exe") || trimmedLine.endsWith("cursor")) {
            // 从cursor命令路径推导出Cursor.exe路径
            const cursorDir = path.dirname(
              path.dirname(path.dirname(trimmedLine))
            );
            const cursorExePath = path.join(cursorDir, "Cursor.exe");

            if (await fs.pathExists(cursorExePath)) {
              return cursorExePath;
            }
          }
        }
      } catch (error) {
        // where命令失败，继续其他方法
      }

      // 方法2: 检查注册表中的安装信息
      if (this.platform === "win32") {
        try {
          const { stdout } = await execAsync(
            'reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s /f "Cursor" /k'
          );
          const lines = stdout.split("\n");

          for (const line of lines) {
            if (line.includes("Cursor")) {
              try {
                const { stdout: installLocation } = await execAsync(
                  `reg query "${line.trim()}" /v "InstallLocation"`
                );
                const match = installLocation.match(
                  /InstallLocation\s+REG_SZ\s+(.+)/
                );
                if (match) {
                  const installPath = match[1].trim();
                  const cursorExePath = path.join(installPath, "Cursor.exe");
                  if (await fs.pathExists(cursorExePath)) {
                    return cursorExePath;
                  }
                }
              } catch (error) {
                // 忽略单个注册表项的查询失败
              }
            }
          }
        } catch (error) {
          // 注册表查询失败，继续其他方法
        }
      }

      // 方法3: 检查常见安装路径
      const commonPaths = [
        // 用户级安装
        path.join(
          os.homedir(),
          "AppData",
          "Local",
          "Programs",
          "cursor",
          "Cursor.exe"
        ),
        path.join(os.homedir(), "AppData", "Local", "cursor", "Cursor.exe"),

        // 系统级安装
        "C:\\Program Files\\Cursor\\Cursor.exe",
        "C:\\Program Files (x86)\\Cursor\\Cursor.exe",

        // 其他可能的位置
        "D:\\cursor\\Cursor.exe",
        "E:\\cursor\\Cursor.exe",
        "F:\\cursor\\Cursor.exe",

        // Portable版本可能的位置
        path.join("C:", "cursor", "Cursor.exe"),
        path.join("D:", "cursor", "Cursor.exe"),
        path.join("E:", "cursor", "Cursor.exe"),
      ];

      for (const possiblePath of commonPaths) {
        if (await fs.pathExists(possiblePath)) {
          return possiblePath;
        }
      }

      // 方法4: 搜索所有驱动器的Program Files目录
      try {
        const drives = ["C:", "D:", "E:", "F:", "G:"];

        for (const drive of drives) {
          const programFilesPaths = [
            path.join(drive, "\\", "Program Files", "Cursor", "Cursor.exe"),
            path.join(
              drive,
              "\\",
              "Program Files (x86)",
              "Cursor",
              "Cursor.exe"
            ),
            path.join(drive, "\\", "cursor", "Cursor.exe"),
          ];

          for (const possiblePath of programFilesPaths) {
            if (await fs.pathExists(possiblePath)) {
              return possiblePath;
            }
          }
        }
      } catch (error) {
        // 驱动器搜索失败
      }

      return null;
    } catch (error) {
      console.error("查找Cursor路径失败:", error);
      return null;
    }
  }

  // macOS Cursor路径检测
  async findCursorPathMacOS() {
    try {
      const commonPaths = [
        "/Applications/Cursor.app",
        path.join(os.homedir(), "Applications", "Cursor.app"),
        "/usr/local/bin/cursor",
        "/opt/homebrew/bin/cursor",
      ];

      for (const possiblePath of commonPaths) {
        if (await fs.pathExists(possiblePath)) {
          return possiblePath;
        }
      }

      // 使用which命令查找
      try {
        const { stdout } = await execAsync("which cursor");
        const cursorPath = stdout.trim();
        if (cursorPath && (await fs.pathExists(cursorPath))) {
          return cursorPath;
        }
      } catch (error) {
        // which命令失败
      }

      return null;
    } catch (error) {
      console.error("查找macOS Cursor路径失败:", error);
      return null;
    }
  }

  // Linux Cursor路径检测
  async findCursorPathLinux() {
    try {
      const commonPaths = [
        "/usr/bin/cursor",
        "/usr/local/bin/cursor",
        "/opt/cursor/cursor",
        path.join(os.homedir(), ".local", "bin", "cursor"),
        path.join(os.homedir(), "cursor", "cursor"),
        "/snap/bin/cursor",
        "/var/lib/flatpak/exports/bin/cursor",
      ];

      for (const possiblePath of commonPaths) {
        if (await fs.pathExists(possiblePath)) {
          return possiblePath;
        }
      }

      // 使用which命令查找
      try {
        const { stdout } = await execAsync("which cursor");
        const cursorPath = stdout.trim();
        if (cursorPath && (await fs.pathExists(cursorPath))) {
          return cursorPath;
        }
      } catch (error) {
        // which命令失败
      }

      return null;
    } catch (error) {
      console.error("查找Linux Cursor路径失败:", error);
      return null;
    }
  }

  // 执行深度清理验证和补充清理
  async performDeepCleanupVerification(results, options = {}) {
    try {
      results.actions.push("🔍 执行深度清理验证...");

      // 1. 再次清理可能重新生成的文件
      const criticalPaths = [
        path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "globalStorage",
          "storage.json"
        ),
        path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "globalStorage",
          "state.vscdb"
        ),
      ];

      for (const criticalPath of criticalPaths) {
        if (await fs.pathExists(criticalPath)) {
          const fileName = path.basename(criticalPath);

          // 在保留登录模式下，跳过关键登录文件
          if (options.skipCursorLogin && fileName === "state.vscdb") {
            results.actions.push(`🛡️ 保留登录模式：跳过二次清理 ${fileName}`);
            continue;
          }

          try {
            await fs.remove(criticalPath);
            results.actions.push(`🗑️ 二次清理: ${fileName}`);
          } catch (error) {
            results.errors.push(`二次清理失败 ${fileName}: ${error.message}`);
          }
        }
      }

      // 2. 强制重新生成完全新的storage.json
      await this.forceRegenerateStorageJson(results, options);

      // 3. 清理可能的进程残留文件
      await this.cleanProcessResidualFiles(results);

      results.actions.push("✅ 深度清理验证完成");
    } catch (error) {
      results.errors.push(`深度清理验证失败: ${error.message}`);
    }
  }

  // 强制重新生成storage.json
  async forceRegenerateStorageJson(results, options = {}) {
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

      // 生成完全新的设备标识
      const { generateCursorDeviceId } = require(getSharedPath(
        "utils/stable-device-id"
      ));
      const newCursorDeviceId = await generateCursorDeviceId();
      const currentTime = new Date().toUTCString();

      // 创建最小化的storage.json，只包含必要的遥测信息
      const minimalStorageData = {
        "telemetry.machineId": newCursorDeviceId,
        "telemetry.macMachineId": newCursorDeviceId.substring(0, 64),
        "telemetry.devDeviceId": `${newCursorDeviceId.substring(
          0,
          8
        )}-${newCursorDeviceId.substring(8, 12)}-${newCursorDeviceId.substring(
          12,
          16
        )}-${newCursorDeviceId.substring(16, 20)}-${newCursorDeviceId.substring(
          20,
          32
        )}`,
        "telemetry.sqmId": `{${newCursorDeviceId
          .substring(0, 8)
          .toUpperCase()}-${newCursorDeviceId
          .substring(8, 12)
          .toUpperCase()}-${newCursorDeviceId
          .substring(12, 16)
          .toUpperCase()}-${newCursorDeviceId
          .substring(16, 20)
          .toUpperCase()}-${newCursorDeviceId
          .substring(20, 32)
          .toUpperCase()}}`,
        "telemetry.firstSessionDate": currentTime,
        "telemetry.currentSessionDate": currentTime,
      };

      await fs.ensureDir(path.dirname(storageJsonPath));
      await fs.writeJson(storageJsonPath, minimalStorageData, { spaces: 2 });

      results.actions.push(
        `🆔 强制重新生成storage.json: ${newCursorDeviceId.substring(0, 16)}...`
      );
    } catch (error) {
      results.errors.push(`强制重新生成storage.json失败: ${error.message}`);
    }
  }

  // 清理进程残留文件
  async cleanProcessResidualFiles(results) {
    try {
      const residualPaths = [
        path.join(os.tmpdir(), "cursor-*"),
        path.join(os.tmpdir(), "Cursor-*"),
        path.join(os.homedir(), "AppData", "Local", "Temp", "cursor-*"),
        path.join(os.homedir(), "AppData", "Local", "Temp", "Cursor-*"),
      ];

      for (const residualPattern of residualPaths) {
        try {
          const glob = require("glob");
          const files = glob.sync(residualPattern);

          for (const file of files) {
            try {
              await fs.remove(file);
              results.actions.push(`🗑️ 清理残留文件: ${path.basename(file)}`);
            } catch (error) {
              // 忽略单个文件清理失败
            }
          }
        } catch (error) {
          // 忽略glob错误
        }
      }
    } catch (error) {
      results.errors.push(`清理进程残留文件失败: ${error.message}`);
    }
  }

  // 启动持续监控，防止Cursor恢复旧数据
  async startContinuousMonitoring(
    results,
    monitoringDuration = 30000,
    options = {}
  ) {
    try {
      results.actions.push("🔄 启动持续监控，防止数据恢复...");

      // 保存我们生成的新设备ID
      const { generateCursorDeviceId } = require(getSharedPath(
        "utils/stable-device-id"
      ));
      const newCursorDeviceId = await generateCursorDeviceId();

      // 启动终极监控任务
      const checkInterval = 1500; // 每1.5秒检查一次（更频繁）
      const startTime = Date.now();
      let updateCount = 0;
      const oldDeviceId = "36987e70-60fe-4401-85a4-f463c269f069";

      const monitoringTask = setInterval(async () => {
        try {
          // 检查当前设备ID
          const currentDeviceId = await this.getCurrentDeviceId();

          // 如果检测到旧ID或非目标ID，立即强制更新
          if (
            currentDeviceId === oldDeviceId ||
            (currentDeviceId && currentDeviceId !== newCursorDeviceId)
          ) {
            await this.enforceNewDeviceId(newCursorDeviceId, options);
            updateCount++;
            results.actions.push(
              `🔄 检测到ID偏离，已强制更新 (第${updateCount}次)`
            );
          }
        } catch (error) {
          // 忽略监控过程中的错误
        }

        // 检查是否超时
        if (Date.now() - startTime > monitoringDuration) {
          clearInterval(monitoringTask);
          results.actions.push(
            `✅ 终极监控完成，共执行 ${updateCount} 次强制更新`
          );
        }
      }, checkInterval);

      results.actions.push(
        `⏰ 持续监控已启动，将运行${monitoringDuration / 1000}秒`
      );
      results.actions.push(
        `🆔 强制使用新设备ID: ${newCursorDeviceId.substring(0, 16)}...`
      );
    } catch (error) {
      results.errors.push(`启动持续监控失败: ${error.message}`);
    }
  }

  // 选择性清理storage.json（保留登录信息）
  async selectiveCleanStorageJson(results) {
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
        // 读取现有数据
        const data = await fs.readJson(storageJsonPath);

        // 备份登录相关数据
        const loginKeys = [
          "cursorAuth/accessToken",
          "cursorAuth/refreshToken",
          "cursorAuth/cachedEmail",
          "cursorAuth/cachedSignUpType",
          "cursorAuth/stripeMembershipType",
          "cursorAuth/onboardingDate",
          "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser",
        ];

        const loginBackup = {};
        loginKeys.forEach((key) => {
          if (data[key]) {
            loginBackup[key] = data[key];
          }
        });

        // 生成新的遥测ID
        const crypto = require("crypto");
        const newDeviceId = crypto.randomUUID();

        // 尝试使用在线时间，失败时回退到本地时间
        let currentTime;
        try {
          const BeijingTimeAPI = require("./beijing-time-api");
          const timeAPI = new BeijingTimeAPI();
          const onlineTime = await timeAPI.getCurrentTime(true); // 允许回退
          currentTime = onlineTime.toUTCString();
        } catch (error) {
          console.warn("⚠️ 获取在线时间失败，使用本地时间:", error.message);
          currentTime = new Date().toUTCString();
        }

        // 创建新的storage.json（只包含遥测ID和登录信息）
        const newStorageData = {
          // 新的遥测ID
          "telemetry.devDeviceId": newDeviceId,
          "telemetry.machineId": crypto.randomBytes(32).toString("hex"),
          "telemetry.macMachineId": crypto.randomBytes(32).toString("hex"),
          "telemetry.sqmId": `{${newDeviceId.toUpperCase()}}`,
          "telemetry.firstSessionDate": currentTime,
          "telemetry.currentSessionDate": currentTime,

          // 基础系统ID
          "storage.serviceMachineId": crypto.randomUUID(),

          // 合并保留的登录数据
          ...loginBackup,
        };

        // 写入新的storage.json
        await fs.writeJson(storageJsonPath, newStorageData, { spaces: 2 });

        results.actions.push(
          `🔐 已选择性清理storage.json，保留 ${
            Object.keys(loginBackup).length
          } 项登录数据`
        );
        results.actions.push(`🆔 已更新设备ID: ${newDeviceId}`);

        return newDeviceId;
      } else {
        results.actions.push("⚠️ storage.json文件不存在，跳过选择性清理");
        return null;
      }
    } catch (error) {
      results.errors.push(`选择性清理storage.json失败: ${error.message}`);
      return null;
    }
  }

  // 获取当前设备ID
  async getCurrentDeviceId() {
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
        return data["telemetry.devDeviceId"];
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // 执行多轮清理
  async performMultiRoundCleanup(results, options) {
    try {
      results.actions.push("🔄 启动多轮清理模式...");

      // 保护MCP配置（多轮清理前）
      const mcpConfigs = await this.protectMCPConfigUniversal(results);

      // 第二轮清理：针对顽固文件
      await new Promise((resolve) => setTimeout(resolve, 2000));
      results.actions.push("🔄 第二轮清理：处理顽固文件...");

      const stubborFiles = [
        path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "globalStorage",
          "storage.json"
        ),
        path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "globalStorage",
          "state.vscdb"
        ),
      ];

      for (const file of stubborFiles) {
        if (await fs.pathExists(file)) {
          const fileName = path.basename(file);

          // 在保留登录模式下，跳过关键登录文件
          if (options.skipCursorLogin && fileName === "state.vscdb") {
            results.actions.push(`🛡️ 保留登录模式：跳过删除 ${fileName}`);
            continue;
          }

          try {
            await fs.remove(file);
            results.actions.push(`🗑️ 第二轮清理: ${fileName}`);
          } catch (error) {
            results.errors.push(`第二轮清理失败 ${fileName}: ${error.message}`);
          }
        }
      }

      // 第三轮清理：重新生成关键文件
      await new Promise((resolve) => setTimeout(resolve, 1000));
      results.actions.push("🔄 第三轮清理：重新生成关键文件...");
      await this.forceRegenerateStorageJson(results, options);

      // 恢复MCP配置（多轮清理后）
      await this.restoreMCPConfigUniversal(results, mcpConfigs);

      results.actions.push("✅ 多轮清理完成");
    } catch (error) {
      results.errors.push(`多轮清理失败: ${error.message}`);
    }
  }

  // 强制执行新设备ID
  async enforceNewDeviceId(newCursorDeviceId, options = {}) {
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

        // 检查是否有旧的devDeviceId
        const oldDeviceId = "36987e70-60fe-4401-85a4-f463c269f069";
        if (data["telemetry.devDeviceId"] === oldDeviceId) {
          // 强制更新为新的设备ID
          const currentTime = new Date().toUTCString();
          data["telemetry.machineId"] = newCursorDeviceId;
          data["telemetry.macMachineId"] = newCursorDeviceId.substring(0, 64);
          data["telemetry.devDeviceId"] = `${newCursorDeviceId.substring(
            0,
            8
          )}-${newCursorDeviceId.substring(
            8,
            12
          )}-${newCursorDeviceId.substring(
            12,
            16
          )}-${newCursorDeviceId.substring(
            16,
            20
          )}-${newCursorDeviceId.substring(20, 32)}`;
          data["telemetry.sqmId"] = `{${newCursorDeviceId
            .substring(0, 8)
            .toUpperCase()}-${newCursorDeviceId
            .substring(8, 12)
            .toUpperCase()}-${newCursorDeviceId
            .substring(12, 16)
            .toUpperCase()}-${newCursorDeviceId
            .substring(16, 20)
            .toUpperCase()}-${newCursorDeviceId
            .substring(20, 32)
            .toUpperCase()}}`;
          data["telemetry.firstSessionDate"] = currentTime;
          data["telemetry.currentSessionDate"] = currentTime;

          // 只有在不保留Cursor登录时才删除认证信息
          if (!options.skipCursorLogin) {
            // 删除用户认证相关信息
            delete data["cursorAuth/stripeMembershipType"];
            delete data["storage.serviceMachineId"];

            // 删除applicationUser中的认证信息
            if (
              data[
                "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser"
              ]
            ) {
              delete data[
                "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser"
              ];
            }
          }

          await fs.writeJson(storageJsonPath, data, { spaces: 2 });
        }
      }
    } catch (error) {
      // 忽略强制执行过程中的错误
    }
  }

  // 执行完全的Cursor IDE重置
  async performCompleteCursorReset(
    results,
    cursorPaths,
    backupDir,
    options = {}
  ) {
    try {
      results.actions.push("🔄 开始完全重置Cursor IDE用户身份...");

      // 1. 清理所有Cursor IDE相关文件和目录
      for (const cursorPath of cursorPaths) {
        try {
          if (await fs.pathExists(cursorPath)) {
            const stats = await fs.stat(cursorPath);
            const pathName = path.basename(cursorPath);

            if (stats.isFile()) {
              // 备份并删除文件（可选备份）
              const fileName = path.basename(cursorPath);
              if (!options.skipBackup && backupDir) {
                const backupPath = path.join(backupDir, fileName);
                await fs.copy(cursorPath, backupPath);
              }
              await fs.remove(cursorPath);
              results.actions.push(`🗑️ 已清理Cursor文件: ${fileName}`);
            } else if (stats.isDirectory()) {
              // 备份并删除目录（可选备份）
              const dirName = path.basename(cursorPath);
              if (!options.skipBackup && backupDir) {
                const backupPath = path.join(backupDir, dirName);
                await fs.copy(cursorPath, backupPath);
              }
              await fs.remove(cursorPath);
              results.actions.push(`🗑️ 已清理Cursor目录: ${dirName}`);
            }
          }
        } catch (error) {
          if (!error.message.includes("ENOENT")) {
            results.errors.push(
              `清理Cursor路径失败 ${path.basename(cursorPath)}: ${
                error.message
              }`
            );
          }
        }
      }

      // 2. 清理额外的Cursor IDE用户数据
      await this.cleanAdditionalCursorData(results);

      // 3. 重新生成全新的Cursor设备标识
      await this.generateFreshCursorIdentity(results);

      results.actions.push("✅ Cursor IDE完全重置完成，将被识别为全新用户");
    } catch (error) {
      results.errors.push(`完全重置Cursor IDE失败: ${error.message}`);
    }
  }

  // 清理额外的Cursor IDE用户数据
  async cleanAdditionalCursorData(results) {
    try {
      // 清理可能的额外用户数据路径
      const additionalPaths = [
        // Windows额外路径
        path.join(os.homedir(), "AppData", "Local", "Cursor"),
        path.join(os.homedir(), "AppData", "LocalLow", "Cursor"),

        // 可能的用户配置文件
        path.join(os.homedir(), ".cursor"),
        path.join(os.homedir(), ".vscode-cursor"),

        // 临时文件和缓存
        path.join(os.tmpdir(), "cursor*"),
        path.join(os.tmpdir(), "vscode-cursor*"),
      ];

      for (const additionalPath of additionalPaths) {
        try {
          if (await fs.pathExists(additionalPath)) {
            const backupPath = path.join(
              os.tmpdir(),
              `cursor-additional-backup-${Date.now()}-${path.basename(
                additionalPath
              )}`
            );
            await fs.copy(additionalPath, backupPath);
            await fs.remove(additionalPath);
            results.actions.push(
              `🗑️ 已清理额外数据: ${path.basename(additionalPath)}`
            );
          }
        } catch (error) {
          // 忽略单个路径的清理失败
        }
      }
    } catch (error) {
      results.errors.push(`清理额外Cursor数据失败: ${error.message}`);
    }
  }

  // 生成全新的Cursor身份标识
  async generateFreshCursorIdentity(results) {
    try {
      const { generateCursorDeviceId } = require(getSharedPath(
        "utils/stable-device-id"
      ));
      const newCursorDeviceId = await generateCursorDeviceId();
      const currentTime = new Date().toUTCString();

      // 创建全新的storage.json，包含全新的身份标识
      const storageJsonPath = path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "globalStorage",
        "storage.json"
      );

      const freshStorageData = {
        // 全新的遥测标识
        "telemetry.machineId": newCursorDeviceId,
        "telemetry.macMachineId": newCursorDeviceId.substring(0, 64),
        "telemetry.devDeviceId": `${newCursorDeviceId.substring(
          0,
          8
        )}-${newCursorDeviceId.substring(8, 12)}-${newCursorDeviceId.substring(
          12,
          16
        )}-${newCursorDeviceId.substring(16, 20)}-${newCursorDeviceId.substring(
          20,
          32
        )}`,
        "telemetry.sqmId": `{${newCursorDeviceId
          .substring(0, 8)
          .toUpperCase()}-${newCursorDeviceId
          .substring(8, 12)
          .toUpperCase()}-${newCursorDeviceId
          .substring(12, 16)
          .toUpperCase()}-${newCursorDeviceId
          .substring(16, 20)
          .toUpperCase()}-${newCursorDeviceId
          .substring(20, 32)
          .toUpperCase()}}`,

        // 重置时间戳，模拟首次安装
        "telemetry.firstSessionDate": currentTime,
        "telemetry.currentSessionDate": currentTime,
        "telemetry.lastSessionDate": currentTime,

        // 重置安装和使用统计
        "telemetry.installTime": Date.now(),
        "telemetry.sessionCount": 1,

        // 清除所有用户偏好和设置
        // 注意：不包含任何认证信息，确保需要重新登录
      };

      await fs.ensureDir(path.dirname(storageJsonPath));
      await fs.writeJson(storageJsonPath, freshStorageData, { spaces: 2 });

      results.actions.push(
        `🆔 已生成全新Cursor身份: ${newCursorDeviceId.substring(0, 16)}...`
      );
      results.actions.push("🔄 Cursor IDE将被识别为全新安装的实例");
    } catch (error) {
      results.errors.push(`生成全新Cursor身份失败: ${error.message}`);
    }
  }

  // ==================== 分级清理模式实现 ====================

  // 智能清理模式：只清理设备身份，保留所有配置
  async performIntelligentCleanup(results, options = {}) {
    try {
      results.actions.push("🧠 开始智能清理 - 精准清理设备身份数据");

      // 1. 使用通用保护机制保护所有MCP配置
      const mcpConfigs = await this.protectMCPConfigUniversal(results);

      // 2. 保护IDE核心设置文件
      const ideSettings = await this.protectIDESettings(results);

      // 3. 保护工作区配置
      const workspaceSettings = await this.protectWorkspaceSettings(results);

      // 4. 清理设备身份相关数据（最小化清理）
      await this.cleanDeviceIdentityOnly(results, options);

      // 5. 清理Augment扩展的设备身份数据
      await this.cleanAugmentDeviceIdentity(results, options);

      // 6. 更新设备指纹（生成新的设备ID）
      await this.regenerateDeviceFingerprint(results, options);

      // 7. 恢复所有MCP配置
      await this.restoreMCPConfigUniversal(results, mcpConfigs);

      // 8. 恢复IDE核心设置
      await this.restoreIDESettings(results, ideSettings);

      // 9. 恢复工作区配置
      await this.restoreWorkspaceSettings(results, workspaceSettings);

      // 10. 启动增强防护（智能模式默认启用）
      if (options.enableEnhancedGuardian !== false) {
        await this.startEnhancedGuardian(results, options);
      }

      // 11. 处理VS Code（如果启用）
      if (options.cleanVSCode) {
        results.actions.push("🔵 智能清理模式 - 处理VS Code设备身份");

        // VS Code智能清理：仅更新设备身份，不清理配置
        const vscodeVariants = await this.detectInstalledVSCodeVariants();
        for (const variant of vscodeVariants) {
          // 智能模式：仅清理设备身份，保护所有配置
          await this.performVSCodeIntelligentCleanup(results, variant, options);
        }
      }

      // 12. 重新启动IDE（如果需要）
      await this.startIDEsAfterCleanup(results, options);

      results.actions.push("✅ 智能清理完成 - 设备身份已重置，所有配置已保留");
      results.actions.push(
        "🛡️ 保护范围: MCP配置 + IDE设置 + 工作区配置 + 登录状态"
      );
      results.actions.push("🎯 效果: 扩展识别为新用户，但保留所有个人配置");
      results.actions.push(
        "⚠️ 重要提醒: 智能模式仅更新设备身份，不清理任何IDE配置文件"
      );
      return results;
    } catch (error) {
      results.errors.push(`智能清理失败: ${error.message}`);
      results.success = false;
      return results;
    }
  }

  // 标准清理模式：深度清理但保留核心配置
  async performStandardModeCleanup(results, options = {}) {
    try {
      results.actions.push("🔧 开始标准清理 - 深度清理保留核心配置");

      // 1. 使用通用保护机制保护所有MCP配置
      const mcpConfigs = await this.protectMCPConfigUniversal(results);

      // 2. 设置标准清理选项
      const standardOptions = {
        ...options,
        deepClean: true,
        aggressiveMode: true,
        multiRoundClean: true,
        extendedMonitoring: true,
        skipCursorLogin: true,
        resetCursorCompletely: false,
        resetVSCodeCompletely: false,
      };

      // 3. 执行标准清理流程（复用现有逻辑）
      const cleanupResults = await this.performStandardCleanup(standardOptions);

      // 4. 恢复所有MCP配置
      await this.restoreMCPConfigUniversal(results, mcpConfigs);

      // 5. 合并清理结果
      results.actions.push(...cleanupResults.actions);
      results.errors.push(...cleanupResults.errors);
      results.success = cleanupResults.success && results.success;

      // 6. 启动增强防护（标准模式默认启用）
      if (options.enableEnhancedGuardian !== false) {
        await this.startEnhancedGuardian(results, options);
      }

      // 7. 重新启动IDE（如果需要）
      await this.startIDEsAfterCleanup(results, options);

      results.actions.push("✅ 标准清理完成 - 深度清理已完成，MCP配置已保护");
      return results;
    } catch (error) {
      results.errors.push(`标准清理失败: ${error.message}`);
      results.success = false;
      return results;
    }
  }

  // 完全清理模式：彻底重置，仅保护MCP配置
  async performCompleteModeCleanup(results, options = {}) {
    try {
      results.actions.push("💥 开始完全清理 - 彻底重置仅保护MCP配置");

      // 1. 使用通用保护机制保护所有MCP配置
      const mcpConfigs = await this.protectMCPConfigUniversal(results);

      // 2. 强制关闭所有IDE进程
      if (options.cleanCursor) {
        await this.forceCloseCursorIDE(results);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      // 3. 执行完全重置
      const completeOptions = {
        ...options,
        deepClean: true,
        aggressiveMode: true,
        multiRoundClean: true,
        extendedMonitoring: true,
        skipCursorLogin: false,
        resetCursorCompletely: true,
        resetVSCodeCompletely: true,
        skipBackup: true,
      };

      // 4. 清理所有数据
      await this.cleanActivationData(results, completeOptions);
      await this.cleanAugmentStorage(results);
      await this.cleanStateDatabase(results, completeOptions);

      if (this.platform === "win32") {
        await this.cleanWindowsRegistry(results);
      }

      await this.cleanTempFiles(results);
      await this.cleanBrowserData(results);

      if (completeOptions.cleanCursor) {
        await this.performCompleteCursorReset(results, completeOptions);
      }

      if (completeOptions.cleanVSCode) {
        const vscodeVariants = await this.detectInstalledVSCodeVariants();
        for (const variant of vscodeVariants) {
          await this.performCompleteVSCodeReset(
            results,
            variant,
            completeOptions
          );
        }
      }

      // 5. 恢复MCP配置
      await this.restoreMCPConfigUniversal(results, mcpConfigs);

      // 6. 启动增强防护（完全模式默认启用）
      if (options.enableEnhancedGuardian !== false) {
        await this.startEnhancedGuardian(results, options);
      }

      // 7. 重新启动IDE（如果需要）
      await this.startIDEsAfterCleanup(results, options);

      results.actions.push("✅ 完全清理完成 - IDE已彻底重置，MCP配置已恢复");
      return results;
    } catch (error) {
      results.errors.push(`完全清理失败: ${error.message}`);
      results.success = false;
      return results;
    }
  }

  // 清理设备身份数据（智能模式专用）
  async cleanDeviceIdentityOnly(results, options = {}) {
    try {
      results.actions.push("🧠 智能模式：精准更新设备身份，让扩展认为是新用户");

      // 1. 更新Cursor storage.json中的关键设备ID字段
      const cursorStorageJsonPath = path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "globalStorage",
        "storage.json"
      );

      await this.updateIDEDeviceIdentity(
        results,
        cursorStorageJsonPath,
        "Cursor"
      );

      // 2. 更新VS Code storage.json中的关键设备ID字段
      const vscodeStorageJsonPath = path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Code",
        "User",
        "globalStorage",
        "storage.json"
      );

      await this.updateIDEDeviceIdentity(
        results,
        vscodeStorageJsonPath,
        "VS Code"
      );
    } catch (error) {
      results.errors.push(`设备身份清理失败: ${error.message}`);
    }
  }

  // 更新IDE设备身份的通用方法
  async updateIDEDeviceIdentity(results, storageJsonPath, ideName) {
    try {
      if (await fs.pathExists(storageJsonPath)) {
        const storageData = await fs.readJson(storageJsonPath);

        // 精准更新设备身份字段，保留其他所有配置
        const deviceIdentityFields = [
          "telemetry.devDeviceId", // 最关键：扩展用户识别
          "telemetry.machineId", // 机器标识
          "telemetry.sqmId", // 遥测标识
          "storage.serviceMachineId", // 服务机器ID
        ];

        let updated = false;
        for (const field of deviceIdentityFields) {
          if (storageData[field]) {
            const oldValue = storageData[field];
            storageData[field] = crypto.randomUUID();
            updated = true;
            results.actions.push(`🔄 ${ideName} - 已更新设备ID: ${field}`);
          }
        }

        if (updated) {
          await fs.writeJson(storageJsonPath, storageData, { spaces: 2 });
          results.actions.push(
            `✅ ${ideName} - 设备身份已更新，扩展将识别为新用户`
          );
        } else {
          results.actions.push(`ℹ️ ${ideName} - 未发现需要更新的设备身份字段`);
        }
      } else {
        results.actions.push(
          `ℹ️ ${ideName} - 配置文件不存在，跳过设备身份更新`
        );
      }
    } catch (error) {
      results.actions.push(
        `⚠️ ${ideName} - 设备身份更新失败: ${error.message}`
      );
    }
  }

  // 清理Augment扩展的设备身份数据（智能模式专用）
  async cleanAugmentDeviceIdentity(results, options = {}) {
    try {
      results.actions.push("🧠 智能模式：清理扩展用户识别数据，保护配置和设置");

      // 1. 清理state.vscdb中的Augment用户识别记录
      await this.cleanAugmentSessionsFromDatabase(results, {
        skipCursorLogin: true, // 保留Cursor登录状态
        intelligentMode: true, // 智能模式标记
      });

      // 2. 清理Cursor Augment扩展存储中的用户身份文件
      const cursorAugmentStoragePath = path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "globalStorage",
        "augment.vscode-augment"
      );

      await this.cleanAugmentIdentityFiles(
        results,
        cursorAugmentStoragePath,
        "Cursor"
      );

      // 3. 清理VS Code Augment扩展存储中的用户身份文件
      const vscodeAugmentStoragePath = path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Code",
        "User",
        "globalStorage",
        "augment.vscode-augment"
      );

      await this.cleanAugmentIdentityFiles(
        results,
        vscodeAugmentStoragePath,
        "VS Code"
      );
    } catch (error) {
      results.errors.push(`清理Augment设备身份失败: ${error.message}`);
    }
  }

  // 清理Augment身份文件的通用方法
  async cleanAugmentIdentityFiles(results, augmentStoragePath, ideName) {
    try {
      if (await fs.pathExists(augmentStoragePath)) {
        // 智能模式：只清理明确的用户身份文件，保留配置
        const files = await fs.readdir(augmentStoragePath);
        const identityFiles = files.filter(
          (file) =>
            file.includes("user-") || // 用户相关
            file.includes("session-") || // 会话相关
            file.includes("auth-") || // 认证相关
            file.includes("device-") || // 设备相关
            file.includes("fingerprint") || // 指纹相关
            (file.includes("cache") && !file.includes("mcp")) // 缓存但不是MCP
        );

        let cleanedCount = 0;
        for (const file of identityFiles) {
          // 额外保护：跳过明确的配置文件
          if (
            file.includes("config") ||
            file.includes("settings") ||
            file.includes("mcp") ||
            file.includes("server")
          ) {
            continue;
          }

          const filePath = path.join(augmentStoragePath, file);
          await fs.remove(filePath);
          results.actions.push(`🗑️ ${ideName} - 已清理用户身份文件: ${file}`);
          cleanedCount++;
        }

        if (cleanedCount > 0) {
          results.actions.push(`✅ ${ideName} - Augment用户身份数据已清理`);
        } else {
          results.actions.push(`ℹ️ ${ideName} - 未发现需要清理的用户身份文件`);
        }
      } else {
        results.actions.push(`ℹ️ ${ideName} - Augment扩展目录不存在，跳过清理`);
      }
    } catch (error) {
      results.actions.push(
        `⚠️ ${ideName} - Augment身份文件清理失败: ${error.message}`
      );
    }
  }

  // 保护IDE核心设置文件（智能模式专用）
  async protectIDESettings(results) {
    const ideSettings = new Map();

    try {
      // 定义需要保护的IDE设置文件路径
      const settingsPaths = [
        // Cursor主要设置文件
        this.cursorPaths.settingsJson,
        // 快捷键配置
        path.join(
          path.dirname(this.cursorPaths.settingsJson),
          "keybindings.json"
        ),
        // 任务配置
        path.join(path.dirname(this.cursorPaths.settingsJson), "tasks.json"),
        // 启动配置
        path.join(path.dirname(this.cursorPaths.settingsJson), "launch.json"),
      ];

      // 保护代码片段目录
      const snippetsDir = path.join(
        path.dirname(this.cursorPaths.settingsJson),
        "snippets"
      );

      for (const settingsPath of settingsPaths) {
        try {
          if (await fs.pathExists(settingsPath)) {
            const content = await fs.readJson(settingsPath);
            ideSettings.set(settingsPath, content);
            results.actions.push(
              `🛡️ 已保护IDE设置: ${path.basename(settingsPath)}`
            );
          }
        } catch (error) {
          // 文件可能不是JSON格式，跳过
          results.actions.push(
            `⚠️ 跳过非JSON设置文件: ${path.basename(settingsPath)}`
          );
        }
      }

      // 保护代码片段目录
      if (await fs.pathExists(snippetsDir)) {
        try {
          const snippetsBackup = {};
          const snippetFiles = await fs.readdir(snippetsDir);

          for (const snippetFile of snippetFiles) {
            if (snippetFile.endsWith(".json")) {
              const snippetPath = path.join(snippetsDir, snippetFile);
              const snippetContent = await fs.readJson(snippetPath);
              snippetsBackup[snippetFile] = snippetContent;
            }
          }

          if (Object.keys(snippetsBackup).length > 0) {
            ideSettings.set(snippetsDir, snippetsBackup);
            results.actions.push(
              `🛡️ 已保护代码片段: ${Object.keys(snippetsBackup).length} 个文件`
            );
          }
        } catch (error) {
          results.actions.push(`⚠️ 保护代码片段失败: ${error.message}`);
        }
      }

      if (ideSettings.size > 0) {
        results.actions.push(
          `✅ IDE设置保护完成，共保护 ${ideSettings.size} 项配置`
        );
      } else {
        results.actions.push("ℹ️ 未发现需要保护的IDE设置文件");
      }
    } catch (error) {
      results.errors.push(`保护IDE设置失败: ${error.message}`);
    }

    return ideSettings;
  }

  // 恢复IDE核心设置文件（智能模式专用）
  async restoreIDESettings(results, ideSettings) {
    if (!ideSettings || ideSettings.size === 0) {
      return;
    }

    try {
      for (const [settingsPath, content] of ideSettings) {
        try {
          // 处理代码片段目录
          if (path.basename(settingsPath) === "snippets") {
            await fs.ensureDir(settingsPath);
            for (const [snippetFile, snippetContent] of Object.entries(
              content
            )) {
              const snippetPath = path.join(settingsPath, snippetFile);
              await fs.writeJson(snippetPath, snippetContent, { spaces: 2 });
            }
            results.actions.push(
              `🔄 已恢复代码片段: ${Object.keys(content).length} 个文件`
            );
          } else {
            // 处理普通设置文件
            await fs.ensureDir(path.dirname(settingsPath));
            await fs.writeJson(settingsPath, content, { spaces: 2 });
            results.actions.push(
              `🔄 已恢复IDE设置: ${path.basename(settingsPath)}`
            );
          }
        } catch (error) {
          results.actions.push(
            `⚠️ 恢复设置失败 ${path.basename(settingsPath)}: ${error.message}`
          );
        }
      }

      results.actions.push("✅ IDE设置恢复完成");
    } catch (error) {
      results.errors.push(`恢复IDE设置失败: ${error.message}`);
    }
  }

  // 保护工作区配置（智能模式专用）
  async protectWorkspaceSettings(results) {
    const workspaceSettings = new Map();

    try {
      // 获取跨平台的工作区存储目录
      let workspaceStorageDir;
      if (this.platform === "win32") {
        workspaceStorageDir = path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "workspaceStorage"
        );
      } else if (this.platform === "darwin") {
        workspaceStorageDir = path.join(
          os.homedir(),
          "Library",
          "Application Support",
          "Cursor",
          "User",
          "workspaceStorage"
        );
      } else {
        workspaceStorageDir = path.join(
          os.homedir(),
          ".config",
          "Cursor",
          "User",
          "workspaceStorage"
        );
      }

      if (await fs.pathExists(workspaceStorageDir)) {
        // 只保护重要的工作区配置，不保护临时数据
        const workspaceDirs = await fs.readdir(workspaceStorageDir);

        for (const workspaceDir of workspaceDirs) {
          const workspacePath = path.join(workspaceStorageDir, workspaceDir);
          const stat = await fs.stat(workspacePath);

          if (stat.isDirectory()) {
            // 检查是否包含重要配置文件
            const configFiles = [
              "workspace.json",
              "settings.json",
              "tasks.json",
            ];
            const workspaceConfig = {};
            let hasImportantConfig = false;

            for (const configFile of configFiles) {
              const configPath = path.join(workspacePath, configFile);
              if (await fs.pathExists(configPath)) {
                try {
                  const configContent = await fs.readJson(configPath);
                  workspaceConfig[configFile] = configContent;
                  hasImportantConfig = true;
                } catch (error) {
                  // 跳过损坏的配置文件
                }
              }
            }

            if (hasImportantConfig) {
              workspaceSettings.set(workspacePath, workspaceConfig);
            }
          }
        }

        if (workspaceSettings.size > 0) {
          results.actions.push(
            `🛡️ 已保护工作区配置: ${workspaceSettings.size} 个工作区`
          );
        } else {
          results.actions.push("ℹ️ 未发现需要保护的工作区配置");
        }
      } else {
        results.actions.push("ℹ️ 工作区存储目录不存在");
      }
    } catch (error) {
      results.errors.push(`保护工作区配置失败: ${error.message}`);
    }

    return workspaceSettings;
  }

  // 恢复工作区配置（智能模式专用）
  async restoreWorkspaceSettings(results, workspaceSettings) {
    if (!workspaceSettings || workspaceSettings.size === 0) {
      return;
    }

    try {
      for (const [workspacePath, configFiles] of workspaceSettings) {
        try {
          await fs.ensureDir(workspacePath);

          for (const [configFile, configContent] of Object.entries(
            configFiles
          )) {
            const configPath = path.join(workspacePath, configFile);
            await fs.writeJson(configPath, configContent, { spaces: 2 });
          }

          const workspaceName = path.basename(workspacePath);
          results.actions.push(`🔄 已恢复工作区配置: ${workspaceName}`);
        } catch (error) {
          results.actions.push(
            `⚠️ 恢复工作区失败 ${path.basename(workspacePath)}: ${
              error.message
            }`
          );
        }
      }

      results.actions.push("✅ 工作区配置恢复完成");
    } catch (error) {
      results.errors.push(`恢复工作区配置失败: ${error.message}`);
    }
  }

  // ==================== VS Code 支持功能 ====================

  // 检测已安装的VS Code变体
  async detectInstalledVSCodeVariants() {
    const vscodeVariants = [];
    const paths = this.getVSCodePaths();

    for (const [name, config] of Object.entries(paths.variants)) {
      if (await fs.pathExists(config.globalStorage)) {
        vscodeVariants.push({ name, ...config });
      }
    }

    return vscodeVariants;
  }

  // VS Code专用清理函数
  async performVSCodeCleanup(results, options = {}) {
    try {
      results.actions.push("🔵 开始VS Code清理流程...");

      // 1. 检测已安装的VS Code变体
      const installedVariants = await this.detectInstalledVSCodeVariants();

      if (installedVariants.length === 0) {
        results.actions.push("ℹ️ 未检测到已安装的VS Code，跳过清理");
        return;
      }

      results.actions.push(
        `🔍 检测到 ${installedVariants.length} 个VS Code变体`
      );

      for (const variant of installedVariants) {
        results.actions.push(`🔧 处理VS Code ${variant.name}...`);

        if (options.resetVSCodeCompletely) {
          await this.performCompleteVSCodeReset(results, variant, options);
        } else {
          await this.performSelectiveVSCodeCleanup(results, variant, options);
        }
      }

      results.actions.push("✅ VS Code清理流程完成");
    } catch (error) {
      results.errors.push(`VS Code清理失败: ${error.message}`);
    }
  }

  // 保护VS Code MCP配置
  async protectVSCodeMCPConfig(results, variant) {
    try {
      if (!(await fs.pathExists(variant.settingsJson))) {
        return null;
      }

      const settingsContent = await fs.readJson(variant.settingsJson);

      // 提取MCP配置
      const mcpConfig = {};
      if (settingsContent.mcpServers) {
        mcpConfig.mcpServers = settingsContent.mcpServers;
        results.actions.push(`🛡️ 已保护VS Code ${variant.name} MCP配置`);
      }

      return mcpConfig;
    } catch (error) {
      results.actions.push(`⚠️ 保护MCP配置时出错: ${error.message}`);
      return null;
    }
  }

  // 恢复VS Code MCP配置
  async restoreVSCodeMCPConfig(results, variant, mcpConfig) {
    try {
      if (!mcpConfig || !mcpConfig.mcpServers) {
        return;
      }

      // 确保settings.json存在
      await fs.ensureFile(variant.settingsJson);

      let settingsContent = {};
      if (await fs.pathExists(variant.settingsJson)) {
        try {
          settingsContent = await fs.readJson(variant.settingsJson);
        } catch (error) {
          // 如果文件损坏，创建新的
          settingsContent = {};
        }
      }

      // 恢复MCP配置（合并而不是覆盖）
      if (!settingsContent.mcpServers) {
        settingsContent.mcpServers = {};
      }
      Object.assign(settingsContent.mcpServers, mcpConfig.mcpServers);

      await fs.writeJson(variant.settingsJson, settingsContent, { spaces: 2 });
      results.actions.push(`🔄 已恢复VS Code ${variant.name} MCP配置`);
    } catch (error) {
      results.actions.push(`⚠️ 恢复MCP配置时出错: ${error.message}`);
    }
  }

  // 执行VS Code智能清理（仅更新设备身份，保护所有配置）
  async performVSCodeIntelligentCleanup(results, variant, options = {}) {
    try {
      results.actions.push(`🧠 VS Code ${variant.name} - 智能清理设备身份`);

      // 1. 使用通用保护机制保护所有MCP配置
      const mcpConfigs = await this.protectMCPConfigUniversal(results);

      // 2. 保护VS Code settings.json中的MCP配置（兼容旧版本）
      const settingsMcpConfig = await this.protectVSCodeMCPConfig(
        results,
        variant
      );

      // 3. 智能清理：仅更新VS Code的设备身份，类似Cursor的处理
      if (
        variant.globalStorage &&
        (await fs.pathExists(variant.globalStorage))
      ) {
        const storageJsonPath = path.join(
          variant.globalStorage,
          "storage.json"
        );
        if (await fs.pathExists(storageJsonPath)) {
          const storageData = await fs.readJson(storageJsonPath);

          // 精准更新设备身份字段，保留其他所有配置
          const deviceIdentityFields = [
            "telemetry.devDeviceId", // 最关键：扩展用户识别
            "telemetry.machineId", // 机器标识
            "telemetry.sqmId", // 遥测标识
            "storage.serviceMachineId", // 服务机器ID
          ];

          let updated = false;
          for (const field of deviceIdentityFields) {
            if (storageData[field]) {
              storageData[field] = crypto.randomUUID();
              updated = true;
              results.actions.push(
                `🔄 VS Code ${variant.name} - 已更新设备ID: ${field}`
              );
            }
          }

          if (updated) {
            await fs.writeJson(storageJsonPath, storageData, { spaces: 2 });
            results.actions.push(
              `✅ VS Code ${variant.name} - 设备身份已更新，扩展将识别为新用户`
            );
          } else {
            results.actions.push(
              `ℹ️ VS Code ${variant.name} - 未发现需要更新的设备身份字段`
            );
          }
        }
      }

      // 4. 恢复所有MCP配置
      await this.restoreMCPConfigUniversal(results, mcpConfigs);
      await this.restoreVSCodeMCPConfig(results, variant, settingsMcpConfig);

      results.actions.push(
        `✅ VS Code ${variant.name} - 智能清理完成，所有配置已保护`
      );
    } catch (error) {
      results.errors.push(
        `VS Code ${variant.name} 智能清理失败: ${error.message}`
      );
    }
  }

  // 执行VS Code选择性清理（保留登录状态和MCP配置）
  async performSelectiveVSCodeCleanup(results, variant, options = {}) {
    try {
      // 1. 使用通用保护机制保护所有MCP配置
      const mcpConfigs = await this.protectMCPConfigUniversal(results);

      // 2. 保护VS Code settings.json中的MCP配置（兼容旧版本）
      const settingsMcpConfig = await this.protectVSCodeMCPConfig(
        results,
        variant
      );

      // 3. 清理Augment扩展存储
      if (await fs.pathExists(variant.augmentStorage)) {
        if (!options.skipBackup) {
          const backupDir = path.join(
            os.tmpdir(),
            `vscode-${variant.name}-backup-${Date.now()}`
          );
          await fs.ensureDir(backupDir);
          const backupPath = path.join(backupDir, "augment.vscode-augment");
          await fs.copy(variant.augmentStorage, backupPath);
          results.actions.push(`📁 备份至: ${backupPath}`);
        }

        await fs.remove(variant.augmentStorage);
        results.actions.push(
          `🗑️ 已清理VS Code ${variant.name} Augment扩展存储`
        );
      }

      // 4. 清理数据库中的Augment数据（保留其他数据）
      await this.cleanVSCodeAugmentData(results, variant, true);

      // 5. 更新设备ID
      await this.updateVSCodeDeviceId(results, variant);

      // 6. 恢复所有MCP配置
      await this.restoreMCPConfigUniversal(results, mcpConfigs);

      // 7. 恢复settings.json中的MCP配置（兼容旧版本）
      if (settingsMcpConfig) {
        await this.restoreVSCodeMCPConfig(results, variant, settingsMcpConfig);
      }

      results.actions.push(`✅ VS Code ${variant.name} 选择性清理完成`);
    } catch (error) {
      results.errors.push(
        `VS Code ${variant.name} 选择性清理失败: ${error.message}`
      );
    }
  }

  // 执行VS Code完全重置（保护MCP配置）
  async performCompleteVSCodeReset(results, variant, options = {}) {
    try {
      // 1. 使用通用保护机制保护所有MCP配置
      const mcpConfigs = await this.protectMCPConfigUniversal(results);

      // 2. 保护VS Code settings.json中的MCP配置（兼容旧版本）
      const settingsMcpConfig = await this.protectVSCodeMCPConfig(
        results,
        variant
      );

      // 3. 备份所有数据（可选）
      let backupDir = null;
      if (!options.skipBackup) {
        backupDir = path.join(
          os.tmpdir(),
          `vscode-${variant.name}-complete-backup-${Date.now()}`
        );
        await fs.ensureDir(backupDir);
      }

      // 4. 清理所有VS Code数据
      const pathsToClean = [
        variant.globalStorage,
        variant.workspaceStorage,
        variant.extensions,
      ];

      for (const pathToClean of pathsToClean) {
        if (await fs.pathExists(pathToClean)) {
          const pathName = path.basename(pathToClean);
          if (!options.skipBackup && backupDir) {
            const backupPath = path.join(backupDir, pathName);
            await fs.copy(pathToClean, backupPath);
          }
          await fs.remove(pathToClean);
          results.actions.push(`🗑️ 已清理VS Code ${variant.name} ${pathName}`);
        }
      }

      // 5. 生成全新的VS Code身份
      await this.generateFreshVSCodeIdentity(results, variant);

      // 6. 恢复所有MCP配置
      await this.restoreMCPConfigUniversal(results, mcpConfigs);

      // 7. 恢复settings.json中的MCP配置（兼容旧版本）
      if (settingsMcpConfig) {
        await this.restoreVSCodeMCPConfig(results, variant, settingsMcpConfig);
      }

      results.actions.push(`🔄 VS Code ${variant.name} 完全重置完成`);
      if (backupDir) {
        results.actions.push(`📁 完整备份至: ${backupDir}`);
      }
    } catch (error) {
      results.errors.push(
        `VS Code ${variant.name} 完全重置失败: ${error.message}`
      );
    }
  }

  // 清理VS Code数据库中的Augment数据
  async cleanVSCodeAugmentData(results, variant, preserveLogin = false) {
    try {
      if (!(await fs.pathExists(variant.stateDb))) {
        return;
      }

      const initSqlJs = require("sql.js");
      const SQL = await initSqlJs();
      const data = await fs.readFile(variant.stateDb);
      const db = new SQL.Database(data);

      const deleteQueries = preserveLogin
        ? [
            // 仅清理Augment相关数据
            "DELETE FROM ItemTable WHERE key LIKE '%augment%'",
            "DELETE FROM ItemTable WHERE key LIKE '%Augment%'",
          ]
        : [
            // 完整清理
            "DELETE FROM ItemTable WHERE key LIKE '%augment%'",
            "DELETE FROM ItemTable WHERE key LIKE '%Augment%'",
            "DELETE FROM ItemTable WHERE key LIKE '%auth%'",
            "DELETE FROM ItemTable WHERE key LIKE '%token%'",
            "DELETE FROM ItemTable WHERE key LIKE '%login%'",
            "DELETE FROM ItemTable WHERE key LIKE '%user%'",
          ];

      let deletedCount = 0;
      for (const query of deleteQueries) {
        try {
          const result = db.run(query);
          if (result.changes > 0) {
            deletedCount += result.changes;
          }
        } catch (error) {
          // 忽略单个查询失败
        }
      }

      if (deletedCount > 0) {
        const newData = db.export();
        await fs.writeFile(variant.stateDb, newData);
        results.actions.push(
          `🗑️ VS Code ${variant.name} 数据库清理: ${deletedCount} 条记录`
        );
      }

      db.close();
    } catch (error) {
      results.actions.push(
        `⚠️ VS Code ${variant.name} 数据库清理跳过: ${error.message}`
      );
    }
  }

  // 更新VS Code设备ID
  async updateVSCodeDeviceId(results, variant) {
    try {
      const { generateVSCodeDeviceId } = require(getSharedPath(
        "utils/stable-device-id"
      ));
      const newVSCodeDeviceId = await generateVSCodeDeviceId();
      const currentTime = new Date().toUTCString();

      const newStorageData = {
        "telemetry.machineId": newVSCodeDeviceId,
        "telemetry.macMachineId": newVSCodeDeviceId.substring(0, 64),
        "telemetry.devDeviceId": `${newVSCodeDeviceId.substring(
          0,
          8
        )}-${newVSCodeDeviceId.substring(8, 12)}-${newVSCodeDeviceId.substring(
          12,
          16
        )}-${newVSCodeDeviceId.substring(16, 20)}-${newVSCodeDeviceId.substring(
          20,
          32
        )}`,
        "telemetry.sqmId": `{${newVSCodeDeviceId
          .substring(0, 8)
          .toUpperCase()}-${newVSCodeDeviceId
          .substring(8, 12)
          .toUpperCase()}-${newVSCodeDeviceId
          .substring(12, 16)
          .toUpperCase()}-${newVSCodeDeviceId
          .substring(16, 20)
          .toUpperCase()}-${newVSCodeDeviceId
          .substring(20, 32)
          .toUpperCase()}}`,
        "telemetry.firstSessionDate": currentTime,
        "telemetry.currentSessionDate": currentTime,
      };

      await fs.ensureDir(path.dirname(variant.storageJson));
      await fs.writeJson(variant.storageJson, newStorageData, { spaces: 2 });

      results.actions.push(
        `🆔 VS Code ${variant.name} 新设备ID: ${newVSCodeDeviceId.substring(
          0,
          16
        )}...`
      );
    } catch (error) {
      results.errors.push(
        `VS Code ${variant.name} 设备ID生成失败: ${error.message}`
      );
    }
  }

  // 生成全新的VS Code身份
  async generateFreshVSCodeIdentity(results, variant) {
    try {
      const { generateVSCodeDeviceId } = require(getSharedPath(
        "utils/stable-device-id"
      ));
      const newVSCodeDeviceId = await generateVSCodeDeviceId();
      const currentTime = new Date().toUTCString();

      const freshStorageData = {
        "telemetry.machineId": newVSCodeDeviceId,
        "telemetry.macMachineId": newVSCodeDeviceId.substring(0, 64),
        "telemetry.devDeviceId": `${newVSCodeDeviceId.substring(
          0,
          8
        )}-${newVSCodeDeviceId.substring(8, 12)}-${newVSCodeDeviceId.substring(
          12,
          16
        )}-${newVSCodeDeviceId.substring(16, 20)}-${newVSCodeDeviceId.substring(
          20,
          32
        )}`,
        "telemetry.sqmId": `{${newVSCodeDeviceId
          .substring(0, 8)
          .toUpperCase()}-${newVSCodeDeviceId
          .substring(8, 12)
          .toUpperCase()}-${newVSCodeDeviceId
          .substring(12, 16)
          .toUpperCase()}-${newVSCodeDeviceId
          .substring(16, 20)
          .toUpperCase()}-${newVSCodeDeviceId
          .substring(20, 32)
          .toUpperCase()}}`,
        "telemetry.firstSessionDate": currentTime,
        "telemetry.currentSessionDate": currentTime,
        "telemetry.lastSessionDate": currentTime,
        "telemetry.installTime": Date.now(),
        "telemetry.sessionCount": 1,
      };

      await fs.ensureDir(path.dirname(variant.storageJson));
      await fs.writeJson(variant.storageJson, freshStorageData, { spaces: 2 });

      results.actions.push(
        `🆔 VS Code ${variant.name} 全新身份: ${newVSCodeDeviceId.substring(
          0,
          16
        )}...`
      );
      results.actions.push(`🔄 VS Code ${variant.name} 将被识别为全新安装`);
    } catch (error) {
      results.errors.push(
        `VS Code ${variant.name} 全新身份生成失败: ${error.message}`
      );
    }
  }

  // PowerShell辅助清理功能
  async performPowerShellAssistedCleanup(options = {}) {
    const results = {
      success: true,
      actions: [],
      errors: [],
      options: options,
      powerShellAssisted: true,
    };

    try {
      results.actions.push("🚀 启用PowerShell辅助清理模式");

      // 1. 使用通用保护机制保护所有MCP配置
      const mcpConfigs = await this.protectMCPConfigUniversal(results);

      // 2. 准备PowerShell脚本参数
      const psConfig = await this.preparePowerShellConfig(options);

      // 3. 执行PowerShell脚本
      const psResults = await this.executePowerShellScript(psConfig);

      // 4. 解析PowerShell执行结果
      results.actions.push(...psResults.actions);
      results.errors.push(...psResults.errors);

      // 5. 执行Node.js补充清理（PowerShell无法处理的部分）
      await this.performSupplementaryCleanup(results, options);

      // 6. 恢复所有MCP配置
      await this.restoreMCPConfigUniversal(results, mcpConfigs);

      results.actions.push("✅ PowerShell辅助清理完成 - MCP配置已保护");
    } catch (error) {
      results.success = false;
      results.errors.push(`PowerShell辅助清理失败: ${error.message}`);

      // 降级到标准清理模式
      results.actions.push("⚠️ 降级到标准清理模式");
      return await this.performStandardCleanup(options);
    }

    return results;
  }

  // 准备PowerShell脚本配置
  async preparePowerShellConfig(options) {
    const config = {
      mode: options.isDryRun ? "preview" : "execute",
      ide: options.cleanCursor
        ? "Cursor"
        : options.cleanVSCode
        ? "VSCode"
        : "Cursor",
      extensions: [],
      preserveLogin: options.skipCursorLogin || options.preserveActivation,
      deepClean: options.aggressiveMode || options.multiRoundClean,
      autoRestart: options.autoRestartCursor || false,
    };

    // 确定要清理的扩展
    if (options.cleanCursorExtension || options.cleanAugment) {
      config.extensions.push("Augment");
    }

    // 添加其他扩展支持
    if (options.cleanCopilot) {
      config.extensions.push("Copilot");
    }

    if (options.cleanCodeium) {
      config.extensions.push("Codeium");
    }

    return config;
  }

  // 执行PowerShell辅助清理（内置实现）
  async executePowerShellScript(config) {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    const results = {
      actions: [],
      errors: [],
    };

    try {
      results.actions.push("🚀 启动PowerShell辅助清理（内置实现）");

      // 1. 生成新的设备标识符
      const crypto = require("crypto");
      const newIdentifiers = {
        devDeviceId: crypto.randomUUID(),
        machineId: crypto.randomUUID(),
        macMachineId: crypto.randomUUID(),
        sessionId: crypto.randomUUID(),
        sqmId: `{${crypto.randomUUID().toUpperCase()}}`,
      };

      results.actions.push(
        `🆔 生成新设备标识符: ${newIdentifiers.devDeviceId.substring(0, 16)}...`
      );

      // 2. 关闭IDE进程（如果需要）
      if (config.ide === "Cursor") {
        try {
          if (this.platform === "win32") {
            await execAsync('taskkill /f /im "Cursor.exe" 2>nul', {
              timeout: 10000,
            });
            results.actions.push("🔄 已关闭Cursor进程");
          }
        } catch (error) {
          // 忽略进程不存在的错误
          results.actions.push("ℹ️ Cursor进程未运行或已关闭");
        }
      }

      // 3. 更新IDE配置文件（保留登录状态）
      const storageJsonPath = path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        config.ide === "Cursor" ? "Cursor" : "Code",
        "User",
        "globalStorage",
        "storage.json"
      );

      if (config.mode !== "preview") {
        await fs.ensureDir(path.dirname(storageJsonPath));

        // 读取现有配置（保留登录数据）
        let existingConfig = {};
        if (await fs.pathExists(storageJsonPath)) {
          try {
            const content = await fs.readFile(storageJsonPath, "utf8");
            existingConfig = JSON.parse(content);
            results.actions.push("📖 已读取现有配置，保留登录状态");
          } catch (error) {
            results.actions.push("⚠️ 无法读取现有配置，创建新配置");
          }
        }

        // 只更新设备相关标识符，保留其他数据
        const updatedConfig = {
          ...existingConfig, // 保留所有现有数据（包括登录状态）
          "telemetry.devDeviceId": newIdentifiers.devDeviceId,
          "telemetry.machineId": newIdentifiers.machineId,
          "telemetry.macMachineId": newIdentifiers.macMachineId,
          "telemetry.sessionId": newIdentifiers.sessionId,
          "telemetry.sqmId": newIdentifiers.sqmId,
          "telemetry.firstSessionDate": new Date().toUTCString(),
          "telemetry.currentSessionDate": new Date().toUTCString(),
        };

        await fs.writeFile(
          storageJsonPath,
          JSON.stringify(updatedConfig, null, 2),
          "utf8"
        );
        results.actions.push(
          `✅ 已更新设备标识符到 ${path.basename(storageJsonPath)}`
        );
      } else {
        results.actions.push(
          `🔍 [预览] 将更新设备标识符到 ${path.basename(storageJsonPath)}`
        );
      }

      // 4. 清理Augment扩展数据（但保留IDE登录）
      if (config.extensions && config.extensions.includes("Augment")) {
        const augmentPaths = [
          path.join(
            os.homedir(),
            "AppData",
            "Roaming",
            config.ide === "Cursor" ? "Cursor" : "Code",
            "User",
            "globalStorage",
            "augmentcode.augment"
          ),
          path.join(
            os.homedir(),
            "AppData",
            "Roaming",
            config.ide === "Cursor" ? "Cursor" : "Code",
            "User",
            "workspaceStorage"
          ),
        ];

        for (const augmentPath of augmentPaths) {
          if (config.mode !== "preview") {
            if (await fs.pathExists(augmentPath)) {
              try {
                if (augmentPath.includes("workspaceStorage")) {
                  // 只清理Augment相关的工作区存储
                  const items = await fs.readdir(augmentPath);
                  for (const item of items) {
                    if (item.toLowerCase().includes("augment")) {
                      await fs.remove(path.join(augmentPath, item));
                      results.actions.push(
                        `🗑️ 已清理Augment工作区数据: ${item}`
                      );
                    }
                  }
                } else {
                  // 完全清理Augment扩展数据
                  await fs.remove(augmentPath);
                  results.actions.push(
                    `🗑️ 已清理Augment扩展数据: ${path.basename(augmentPath)}`
                  );
                }
              } catch (error) {
                results.errors.push(
                  `清理Augment数据失败 ${path.basename(augmentPath)}: ${
                    error.message
                  }`
                );
              }
            }
          } else {
            results.actions.push(
              `🔍 [预览] 将清理Augment数据: ${path.basename(augmentPath)}`
            );
          }
        }
      }

      // 5. 更新系统注册表MachineGuid（需要管理员权限）
      if (this.platform === "win32" && config.deepClean) {
        try {
          if (config.mode !== "preview") {
            await execAsync(
              `reg add "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid /t REG_SZ /d "${newIdentifiers.macMachineId}" /f`,
              { timeout: 10000 }
            );
            results.actions.push("🔧 已更新系统注册表MachineGuid");
          } else {
            results.actions.push("🔍 [预览] 将更新系统注册表MachineGuid");
          }
        } catch (error) {
          results.errors.push(
            `注册表更新失败（可能需要管理员权限）: ${error.message}`
          );
        }
      }

      results.actions.push("✅ PowerShell辅助清理完成");
      results.actions.push(
        `🎯 新设备ID: ${newIdentifiers.devDeviceId.substring(0, 16)}...`
      );
      results.actions.push("🔒 IDE登录状态已保留");

      return results;
    } catch (error) {
      results.errors.push(`PowerShell辅助清理失败: ${error.message}`);
      return results;
    }
  }

  // 执行补充清理（PowerShell无法处理的部分）
  async performSupplementaryCleanup(results, options) {
    try {
      results.actions.push("🔧 执行Node.js补充清理...");

      // 1. 清理激活数据（如果需要保留激活状态）
      if (options.preserveActivation) {
        await this.cleanActivationData(results, options);
      }

      // 2. 重新生成设备指纹
      await this.regenerateDeviceFingerprint(results, options);

      // 3. 清理浏览器相关数据
      await this.cleanBrowserData(results);

      // 4. 清理系统临时文件
      await this.cleanTempFiles(results);

      results.actions.push("✅ Node.js补充清理完成");
    } catch (error) {
      results.errors.push(`补充清理失败: ${error.message}`);
    }
  }

  // 标准清理模式（降级方案）
  async performStandardCleanup(options) {
    // 调用原有的清理逻辑
    const results = {
      success: true,
      actions: [],
      errors: [],
      options: options,
      fallbackMode: true,
    };

    results.actions.push("🔄 使用标准清理模式");

    // 1. 使用通用保护机制保护所有MCP配置
    const mcpConfigs = await this.protectMCPConfigUniversal(results);

    // 2. 执行原有的清理流程
    await this.cleanActivationData(results, options);
    await this.cleanAugmentStorage(results);
    await this.cleanStateDatabase(results, options);

    if (this.platform === "win32") {
      await this.cleanWindowsRegistry(results);
    }

    await this.cleanTempFiles(results);
    await this.cleanBrowserData(results);

    if (options.cleanCursor && options.cleanCursorExtension) {
      await this.cleanCursorExtensionData(results, options);
    }

    if (options.cleanVSCode) {
      await this.performVSCodeCleanup(results, options);
    }

    await this.regenerateDeviceFingerprint(results, options);

    // 3. 恢复所有MCP配置
    await this.restoreMCPConfigUniversal(results, mcpConfigs);

    results.actions.push("✅ 标准清理完成 - MCP配置已保护");

    return results;
  }
  // 智能管理员权限清理（新增功能）
  async performSmartAdminCleanup(options = {}) {
    try {
      const results = {
        success: true,
        actions: [],
        errors: [],
        adminOperations: [],
        standardOperations: [],
        options: options,
      };

      results.actions.push("🚀 启动智能管理员权限清理模式");

      // 1. 使用通用保护机制保护所有MCP配置
      const mcpConfigs = await this.protectMCPConfigUniversal(results);

      // 2. 使用AdminHelper进行智能清理
      const adminResults = await this.adminHelper.performSmartCleanup({
        requestAdmin: options.requestAdmin !== false,
        updateRegistry: options.updateRegistry !== false,
        ...options,
      });

      // 2. 合并AdminHelper的结果
      results.actions.push(...adminResults.actions);
      results.errors.push(...adminResults.errors);
      results.adminOperations = adminResults.adminOperations;
      results.standardOperations = adminResults.standardOperations;

      // 3. 执行标准的设备管理器清理
      results.actions.push("🔄 执行标准设备清理操作...");

      // 执行标准清理流程（不包括管理员权限部分）
      const standardOptions = {
        ...options,
        skipRegistryClean: true, // 跳过注册表清理，已由AdminHelper处理
        usePowerShellAssist: false, // 避免重复
        useSmartAdminCleanup: false, // 避免递归
      };

      // 调用标准清理流程
      await this.cleanActivationData(results, standardOptions);
      await this.cleanAugmentStorage(results);
      await this.cleanStateDatabase(results, standardOptions);
      await this.cleanTempFiles(results);
      await this.cleanBrowserData(results);

      if (standardOptions.cleanCursor && standardOptions.cleanCursorExtension) {
        await this.cleanCursorExtensionData(results, standardOptions);
      }

      if (standardOptions.cleanVSCode) {
        await this.performVSCodeCleanup(results, standardOptions);
      }

      await this.regenerateDeviceFingerprint(results, standardOptions);

      // 4. 执行深度清理验证
      if (standardOptions.cleanCursorExtension) {
        await this.performDeepCleanupVerification(results, standardOptions);

        if (standardOptions.aggressiveMode || standardOptions.multiRoundClean) {
          await this.performMultiRoundCleanup(results, standardOptions);
        }
      }

      // 5. 恢复所有MCP配置
      await this.restoreMCPConfigUniversal(results, mcpConfigs);

      results.actions.push("✅ 智能管理员权限清理完成 - MCP配置已保护");

      // 6. 生成清理报告
      const summary = this.generateCleanupSummary(results);
      results.actions.push(`📊 清理总结: ${summary}`);

      return results;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        actions: [`❌ 智能管理员权限清理失败: ${error.message}`],
        errors: [error.message],
      };
    }
  }

  // 生成清理总结
  generateCleanupSummary(results) {
    const adminOps = results.adminOperations?.length || 0;
    const standardOps = results.standardOperations?.length || 0;
    const totalActions = results.actions?.length || 0;
    const errors = results.errors?.length || 0;

    return `管理员操作${adminOps}个, 标准操作${standardOps}个, 总操作${totalActions}个, 错误${errors}个`;
  }

  // 检查管理员权限需求
  async checkAdminRequirements() {
    try {
      const requirements = await this.adminHelper.checkDeepCleanRequirements();
      return {
        success: true,
        data: requirements,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // 启动设备ID守护者（已禁用，改用一次性文件保护）
  /*
  async startDeviceIdGuardian(results, options = {}) {
    try {
      // 生成新的设备ID
      const crypto = require("crypto");
      const newDeviceId = crypto.randomUUID();

      // 启动守护者
      await this.deviceIdGuardian.startGuarding(newDeviceId);

      results.actions.push(`🛡️ 设备ID守护者已启动`);
      results.actions.push(`🆔 新设备ID: ${newDeviceId}`);
      results.actions.push(`🔒 已设置storage.json只读保护`);

      // 设置定时器，在60秒后停止守护（避免长期占用资源）
      setTimeout(async () => {
        try {
          await this.deviceIdGuardian.stopGuarding();
          console.log("🛑 设备ID守护者已自动停止");
        } catch (error) {
          console.error("停止守护者失败:", error);
        }
      }, 60000);
    } catch (error) {
      results.errors.push(`启动设备ID守护者失败: ${error.message}`);
    }
  }
  */

  // 一次性禁用storage.json文件（替代持续监控）
  async disableStorageJson(results, options = {}) {
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

      // 检查文件是否存在
      if (!(await fs.pathExists(storageJsonPath))) {
        results.actions.push("⚠️ storage.json文件不存在，跳过禁用操作");
        return;
      }

      // 注意：已禁用文件级被动保护，改用实时监控主动保护
      results.actions.push("🛡️ 使用实时监控保护模式，跳过文件级只读保护");
      results.actions.push(
        "📡 实时监控可精确拦截IDE修改并立即恢复，避免权限冲突"
      );

      // 原只读保护代码已注释，避免权限冲突：
      // - attrib +R (只读属性)
      // - chmod 0o444 (只读权限)
      // 这些会导致程序自身无法写入storage.json

      results.actions.push("💡 提示: 实时监控保护更智能，无需手动管理文件权限");
    } catch (error) {
      results.errors.push(`禁用storage.json失败: ${error.message}`);
    }
  }

  // 恢复storage.json文件的修改权限
  async enableStorageJson(results) {
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

      // 检查文件是否存在
      if (!(await fs.pathExists(storageJsonPath))) {
        results.actions.push("⚠️ storage.json文件不存在");
        return;
      }

      // 移除只读属性
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);

      try {
        // Windows: 移除只读属性
        await execAsync(`attrib -R "${storageJsonPath}"`);
        results.actions.push("🔓 已恢复storage.json的修改权限");

        // 验证设置是否成功
        const { stdout } = await execAsync(`attrib "${storageJsonPath}"`);
        if (!stdout.includes("R")) {
          results.actions.push("✅ 修改权限恢复成功");
        }
      } catch (error) {
        results.errors.push(`恢复修改权限失败: ${error.message}`);

        // 备用方案：尝试修改文件权限
        try {
          await fs.chmod(storageJsonPath, 0o644); // 可读写权限
          results.actions.push("🔓 已通过chmod恢复storage.json修改权限");
        } catch (chmodError) {
          results.errors.push(`备用权限恢复也失败: ${chmodError.message}`);
        }
      }
    } catch (error) {
      results.errors.push(`恢复storage.json权限失败: ${error.message}`);
    }
  }

  // 清理cursorDiskKV表中的用户会话数据
  async cleanCursorDiskKVTable(db, results) {
    try {
      // 查看清理前的记录数量
      const beforeCount = db.exec("SELECT COUNT(*) as count FROM cursorDiskKV");
      const totalBefore =
        beforeCount.length > 0 ? beforeCount[0].values[0][0] : 0;

      const bubbleCount = db.exec(
        'SELECT COUNT(*) as count FROM cursorDiskKV WHERE key LIKE "bubbleId:%"'
      );
      const bubbleBefore =
        bubbleCount.length > 0 ? bubbleCount[0].values[0][0] : 0;

      if (bubbleBefore > 0) {
        // 清理用户相关记录
        const cleanupQueries = [
          'DELETE FROM cursorDiskKV WHERE key LIKE "bubbleId:%"',
          'DELETE FROM cursorDiskKV WHERE key LIKE "checkpointId:%"',
          'DELETE FROM cursorDiskKV WHERE key LIKE "messageRequest%"',
          'DELETE FROM cursorDiskKV WHERE key LIKE "%composer%"',
          'DELETE FROM cursorDiskKV WHERE key LIKE "%session%"',
          'DELETE FROM cursorDiskKV WHERE key LIKE "%auth%"',
          'DELETE FROM cursorDiskKV WHERE key LIKE "%user%"',
          'DELETE FROM cursorDiskKV WHERE key LIKE "%augment%"',
        ];

        for (const query of cleanupQueries) {
          try {
            db.exec(query);
          } catch (error) {
            // 忽略单个查询失败
          }
        }

        // 查看清理后的记录数量
        const afterCount = db.exec(
          "SELECT COUNT(*) as count FROM cursorDiskKV"
        );
        const totalAfter =
          afterCount.length > 0 ? afterCount[0].values[0][0] : 0;

        const deletedCount = totalBefore - totalAfter;
        results.actions.push(
          `🧹 已清理cursorDiskKV表: ${deletedCount} 条用户会话记录`
        );
        results.actions.push(`📊 bubbleId记录: ${bubbleBefore} → 0`);
      } else {
        results.actions.push("✅ cursorDiskKV表中无需清理的用户数据");
      }
    } catch (error) {
      results.errors.push(`清理cursorDiskKV表失败: ${error.message}`);
    }
  }

  // 启动增强设备ID守护进程
  async startEnhancedGuardian(results, options = {}) {
    try {
      // 生成新的设备ID作为目标ID
      const newDeviceId = crypto.randomUUID();

      // 检查是否启用独立服务模式
      const useStandaloneService = options.useStandaloneService !== false; // 默认启用

      if (useStandaloneService) {
        // 启动独立守护服务（客户端关闭后仍然运行）
        const serviceResult =
          await this.standaloneService.startStandaloneService(newDeviceId, {
            enableBackupMonitoring: true,
            enableDatabaseMonitoring: true,
            enableEnhancedProtection: true,
          });

        if (serviceResult.success) {
          results.actions.push("🛡️ 独立守护服务已启动（持久防护）");
          results.actions.push(`🎯 目标设备ID: ${newDeviceId}`);
          results.actions.push(`🔧 服务PID: ${serviceResult.pid}`);
          results.actions.push("🔒 已启用零容忍备份文件监控");
          results.actions.push("🗄️ 已启用SQLite数据库监控");
          results.actions.push("🛡️ 已启用增强文件保护");
          results.actions.push("⚡ 服务将在客户端关闭后继续运行");
        } else {
          results.errors.push(`启动独立守护服务失败: ${serviceResult.message}`);

          // 降级到内置守护进程
          results.actions.push("⚠️ 降级到内置守护进程模式");
          await this.startInProcessGuardian(results, newDeviceId, options);
        }
      } else {
        // 使用内置守护进程（客户端关闭时停止）
        await this.startInProcessGuardian(results, newDeviceId, options);
      }
    } catch (error) {
      results.errors.push(`启动增强守护进程失败: ${error.message}`);
    }
  }

  // 启动内置守护进程
  async startInProcessGuardian(results, deviceId, options = {}) {
    try {
      // 标记客户端正在清理，避免守护进程干扰
      this.enhancedGuardian.setClientCleaningState(true);

      // 启动增强守护进程
      const guardianResult = await this.enhancedGuardian.startGuarding(
        deviceId,
        {
          enableBackupMonitoring: true,
          enableDatabaseMonitoring: true,
          enableEnhancedProtection: true,
        }
      );

      if (guardianResult.success) {
        results.actions.push("🛡️ 内置守护进程已启动（客户端运行时防护）");
        results.actions.push(`🎯 目标设备ID: ${deviceId}`);
        results.actions.push("🔒 已启用零容忍备份文件监控");
        results.actions.push("🗄️ 已启用SQLite数据库监控");
        results.actions.push("🛡️ 已启用增强文件保护");

        // 设置定时器，在指定时间后标记客户端清理完成
        setTimeout(() => {
          this.enhancedGuardian.setClientCleaningState(false);
          console.log("✅ 客户端清理完成，增强守护进程开始全面监控");
        }, 10000); // 10秒后开始监控
      } else {
        results.errors.push(`启动内置守护进程失败: ${guardianResult.message}`);
      }
    } catch (error) {
      results.errors.push(`启动内置守护进程失败: ${error.message}`);
    }
  }

  // 停止增强设备ID守护进程
  async stopEnhancedGuardian(results) {
    try {
      const stopResult = await this.enhancedGuardian.stopGuarding();

      if (stopResult.success) {
        results.actions.push("🛑 增强设备ID守护进程已停止");
      } else {
        results.errors.push(`停止增强守护进程失败: ${stopResult.message}`);
      }
    } catch (error) {
      results.errors.push(`停止增强守护进程失败: ${error.message}`);
    }
  }

  // 清理前停止增强防护（避免防护机制干扰清理过程）
  async stopEnhancedProtectionBeforeCleanup(results) {
    try {
      results.actions.push("🔍 检查增强防护状态...");

      // 获取当前防护状态
      const status = await this.getEnhancedGuardianStatus();

      if (status.isGuarding || status.standaloneService?.isRunning) {
        results.actions.push("🛑 检测到增强防护正在运行，清理前先停止防护...");

        // 停止内置守护进程
        if (status.isGuarding) {
          await this.stopEnhancedGuardian(results);
        }

        // 停止独立守护服务
        if (status.standaloneService?.isRunning) {
          await this.stopStandaloneService(results);
        }

        // 等待防护完全停止
        await new Promise((resolve) => setTimeout(resolve, 2000));
        results.actions.push("✅ 增强防护已停止，可以安全进行清理");
      } else {
        results.actions.push("✅ 增强防护未运行，可以直接进行清理");
      }
    } catch (error) {
      results.errors.push(`停止增强防护失败: ${error.message}`);
      results.actions.push("⚠️ 防护停止失败，但继续执行清理操作");
    }
  }

  // 独立启动增强防护
  async startEnhancedGuardianIndependently(options = {}) {
    try {
      // 检查启动条件
      const canStart = await this.canStartEnhancedGuardian();
      if (!canStart.success) {
        return canStart;
      }

      // 获取当前设备ID
      const deviceId = await this.getCurrentDeviceId();
      if (!deviceId) {
        return { success: false, message: "无法获取设备ID" };
      }

      // 优先尝试启动独立服务
      console.log("🚀 尝试启动独立守护服务...");
      const serviceResult = await this.standaloneService.startStandaloneService(
        deviceId,
        {
          enableBackupMonitoring: options.enableBackupMonitoring !== false,
          enableDatabaseMonitoring: options.enableDatabaseMonitoring !== false,
          enableEnhancedProtection: options.enableEnhancedProtection !== false,
          ...options,
        }
      );

      if (serviceResult.success) {
        console.log("✅ 独立守护服务启动成功");
        return {
          success: true,
          message: "独立守护服务已启动",
          deviceId: deviceId,
          mode: "standalone",
          pid: serviceResult.pid,
        };
      } else if (serviceResult.alreadyRunning) {
        console.log("ℹ️ 独立守护服务已在运行");
        return {
          success: true,
          message: "独立守护服务已在运行",
          deviceId: deviceId,
          mode: "standalone",
          pid: serviceResult.pid,
          alreadyRunning: true,
        };
      } else {
        console.log(`⚠️ 独立服务启动失败: ${serviceResult.message}`);
        console.log("🔄 降级到内置守护进程模式...");

        // 降级到内置守护进程
        const result = await this.enhancedGuardian.startGuardingIndependently(
          deviceId,
          options
        );

        if (result.success) {
          return {
            success: true,
            message: "增强防护已启动（内置模式）",
            deviceId: deviceId,
            mode: "inprocess",
          };
        } else {
          return result;
        }
      }
    } catch (error) {
      return { success: false, message: `启动增强防护失败: ${error.message}` };
    }
  }

  // 检查是否可以启动增强防护
  async canStartEnhancedGuardian() {
    try {
      // 检查是否已在运行
      const status = await this.getEnhancedGuardianStatus();
      if (status.isGuarding) {
        return { success: false, message: "增强防护已在运行" };
      }

      // 检查设备ID可用性
      const deviceId = await this.getCurrentDeviceId();
      if (!deviceId) {
        return { success: false, message: "设备ID不可用" };
      }

      // 检查增强守护进程是否可以启动
      const isReady = await this.enhancedGuardian.isReadyToStart();
      if (!isReady) {
        return { success: false, message: "增强守护进程未就绪" };
      }

      return { success: true, message: "可以启动增强防护" };
    } catch (error) {
      return { success: false, message: `检查启动条件失败: ${error.message}` };
    }
  }

  // 获取守护进程启动状态信息
  async getGuardianStartupStatus() {
    try {
      const requirements =
        await this.enhancedGuardian.checkStartupRequirements();
      const currentStatus = await this.getEnhancedGuardianStatus();

      return {
        canStart: requirements.canStart,
        reason: requirements.reason,
        requirements: requirements.checks,
        currentStatus: currentStatus,
        deviceId: requirements.deviceId,
      };
    } catch (error) {
      return {
        canStart: false,
        reason: `获取状态失败: ${error.message}`,
        requirements: {},
        currentStatus: { isGuarding: false },
        deviceId: null,
      };
    }
  }

  // 获取增强守护进程状态
  async getEnhancedGuardianStatus() {
    try {
      const inProcessStatus = await this.enhancedGuardian.getStatus();
      const standaloneStatus = await this.standaloneService.getServiceStatus();

      // 增强独立服务状态检测 - 即使PID文件有问题也要检查实际进程
      let enhancedStandaloneStatus = { ...standaloneStatus };

      if (!standaloneStatus.isRunning) {
        // 如果基础检查显示未运行，进行深度进程扫描
        const actuallyRunning = await this.checkActualGuardianProcesses();
        if (actuallyRunning.hasStandaloneProcess) {
          console.log("🔍 检测到独立守护进程实际在运行，但PID文件可能有问题");
          enhancedStandaloneStatus.isRunning = true;
          enhancedStandaloneStatus.pid = actuallyRunning.pid;
          enhancedStandaloneStatus.detectionMethod = "process-scan";
          enhancedStandaloneStatus.warning =
            "PID文件可能不同步，但进程正在运行";
        }
      }

      const isActuallyGuarding =
        inProcessStatus.isGuarding || enhancedStandaloneStatus.isRunning;
      const currentMode = enhancedStandaloneStatus.isRunning
        ? "standalone"
        : inProcessStatus.isGuarding
        ? "inprocess"
        : "none";

      console.log(
        `🔍 状态检查结果: 内置进程=${inProcessStatus.isGuarding}, 独立服务=${enhancedStandaloneStatus.isRunning}, 总体防护=${isActuallyGuarding}`
      );

      return {
        inProcess: inProcessStatus,
        standalone: enhancedStandaloneStatus,
        isGuarding: isActuallyGuarding,
        mode: currentMode,
        timestamp: new Date().toISOString(),
        detectionDetails: {
          inProcessGuarding: inProcessStatus.isGuarding,
          standaloneRunning: enhancedStandaloneStatus.isRunning,
          detectionMethod:
            enhancedStandaloneStatus.detectionMethod || "standard",
        },
      };
    } catch (error) {
      console.error("获取增强防护状态失败:", error);
      return {
        isGuarding: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // 检查实际运行的守护进程（深度扫描）
  async checkActualGuardianProcesses() {
    try {
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);

      const result = {
        hasStandaloneProcess: false,
        hasInProcessGuardian: false,
        pid: null,
        processes: [],
      };

      if (process.platform === "win32") {
        // Windows系统进程扫描
        try {
          const { stdout } = await execAsync(
            "wmic process get processid,commandline /format:csv"
          );
          const lines = stdout.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            if (line.includes("node.exe")) {
              const parts = line.split(",");
              if (parts.length >= 2) {
                const pid = parts[1].replace(/"/g, "");
                const commandLine = parts[2] || "";

                // 检查是否是独立守护服务
                if (
                  commandLine.includes("standalone-guardian-service") ||
                  commandLine.includes("guardian-service-worker")
                ) {
                  result.hasStandaloneProcess = true;
                  result.pid = parseInt(pid);
                  result.processes.push({
                    pid: pid,
                    type: "standalone",
                    command: commandLine,
                  });
                  console.log(`🎯 发现独立守护进程: PID ${pid}`);
                }

                // 检查是否是增强守护进程
                if (commandLine.includes("enhanced-device-guardian")) {
                  result.hasInProcessGuardian = true;
                  result.processes.push({
                    pid: pid,
                    type: "inprocess",
                    command: commandLine,
                  });
                  console.log(`🎯 发现内置守护进程: PID ${pid}`);
                }
              }
            }
          }
        } catch (error) {
          console.log("Windows进程扫描失败:", error.message);
        }
      } else {
        // Unix/Linux/macOS系统进程扫描
        try {
          const { stdout } = await execAsync(
            'ps aux | grep -E "(standalone-guardian|enhanced-device-guardian|guardian-service-worker)" | grep -v grep'
          );
          const lines = stdout.trim().split("\n");

          for (const line of lines) {
            if (line.trim()) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[1];
              const command = parts.slice(10).join(" ");

              if (
                command.includes("standalone-guardian") ||
                command.includes("guardian-service-worker")
              ) {
                result.hasStandaloneProcess = true;
                result.pid = parseInt(pid);
                result.processes.push({
                  pid: pid,
                  type: "standalone",
                  command: command,
                });
                console.log(`🎯 发现独立守护进程: PID ${pid}`);
              }

              if (command.includes("enhanced-device-guardian")) {
                result.hasInProcessGuardian = true;
                result.processes.push({
                  pid: pid,
                  type: "inprocess",
                  command: command,
                });
                console.log(`🎯 发现内置守护进程: PID ${pid}`);
              }
            }
          }
        } catch (error) {
          console.log("Unix进程扫描失败:", error.message);
        }
      }

      console.log(
        `🔍 进程扫描结果: 独立服务=${result.hasStandaloneProcess}, 内置进程=${result.hasInProcessGuardian}`
      );
      return result;
    } catch (error) {
      console.error("检查实际守护进程失败:", error);
      return {
        hasStandaloneProcess: false,
        hasInProcessGuardian: false,
        pid: null,
        processes: [],
        error: error.message,
      };
    }
  }

  // 停止独立守护服务
  async stopStandaloneService(results) {
    try {
      const stopResult = await this.standaloneService.stopStandaloneService();

      if (stopResult.success) {
        results.actions.push("🛑 独立守护服务已停止");
        if (stopResult.pid) {
          results.actions.push(`🔧 已停止PID: ${stopResult.pid}`);
        }
      } else {
        results.errors.push(`停止独立守护服务失败: ${stopResult.message}`);
      }
    } catch (error) {
      results.errors.push(`停止独立守护服务失败: ${error.message}`);
    }
  }

  // 获取独立服务状态
  async getStandaloneServiceStatus() {
    try {
      return await this.standaloneService.getServiceStatus();
    } catch (error) {
      return {
        isRunning: false,
        error: error.message,
      };
    }
  }
}

module.exports = DeviceManager;
