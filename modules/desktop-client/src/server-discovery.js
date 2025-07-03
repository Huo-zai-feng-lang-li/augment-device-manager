// 服务器地址自动发现
const fetch = require("node-fetch");

class ServerDiscovery {
  constructor(serverConfig = null) {
    this.serverConfig = serverConfig;

    // 可能的服务器地址列表
    this.candidates = [
      // 从环境变量读取
      process.env.AUGMENT_SERVER_URL,
      // 本地开发地址
      "http://127.0.0.1:3002",
      "http://localhost:3002",
    ].filter(Boolean); // 过滤掉空值

    // 从配置文件加载候选地址
    this.loadCandidatesFromConfig();

    // 异步添加ngrok地址检测（不阻塞构造函数）
    this.addNgrokCandidates().catch(() => {
      // 忽略错误，不影响基本功能
    });
  }

  // 从配置文件加载候选地址
  loadCandidatesFromConfig() {
    try {
      if (this.serverConfig) {
        const config = this.serverConfig.getConfig();

        // 添加当前配置的服务器
        const currentUrl = this.serverConfig.getHttpUrl();
        this.addCandidate(currentUrl);

        // 从配置中读取候选服务器列表
        if (
          config.client &&
          config.client.serverDiscovery &&
          config.client.serverDiscovery.candidates
        ) {
          config.client.serverDiscovery.candidates.forEach((url) => {
            this.addCandidate(url);
          });
        }
      }
    } catch (error) {
      console.log("从配置加载候选地址失败:", error.message);
    }
  }

  // 测试单个地址连接
  async testConnection(url, timeout = 3000) {
    try {
      console.log(`🔍 正在测试服务器: ${url}`);
      const response = await fetch(`${url}/api/health`, {
        method: "GET",
        timeout: timeout,
        headers: {
          "User-Agent": "Augment-Client-Discovery",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const isHealthy = data.status === "ok";
        if (isHealthy) {
          console.log(`✅ 服务器响应正常: ${url}`);
        } else {
          console.log(`⚠️ 服务器状态异常: ${url} (状态: ${data.status})`);
        }
        return isHealthy;
      } else {
        console.log(`❌ 服务器响应错误: ${url} (HTTP ${response.status})`);
        return false;
      }
    } catch (error) {
      // 提供更友好的错误提示
      const friendlyMessage = this.getFriendlyConnectionError(url, error);
      console.log(friendlyMessage);
      return false;
    }
  }

  // 获取友好的连接错误信息
  getFriendlyConnectionError(url, error) {
    const urlObj = new URL(url);

    if (error.code === "ECONNREFUSED") {
      return `
❌ 无法连接到 ${url}
   └─ 原因: 服务器未启动或端口 ${urlObj.port} 被占用
`;
    }

    if (error.code === "ENOTFOUND") {
      return `
❌ 域名解析失败 ${url}
   └─ 原因: 无法解析域名 ${urlObj.hostname}
`;
    }

    if (error.code === "ETIMEDOUT" || error.message.includes("timeout")) {
      return `
❌ 连接超时 ${url}
   └─ 原因: 网络延迟过高或服务器响应缓慢
`;
    }

    if (error.message.includes("fetch failed")) {
      return `
❌ 网络请求失败 ${url}
   └─ 原因: 网络连接问题或服务器不可达
`;
    }

    return `
❌ 连接异常 ${url}
   └─ 详情: ${error.message}
`;
  }

  // 从URL提取主机信息
  parseServerUrl(url) {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        protocol: parsed.protocol.replace(":", ""),
      };
    } catch (error) {
      console.error("解析URL失败:", error);
      return null;
    }
  }

  // 自动发现可用的服务器
  async discoverServer() {
    console.log("🔍 开始自动发现服务器...");

    // 并行测试所有候选地址
    const testPromises = this.candidates.map(async (url) => {
      const isAvailable = await this.testConnection(url);
      return { url, isAvailable };
    });

    try {
      const results = await Promise.all(testPromises);

      // 找到第一个可用的服务器
      for (const result of results) {
        if (result.isAvailable) {
          console.log(`✅ 发现可用服务器: ${result.url}`);
          return result.url;
        }
      }

      console.log("❌ 未发现可用的服务器");
      return null;
    } catch (error) {
      console.error("服务器发现过程出错:", error);
      return null;
    }
  }

  // 从已知地址列表中添加新地址
  addCandidate(url) {
    if (url && !this.candidates.includes(url)) {
      this.candidates.unshift(url); // 添加到开头，优先测试
      console.log(`添加候选服务器: ${url}`);
    }
  }

  // 添加ngrok候选地址
  async addNgrokCandidates() {
    try {
      // 1. 尝试从本地ngrok API获取地址
      const ngrokUrl = await this.getNgrokUrl();
      if (ngrokUrl) {
        this.addCandidate(`https://${ngrokUrl}`);
        this.addCandidate(`http://${ngrokUrl}`);
      }

      // 2. 尝试从服务器信息文件读取
      const serverInfoUrl = await this.getServerInfoUrl();
      if (serverInfoUrl) {
        this.addCandidate(serverInfoUrl);
      }
    } catch (error) {
      console.log("添加ngrok候选地址失败:", error.message);
    }
  }

  // 从ngrok API获取地址
  async getNgrokUrl() {
    try {
      const response = await fetch("http://localhost:4040/api/tunnels", {
        timeout: 2000,
      });
      const data = await response.json();
      const httpsTunnel = data.tunnels.find((t) => t.proto === "https");
      if (httpsTunnel) {
        const url = new URL(httpsTunnel.public_url);
        return url.hostname;
      }
    } catch (error) {
      // ngrok API不可用，忽略
    }
    return null;
  }

  // 从服务器信息文件获取地址
  async getServerInfoUrl() {
    try {
      const path = require("path");
      const fs = require("fs-extra");

      // 尝试多个可能的路径
      const possiblePaths = [
        path.join(process.cwd(), "server-info.json"),
        path.join(process.cwd(), "../../server-info.json"),
        path.join(__dirname, "../../../server-info.json"),
      ];

      for (const filePath of possiblePaths) {
        if (await fs.pathExists(filePath)) {
          const serverInfo = await fs.readJson(filePath);
          if (serverInfo.managementUrl) {
            return serverInfo.managementUrl;
          }
        }
      }
    } catch (error) {
      // 服务器信息文件不可用，忽略
    }
    return null;
  }

  // 从配置文件或其他来源加载候选地址
  async loadCandidatesFromConfig() {
    try {
      // 可以从配置文件、注册表、或远程API加载
      // 这里预留接口，后续可以扩展
      const additionalUrls = [
        // 从配置文件读取
        // 从注册表读取
        // 从远程API读取
      ];

      additionalUrls.forEach((url) => this.addCandidate(url));
    } catch (error) {
      console.log("加载额外候选地址失败:", error.message);
    }
  }

  // 验证并更新服务器配置
  async updateServerConfig(serverConfig) {
    const serverUrl = await this.discoverServer();

    if (serverUrl) {
      const serverInfo = this.parseServerUrl(serverUrl);
      if (serverInfo) {
        console.log("🔄 更新服务器配置:", serverInfo);
        await serverConfig.updateServerConfig(
          serverInfo.host,
          serverInfo.port,
          serverInfo.protocol
        );
        return true;
      }
    }

    return false;
  }
}

module.exports = ServerDiscovery;
