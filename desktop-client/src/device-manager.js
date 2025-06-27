const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const { promisify } = require("util");
const { app } = require("electron");

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

      // 0. 如果需要清理Cursor扩展，先强制关闭Cursor IDE
      if (options.cleanCursorExtension && options.autoRestartCursor) {
        await this.forceCloseCursorIDE(results);
        // 等待进程完全终止
        await new Promise((resolve) => setTimeout(resolve, 5000));
        results.actions.push("⏳ 等待5秒确保进程完全终止...");
      }

      // 1. 清理本地激活信息（根据选项决定是否保留）
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
      if (options.cleanCursorExtension) {
        await this.cleanCursorExtensionData(results, options);
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

        // 备份完整配置文件
        const backupPath = configFile + ".backup." + Date.now();
        await fs.copy(configFile, backupPath);
        results.actions.push(`已备份配置文件到: ${backupPath}`);

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
              [
                "stable-device-id.cache",
                "stable-device-id.backup",
                "device-fingerprint.cache",
              ].includes(file)
            ) {
              results.actions.push(`已保留设备ID缓存: ${file}`);
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

          // 只清理特定的Augment相关文件
          const augmentFiles = files.filter(
            (file) =>
              file.toLowerCase().includes("augment") ||
              file.toLowerCase().includes("device") ||
              file.toLowerCase().includes("license") ||
              file.endsWith(".tmp") ||
              file.endsWith(".cache")
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
                ];
                let whereConditions = [];

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

  // 重置使用计数
  async resetUsageCount() {
    try {
      const results = {
        success: true,
        actions: [],
        errors: [],
      };

      // 重新创建干净的存储目录
      if (await fs.pathExists(this.cursorPaths.augmentStorage)) {
        await fs.remove(this.cursorPaths.augmentStorage);
      }

      await fs.ensureDir(this.cursorPaths.augmentStorage);
      results.actions.push("已重置Augment存储目录");

      // 创建新的配置文件（如果需要）
      const newConfigPath = path.join(
        this.cursorPaths.augmentStorage,
        "augment-global-state"
      );
      await fs.ensureDir(newConfigPath);

      // 写入基础配置
      const basicConfig = {
        version: "1.0.0",
        resetAt: new Date().toISOString(),
        deviceId: require(getSharedPath(
          "crypto/encryption"
        )).generateDeviceFingerprint(),
      };

      await fs.writeJson(path.join(newConfigPath, "config.json"), basicConfig, {
        spaces: 2,
      });
      results.actions.push("已创建新的配置文件");

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
      // 如果保留激活状态，则不清理设备指纹缓存
      if (options.preserveActivation) {
        results.actions.push("保留激活状态模式：跳过设备指纹重置");
        return;
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

  // 专门清理Cursor IDE扩展数据，让其认为是新设备
  async cleanCursorExtensionData(results, options = {}) {
    try {
      // 首先清理Augment扩展的特定存储数据
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

      // 备份重要文件
      const backupDir = path.join(os.tmpdir(), `cursor-backup-${Date.now()}`);
      await fs.ensureDir(backupDir);

      // 根据resetCursorCompletely和skipCursorLogin选项决定清理策略
      if (options.resetCursorCompletely) {
        // 完全重置模式：清理所有Cursor IDE数据
        results.actions.push("🔄 启用完全重置模式，清理所有Cursor IDE数据...");
        await this.performCompleteCursorReset(results, cursorPaths, backupDir);
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
                // 备份并删除非关键文件
                const fileName = path.basename(cursorPath);
                const backupPath = path.join(backupDir, fileName);
                await fs.copy(cursorPath, backupPath);
                await fs.remove(cursorPath);
                results.actions.push(`已清理Cursor文件: ${fileName}`);
              } else if (stats.isDirectory()) {
                // 备份并删除非关键目录
                const dirName = path.basename(cursorPath);
                const backupPath = path.join(backupDir, dirName);
                await fs.copy(cursorPath, backupPath);
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
                // 备份单个文件
                const fileName = path.basename(cursorPath);
                const backupPath = path.join(backupDir, fileName);
                await fs.copy(cursorPath, backupPath);

                // 删除原文件
                await fs.remove(cursorPath);
                results.actions.push(`已清理Cursor文件: ${fileName}`);
              } else if (stats.isDirectory()) {
                // 备份整个目录
                const dirName = path.basename(cursorPath);
                const backupPath = path.join(backupDir, dirName);
                await fs.copy(cursorPath, backupPath);

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

      results.actions.push("🎯 Cursor IDE扩展数据已完全重置，将被识别为新设备");
    } catch (error) {
      results.errors.push(`清理Cursor扩展数据失败: ${error.message}`);
    }
  }

  // 专门清理Augment扩展的存储数据（包括登录会话）
  async cleanAugmentExtensionStorage(results, options = {}) {
    try {
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
            // 备份Augment扩展数据
            const backupDir = path.join(
              os.tmpdir(),
              `augment-backup-${Date.now()}`
            );
            await fs.ensureDir(backupDir);
            const backupPath = path.join(backupDir, "augment.vscode-augment");
            await fs.copy(augmentPath, backupPath);

            // 删除Augment扩展存储目录
            await fs.remove(augmentPath);
            results.actions.push(
              `✅ 已清理Augment扩展存储: ${path.basename(augmentPath)}`
            );
            results.actions.push(`📁 Augment数据备份至: ${backupPath}`);
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

              // 清理MCP服务相关（可能包含Augment数据）
              "DELETE FROM ItemTable WHERE key LIKE '%mcpService%'",
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

              // MCP服务相关
              "DELETE FROM ItemTable WHERE key LIKE '%mcpService%'",
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
            // 备份工作区Augment数据
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

            // 删除工作区Augment数据
            await fs.remove(augmentWorkspacePath);
            results.actions.push(
              `✅ 已清理工作区Augment数据: ${workspace.substring(0, 16)}...`
            );
            results.actions.push(`📁 工作区数据备份至: ${backupPath}`);
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
            // 备份目录
            const backupDir = path.join(
              os.tmpdir(),
              `cursor-backup-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`
            );
            await fs.ensureDir(backupDir);
            const backupPath = path.join(backupDir, path.basename(pathToClean));

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
        const currentTime = new Date().toUTCString();

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
  async performCompleteCursorReset(results, cursorPaths, backupDir) {
    try {
      results.actions.push("🔄 开始完全重置Cursor IDE用户身份...");

      // 1. 清理所有Cursor IDE相关文件和目录
      for (const cursorPath of cursorPaths) {
        try {
          if (await fs.pathExists(cursorPath)) {
            const stats = await fs.stat(cursorPath);
            const pathName = path.basename(cursorPath);

            if (stats.isFile()) {
              // 备份并删除文件
              const fileName = path.basename(cursorPath);
              const backupPath = path.join(backupDir, fileName);
              await fs.copy(cursorPath, backupPath);
              await fs.remove(cursorPath);
              results.actions.push(`🗑️ 已清理Cursor文件: ${fileName}`);
            } else if (stats.isDirectory()) {
              // 备份并删除目录
              const dirName = path.basename(cursorPath);
              const backupPath = path.join(backupDir, dirName);
              await fs.copy(cursorPath, backupPath);
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
}

module.exports = DeviceManager;
