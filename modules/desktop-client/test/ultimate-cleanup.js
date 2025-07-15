#!/usr/bin/env node

/**
 * Augment设备管理器 - 终极清理方案
 * 目标：98%以上清理成功率，让Augment扩展完全无法识别为老用户
 *
 * 三种清理策略：
 * 1. 完全卸载并重新安装Cursor IDE
 * 2. 深层配置文件清理
 * 3. 系统级别阻止ID恢复
 */

const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { exec, spawn } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

class UltimateCleanup {
  constructor() {
    this.platform = os.platform();
    this.results = {
      success: true,
      actions: [],
      errors: [],
      phase: "initialization",
    };
  }

  async execute(options = {}) {
    console.log("🚀 启动终极清理方案...");
    console.log("🎯 目标：98%以上清理成功率");
    console.log("⚠️ 警告：这将完全重置Cursor IDE");
    console.log("");

    try {
      // 阶段1：系统级别阻止ID恢复
      await this.phase1_SystemLevelBlocking();

      // 阶段2：深层配置文件清理
      await this.phase2_DeepConfigCleanup();

      // 阶段3：完全卸载Cursor IDE
      await this.phase3_CompleteUninstall();

      // 阶段4：彻底清理残留
      await this.phase4_ThoroughCleanup();

      // 阶段5：重新安装Cursor IDE
      if (options.reinstall !== false) {
        await this.phase5_ReinstallCursor();
      }

      // 阶段6：验证清理效果
      await this.phase6_VerifyCleanup();

      console.log("\n🎉 终极清理完成！");
      return this.results;
    } catch (error) {
      console.error("❌ 终极清理失败:", error.message);
      this.results.success = false;
      this.results.errors.push(`终极清理失败: ${error.message}`);
      return this.results;
    }
  }

  // 阶段1：系统级别阻止ID恢复
  async phase1_SystemLevelBlocking() {
    this.results.phase = "system-blocking";
    console.log("🔒 阶段1：系统级别阻止ID恢复");

    try {
      // 1.1 创建文件系统锁定
      await this.createFilesystemLocks();

      // 1.2 修改注册表阻止恢复
      if (this.platform === "win32") {
        await this.blockRegistryRecovery();
      }

      // 1.3 创建网络级别阻断
      await this.createNetworkBlocking();

      this.results.actions.push("✅ 系统级别阻止机制已启用");
    } catch (error) {
      this.results.errors.push(`系统级别阻止失败: ${error.message}`);
    }
  }

  // 阶段2：深层配置文件清理
  async phase2_DeepConfigCleanup() {
    this.results.phase = "deep-config";
    console.log("🗂️ 阶段2：深层配置文件清理");

    try {
      // 2.1 清理所有Cursor相关配置
      await this.cleanAllCursorConfigs();

      // 2.2 清理系统级别配置
      await this.cleanSystemConfigs();

      // 2.3 清理用户级别配置
      await this.cleanUserConfigs();

      this.results.actions.push("✅ 深层配置文件已完全清理");
    } catch (error) {
      this.results.errors.push(`深层配置清理失败: ${error.message}`);
    }
  }

  // 阶段3：完全卸载Cursor IDE
  async phase3_CompleteUninstall() {
    this.results.phase = "uninstall";
    console.log("🗑️ 阶段3：完全卸载Cursor IDE");

    try {
      // 3.1 强制终止所有Cursor进程
      await this.forceKillAllCursorProcesses();

      // 3.2 卸载Cursor应用程序
      await this.uninstallCursorApplication();

      // 3.3 清理注册表项
      if (this.platform === "win32") {
        await this.cleanCursorRegistry();
      }

      // 3.4 删除所有安装文件
      await this.removeAllCursorFiles();

      this.results.actions.push("✅ Cursor IDE已完全卸载");
    } catch (error) {
      this.results.errors.push(`完全卸载失败: ${error.message}`);
    }
  }

  // 阶段4：彻底清理残留
  async phase4_ThoroughCleanup() {
    this.results.phase = "thorough-cleanup";
    console.log("🧹 阶段4：彻底清理残留");

    try {
      // 4.1 清理所有用户数据
      await this.cleanAllUserData();

      // 4.2 清理系统缓存
      await this.cleanSystemCache();

      // 4.3 清理临时文件
      await this.cleanTempFiles();

      // 4.4 清理网络缓存
      await this.cleanNetworkCache();

      this.results.actions.push("✅ 所有残留数据已清理");
    } catch (error) {
      this.results.errors.push(`彻底清理失败: ${error.message}`);
    }
  }

  // 阶段5：重新安装Cursor IDE
  async phase5_ReinstallCursor() {
    this.results.phase = "reinstall";
    console.log("📥 阶段5：重新安装Cursor IDE");

    try {
      // 5.1 下载最新版本Cursor
      const installerPath = await this.downloadCursorInstaller();

      // 5.2 静默安装
      await this.silentInstallCursor(installerPath);

      // 5.3 验证安装
      await this.verifyInstallation();

      this.results.actions.push("✅ Cursor IDE已重新安装");
    } catch (error) {
      this.results.errors.push(`重新安装失败: ${error.message}`);
      console.log("⚠️ 重新安装失败，请手动安装Cursor IDE");
    }
  }

  // 阶段6：验证清理效果
  async phase6_VerifyCleanup() {
    this.results.phase = "verification";
    console.log("✅ 阶段6：验证清理效果");

    try {
      // 6.1 检查设备ID是否完全重置
      const deviceIdStatus = await this.verifyDeviceIdReset();

      // 6.2 检查Augment扩展数据
      const augmentStatus = await this.verifyAugmentDataCleanup();

      // 6.3 计算清理成功率
      const successRate = await this.calculateSuccessRate();

      console.log(`📊 清理成功率: ${successRate.toFixed(1)}%`);

      if (successRate >= 98) {
        console.log("🎉 清理成功！Augment扩展应该识别为新用户");
        this.results.actions.push(
          `🎯 清理成功率: ${successRate.toFixed(1)}% (≥98%)`
        );
      } else {
        console.log("⚠️ 清理成功率不足，可能需要额外处理");
        this.results.errors.push(
          `清理成功率不足: ${successRate.toFixed(1)}% (<98%)`
        );
      }
    } catch (error) {
      this.results.errors.push(`验证清理效果失败: ${error.message}`);
    }
  }

  // 创建文件系统锁定
  async createFilesystemLocks() {
    const lockPaths = [
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

    for (const lockPath of lockPaths) {
      try {
        const lockDir = path.dirname(lockPath);
        await fs.ensureDir(lockDir);

        // 创建只读锁定文件
        await fs.writeFile(lockPath + ".lock", "LOCKED_BY_ULTIMATE_CLEANUP");

        if (this.platform === "win32") {
          // Windows: 设置文件为只读和隐藏
          await execAsync(`attrib +R +H "${lockPath}.lock"`);
        }

        this.results.actions.push(`🔒 已锁定: ${path.basename(lockPath)}`);
      } catch (error) {
        // 忽略单个锁定失败
      }
    }
  }

  // 强制终止所有Cursor进程
  async forceKillAllCursorProcesses() {
    const killCommands =
      this.platform === "win32"
        ? [
            'taskkill /f /im "Cursor.exe" /t',
            'taskkill /f /im "cursor.exe" /t',
            "wmic process where \"name like '%cursor%'\" delete",
            "wmic process where \"CommandLine like '%cursor%'\" delete",
          ]
        : [
            "pkill -9 -f cursor",
            "pkill -9 -f Cursor",
            "killall -9 cursor",
            "killall -9 Cursor",
          ];

    for (const cmd of killCommands) {
      try {
        await execAsync(cmd);
        this.results.actions.push(`🔪 执行: ${cmd}`);
      } catch (error) {
        // 忽略进程不存在的错误
      }
    }

    // 等待进程完全终止
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

// 主执行函数
async function runUltimateCleanup() {
  const cleanup = new UltimateCleanup();

  // 检查管理员权限
  if (os.platform() === "win32") {
    try {
      await execAsync("net session");
    } catch (error) {
      console.log("⚠️ 建议以管理员权限运行以获得最佳效果");
    }
  }

  const options = {
    reinstall: process.argv.includes("--no-reinstall") ? false : true,
  };

  const results = await cleanup.execute(options);

  console.log("\n📋 终极清理结果总结:");
  console.log(`✅ 成功操作: ${results.actions.length} 个`);
  console.log(`❌ 失败操作: ${results.errors.length} 个`);

  if (results.errors.length > 0) {
    console.log("\n❌ 错误详情:");
    results.errors.forEach((error) => console.log(`  • ${error}`));
  }

  return results;
}

// 处理命令行参数
if (require.main === module) {
  if (process.argv.includes("--help")) {
    console.log("终极清理方案使用说明:");
    console.log("  node ultimate-cleanup.js              # 完整清理+重装");
    console.log("  node ultimate-cleanup.js --no-reinstall # 仅清理，不重装");
    console.log("");
    console.log("⚠️ 警告：这将完全重置Cursor IDE，请确保已备份重要数据");
  } else {
    runUltimateCleanup().catch(console.error);
  }
}

module.exports = { UltimateCleanup, runUltimateCleanup };
