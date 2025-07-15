#!/usr/bin/env node

/**
 * 启动远程控制服务器 - 持久运行版本
 * 使用方法：node start-server.js
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

console.log("🌐 启动远程控制服务器");
console.log("====================");
console.log("");

let serverProcess = null;
let ngrokProcess = null;

async function main() {
  try {
    // 检查ngrok配置
    const ngrokPath = await checkNgrok();
    
    // 启动后端服务
    console.log("🚀 启动后端服务...");
    serverProcess = await startServer();
    
    // 等待服务启动
    await sleep(3000);
    
    // 启动ngrok
    console.log("🔗 启动ngrok隧道...");
    ngrokProcess = await startNgrok(ngrokPath);
    
    // 等待ngrok启动
    await sleep(5000);
    
    // 获取公网地址
    const ngrokUrl = await getNgrokUrl();
    if (ngrokUrl) {
      console.log("");
      console.log("🎉 服务启动成功！");
      console.log(`🌐 管理界面: https://${ngrokUrl}`);
      console.log(`📱 客户端连接地址: ${ngrokUrl}`);
      console.log("");
      console.log("💡 服务将持续运行，按 Ctrl+C 停止");
      console.log("💡 现在可以分发预配置的客户端安装包");
      
      // 保存服务信息
      await saveServerInfo(ngrokUrl);
    } else {
      throw new Error("无法获取ngrok公网地址");
    }
    
  } catch (error) {
    console.error("❌ 服务启动失败:", error.message);
    cleanup();
    process.exit(1);
  }
}

// 检查ngrok
async function checkNgrok() {
  const localNgrokPath = path.join(__dirname, "../../tools/ngrok.exe");
  
  try {
    await fs.promises.access(localNgrokPath);
    console.log("✅ 检测到本地ngrok.exe");
    return localNgrokPath;
  } catch (error) {
    throw new Error("未检测到ngrok，请先配置认证令牌");
  }
}

// 启动后端服务
function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn("npm", ["run", "dev"], {
      shell: true,
      stdio: "pipe",
      cwd: path.join(__dirname, "../../modules/admin-backend"),
    });

    server.stdout.on("data", (data) => {
      const output = data.toString();
      console.log("后端:", output.trim());
      if (output.includes("3002") && output.includes("运行在")) {
        console.log("✅ 后端服务已启动");
        resolve(server);
      }
    });

    server.stderr.on("data", (data) => {
      console.log("后端错误:", data.toString().trim());
    });

    server.on("error", reject);

    setTimeout(() => {
      reject(new Error("后端服务启动超时"));
    }, 30000);
  });
}

// 启动ngrok
function startNgrok(ngrokPath) {
  return new Promise((resolve, reject) => {
    const ngrok = spawn(ngrokPath, ["http", "3002"], {
      shell: true,
      stdio: "pipe",
    });

    let resolved = false;

    ngrok.stdout.on("data", (data) => {
      console.log("ngrok:", data.toString().trim());
    });

    ngrok.stderr.on("data", (data) => {
      console.log("ngrok:", data.toString().trim());
    });

    ngrok.on("error", reject);

    // 使用API检测ngrok状态
    const checkAPI = async () => {
      for (let i = 0; i < 30; i++) {
        try {
          const fetch = require("node-fetch");
          const response = await fetch("http://localhost:4040/api/tunnels");
          if (response.ok) {
            const data = await response.json();
            if (data.tunnels && data.tunnels.length > 0) {
              console.log("✅ ngrok隧道已建立");
              if (!resolved) {
                resolved = true;
                resolve(ngrok);
              }
              return;
            }
          }
        } catch (error) {
          // 继续等待
        }
        await sleep(1000);
      }
      
      if (!resolved) {
        reject(new Error("ngrok隧道建立超时"));
      }
    };

    checkAPI();
  });
}

// 获取ngrok地址
async function getNgrokUrl() {
  try {
    const fetch = require("node-fetch");
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

// 保存服务信息
async function saveServerInfo(ngrokUrl) {
  const serverInfo = {
    ngrokUrl: ngrokUrl,
    managementUrl: `https://${ngrokUrl}`,
    startTime: new Date().toISOString(),
    status: "running"
  };
  
  try {
    await fs.promises.writeFile(
      path.join(__dirname, "../../server-info.json"),
      JSON.stringify(serverInfo, null, 2)
    );
  } catch (error) {
    // 忽略保存错误
  }
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
  
  // 删除服务信息文件
  try {
    fs.unlinkSync(path.join(__dirname, "../../server-info.json"));
  } catch (error) {
    // 忽略删除错误
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
