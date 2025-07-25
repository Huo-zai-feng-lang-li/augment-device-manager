/**
 * 清理后启动防护功能
 * 根据用户选择的IDE进行清理，然后启动对应的防护
 */

const path = require("path");
const fs = require("fs-extra");
const os = require("os");

class CleanupAndStartGuardian {
  constructor() {
    this.ideConfigs = {
      cursor: {
        name: "Cursor",
        storagePath: path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "User",
          "globalStorage",
          "storage.json"
        ),
        processNames: ["Cursor.exe", "cursor.exe"],
        displayName: "Cursor IDE",
      },
      vscode: {
        name: "VS Code",
        storagePath: path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Code",
          "User",
          "globalStorage",
          "storage.json"
        ),
        processNames: ["Code.exe", "code.exe"],
        displayName: "Visual Studio Code",
      },
    };
  }

  /**
   * 主要的清理和启动防护流程
   */
  async cleanupAndStartGuardian(selectedIDE, options = {}) {
    console.log("🧹 清理后启动防护功能");
    console.log("=".repeat(60));

    const results = { actions: [], errors: [], success: true };

    try {
      // 验证IDE选择
      if (!this.ideConfigs[selectedIDE]) {
        throw new Error(`不支持的IDE类型: ${selectedIDE}`);
      }

      const ideConfig = this.ideConfigs[selectedIDE];
      console.log(`🎯 选择的IDE: ${ideConfig.displayName}`);

      // 1. 停止所有现有的防护进程
      console.log("\n📍 1. 停止所有现有的防护进程");
      await this.stopAllGuardianProcesses(results);

      // 2. 执行IDE清理
      console.log("\n📍 2. 执行IDE清理");
      await this.performIDECleanup(selectedIDE, results, options);

      // 3. 等待系统稳定
      console.log("\n📍 3. 等待系统稳定（3秒）");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 4. 启动对应的防护
      console.log("\n📍 4. 启动防护");
      await this.startGuardianForIDE(selectedIDE, results, options);

      // 5. 验证防护状态
      console.log("\n📍 5. 验证防护状态");
      await this.verifyGuardianStatus(selectedIDE, results);

      console.log("\n🎉 清理后启动防护完成！");
      this.printResults(results);

      return results;
    } catch (error) {
      console.error("❌ 清理后启动防护失败:", error.message);
      results.errors.push(`清理后启动防护失败: ${error.message}`);
      results.success = false;
      return results;
    }
  }

  /**
   * 停止所有防护进程
   */
  async stopAllGuardianProcesses(results) {
    try {
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);

      console.log("🛑 扫描并停止所有防护进程...");

      if (process.platform === "win32") {
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
            // 提取PID
            const pidMatch = line.trim().match(/\s+(\d+)\s*$/);
            if (pidMatch) {
              guardianProcesses.push(pidMatch[1]);
              console.log(`发现防护进程 PID: ${pidMatch[1]}`);
            }
          }
        }

        if (guardianProcesses.length > 0) {
          console.log(
            `🎯 发现 ${guardianProcesses.length} 个防护进程，正在终止...`
          );

          for (const pid of guardianProcesses) {
            try {
              await execAsync(`taskkill /F /PID ${pid}`);
              console.log(`✅ 已终止防护进程 PID: ${pid}`);
              results.actions.push(`已终止防护进程 PID: ${pid}`);
            } catch (error) {
              console.log(`⚠️ 终止进程 ${pid} 失败: ${error.message}`);
              results.errors.push(`终止进程 ${pid} 失败: ${error.message}`);
            }
          }
        } else {
          console.log("✅ 未发现运行中的防护进程");
          results.actions.push("未发现运行中的防护进程");
        }
      }
    } catch (error) {
      console.error("停止防护进程失败:", error);
      results.errors.push(`停止防护进程失败: ${error.message}`);
    }
  }

  /**
   * 执行IDE清理
   */
  async performIDECleanup(selectedIDE, results, options) {
    try {
      const DeviceManager = require("../../modules/desktop-client/src/device-manager");
      const deviceManager = new DeviceManager();

      const ideConfig = this.ideConfigs[selectedIDE];
      console.log(`🧹 开始清理 ${ideConfig.displayName}...`);

      // 构建清理选项
      const cleanupOptions = {
        preserveActivation: options.preserveActivation ?? true,
        deepClean: options.deepClean ?? true,
        intelligentMode: options.intelligentMode ?? true, // 默认使用智能模式
        // 根据选择的IDE设置清理选项
        cleanCursor: selectedIDE === "cursor",
        cleanVSCode: selectedIDE === "vscode",
        cleanCursorExtension:
          selectedIDE === "cursor" ? options.cleanExtension ?? true : false,
        autoRestartCursor: false, // 不自动重启，我们会手动启动防护
        ...options,
      };

      console.log(`清理选项:`, {
        selectedIDE,
        cleanCursor: cleanupOptions.cleanCursor,
        cleanVSCode: cleanupOptions.cleanVSCode,
        intelligentMode: cleanupOptions.intelligentMode,
      });

      // 执行清理
      const cleanupResults = await deviceManager.performCleanup(cleanupOptions);

      // 合并结果
      results.actions.push(...cleanupResults.actions);
      results.errors.push(...cleanupResults.errors);
      results.success = cleanupResults.success && results.success;

      if (cleanupResults.success) {
        console.log(`✅ ${ideConfig.displayName} 清理完成`);
      } else {
        console.log(`❌ ${ideConfig.displayName} 清理失败`);
      }
    } catch (error) {
      console.error(`IDE清理失败:`, error);
      results.errors.push(`IDE清理失败: ${error.message}`);
      results.success = false;
    }
  }

  /**
   * 为指定IDE启动防护
   */
  async startGuardianForIDE(selectedIDE, results, options) {
    try {
      const DeviceManager = require("../../modules/desktop-client/src/device-manager");
      const deviceManager = new DeviceManager();

      const ideConfig = this.ideConfigs[selectedIDE];
      console.log(`🛡️ 为 ${ideConfig.displayName} 启动防护...`);

      // 从实际的IDE配置文件中读取清理后的新设备ID
      const targetDeviceId = await this.getCurrentDeviceIdFromIDE(selectedIDE);

      if (!targetDeviceId) {
        throw new Error(`无法获取 ${ideConfig.displayName} 的当前设备ID`);
      }

      console.log(`🎯 目标设备ID: ${targetDeviceId}`);

      // 启动防护
      const guardianOptions = {
        selectedIDE: selectedIDE,
        targetDeviceId: targetDeviceId,
        enableBackupMonitoring: true,
        enableDatabaseMonitoring: true,
        enableEnhancedProtection: true,
        ...options.guardianOptions,
      };

      const startResult =
        await deviceManager.startEnhancedGuardianIndependently(guardianOptions);

      if (startResult.success) {
        console.log(`✅ ${ideConfig.displayName} 防护启动成功`);
        console.log(`🔧 防护模式: ${startResult.mode}`);
        results.actions.push(
          `${ideConfig.displayName} 防护启动成功 (模式: ${startResult.mode})`
        );
      } else {
        console.log(
          `❌ ${ideConfig.displayName} 防护启动失败: ${startResult.message}`
        );
        results.errors.push(
          `${ideConfig.displayName} 防护启动失败: ${startResult.message}`
        );
        results.success = false;
      }
    } catch (error) {
      console.error(`启动防护失败:`, error);
      results.errors.push(`启动防护失败: ${error.message}`);
      results.success = false;
    }
  }

  /**
   * 从IDE配置文件中获取当前设备ID
   */
  async getCurrentDeviceIdFromIDE(selectedIDE) {
    try {
      const fs = require("fs-extra");
      const DeviceManager = require("../../modules/desktop-client/src/device-manager");
      const deviceManager = new DeviceManager();

      let storageJsonPaths = [];

      if (selectedIDE === "cursor") {
        // 使用动态路径检测Cursor
        const cursorPaths = deviceManager.getCursorPaths();
        storageJsonPaths.push(cursorPaths.storageJson);
      } else if (selectedIDE === "vscode") {
        // 使用动态路径检测所有VS Code变体
        const vscodePaths = deviceManager.getVSCodePaths();
        if (vscodePaths.variants) {
          for (const [variantName, config] of Object.entries(
            vscodePaths.variants
          )) {
            const storageJsonPath = require("path").join(
              config.globalStorage,
              "storage.json"
            );
            storageJsonPaths.push({
              path: storageJsonPath,
              variant: variantName,
            });
          }
        }
      } else {
        throw new Error(`不支持的IDE类型: ${selectedIDE}`);
      }

      // 尝试从所有可能的路径中读取设备ID
      for (const pathInfo of storageJsonPaths) {
        const storageJsonPath =
          typeof pathInfo === "string" ? pathInfo : pathInfo.path;
        const variantName =
          typeof pathInfo === "string" ? selectedIDE : pathInfo.variant;

        if (await fs.pathExists(storageJsonPath)) {
          try {
            const storageData = await fs.readJson(storageJsonPath);
            const deviceId = storageData["telemetry.devDeviceId"];

            if (deviceId) {
              console.log(
                `📋 从 ${selectedIDE} (${variantName}) 配置文件读取到设备ID: ${deviceId}`
              );
              console.log(`📁 配置文件路径: ${storageJsonPath}`);
              return deviceId;
            }
          } catch (error) {
            console.log(`⚠️ 读取 ${storageJsonPath} 失败: ${error.message}`);
            continue;
          }
        }
      }

      console.log(`⚠️ ${selectedIDE} 未找到有效的配置文件或设备ID`);
      return null;
    } catch (error) {
      console.error(`读取 ${selectedIDE} 设备ID失败:`, error);
      return null;
    }
  }

  /**
   * 验证防护状态
   */
  async verifyGuardianStatus(selectedIDE, results) {
    try {
      const DeviceManager = require("../../modules/desktop-client/src/device-manager");
      const deviceManager = new DeviceManager();

      const ideConfig = this.ideConfigs[selectedIDE];
      console.log(`🔍 验证 ${ideConfig.displayName} 防护状态...`);

      const status = await deviceManager.getEnhancedGuardianStatus();

      console.log(`总体防护: ${status.isGuarding ? "🟢 运行中" : "🔴 未运行"}`);
      console.log(`选择的IDE: ${status.selectedIDE || "未知"}`);
      console.log(`目标设备ID: ${status.targetDeviceId || "未设置"}`);
      console.log(`运行模式: ${status.mode || "未知"}`);

      // 验证配置是否正确
      const configCorrect =
        status.isGuarding &&
        status.selectedIDE === selectedIDE &&
        status.targetDeviceId;

      if (configCorrect) {
        console.log("✅ 防护配置验证成功");
        results.actions.push("防护配置验证成功");
      } else {
        console.log("❌ 防护配置验证失败");
        results.errors.push("防护配置验证失败");
        results.success = false;
      }
    } catch (error) {
      console.error(`验证防护状态失败:`, error);
      results.errors.push(`验证防护状态失败: ${error.message}`);
    }
  }

  /**
   * 打印结果
   */
  printResults(results) {
    console.log("\n📊 操作结果:");
    console.log(`✅ 成功: ${results.success}`);

    if (results.actions.length > 0) {
      console.log("\n📝 执行的操作:");
      results.actions.forEach((action, index) => {
        console.log(`  ${index + 1}. ${action}`);
      });
    }

    if (results.errors.length > 0) {
      console.log("\n❌ 错误信息:");
      results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
  }
}

// 使用示例
async function main() {
  const cleanup = new CleanupAndStartGuardian();

  // 从命令行参数获取IDE选择，默认为vscode
  const selectedIDE = process.argv[2] || "vscode";

  console.log(`🚀 开始清理后启动防护流程 - IDE: ${selectedIDE}`);

  const options = {
    intelligentMode: true, // 使用智能清理模式
    preserveActivation: true, // 保留激活状态
    deepClean: true, // 深度清理
    cleanExtension: true, // 清理扩展数据
  };

  const results = await cleanup.cleanupAndStartGuardian(selectedIDE, options);

  if (results.success) {
    console.log("\n🎉 清理后启动防护完成！");
    process.exit(0);
  } else {
    console.log("\n❌ 清理后启动防护失败！");
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ 脚本执行异常:", error);
    process.exit(1);
  });
}

module.exports = { CleanupAndStartGuardian };
