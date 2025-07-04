
const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { EnhancedDeviceGuardian } = require("./enhanced-device-guardian");

// 服务工作进程
class GuardianServiceWorker {
  constructor(configPath) {
    this.configPath = configPath;
    this.guardian = new EnhancedDeviceGuardian();
    this.logPath = path.join(require("os").tmpdir(), "augment-guardian.log");
  }

  async start() {
    try {
      // 读取配置
      const config = await fs.readJson(this.configPath);

      this.log("🛡️ 独立守护服务启动");
      this.log(`🎯 目标设备ID: ${config.deviceId}`);

      // 设置增强守护进程的事件回调，将事件记录到日志
      this.guardian.setEventCallback((eventType, data) => {
        if (eventType === "intercept-success") {
          this.log("🚨 拦截IDE临时文件修改");
          this.log(`⚠️ 检测到设备ID被修改: ${data.interceptedId || '未知'}`);
          this.log(`✅ 已拦截并恢复目标设备ID: ${data.targetDeviceId || '未知'}`);
        } else if (eventType === "protection-restored") {
          this.log("🛡️ 保护恢复事件");
          this.log(`🔒 设备ID已恢复: ${data.targetDeviceId || '未知'}`);
        } else if (eventType === "backup-removed") {
          this.log("🗑️ 删除备份文件");
          this.log(`🧹 已删除备份文件: ${data.filePath || '未知'}`);
        }
      });

      // 启动增强守护进程
      const result = await this.guardian.startGuarding(config.deviceId, config.options);

      if (result.success) {
        this.log("✅ 增强守护进程启动成功");

        // 设置进程退出处理
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
        process.on('exit', () => this.shutdown());

        // 保持进程运行并进行激活状态检查
        setInterval(async () => {
          // 心跳检查和激活状态验证
          try {
            const isActivated = await this.checkActivationStatus();
            if (!isActivated) {
              this.log("🚨 检测到激活状态失效，自动退出独立守护服务");
              await this.shutdown();
            }
          } catch (error) {
            this.log('激活状态检查失败: ' + error.message);
          }
        }, 60000); // 60秒间隔

      } else {
        this.log('守护进程启动失败: ' + result.message);
        process.exit(1);
      }

    } catch (error) {
      this.log('服务启动失败: ' + error.message);
      process.exit(1);
    }
  }

  /**
   * 检查激活状态
   */
  async checkActivationStatus() {
    try {
      const configPath = path.join(os.homedir(), '.augment-device-manager', 'config.json');

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
      this.log('检查激活状态失败: ' + error.message);
      return false;
    }
  }

  async shutdown() {
    try {
      this.log("🛑 正在停止守护服务...");
      await this.guardian.stopGuarding();
      this.log("✅ 守护服务已停止");
    } catch (error) {
      this.log('停止服务失败: ' + error.message);
    }
    process.exit(0);
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = '[' + timestamp + '] ' + message + '\n';

    console.log(message);

    // 异步写入日志文件
    fs.appendFile(this.logPath, logEntry).catch(() => {});
  }
}

// 启动服务
if (process.argv.length > 2) {
  const configPath = process.argv[2];
  const worker = new GuardianServiceWorker(configPath);
  worker.start();
} else {
  console.error("缺少配置文件路径参数");
  process.exit(1);
}
