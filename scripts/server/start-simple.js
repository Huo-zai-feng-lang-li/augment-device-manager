#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

console.log("🚀 简化版服务器启动脚本");
console.log("====================");

let serverProcess = null;
let ngrokProcess = null;

async function main() {
  try {
    // 检查ngrok
    const ngrokPath = path.join(__dirname, "../../tools/ngrok.exe");
    console.log("✅ 检测到本地ngrok.exe");

    // 启动后端服务
    console.log("🚀 启动后端服务...");
    serverProcess = startServer();

    // 等待服务启动
    await sleep(3000);

    // 启动ngrok
    console.log("🔗 启动ngrok隧道...");
    ngrokProcess = startNgrok(ngrokPath);

    console.log("✅ 服务启动完成！");
    console.log("💡 服务将持续运行，按 Ctrl+C 停止");

  } catch (error) {
    console.error("❌ 服务启动失败:", error.message);
    cleanup();
    process.exit(1);
  }
}

// 启动后端服务
function startServer() {
  const server = spawn("node", ["src/server-simple.js"], {
    shell: true,
    stdio: "inherit",
    cwd: path.join(__dirname, "../../modules/admin-backend"),
  });

  server.on("error", (error) => {
    console.error("后端服务错误:", error);
  });

  return server;
}

// 启动ngrok
function startNgrok(ngrokPath) {
  const ngrok = spawn(ngrokPath, ["http", "3002"], {
    shell: true,
    stdio: "inherit",
  });

  ngrok.on("error", (error) => {
    console.error("ngrok错误:", error);
  });

  return ngrok;
}

// 清理进程
function cleanup() {
  console.log("\n🧹 停止服务...");

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
  console.log("\n🛑 收到停止信号...");
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

// 运行主函数
main().catch(console.error);
