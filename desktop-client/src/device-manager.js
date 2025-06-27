const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const { promisify } = require("util");
const { app } = require("electron");

const execAsync = promisify(exec);

// 获取共享模块路径的辅助函数
function getSharedPath(relativePath) {
  if (app.isPackaged) {
    // 打包后的路径
    return path.join(process.resourcesPath, "shared", relativePath);
  } else {
    // 开发环境路径
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
  async performCleanup() {
    try {
      const results = {
        success: true,
        actions: [],
        errors: [],
      };

      // 1. 清理本地激活信息（确保扩展认为是新用户）
      await this.cleanActivationData(results);

      // 2. 清理Augment存储数据
      await this.cleanAugmentStorage(results);

      // 3. 清理SQLite状态数据库
      await this.cleanStateDatabase(results);

      // 4. 清理注册表（仅Windows）
      if (this.platform === "win32") {
        await this.cleanWindowsRegistry(results);
      }

      // 5. 清理系统临时文件
      await this.cleanTempFiles(results);

      // 6. 清理浏览器相关数据
      await this.cleanBrowserData(results);

      // 7. 重新生成设备指纹（可选）
      await this.regenerateDeviceFingerprint(results);

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

  // 清理激活数据（确保扩展认为是新用户）
  async cleanActivationData(results) {
    try {
      const configPath = path.join(os.homedir(), ".augment-device-manager");

      if (await fs.pathExists(configPath)) {
        // 备份配置目录
        const backupPath = configPath + ".backup." + Date.now();
        await fs.copy(configPath, backupPath);
        results.actions.push(`已备份配置目录到: ${backupPath}`);

        // 保留服务器配置，只删除激活相关文件
        const serverConfigPath = path.join(configPath, "server-config.json");
        let serverConfig = null;

        // 读取服务器配置
        if (await fs.pathExists(serverConfigPath)) {
          serverConfig = await fs.readJson(serverConfigPath);
          results.actions.push("已保存服务器配置");
        }

        // 清理配置目录
        await fs.remove(configPath);

        // 重新创建目录并恢复服务器配置
        await fs.ensureDir(configPath);
        if (serverConfig) {
          await fs.writeJson(serverConfigPath, serverConfig, { spaces: 2 });
          results.actions.push("已恢复服务器配置");
        }

        results.actions.push("已清理设备激活信息，保留服务器配置");
      } else {
        results.actions.push("未找到激活配置，跳过清理");
      }

      // 清理可能的其他激活相关文件
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
  async cleanStateDatabase(results) {
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
        await this.cleanSqliteAugmentData(results);
      } else {
        results.actions.push("状态数据库不存在，跳过清理");
      }
    } catch (error) {
      results.errors.push(`清理状态数据库失败: ${error.message}`);
    }
  }

  // 清理SQLite中的Augment相关数据
  async cleanSqliteAugmentData(results) {
    try {
      // 这里可以添加SQLite操作来清理特定的Augment相关记录
      // 由于需要sqlite3模块，这里先跳过具体实现
      results.actions.push("SQLite数据清理已跳过（需要额外配置）");
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
  async regenerateDeviceFingerprint(results) {
    try {
      // 清理缓存的指纹数据，确保下次生成新的设备标识（增强版）
      const fingerprintPaths = [
        path.join(
          os.homedir(),
          ".augment-device-manager",
          "device-fingerprint"
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
      await this.clearExtensionStorage(results);

      results.actions.push("设备指纹已完全重置，扩展将无法识别为旧设备");
    } catch (error) {
      results.errors.push(`重新生成设备指纹失败: ${error.message}`);
    }
  }

  // 清理扩展存储（深度清理）
  async clearExtensionStorage(results) {
    try {
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
}

module.exports = DeviceManager;
