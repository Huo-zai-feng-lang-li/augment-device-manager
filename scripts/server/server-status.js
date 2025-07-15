#!/usr/bin/env node

/**
 * 检查远程控制服务器状态
 * 使用方法：node server-status.js
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("📊 远程控制服务器状态");
console.log("====================");
console.log("");

async function checkServerStatus() {
  let isRunning = false;
  
  try {
    // 1. 检查服务信息文件
    const serverInfoPath = path.join(__dirname, "../../server-info.json");
    let serverInfo = null;
    
    if (fs.existsSync(serverInfoPath)) {
      try {
        const content = fs.readFileSync(serverInfoPath, 'utf8');
        serverInfo = JSON.parse(content);
        console.log("📋 服务信息:");
        console.log(`   启动时间: ${new Date(serverInfo.startTime).toLocaleString()}`);
        console.log(`   管理界面: ${serverInfo.managementUrl}`);
        console.log(`   ngrok地址: ${serverInfo.ngrokUrl}`);
        console.log("");
      } catch (error) {
        console.log("⚠️ 服务信息文件损坏");
      }
    }
    
    // 2. 检查后端服务进程
    try {
      let backendRunning = false;
      if (process.platform === "win32") {
        const result = execSync('wmic process where "commandline like \'%admin-backend%\'" get processid', { encoding: 'utf8' });
        backendRunning = result.includes("ProcessId") && result.split('\n').length > 3;
      } else {
        execSync('pgrep -f "admin-backend"', { stdio: "ignore" });
        backendRunning = true;
      }
      
      if (backendRunning) {
        console.log("✅ 后端服务: 运行中");
        isRunning = true;
      } else {
        console.log("❌ 后端服务: 未运行");
      }
    } catch (error) {
      console.log("❌ 后端服务: 未运行");
    }
    
    // 3. 检查ngrok进程
    try {
      let ngrokRunning = false;
      if (process.platform === "win32") {
        execSync('tasklist | findstr ngrok.exe', { stdio: "ignore" });
        ngrokRunning = true;
      } else {
        execSync('pgrep -f ngrok', { stdio: "ignore" });
        ngrokRunning = true;
      }
      
      if (ngrokRunning) {
        console.log("✅ ngrok服务: 运行中");
        isRunning = true;
      } else {
        console.log("❌ ngrok服务: 未运行");
      }
    } catch (error) {
      console.log("❌ ngrok服务: 未运行");
    }
    
    // 4. 检查端口占用
    try {
      const result = execSync('netstat -ano | findstr :3002', { encoding: 'utf8' });
      if (result.trim()) {
        console.log("✅ 端口3002: 已占用");
        isRunning = true;
      } else {
        console.log("❌ 端口3002: 未占用");
      }
    } catch (error) {
      console.log("❌ 端口3002: 未占用");
    }
    
    // 5. 检查ngrok API
    try {
      const fetch = require("node-fetch");
      const response = await fetch("http://localhost:4040/api/tunnels", { timeout: 3000 });
      if (response.ok) {
        const data = await response.json();
        if (data.tunnels && data.tunnels.length > 0) {
          console.log("✅ ngrok隧道: 已建立");
          const httpsTunnel = data.tunnels.find(t => t.proto === "https");
          if (httpsTunnel) {
            console.log(`   公网地址: ${httpsTunnel.public_url}`);
          }
          isRunning = true;
        } else {
          console.log("❌ ngrok隧道: 未建立");
        }
      } else {
        console.log("❌ ngrok API: 无响应");
      }
    } catch (error) {
      console.log("❌ ngrok API: 无响应");
    }
    
    console.log("");
    
    // 6. 总体状态
    if (isRunning) {
      console.log("🎉 服务状态: 运行中");
      console.log("💡 客户端可以正常连接和使用");
      
      if (serverInfo && serverInfo.managementUrl) {
        console.log(`🌐 管理界面: ${serverInfo.managementUrl}`);
      }
    } else {
      console.log("🛑 服务状态: 未运行");
      console.log("💡 使用以下命令启动服务:");
      console.log("   npm run server:start");
      console.log("   或");
      console.log("   node scripts/server/start-server.js");
    }
    
    // 7. 连接的客户端数量（如果服务运行中）
    if (isRunning) {
      try {
        const fetch = require("node-fetch");
        const response = await fetch("http://localhost:3002/api/clients", { timeout: 3000 });
        if (response.ok) {
          const clients = await response.json();
          console.log(`📱 连接的客户端: ${clients.length} 个`);
        }
      } catch (error) {
        // 忽略客户端检查错误
      }
    }
    
  } catch (error) {
    console.error("❌ 检查状态时出错:", error.message);
  }
}

// 运行状态检查
checkServerStatus();
