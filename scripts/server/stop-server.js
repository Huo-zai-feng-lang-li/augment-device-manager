#!/usr/bin/env node

/**
 * 停止远程控制服务器
 * 使用方法：node stop-server.js
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🛑 停止远程控制服务器");
console.log("====================");

async function stopServer() {
  try {
    let stopped = false;
    
    // 1. 停止后端服务进程
    try {
      if (process.platform === "win32") {
        // Windows
        execSync('taskkill /f /im node.exe /fi "WINDOWTITLE eq *admin-backend*" 2>nul', { stdio: "ignore" });
        execSync('wmic process where "commandline like \'%admin-backend%\'" delete 2>nul', { stdio: "ignore" });
      } else {
        // Unix系统
        execSync('pkill -f "admin-backend"', { stdio: "ignore" });
      }
      console.log("✅ 后端服务已停止");
      stopped = true;
    } catch (error) {
      // 进程可能不存在
    }
    
    // 2. 停止ngrok进程
    try {
      if (process.platform === "win32") {
        execSync('taskkill /f /im ngrok.exe 2>nul', { stdio: "ignore" });
      } else {
        execSync('pkill -f ngrok', { stdio: "ignore" });
      }
      console.log("✅ ngrok服务已停止");
      stopped = true;
    } catch (error) {
      // 进程可能不存在
    }
    
    // 3. 清理服务信息文件
    const serverInfoPath = path.join(__dirname, "../../server-info.json");
    try {
      if (fs.existsSync(serverInfoPath)) {
        fs.unlinkSync(serverInfoPath);
        console.log("✅ 服务信息已清理");
        stopped = true;
      }
    } catch (error) {
      // 忽略删除错误
    }
    
    // 4. 检查端口占用
    try {
      const result = execSync('netstat -ano | findstr :3002', { encoding: 'utf8' });
      if (result.trim()) {
        console.log("⚠️ 端口3002仍被占用，可能需要手动处理");
      }
    } catch (error) {
      // 端口未被占用，正常
    }
    
    if (stopped) {
      console.log("");
      console.log("🎉 服务已完全停止");
      console.log("💡 现在可以重新启动服务或进行其他操作");
    } else {
      console.log("ℹ️ 未检测到运行中的服务");
    }
    
  } catch (error) {
    console.error("❌ 停止服务时出错:", error.message);
    console.log("💡 请尝试手动停止相关进程");
  }
}

// 运行停止函数
stopServer();
