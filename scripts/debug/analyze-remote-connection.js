#!/usr/bin/env node

/**
 * 远程服务器连接问题分析工具
 * 全面诊断server:start脚本的连接问题
 */

const fs = require("fs-extra");
const path = require("path");
const { spawn, execSync } = require("child_process");
const fetch = require("node-fetch");

console.log("🔍 远程服务器连接问题分析工具");
console.log("=" .repeat(60));

class RemoteConnectionAnalyzer {
  constructor() {
    this.results = {
      environment: {},
      ngrok: {},
      backend: {},
      client: {},
      network: {},
      issues: [],
      recommendations: []
    };
  }

  async analyze() {
    console.log("\n📋 开始全面分析...");
    
    try {
      await this.analyzeEnvironment();
      await this.analyzeNgrok();
      await this.analyzeBackend();
      await this.analyzeClientConfig();
      await this.analyzeNetwork();
      
      this.generateReport();
    } catch (error) {
      console.error("❌ 分析过程中出现错误:", error.message);
    }
  }

  // 分析环境配置
  async analyzeEnvironment() {
    console.log("\n🖥️ 分析环境配置...");
    
    const env = this.results.environment;
    
    // 检查Node.js版本
    try {
      env.nodeVersion = process.version;
      console.log(`  ✅ Node.js版本: ${env.nodeVersion}`);
    } catch (error) {
      env.nodeVersion = "未知";
      this.results.issues.push("无法获取Node.js版本");
    }

    // 检查操作系统
    env.platform = process.platform;
    env.arch = process.arch;
    console.log(`  ✅ 操作系统: ${env.platform} ${env.arch}`);

    // 检查工作目录
    env.cwd = process.cwd();
    console.log(`  ✅ 工作目录: ${env.cwd}`);

    // 检查package.json
    const packagePath = path.join(process.cwd(), "package.json");
    if (await fs.pathExists(packagePath)) {
      env.packageExists = true;
      const pkg = await fs.readJson(packagePath);
      env.serverStartScript = pkg.scripts?.["server:start"];
      console.log(`  ✅ package.json存在`);
      console.log(`  📜 server:start脚本: ${env.serverStartScript}`);
    } else {
      env.packageExists = false;
      this.results.issues.push("package.json文件不存在");
    }
  }

  // 分析ngrok配置
  async analyzeNgrok() {
    console.log("\n🔗 分析ngrok配置...");
    
    const ngrok = this.results.ngrok;

    // 检查本地ngrok.exe
    const localNgrokPath = path.join(process.cwd(), "tools", "ngrok.exe");
    if (await fs.pathExists(localNgrokPath)) {
      ngrok.localExists = true;
      console.log(`  ✅ 本地ngrok.exe存在: ${localNgrokPath}`);
      
      // 检查文件大小
      try {
        const stats = await fs.stat(localNgrokPath);
        ngrok.fileSize = stats.size;
        console.log(`  📏 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        if (stats.size < 1024 * 1024) {
          this.results.issues.push("ngrok.exe文件大小异常，可能损坏");
        }
      } catch (error) {
        this.results.issues.push("无法读取ngrok.exe文件信息");
      }
    } else {
      ngrok.localExists = false;
      this.results.issues.push("本地ngrok.exe不存在");
    }

    // 检查全局ngrok
    try {
      const version = execSync("ngrok version", { encoding: "utf8", stdio: "pipe" });
      ngrok.globalExists = true;
      ngrok.globalVersion = version.trim();
      console.log(`  ✅ 全局ngrok存在: ${ngrok.globalVersion}`);
    } catch (error) {
      ngrok.globalExists = false;
      console.log(`  ❌ 全局ngrok不存在`);
    }

    // 检查ngrok配置文件
    const ngrokConfigPath = path.join(require("os").homedir(), ".ngrok2", "ngrok.yml");
    if (await fs.pathExists(ngrokConfigPath)) {
      ngrok.configExists = true;
      console.log(`  ✅ ngrok配置文件存在`);
    } else {
      ngrok.configExists = false;
      this.results.issues.push("ngrok配置文件不存在，可能未设置认证令牌");
    }

    // 检查ngrok API是否可用
    try {
      const response = await fetch("http://localhost:4040/api/tunnels", { timeout: 3000 });
      if (response.ok) {
        const data = await response.json();
        ngrok.apiAvailable = true;
        ngrok.activeTunnels = data.tunnels?.length || 0;
        console.log(`  ✅ ngrok API可用，活跃隧道: ${ngrok.activeTunnels}`);
        
        if (data.tunnels && data.tunnels.length > 0) {
          ngrok.tunnelUrls = data.tunnels.map(t => t.public_url);
          console.log(`  🌐 隧道地址: ${ngrok.tunnelUrls.join(", ")}`);
        }
      } else {
        ngrok.apiAvailable = false;
      }
    } catch (error) {
      ngrok.apiAvailable = false;
      console.log(`  ❌ ngrok API不可用: ${error.message}`);
    }
  }

  // 分析后端服务
  async analyzeBackend() {
    console.log("\n🌐 分析后端服务...");
    
    const backend = this.results.backend;

    // 检查后端目录
    const backendPath = path.join(process.cwd(), "modules", "admin-backend");
    if (await fs.pathExists(backendPath)) {
      backend.directoryExists = true;
      console.log(`  ✅ 后端目录存在: ${backendPath}`);

      // 检查package.json
      const backendPackagePath = path.join(backendPath, "package.json");
      if (await fs.pathExists(backendPackagePath)) {
        const pkg = await fs.readJson(backendPackagePath);
        backend.packageExists = true;
        backend.devScript = pkg.scripts?.dev;
        console.log(`  ✅ 后端package.json存在`);
        console.log(`  📜 dev脚本: ${backend.devScript}`);
      } else {
        backend.packageExists = false;
        this.results.issues.push("后端package.json不存在");
      }

      // 检查主要文件
      const serverFile = path.join(backendPath, "src", "server-simple.js");
      if (await fs.pathExists(serverFile)) {
        backend.serverFileExists = true;
        console.log(`  ✅ 服务器文件存在: server-simple.js`);
      } else {
        backend.serverFileExists = false;
        this.results.issues.push("后端服务器文件不存在");
      }
    } else {
      backend.directoryExists = false;
      this.results.issues.push("后端目录不存在");
    }

    // 检查端口占用
    try {
      if (process.platform === "win32") {
        const result = execSync("netstat -ano | findstr :3002", { encoding: "utf8", stdio: "pipe" });
        if (result.trim()) {
          backend.portOccupied = true;
          console.log(`  ⚠️ 端口3002被占用`);
          
          // 提取占用进程信息
          const lines = result.trim().split("\n");
          backend.occupyingProcesses = lines.map(line => {
            const parts = line.trim().split(/\s+/);
            return parts.length >= 5 ? parts[4] : "未知";
          });
        } else {
          backend.portOccupied = false;
          console.log(`  ✅ 端口3002可用`);
        }
      }
    } catch (error) {
      backend.portOccupied = false;
      console.log(`  ✅ 端口3002可用`);
    }

    // 测试后端连接
    try {
      const response = await fetch("http://localhost:3002/api/health", { timeout: 3000 });
      if (response.ok) {
        backend.serviceRunning = true;
        console.log(`  ✅ 后端服务正在运行`);
      } else {
        backend.serviceRunning = false;
        console.log(`  ❌ 后端服务响应异常: ${response.status}`);
      }
    } catch (error) {
      backend.serviceRunning = false;
      console.log(`  ❌ 后端服务未运行: ${error.message}`);
    }
  }

  // 分析客户端配置
  async analyzeClientConfig() {
    console.log("\n📱 分析客户端配置...");
    
    const client = this.results.client;

    // 检查客户端目录
    const clientPath = path.join(process.cwd(), "modules", "desktop-client");
    if (await fs.pathExists(clientPath)) {
      client.directoryExists = true;
      console.log(`  ✅ 客户端目录存在: ${clientPath}`);

      // 检查配置文件
      const configPath = path.join(clientPath, "src", "config.js");
      if (await fs.pathExists(configPath)) {
        client.configExists = true;
        console.log(`  ✅ 配置文件存在: config.js`);

        // 分析配置内容
        try {
          const configContent = await fs.readFile(configPath, "utf8");
          
          // 提取生产环境配置
          const prodHostMatch = configContent.match(/host: "([^"]+)"/);
          const prodPortMatch = configContent.match(/port: (\d+)/);
          const prodProtocolMatch = configContent.match(/protocol: "([^"]+)"/);
          
          if (prodHostMatch) {
            client.prodHost = prodHostMatch[1];
            console.log(`  🌐 生产环境主机: ${client.prodHost}`);
            
            if (client.prodHost.includes("ngrok")) {
              client.usesNgrok = true;
              console.log(`  ✅ 配置使用ngrok地址`);
            } else {
              client.usesNgrok = false;
            }
          }
          
          if (prodPortMatch) {
            client.prodPort = parseInt(prodPortMatch[1]);
            console.log(`  🔌 生产环境端口: ${client.prodPort}`);
          }
          
          if (prodProtocolMatch) {
            client.prodProtocol = prodProtocolMatch[1];
            console.log(`  🔒 生产环境协议: ${client.prodProtocol}`);
          }
        } catch (error) {
          this.results.issues.push("无法解析客户端配置文件");
        }
      } else {
        client.configExists = false;
        this.results.issues.push("客户端配置文件不存在");
      }
    } else {
      client.directoryExists = false;
      this.results.issues.push("客户端目录不存在");
    }
  }

  // 分析网络连接
  async analyzeNetwork() {
    console.log("\n🌐 分析网络连接...");
    
    const network = this.results.network;

    // 测试本地连接
    try {
      const response = await fetch("http://localhost:3002", { timeout: 3000 });
      network.localConnection = response.ok;
      console.log(`  ${network.localConnection ? "✅" : "❌"} 本地连接测试`);
    } catch (error) {
      network.localConnection = false;
      console.log(`  ❌ 本地连接失败: ${error.message}`);
    }

    // 测试外网连接
    try {
      const response = await fetch("https://www.google.com", { timeout: 5000 });
      network.internetConnection = response.ok;
      console.log(`  ${network.internetConnection ? "✅" : "❌"} 外网连接测试`);
    } catch (error) {
      network.internetConnection = false;
      console.log(`  ❌ 外网连接失败: ${error.message}`);
    }

    // 检查防火墙状态（Windows）
    if (process.platform === "win32") {
      try {
        const result = execSync("netsh advfirewall show allprofiles state", { encoding: "utf8", stdio: "pipe" });
        network.firewallStatus = result.includes("ON") ? "启用" : "禁用";
        console.log(`  🛡️ 防火墙状态: ${network.firewallStatus}`);
      } catch (error) {
        network.firewallStatus = "未知";
      }
    }
  }

  // 生成分析报告
  generateReport() {
    console.log("\n" + "=".repeat(60));
    console.log("📊 分析报告");
    console.log("=".repeat(60));

    // 环境状态
    console.log("\n🖥️ 环境状态:");
    console.log(`  Node.js: ${this.results.environment.nodeVersion}`);
    console.log(`  平台: ${this.results.environment.platform}`);
    console.log(`  package.json: ${this.results.environment.packageExists ? "✅" : "❌"}`);

    // ngrok状态
    console.log("\n🔗 ngrok状态:");
    console.log(`  本地ngrok.exe: ${this.results.ngrok.localExists ? "✅" : "❌"}`);
    console.log(`  全局ngrok: ${this.results.ngrok.globalExists ? "✅" : "❌"}`);
    console.log(`  配置文件: ${this.results.ngrok.configExists ? "✅" : "❌"}`);
    console.log(`  API可用: ${this.results.ngrok.apiAvailable ? "✅" : "❌"}`);
    if (this.results.ngrok.activeTunnels > 0) {
      console.log(`  活跃隧道: ${this.results.ngrok.activeTunnels}`);
    }

    // 后端状态
    console.log("\n🌐 后端状态:");
    console.log(`  目录存在: ${this.results.backend.directoryExists ? "✅" : "❌"}`);
    console.log(`  服务运行: ${this.results.backend.serviceRunning ? "✅" : "❌"}`);
    console.log(`  端口占用: ${this.results.backend.portOccupied ? "⚠️" : "✅"}`);

    // 客户端状态
    console.log("\n📱 客户端状态:");
    console.log(`  目录存在: ${this.results.client.directoryExists ? "✅" : "❌"}`);
    console.log(`  配置文件: ${this.results.client.configExists ? "✅" : "❌"}`);
    if (this.results.client.prodHost) {
      console.log(`  生产环境: ${this.results.client.prodHost}:${this.results.client.prodPort}`);
    }

    // 网络状态
    console.log("\n🌐 网络状态:");
    console.log(`  本地连接: ${this.results.network.localConnection ? "✅" : "❌"}`);
    console.log(`  外网连接: ${this.results.network.internetConnection ? "✅" : "❌"}`);

    // 问题列表
    if (this.results.issues.length > 0) {
      console.log("\n❌ 发现的问题:");
      this.results.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }

    // 生成建议
    this.generateRecommendations();
    
    if (this.results.recommendations.length > 0) {
      console.log("\n💡 解决建议:");
      this.results.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    console.log("\n" + "=".repeat(60));
  }

  // 生成解决建议
  generateRecommendations() {
    const recs = this.results.recommendations;

    // ngrok相关建议
    if (!this.results.ngrok.localExists && !this.results.ngrok.globalExists) {
      recs.push("安装ngrok: 访问 https://ngrok.com/ 下载并配置认证令牌");
    }
    
    if (!this.results.ngrok.configExists) {
      recs.push("配置ngrok认证令牌: 运行 'ngrok authtoken YOUR_TOKEN'");
    }

    // 后端相关建议
    if (!this.results.backend.serviceRunning) {
      recs.push("启动后端服务: 在 modules/admin-backend 目录运行 'npm run dev'");
    }

    if (this.results.backend.portOccupied) {
      recs.push("释放端口3002: 终止占用进程或使用其他端口");
    }

    // 网络相关建议
    if (!this.results.network.internetConnection) {
      recs.push("检查网络连接: 确保能够访问外网");
    }

    // 配置相关建议
    if (this.results.client.prodHost && this.results.client.prodHost.includes("ngrok") && !this.results.ngrok.apiAvailable) {
      recs.push("更新客户端配置: 客户端配置的ngrok地址可能已过期");
    }

    // 通用建议
    if (this.results.issues.length > 0) {
      recs.push("按顺序执行: 1) 启动后端服务 2) 启动ngrok 3) 运行打包脚本");
    }
  }
}

// 运行分析
async function main() {
  const analyzer = new RemoteConnectionAnalyzer();
  await analyzer.analyze();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { RemoteConnectionAnalyzer };
