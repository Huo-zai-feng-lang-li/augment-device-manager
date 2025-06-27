// 服务器配置管理
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 默认配置
const DEFAULT_CONFIG = {
  server: {
    host: "abc123-demo.ngrok.io", // 预设服务器地址
    port: 443, // 预设端口
    protocol: "https", // 预设协议
  },
  client: {
    autoConnect: true,
    verifyInterval: 5 * 60 * 1000, // 5分钟
    reconnectDelay: 5000, // 5秒
  },
};

// 配置文件路径
const CONFIG_DIR = path.join(os.homedir(), ".augment-device-manager");
const CONFIG_FILE = path.join(CONFIG_DIR, "server-config.json");

class ServerConfig {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.loadConfigSync();
  }

  // 同步加载配置
  loadConfigSync() {
    try {
      // 确保配置目录存在
      fs.ensureDirSync(CONFIG_DIR);

      // 检查配置文件是否存在
      if (fs.pathExistsSync(CONFIG_FILE)) {
        const savedConfig = fs.readJsonSync(CONFIG_FILE);

        // 检查是否是无效的ngrok配置，如果是则重置
        if (
          savedConfig.server &&
          savedConfig.server.host &&
          savedConfig.server.host.includes("ngrok.io") &&
          savedConfig.server.host.includes("abc123")
        ) {
          console.log("检测到无效的ngrok配置，重置为默认配置");
          this.config = { ...DEFAULT_CONFIG };
          this.saveConfigSync();
        } else {
          this.config = { ...DEFAULT_CONFIG, ...savedConfig };
        }
      } else {
        // 创建默认配置文件
        this.saveConfigSync();
      }

      // 从环境变量覆盖配置
      this.loadFromEnv();
    } catch (error) {
      console.error("加载服务器配置失败:", error);
    }
  }

  // 异步加载配置（保留向后兼容）
  async loadConfig() {
    this.loadConfigSync();
  }

  // 从环境变量加载配置
  loadFromEnv() {
    if (process.env.AUGMENT_SERVER_HOST) {
      this.config.server.host = process.env.AUGMENT_SERVER_HOST;
    }
    if (process.env.AUGMENT_SERVER_PORT) {
      this.config.server.port = parseInt(process.env.AUGMENT_SERVER_PORT);
    }
    if (process.env.AUGMENT_SERVER_PROTOCOL) {
      this.config.server.protocol = process.env.AUGMENT_SERVER_PROTOCOL;
    }
  }

  // 同步保存配置
  saveConfigSync() {
    try {
      fs.writeJsonSync(CONFIG_FILE, this.config, { spaces: 2 });
    } catch (error) {
      console.error("保存服务器配置失败:", error);
    }
  }

  // 异步保存配置（保留向后兼容）
  async saveConfig() {
    this.saveConfigSync();
  }

  // 更新服务器配置
  async updateServerConfig(host, port, protocol = "http") {
    this.config.server.host = host;
    this.config.server.port = port;
    this.config.server.protocol = protocol;
    await this.saveConfig();
  }

  // 获取HTTP URL
  getHttpUrl(path = "") {
    const { host, port, protocol } = this.config.server;
    return `${protocol}://${host}:${port}${path}`;
  }

  // 获取WebSocket URL
  getWebSocketUrl(path = "/ws") {
    const { host, port } = this.config.server;
    const wsProtocol = this.config.server.protocol === "https" ? "wss" : "ws";
    return `${wsProtocol}://${host}:${port}${path}`;
  }

  // 获取配置
  getConfig() {
    return { ...this.config };
  }

  // 测试服务器连接
  async testConnection() {
    try {
      const response = await fetch(this.getHttpUrl("/api/health"), {
        method: "GET",
        timeout: 5000,
      });
      return response.ok;
    } catch (error) {
      console.error("服务器连接测试失败:", error);
      return false;
    }
  }
}

// 导出单例
const serverConfig = new ServerConfig();
module.exports = serverConfig;
