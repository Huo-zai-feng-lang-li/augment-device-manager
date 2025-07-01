const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const { EnhancedDeviceGuardian } = require("./enhanced-device-guardian");

/**
 * 独立守护服务
 * 可以在客户端关闭后继续运行的后台防护服务
 */

class StandaloneGuardianService {
  constructor() {
    this.serviceName = "augment-device-guardian";
    this.serviceProcess = null;
    this.configPath = path.join(os.tmpdir(), "augment-guardian-config.json");
    this.pidPath = path.join(os.tmpdir(), "augment-guardian.pid");
    this.logPath = path.join(os.tmpdir(), "augment-guardian.log");
  }

  /**
   * 启动独立守护服务
   */
  async startStandaloneService(deviceId, options = {}) {
    try {
      // 检查是否已经在运行
      if (await this.isServiceRunning()) {
        return { 
          success: false, 
          message: "守护服务已在运行",
          pid: await this.getServicePid()
        };
      }

      // 保存配置
      const config = {
        deviceId: deviceId,
        startTime: new Date().toISOString(),
        options: {
          enableBackupMonitoring: options.enableBackupMonitoring !== false,
          enableDatabaseMonitoring: options.enableDatabaseMonitoring !== false,
          enableEnhancedProtection: options.enableEnhancedProtection !== false,
          ...options
        }
      };

      await fs.writeJson(this.configPath, config, { spaces: 2 });

      // 启动独立进程
      const serviceScript = path.join(__dirname, "guardian-service-worker.js");
      
      // 创建服务工作进程
      await this.createServiceWorker();

      const child = spawn(process.execPath, [serviceScript, this.configPath], {
        detached: true,
        stdio: ['ignore', 'ignore', 'ignore'],
        windowsHide: true
      });

      // 保存PID
      await fs.writeFile(this.pidPath, child.pid.toString());

      // 分离进程，让它独立运行
      child.unref();

      // 等待一下确保服务启动
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 验证服务是否成功启动
      const isRunning = await this.isServiceRunning();
      
      if (isRunning) {
        return {
          success: true,
          message: "独立守护服务启动成功",
          pid: child.pid,
          configPath: this.configPath,
          logPath: this.logPath
        };
      } else {
        return {
          success: false,
          message: "守护服务启动失败"
        };
      }

    } catch (error) {
      return {
        success: false,
        message: `启动守护服务失败: ${error.message}`
      };
    }
  }

  /**
   * 停止独立守护服务
   */
  async stopStandaloneService() {
    try {
      const pid = await this.getServicePid();
      
      if (!pid) {
        return { success: true, message: "守护服务未运行" };
      }

      // 尝试优雅停止
      try {
        if (process.platform === 'win32') {
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          await execAsync(`taskkill /pid ${pid} /f`);
        } else {
          process.kill(pid, 'SIGTERM');
        }
      } catch (error) {
        // 如果优雅停止失败，强制停止
        if (process.platform === 'win32') {
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          await execAsync(`taskkill /pid ${pid} /f /t`);
        } else {
          process.kill(pid, 'SIGKILL');
        }
      }

      // 清理文件
      await this.cleanupServiceFiles();

      return {
        success: true,
        message: "守护服务已停止",
        pid: pid
      };

    } catch (error) {
      return {
        success: false,
        message: `停止守护服务失败: ${error.message}`
      };
    }
  }

  /**
   * 检查服务是否在运行
   */
  async isServiceRunning() {
    try {
      const pid = await this.getServicePid();
      if (!pid) return false;

      // 检查进程是否存在
      if (process.platform === 'win32') {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        try {
          const { stdout } = await execAsync(`tasklist /fi "PID eq ${pid}" /fo csv`);
          return stdout.includes(pid.toString());
        } catch (error) {
          return false;
        }
      } else {
        try {
          process.kill(pid, 0); // 发送信号0检查进程是否存在
          return true;
        } catch (error) {
          return false;
        }
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取服务PID
   */
  async getServicePid() {
    try {
      if (!(await fs.pathExists(this.pidPath))) return null;
      const pidStr = await fs.readFile(this.pidPath, 'utf8');
      return parseInt(pidStr.trim());
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus() {
    try {
      const isRunning = await this.isServiceRunning();
      const pid = await this.getServicePid();
      
      let config = null;
      if (await fs.pathExists(this.configPath)) {
        config = await fs.readJson(this.configPath);
      }

      let logs = [];
      if (await fs.pathExists(this.logPath)) {
        const logContent = await fs.readFile(this.logPath, 'utf8');
        logs = logContent.split('\n').filter(line => line.trim()).slice(-10);
      }

      return {
        isRunning: isRunning,
        pid: pid,
        config: config,
        recentLogs: logs,
        configPath: this.configPath,
        logPath: this.logPath,
        pidPath: this.pidPath
      };

    } catch (error) {
      return {
        isRunning: false,
        error: error.message
      };
    }
  }

  /**
   * 创建服务工作进程脚本
   */
  async createServiceWorker() {
    const workerScript = `
const fs = require("fs-extra");
const path = require("path");
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
      this.log(\`🎯 目标设备ID: \${config.deviceId}\`);

      // 启动增强守护进程
      const result = await this.guardian.startGuarding(config.deviceId, config.options);
      
      if (result.success) {
        this.log("✅ 增强守护进程启动成功");
        
        // 设置进程退出处理
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
        process.on('exit', () => this.shutdown());

        // 保持进程运行
        setInterval(() => {
          // 心跳检查
        }, 30000);

      } else {
        this.log(\`❌ 守护进程启动失败: \${result.message}\`);
        process.exit(1);
      }

    } catch (error) {
      this.log(\`❌ 服务启动失败: \${error.message}\`);
      process.exit(1);
    }
  }

  async shutdown() {
    try {
      this.log("🛑 正在停止守护服务...");
      await this.guardian.stopGuarding();
      this.log("✅ 守护服务已停止");
    } catch (error) {
      this.log(\`❌ 停止服务失败: \${error.message}\`);
    }
    process.exit(0);
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = \`[\${timestamp}] \${message}\\n\`;
    
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
`;

    const workerPath = path.join(__dirname, "guardian-service-worker.js");
    await fs.writeFile(workerPath, workerScript);
  }

  /**
   * 清理服务文件
   */
  async cleanupServiceFiles() {
    const filesToClean = [this.pidPath, this.configPath];
    
    for (const file of filesToClean) {
      try {
        if (await fs.pathExists(file)) {
          await fs.remove(file);
        }
      } catch (error) {
        // 忽略清理错误
      }
    }
  }

  /**
   * 重启服务
   */
  async restartService() {
    const status = await this.getServiceStatus();
    
    if (status.isRunning) {
      await this.stopStandaloneService();
      // 等待进程完全停止
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (status.config) {
      return await this.startStandaloneService(
        status.config.deviceId, 
        status.config.options
      );
    } else {
      return {
        success: false,
        message: "无法重启：缺少配置信息"
      };
    }
  }
}

module.exports = { StandaloneGuardianService };
