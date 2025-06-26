#!/usr/bin/env node

/**
 * 超级一键打包脚本 - 自动启动服务、ngrok并打包
 * 使用方法：node super-build.js
 */

const { spawn, execSync } = require("child_process");
const fs = require("fs").promises;
const path = require("path");

console.log("🚀 超级一键打包 - 全自动远程控制版本");
console.log("=====================================");
console.log("");
console.log("📋 将自动执行以下步骤：");
console.log("1. 启动后端服务");
console.log("2. 启动ngrok获取公网地址");
console.log("3. 配置客户端并打包");
console.log("4. 清理临时进程");
console.log("");

let serverProcess = null;
let ngrokProcess = null;

async function main() {
  try {
    // 检查ngrok是否安装
    await checkNgrok();

    // 1. 启动后端服务
    console.log("🌐 启动后端服务...");
    serverProcess = await startServer();
    await sleep(3000); // 等待服务启动

    // 2. 启动ngrok
    console.log("🔗 启动ngrok...");
    ngrokProcess = await startNgrok();
    await sleep(5000); // 等待ngrok启动

    // 3. 获取ngrok地址
    const ngrokUrl = await getNgrokUrl();
    if (!ngrokUrl) {
      throw new Error("无法获取ngrok地址");
    }

    console.log(`✅ 获取到公网地址: ${ngrokUrl}`);

    // 4. 打包客户端
    console.log("🔨 开始打包客户端...");
    await buildWithServer(ngrokUrl);

    console.log("");
    console.log("🎉 超级打包完成！");
    console.log("📦 安装包位置: desktop-client/exe-output/");
    console.log("📤 直接分发给用户即可，无需任何配置！");
    console.log(`🌐 管理界面: https://${ngrokUrl}`);
    console.log("");
    console.log("💡 提示: 保持终端运行以维持ngrok连接");
  } catch (error) {
    console.error("❌ 打包失败:", error.message);
    process.exit(1);
  } finally {
    // 清理进程
    if (process.argv.includes("--cleanup")) {
      cleanup();
    }
  }
}

// 检查ngrok是否安装
async function checkNgrok() {
  try {
    execSync("ngrok version", { stdio: "ignore" });
    console.log("✅ 检测到ngrok");
  } catch (error) {
    console.error("❌ 未检测到ngrok，请先安装：");
    console.error("   1. 访问 https://ngrok.com/ 注册账号");
    console.error("   2. 下载并安装ngrok");
    console.error("   3. 配置认证令牌：ngrok authtoken YOUR_TOKEN");
    process.exit(1);
  }
}

// 启动后端服务
function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn("npm", ["run", "server-only"], {
      shell: true,
      stdio: "pipe",
    });

    server.stdout.on("data", (data) => {
      const output = data.toString();
      if (output.includes("localhost:3002")) {
        console.log("✅ 后端服务已启动");
        resolve(server);
      }
    });

    server.on("error", reject);

    // 超时处理
    setTimeout(() => {
      reject(new Error("后端服务启动超时"));
    }, 30000);
  });
}

// 启动ngrok
function startNgrok() {
  return new Promise((resolve, reject) => {
    const ngrok = spawn("ngrok", ["http", "3002"], {
      shell: true,
      stdio: "pipe",
    });

    ngrok.stdout.on("data", (data) => {
      const output = data.toString();
      if (output.includes("started tunnel") || output.includes("Forwarding")) {
        console.log("✅ ngrok隧道已建立");
        resolve(ngrok);
      }
    });

    ngrok.on("error", reject);

    // 超时处理
    setTimeout(() => {
      reject(new Error("ngrok启动超时"));
    }, 30000);
  });
}

// 获取ngrok地址
async function getNgrokUrl() {
  try {
    const response = await fetch("http://localhost:4040/api/tunnels");
    const data = await response.json();
    const httpsTunnel = data.tunnels.find((t) => t.proto === "https");
    if (httpsTunnel) {
      const url = new URL(httpsTunnel.public_url);
      return url.hostname;
    }
  } catch (error) {
    console.error("获取ngrok地址失败:", error.message);
  }
  return null;
}

// 使用服务器地址打包
async function buildWithServer(serverUrl) {
  return new Promise((resolve, reject) => {
    const build = spawn("node", ["build-with-server.js", serverUrl], {
      shell: true,
      stdio: "inherit",
    });

    build.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`打包失败，退出码: ${code}`));
      }
    });

    build.on("error", reject);
  });
}

// 清理进程
function cleanup() {
  console.log("🧹 清理进程...");

  if (serverProcess) {
    serverProcess.kill();
    console.log("✅ 后端服务已停止");
  }

  if (ngrokProcess) {
    ngrokProcess.kill();
    console.log("✅ ngrok已停止");
  }
}

// 睡眠函数
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 处理退出信号
process.on("SIGINT", () => {
  console.log("\n🛑 收到退出信号...");
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

// 运行主函数
main().catch(console.error);
