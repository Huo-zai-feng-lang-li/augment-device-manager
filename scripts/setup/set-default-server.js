#!/usr/bin/env node

/**
 * 设置客户端默认服务器地址脚本
 * 用于在打包前预设服务器地址，这样分发的客户端无需配置即可使用
 */

const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");

console.log("🔧 设置客户端默认服务器地址");
console.log("==============================");

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("使用方法:");
    console.log("  node set-default-server.js <服务器地址> [端口] [协议]");
    console.log("");
    console.log("示例:");
    console.log("  node set-default-server.js abc123.ngrok.io 443 https");
    console.log("  node set-default-server.js your-server.com 3002 http");
    console.log("");
    console.log("当前默认配置:");
    await showCurrentConfig();
    return;
  }

  const host = args[0];
  const port = parseInt(args[1]) || (host.includes("ngrok.io") ? 443 : 3002);
  const protocol = args[2] || (host.includes("ngrok.io") ? "https" : "http");

  try {
    await updateDefaultConfig(host, port, protocol);
    console.log("✅ 默认服务器配置已更新");
    console.log(`   服务器地址: ${protocol}://${host}:${port}`);
    console.log("");
    console.log("📋 下一步:");
    console.log("1. 运行 npm run build 打包客户端");
    console.log("2. 分发安装包给用户");
    console.log("3. 用户安装后无需配置即可连接到您的服务器");
  } catch (error) {
    console.error("❌ 配置更新失败:", error.message);
    process.exit(1);
  }
}

async function updateDefaultConfig(host, port, protocol) {
  const configPath = path.join(__dirname, "../desktop-client/src/config.js");

  if (!fsSync.existsSync(configPath)) {
    throw new Error("配置文件不存在: " + configPath);
  }

  let content = await fs.readFile(configPath, "utf8");

  // 替换默认配置
  const newConfig = `// 默认配置
const DEFAULT_CONFIG = {
  server: {
    host: "${host}", // 预设服务器地址
    port: ${port}, // 预设端口
    protocol: "${protocol}", // 预设协议
  },
  client: {
    autoConnect: true,
    verifyInterval: 5 * 60 * 1000, // 5分钟
    reconnectDelay: 5000, // 5秒
  },
};`;

  // 使用正则表达式替换默认配置部分
  const configRegex = /\/\/ 默认配置\s*\nconst DEFAULT_CONFIG = \{[\s\S]*?\};/;

  if (configRegex.test(content)) {
    content = content.replace(configRegex, newConfig);
    await fs.writeFile(configPath, content, "utf8");
  } else {
    throw new Error("无法找到默认配置部分");
  }
}

async function showCurrentConfig() {
  try {
    const configPath = path.join(__dirname, "../desktop-client/src/config.js");
    const content = await fs.readFile(configPath, "utf8");

    // 提取当前配置
    const hostMatch = content.match(/host:\s*["']([^"']+)["']/);
    const portMatch = content.match(/port:\s*(\d+)/);
    const protocolMatch = content.match(/protocol:\s*["']([^"']+)["']/);

    if (hostMatch && portMatch && protocolMatch) {
      const host = hostMatch[1];
      const port = portMatch[1];
      const protocol = protocolMatch[1];
      console.log(`   服务器地址: ${protocol}://${host}:${port}`);
    } else {
      console.log("   无法解析当前配置");
    }
  } catch (error) {
    console.log("   读取配置失败");
  }
}

// 运行主函数
main().catch(console.error);
