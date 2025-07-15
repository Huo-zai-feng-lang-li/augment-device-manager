#!/usr/bin/env node

const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const readline = require("readline");

// 快速配置服务器连接脚本
async function configureServerConnection() {
  console.log("🔧 Augment设备管理器 - 服务器连接配置");
  console.log("========================================");
  console.log("");

  const configDir = path.join(os.homedir(), ".augment-device-manager");
  const configFile = path.join(configDir, "server-config.json");

  // 检查命令行参数
  const args = process.argv.slice(2);
  if (args.length >= 1) {
    return await configureFromArgs(args, configDir, configFile);
  }

  // 检查是否已有配置
  let hasExistingConfig = false;
  if (await fs.pathExists(configFile)) {
    try {
      const existingConfig = await fs.readJson(configFile);
      console.log("📋 当前配置:");
      console.log(
        `   服务器: ${existingConfig.server.protocol}://${existingConfig.server.host}:${existingConfig.server.port}`
      );
      console.log("");
      hasExistingConfig = true;
    } catch (error) {
      console.log("⚠️ 现有配置文件损坏，将重新配置");
    }
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("请输入服务器信息:");
    console.log("");

    // 获取服务器地址
    const host = await askQuestion(
      rl,
      "🌐 服务器地址 (例如: abc123.ngrok.io): "
    );
    if (!host.trim()) {
      throw new Error("服务器地址不能为空");
    }

    // 自动判断端口和协议
    const isNgrok = host.includes("ngrok.io");
    const defaultPort = isNgrok ? 443 : 3002;
    const defaultProtocol = isNgrok ? "https" : "http";

    const portInput = await askQuestion(rl, `🔌 端口 (默认: ${defaultPort}): `);
    const port = parseInt(portInput.trim()) || defaultPort;

    const protocolInput = await askQuestion(
      rl,
      `🔒 协议 (默认: ${defaultProtocol}): `
    );
    const protocol = protocolInput.trim() || defaultProtocol;

    const config = {
      server: {
        host: host.trim(),
        port: port,
        protocol: protocol,
      },
      client: {
        autoConnect: true,
        verifyInterval: 5 * 60 * 1000, // 5分钟
        reconnectDelay: 5000, // 5秒
      },
    };

    // 确保配置目录存在
    await fs.ensureDir(configDir);

    // 写入配置文件
    await fs.writeJson(configFile, config, { spaces: 2 });

    console.log("");
    console.log("✅ 服务器配置已保存:");
    console.log(`   服务器地址: ${protocol}://${host}:${port}`);
    console.log(
      `   WebSocket: ${
        protocol === "https" ? "wss" : "ws"
      }://${host}:${port}/ws`
    );
    console.log(`   配置文件: ${configFile}`);
    console.log("");
    console.log("💡 提示: 重启客户端应用以应用新配置");
  } catch (error) {
    console.error("❌ 配置失败:", error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// 从命令行参数配置
async function configureFromArgs(args, configDir, configFile) {
  const host = args[0];
  const port = parseInt(args[1]) || (host.includes("ngrok.io") ? 443 : 3002);
  const protocol = args[2] || (host.includes("ngrok.io") ? "https" : "http");

  const config = {
    server: {
      host: host,
      port: port,
      protocol: protocol,
    },
    client: {
      autoConnect: true,
      verifyInterval: 5 * 60 * 1000, // 5分钟
      reconnectDelay: 5000, // 5秒
    },
  };

  try {
    // 确保配置目录存在
    await fs.ensureDir(configDir);

    // 写入配置文件
    await fs.writeJson(configFile, config, { spaces: 2 });

    console.log("✅ 服务器配置已保存:");
    console.log(`   服务器地址: ${protocol}://${host}:${port}`);
    console.log(
      `   WebSocket: ${
        protocol === "https" ? "wss" : "ws"
      }://${host}:${port}/ws`
    );
    console.log(`   配置文件: ${configFile}`);
  } catch (error) {
    console.error("❌ 配置保存失败:", error.message);
    throw error;
  }
}

// 运行脚本
configureServerConnection().catch(console.error);
