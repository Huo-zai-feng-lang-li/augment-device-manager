
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
      this.log(`🎯 目标设备ID: ${config.deviceId}`);

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
        this.log(`❌ 守护进程启动失败: ${result.message}`);
        process.exit(1);
      }

    } catch (error) {
      this.log(`❌ 服务启动失败: ${error.message}`);
      process.exit(1);
    }
  }

  async shutdown() {
    try {
      this.log("🛑 正在停止守护服务...");
      await this.guardian.stopGuarding();
      this.log("✅ 守护服务已停止");
    } catch (error) {
      this.log(`❌ 停止服务失败: ${error.message}`);
    }
    process.exit(0);
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
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
