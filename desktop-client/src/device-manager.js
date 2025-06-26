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

      // 1. 清理Augment存储数据
      await this.cleanAugmentStorage(results);

      // 2. 清理SQLite状态数据库
      await this.cleanStateDatabase(results);

      // 3. 清理注册表（仅Windows）
      if (this.platform === "win32") {
        await this.cleanWindowsRegistry(results);
      }

      // 4. 清理系统临时文件
      await this.cleanTempFiles(results);

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

  // 清理Augment存储数据
  async cleanAugmentStorage(results) {
    try {
      if (await fs.pathExists(this.cursorPaths.augmentStorage)) {
        // 备份原始数据
        const backupPath =
          this.cursorPaths.augmentStorage + ".backup." + Date.now();
        await fs.copy(this.cursorPaths.augmentStorage, backupPath);

        // 清理存储目录
        await fs.remove(this.cursorPaths.augmentStorage);

        results.actions.push("已清理Augment存储数据");
        results.actions.push(`备份保存至: ${backupPath}`);
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
}

module.exports = DeviceManager;
