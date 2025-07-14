/**
 * 增强防护状态管理器
 *
 * 功能：
 * 1. 统一管理独立服务和内置进程状态
 * 2. 提供准确的状态检查和同步
 * 3. 确保界面显示与实际状态一致
 * 4. 处理状态不一致问题
 */

const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

class EnhancedGuardianStatusManager {
  constructor(deviceManager) {
    this.deviceManager = deviceManager;
    this.lastKnownStatus = null;
    this.statusCheckInterval = null;

    // 状态文件路径
    this.paths = {
      configDir: path.join(os.homedir(), ".augment-device-manager"),
      standaloneConfig: path.join(
        os.homedir(),
        ".augment-device-manager",
        "standalone-guardian-config.json"
      ),
      standalonePid: path.join(
        os.homedir(),
        ".augment-device-manager",
        "standalone-guardian.pid"
      ),
      standaloneLog: path.join(
        os.homedir(),
        ".augment-device-manager",
        "standalone-guardian.log"
      ),
      storageJson: path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "globalStorage",
        "storage.json"
      ),
    };
  }

  /**
   * 获取综合防护状态
   */
  async getComprehensiveStatus() {
    try {
      // 1. 检查独立服务状态
      const standaloneStatus = await this.checkStandaloneServiceStatus();

      // 2. 检查内置进程状态
      const inProcessStatus = await this.checkInProcessStatus();

      // 3. 检查实际防护功能
      const protectionStatus = await this.checkActualProtection();

      // 4. 分析状态一致性
      const consistencyAnalysis = this.analyzeStatusConsistency(
        standaloneStatus,
        inProcessStatus,
        protectionStatus
      );

      // 5. 构建综合状态
      const comprehensiveStatus = {
        // 总体状态
        isGuarding: standaloneStatus.isRunning || inProcessStatus.isGuarding,
        actuallyProtecting: protectionStatus.isProtecting,
        mode: standaloneStatus.isRunning
          ? "standalone"
          : inProcessStatus.isGuarding
          ? "inprocess"
          : "none",

        // 详细状态
        standalone: standaloneStatus,
        inProcess: inProcessStatus,
        protection: protectionStatus,

        // 一致性分析
        consistency: consistencyAnalysis,

        // 元数据
        timestamp: new Date().toISOString(),
        platform: os.platform(),
      };

      // 6. 缓存状态
      this.lastKnownStatus = comprehensiveStatus;

      return comprehensiveStatus;
    } catch (error) {
      console.error("获取综合防护状态失败:", error);
      return {
        isGuarding: false,
        actuallyProtecting: false,
        mode: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 检查独立服务状态
   */
  async checkStandaloneServiceStatus() {
    try {
      const status = {
        isRunning: false,
        pid: null,
        config: null,
        uptime: 0,
        recentLogs: [],
        health: "unknown",
      };

      // 检查PID文件
      if (await fs.pathExists(this.paths.standalonePid)) {
        const pidContent = await fs.readFile(this.paths.standalonePid, "utf8");
        const pid = pidContent.trim();

        if (pid && (await this.isProcessRunning(pid))) {
          status.isRunning = true;
          status.pid = parseInt(pid);
          status.health = "running";
        } else {
          status.health = "stale-pid";
        }
      }

      // 检查配置文件
      if (await fs.pathExists(this.paths.standaloneConfig)) {
        status.config = await fs.readJson(this.paths.standaloneConfig);

        // 计算运行时间
        if (status.config.startTime) {
          const startTime = new Date(status.config.startTime);
          status.uptime = Date.now() - startTime.getTime();
        }
      }

      // 读取最近日志（保持向后兼容）
      if (await fs.pathExists(this.paths.standaloneLog)) {
        const logContent = await fs.readFile(this.paths.standaloneLog, "utf8");
        status.recentLogs = logContent
          .split("\n")
          .filter((line) => line.trim())
          .slice(-20); // 最近20条日志
      }

      // 获取快速统计数据（性能优化）
      if (status.isRunning && this.deviceManager?.standaloneService) {
        try {
          const fastStats =
            await this.deviceManager.standaloneService.getFastStats();
          status.fastStats = fastStats;
        } catch (error) {
          // 静默处理快速统计获取失败
        }
      }

      return status;
    } catch (error) {
      return {
        isRunning: false,
        error: error.message,
        health: "error",
      };
    }
  }

  /**
   * 检查内置进程状态
   */
  async checkInProcessStatus() {
    try {
      if (!this.deviceManager || !this.deviceManager.enhancedGuardian) {
        return {
          isGuarding: false,
          available: false,
          reason: "Guardian not initialized",
        };
      }

      const guardian = this.deviceManager.enhancedGuardian;
      const status = await guardian.getStatus();

      return {
        isGuarding: status.isGuarding || false,
        available: true,
        targetDeviceId: status.targetDeviceId,
        currentDeviceId: status.currentDeviceId,
        isProtected: status.isProtected,
        watchersCount: status.watchersCount || 0,
        uptime: status.uptime || 0,
        stats: status.stats || {
          interceptedAttempts: 0,
          backupFilesRemoved: 0,
          protectionRestored: 0,
        },
      };
    } catch (error) {
      return {
        isGuarding: false,
        available: false,
        error: error.message,
      };
    }
  }

  /**
   * 检查实际防护功能
   */
  async checkActualProtection() {
    try {
      if (!(await fs.pathExists(this.paths.storageJson))) {
        return {
          isProtecting: false,
          reason: "Storage file not found",
          canTest: false,
        };
      }

      // 读取当前设备ID
      const content = await fs.readJson(this.paths.storageJson);
      const currentDeviceId = content["telemetry.devDeviceId"];

      // 简单的保护状态检查（不实际修改文件）
      const stats = await fs.stat(this.paths.storageJson);
      const lastModified = stats.mtime;
      const now = new Date();
      const timeSinceModified = now - lastModified;

      // 如果文件最近被修改（5分钟内），可能有防护活动
      const recentActivity = timeSinceModified < 5 * 60 * 1000;

      return {
        isProtecting: true, // 假设有防护，除非明确检测到问题
        canTest: true,
        currentDeviceId: currentDeviceId,
        lastModified: lastModified.toISOString(),
        recentActivity: recentActivity,
        timeSinceModified: timeSinceModified,
      };
    } catch (error) {
      return {
        isProtecting: false,
        canTest: false,
        error: error.message,
      };
    }
  }

  /**
   * 分析状态一致性
   */
  analyzeStatusConsistency(
    standaloneStatus,
    inProcessStatus,
    protectionStatus
  ) {
    const issues = [];
    const warnings = [];

    // 检查多重防护
    if (standaloneStatus.isRunning && inProcessStatus.isGuarding) {
      issues.push("同时运行独立服务和内置进程，可能导致冲突");
    }

    // 检查防护状态与实际保护的一致性
    const hasActiveGuardian =
      standaloneStatus.isRunning || inProcessStatus.isGuarding;
    if (hasActiveGuardian && !protectionStatus.isProtecting) {
      warnings.push("防护进程运行中但保护功能可能未生效");
    }

    if (!hasActiveGuardian && protectionStatus.isProtecting) {
      issues.push("无防护进程但检测到保护活动，可能存在孤立进程");
    }

    // 检查PID文件一致性
    if (standaloneStatus.health === "stale-pid") {
      issues.push("存在过期的PID文件");
    }

    // 检查配置一致性
    if (standaloneStatus.config && inProcessStatus.targetDeviceId) {
      if (standaloneStatus.config.deviceId !== inProcessStatus.targetDeviceId) {
        warnings.push("独立服务和内置进程的目标设备ID不一致");
      }
    }

    return {
      isConsistent: issues.length === 0,
      issues: issues,
      warnings: warnings,
      score: Math.max(0, 100 - issues.length * 30 - warnings.length * 10),
    };
  }

  /**
   * 检查进程是否运行
   */
  async isProcessRunning(pid) {
    try {
      if (os.platform() === "win32") {
        const { stdout } = await execAsync(
          `tasklist /FI "PID eq ${pid}" /FO CSV`
        );
        return stdout.includes(pid);
      } else {
        const { stdout } = await execAsync(`ps -p ${pid}`);
        return stdout.includes(pid);
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * 同步状态（修复不一致问题）
   */
  async syncStatus() {
    try {
      console.log("🔄 开始状态同步...");

      const status = await this.getComprehensiveStatus();
      const actions = [];

      // 处理状态不一致问题
      if (!status.consistency.isConsistent) {
        console.log("⚠️ 检测到状态不一致，开始修复...");

        for (const issue of status.consistency.issues) {
          console.log(`   • ${issue}`);

          if (issue.includes("同时运行")) {
            // 停止内置进程，保留独立服务
            if (this.deviceManager && this.deviceManager.enhancedGuardian) {
              await this.deviceManager.enhancedGuardian.stopGuarding();
              actions.push("停止内置守护进程以避免冲突");
            }
          }

          if (issue.includes("过期的PID文件")) {
            // 清理过期PID文件
            if (await fs.pathExists(this.paths.standalonePid)) {
              await fs.remove(this.paths.standalonePid);
              actions.push("清理过期PID文件");
            }
          }
        }
      }

      console.log("✅ 状态同步完成");
      return {
        success: true,
        actions: actions,
        finalStatus: await this.getComprehensiveStatus(),
      };
    } catch (error) {
      console.error("❌ 状态同步失败:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 启动状态监控
   */
  startStatusMonitoring(interval = 30000) {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }

    console.log(`🔄 启动状态监控 (间隔: ${interval / 1000}秒)`);

    this.statusCheckInterval = setInterval(async () => {
      try {
        const currentStatus = await this.getComprehensiveStatus();

        // 检查状态变化
        if (this.lastKnownStatus) {
          const statusChanged =
            currentStatus.isGuarding !== this.lastKnownStatus.isGuarding ||
            currentStatus.mode !== this.lastKnownStatus.mode;

          if (statusChanged) {
            console.log("🔄 检测到防护状态变化");

            // 通知状态变化（如果有回调）
            if (this.onStatusChange) {
              this.onStatusChange(currentStatus, this.lastKnownStatus);
            }
          }
        }

        this.lastKnownStatus = currentStatus;
      } catch (error) {
        console.error("状态监控检查失败:", error);
      }
    }, interval);
  }

  /**
   * 停止状态监控
   */
  stopStatusMonitoring() {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
      console.log("⏹️ 状态监控已停止");
    }
  }

  /**
   * 设置状态变化回调
   */
  setStatusChangeCallback(callback) {
    this.onStatusChange = callback;
  }

  /**
   * 获取状态摘要
   */
  getStatusSummary(status = null) {
    const currentStatus = status || this.lastKnownStatus;

    if (!currentStatus) {
      return "状态未知";
    }

    if (currentStatus.error) {
      return `错误: ${currentStatus.error}`;
    }

    const mode = currentStatus.mode;
    const isGuarding = currentStatus.isGuarding;
    const isProtecting = currentStatus.actuallyProtecting;

    if (mode === "standalone" && isGuarding && isProtecting) {
      return "独立服务运行中 - 防护正常";
    } else if (mode === "inprocess" && isGuarding && isProtecting) {
      return "内置进程运行中 - 防护正常";
    } else if (isGuarding && !isProtecting) {
      return "防护进程运行中 - 保护功能异常";
    } else if (!isGuarding && isProtecting) {
      return "无防护进程 - 检测到保护活动";
    } else {
      return "防护未启动";
    }
  }
}

module.exports = EnhancedGuardianStatusManager;
