#!/usr/bin/env node

/**
 * 远程控制快速配置脚本
 * 一键配置远程控制功能
 */

const fs = require("fs-extra");
const path = require("path");
const { spawn } = require("child_process");

console.log("🌐 Augment设备管理器 - 远程控制快速配置");
console.log("==========================================");
console.log("");

async function main() {
  try {
    // 检查是否在项目根目录
    if (!(await fs.pathExists("../package.json"))) {
      console.error("❌ 请在项目根目录运行此脚本");
      process.exit(1);
    }

    console.log("📋 配置选项：");
    console.log("1. 使用 ngrok（推荐新手）");
    console.log("2. 配置自定义服务器");
    console.log("3. 查看当前配置");
    console.log("4. 测试连接");
    console.log("");

    const choice = await getUserInput("请选择配置方式 (1-4): ");

    switch (choice.trim()) {
      case "1":
        await setupNgrok();
        break;
      case "2":
        await setupCustomServer();
        break;
      case "3":
        await showCurrentConfig();
        break;
      case "4":
        await testConnection();
        break;
      default:
        console.log("❌ 无效选择");
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ 配置失败:", error.message);
    process.exit(1);
  }
}

async function setupNgrok() {
  console.log("");
  console.log("🚀 配置 ngrok 远程控制");
  console.log("===================");

  // 检查 ngrok 是否安装
  try {
    await runCommand("ngrok", ["version"]);
  } catch (error) {
    console.log("❌ 未检测到 ngrok，请先安装：");
    console.log("   1. 访问 https://ngrok.com/ 注册账号");
    console.log("   2. 下载并安装 ngrok");
    console.log("   3. 配置认证令牌：ngrok authtoken YOUR_TOKEN");
    return;
  }

  console.log("✅ 检测到 ngrok");
  console.log("");
  console.log("📝 配置步骤：");
  console.log("1. 启动后端服务：npm run server-only");
  console.log("2. 在新终端运行：ngrok http 3002");
  console.log("3. 复制 ngrok 提供的 https 地址");
  console.log("4. 运行客户端配置命令");
  console.log("");

  const ngrokUrl = await getUserInput(
    "请输入 ngrok 地址（如：abc123.ngrok.io）: "
  );

  if (!ngrokUrl.trim()) {
    console.log("❌ 地址不能为空");
    return;
  }

  // 配置客户端
  await configureClient(ngrokUrl.trim(), 443, "https");

  console.log("");
  console.log("🎉 ngrok 配置完成！");
  console.log("");
  console.log("📋 下一步：");
  console.log("1. 运行 npm run build 重新打包客户端");
  console.log("2. 分发 dist/ 目录下的安装包");
  console.log("3. 在管理界面 https://" + ngrokUrl.trim() + " 查看连接状态");
}

async function setupCustomServer() {
  console.log("");
  console.log("☁️ 配置自定义服务器");
  console.log("================");

  const host = await getUserInput("请输入服务器地址: ");
  const port = (await getUserInput("请输入端口 (默认3002): ")) || "3002";
  const protocol =
    (await getUserInput("请输入协议 (http/https，默认http): ")) || "http";

  if (!host.trim()) {
    console.log("❌ 服务器地址不能为空");
    return;
  }

  await configureClient(host.trim(), parseInt(port), protocol);

  console.log("");
  console.log("🎉 自定义服务器配置完成！");
  console.log("");
  console.log("📋 下一步：");
  console.log("1. 确保服务器已部署并运行");
  console.log("2. 运行 npm run build 重新打包客户端");
  console.log("3. 分发客户端安装包");
}

async function configureClient(host, port, protocol) {
  console.log("");
  console.log("⚙️ 正在配置客户端...");

  try {
    await runCommand("node", [
      "./desktop-client/configure-server.js",
      host,
      port.toString(),
      protocol,
    ]);
    console.log("✅ 客户端配置成功");
  } catch (error) {
    console.error("❌ 客户端配置失败:", error.message);
  }
}

async function showCurrentConfig() {
  console.log("");
  console.log("📋 当前配置");
  console.log("==========");

  try {
    await runCommand("node", ["./desktop-client/configure-server.js"]);
  } catch (error) {
    console.error("❌ 读取配置失败:", error.message);
  }
}

async function testConnection() {
  console.log("");
  console.log("🔍 测试连接");
  console.log("==========");

  try {
    console.log("正在测试 WebSocket 连接...");
    await runCommand("node", ["./test-websocket.js"]);
  } catch (error) {
    console.error("❌ 连接测试失败:", error.message);
    console.log("");
    console.log("💡 故障排除建议：");
    console.log("1. 检查服务器是否正常运行");
    console.log("2. 确认防火墙设置");
    console.log("3. 验证客户端配置");
  }
}

function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`命令执行失败，退出码: ${code}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

function getUserInput(prompt) {
  return new Promise((resolve) => {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// 运行主函数
main().catch(console.error);
