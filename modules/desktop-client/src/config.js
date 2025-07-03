// 服务器配置管理
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 智能默认配置 - 根据环境自动选择
function getDefaultConfig() {
  // 检查是否存在打包标记文件
  const isPackaged =
    fs.pathExistsSync(path.join(__dirname, "../.packaged")) ||
    process.env.NODE_ENV === "production";

  // 检查是否在开发环境
  const isDevelopment =
    !isPackaged &&
    (process.env.NODE_ENV === "development" ||
      !process.env.NODE_ENV ||
      process.cwd().includes("augment-device-manager"));

  if (isDevelopment) {
    // 开发环境：优先使用本地服务器
    return {
      server: {
        host: "localhost",
        port: 3002,
        protocol: "http",
      },
      client: {
        autoConnect: true,
        verifyInterval: 5 * 60 * 1000,
        reconnectDelay: 5000,
      },
    };
  } else {
    // 生产环境：使用预设的ngrok地址（打包时会被替换）
    return {
      server: {
        host: "9abf-2409-8a00-6033-ad40-90ab-e159-bca9-417.ngrok-free.app",
        port: 443,
        protocol: "https",
      },
      client: {
        autoConnect: true,
        verifyInterval: 5 * 60 * 1000,
        reconnectDelay: 5000,
      },
    };
  }
}

const DEFAULT_CONFIG = getDefaultConfig();

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

    // 尝试从注册表读取配置（Windows）
    if (process.platform === "win32") {
      this.loadFromRegistry();
    }

    // 尝试从内置配置恢复
    this.loadFromEmbeddedConfig();

    // 尝试从全局配置文件读取
    this.loadFromGlobalConfig();
  }

  // 从Windows注册表读取配置
  loadFromRegistry() {
    try {
      const { execSync } = require("child_process");

      try {
        const hostResult = execSync(
          'reg query "HKEY_CURRENT_USER\\Software\\AugmentDeviceManager" /v ServerHost 2>nul',
          { encoding: "utf8" }
        );
        const hostMatch = hostResult.match(/ServerHost\s+REG_SZ\s+(.+)/);
        if (hostMatch) {
          this.config.server.host = hostMatch[1].trim();
        }
      } catch (e) {}

      try {
        const portResult = execSync(
          'reg query "HKEY_CURRENT_USER\\Software\\AugmentDeviceManager" /v ServerPort 2>nul',
          { encoding: "utf8" }
        );
        const portMatch = portResult.match(
          /ServerPort\s+REG_DWORD\s+0x([0-9a-fA-F]+)/
        );
        if (portMatch) {
          this.config.server.port = parseInt(portMatch[1], 16);
        }
      } catch (e) {}

      try {
        const protocolResult = execSync(
          'reg query "HKEY_CURRENT_USER\\Software\\AugmentDeviceManager" /v ServerProtocol 2>nul',
          { encoding: "utf8" }
        );
        const protocolMatch = protocolResult.match(
          /ServerProtocol\s+REG_SZ\s+(.+)/
        );
        if (protocolMatch) {
          this.config.server.protocol = protocolMatch[1].trim();
        }
      } catch (e) {}
    } catch (error) {
      // 忽略注册表读取错误
    }
  }

  // 从内置配置恢复（智能模式）
  loadFromEmbeddedConfig() {
    try {
      // 检查是否在开发环境
      const isDevelopment =
        process.env.NODE_ENV === "development" ||
        !process.env.NODE_ENV ||
        process.cwd().includes("augment-device-manager");

      const embeddedPaths = [
        path.join(__dirname, "../public/server-config.json"),
        path.join(__dirname, "embedded-config.json"),
        path.join(process.cwd(), "server-config.json"),
        path.join(process.cwd(), "resources", "server-config.json"),
      ];

      for (const configPath of embeddedPaths) {
        if (fs.pathExistsSync(configPath)) {
          const embeddedConfig = fs.readJsonSync(configPath);
          if (embeddedConfig.server) {
            // 智能覆盖逻辑
            const shouldOverride = this.shouldOverrideWithEmbedded(
              embeddedConfig,
              isDevelopment
            );

            if (shouldOverride) {
              this.config.server = {
                ...this.config.server,
                ...embeddedConfig.server,
              };
              console.log(`已从内置配置恢复服务器设置: ${configPath}`);
              return true;
            }
          }
        }
      }
    } catch (error) {
      // 忽略内置配置读取错误
    }
    return false;
  }

  // 判断是否应该使用内置配置覆盖默认配置
  shouldOverrideWithEmbedded(embeddedConfig, isDevelopment) {
    // 如果内置配置包含ngrok地址，说明是打包后的配置，应该使用
    if (
      embeddedConfig.server.host &&
      embeddedConfig.server.host.includes("ngrok")
    ) {
      return true;
    }

    // 如果在开发环境且内置配置是localhost，可以使用
    if (isDevelopment && embeddedConfig.server.host === "localhost") {
      return true;
    }

    // 如果内置配置有注释说明这是开发配置，且当前在开发环境，可以使用
    if (
      isDevelopment &&
      embeddedConfig._comment &&
      embeddedConfig._comment.includes("开发环境")
    ) {
      return true;
    }

    // 其他情况不覆盖，使用智能默认配置
    return false;
  }

  // 从全局配置文件读取
  loadFromGlobalConfig() {
    try {
      const globalConfigPaths = [
        path.join(
          process.env.PROGRAMDATA || "C:\\ProgramData",
          "AugmentDeviceManager",
          "server-config.json"
        ),
        path.join(
          os.homedir(),
          "Documents",
          "AugmentDeviceManager",
          "server-config.json"
        ),
        path.join(process.cwd(), "server-config.json"),
      ];

      for (const configPath of globalConfigPaths) {
        if (fs.pathExistsSync(configPath)) {
          const globalConfig = fs.readJsonSync(configPath);
          if (globalConfig.server) {
            this.config.server = {
              ...this.config.server,
              ...globalConfig.server,
            };
            console.log(`已从全局配置加载服务器设置: ${configPath}`);
            break;
          }
        }
      }
    } catch (error) {
      // 忽略全局配置读取错误
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
      // 提供更友好的中文错误提示
      const friendlyError = this.getFriendlyErrorMessage(error);
      console.error("🔌 服务器连接失败:", friendlyError);
      return false;
    }
  }

  // 获取友好的错误提示信息
  getFriendlyErrorMessage(error) {
    const serverUrl = this.getHttpUrl();

    if (error.code === "ECONNREFUSED") {
      return `
无法连接到服务器 ${serverUrl}

🔍 可能的原因：
  • 服务器未启动 - 请确认后端服务正在运行
  • 端口被占用或防火墙阻止 - 检查端口 ${this.config.server.port} 是否可用
  • 服务器地址配置错误 - 当前配置: ${this.config.server.host}:${this.config.server.port}

💡 解决建议：
  • 检查后端服务是否正常启动
  • 尝试访问 ${serverUrl} 确认服务器状态
  • 如果是开发环境，确保运行了 npm run dev
`;
    }

    if (error.code === "ENOTFOUND") {
      return `
域名解析失败 ${this.config.server.host}

🔍 可能的原因：
  • 域名不存在或DNS解析失败
  • 网络连接问题
  • 服务器地址配置错误

💡 解决建议：
  • 检查网络连接是否正常
  • 确认服务器地址是否正确
  • 尝试使用IP地址代替域名
`;
    }

    if (error.code === "ETIMEDOUT" || error.message.includes("timeout")) {
      return `
连接超时 ${serverUrl}

🔍 可能的原因：
  • 网络延迟过高
  • 服务器响应缓慢
  • 防火墙或代理阻止连接

💡 解决建议：
  • 检查网络连接质量
  • 稍后重试连接
  • 联系网络管理员检查防火墙设置
`;
    }

    if (error.message.includes("fetch failed")) {
      return `
网络请求失败 ${serverUrl}

🔍 可能的原因：
  • 网络连接中断
  • 服务器暂时不可用
  • SSL/TLS证书问题（HTTPS连接）

💡 解决建议：
  • 检查网络连接状态
  • 确认服务器是否正常运行
  • 如果使用HTTPS，检查证书是否有效
`;
    }

    // 默认错误信息
    return `
连接异常 ${serverUrl}

🔍 错误详情：${error.message}

💡 解决建议：
  • 检查网络连接
  • 确认服务器配置
  • 查看详细日志获取更多信息
`;
  }
}

// 导出单例
const serverConfig = new ServerConfig();
module.exports = serverConfig;
