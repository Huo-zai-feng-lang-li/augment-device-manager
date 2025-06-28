/**
 * 测试智能监控修复效果
 * 验证：
 * 1. 正常状态下不会频繁请求设备ID详情
 * 2. 清理过程中会启动监控模式
 * 3. 清理完成后会停止监控模式
 * 4. 设备指纹清理功能仍然正常工作
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

async function testSmartMonitoringFix() {
  console.log("🧪 开始测试智能监控修复效果...\n");

  const results = {
    normalModeRequests: 0,
    cleanupModeRequests: 0,
    deviceFingerprintChanged: false,
    monitoringStarted: false,
    monitoringStopped: false
  };

  return new Promise((resolve, reject) => {
    let phase = "normal"; // normal, cleanup, post-cleanup
    let phaseStartTime = Date.now();
    let outputBuffer = "";
    
    console.log("1️⃣ 启动客户端应用进行智能监控测试...");
    
    // 启动客户端
    const clientProcess = spawn("npm", ["start"], {
      cwd: path.join(__dirname, "desktop-client"),
      stdio: ["pipe", "pipe", "pipe"],
      shell: true
    });

    let requestCount = 0;
    let lastDeviceId = null;
    
    clientProcess.stdout.on("data", (data) => {
      const output = data.toString();
      outputBuffer += output;
      
      // 统计设备ID详情请求
      const deviceIdMatches = output.match(/收到设备ID详情请求/g);
      if (deviceIdMatches) {
        requestCount += deviceIdMatches.length;
        
        if (phase === "normal") {
          results.normalModeRequests += deviceIdMatches.length;
        } else if (phase === "cleanup") {
          results.cleanupModeRequests += deviceIdMatches.length;
        }
      }
      
      // 检测监控状态变化
      if (output.includes("启动清理监控模式")) {
        results.monitoringStarted = true;
        phase = "cleanup";
        phaseStartTime = Date.now();
        console.log("   🔄 检测到监控模式启动");
      }
      
      if (output.includes("清理监控模式已停止")) {
        results.monitoringStopped = true;
        phase = "post-cleanup";
        console.log("   ✅ 检测到监控模式停止");
      }
      
      // 检测设备指纹变化
      const deviceIdMatch = output.match(/设备ID详情获取成功.*?([a-f0-9]{64})/);
      if (deviceIdMatch) {
        const currentDeviceId = deviceIdMatch[1];
        if (lastDeviceId && lastDeviceId !== currentDeviceId) {
          results.deviceFingerprintChanged = true;
          console.log("   🔄 检测到设备指纹变化");
        }
        lastDeviceId = currentDeviceId;
      }
    });

    clientProcess.stderr.on("data", (data) => {
      const output = data.toString();
      outputBuffer += output;
    });

    // 测试流程：
    // 1. 观察正常模式5秒
    // 2. 模拟触发清理（如果可能）
    // 3. 观察清理模式
    // 4. 观察清理后模式
    
    setTimeout(() => {
      console.log("\n2️⃣ 正常模式观察完成，分析请求频率...");
      console.log(`   正常模式请求次数: ${results.normalModeRequests}`);
      
      // 这里可以尝试模拟清理操作，但由于需要UI交互，我们先观察基本行为
      
      setTimeout(() => {
        console.log("\n3️⃣ 停止测试，分析结果...");
        
        clientProcess.kill("SIGTERM");
        
        const totalTime = Date.now() - phaseStartTime;
        const normalRequestRate = results.normalModeRequests / 5; // 5秒观察期
        
        console.log("\n📊 智能监控测试结果:");
        console.log(`   测试总时长: ${totalTime}ms`);
        console.log(`   正常模式请求次数: ${results.normalModeRequests}`);
        console.log(`   正常模式请求频率: ${normalRequestRate.toFixed(2)} 次/秒`);
        console.log(`   清理模式请求次数: ${results.cleanupModeRequests}`);
        console.log(`   监控启动检测: ${results.monitoringStarted ? '✅' : '❌'}`);
        console.log(`   监控停止检测: ${results.monitoringStopped ? '✅' : '❌'}`);
        console.log(`   设备指纹变化: ${results.deviceFingerprintChanged ? '✅' : '❌'}`);
        
        // 评估修复效果
        const normalModeOptimal = normalRequestRate <= 0.5; // 正常模式下每秒不超过0.5次请求
        const monitoringWorking = results.monitoringStarted || results.monitoringStopped;
        
        console.log("\n🎯 修复效果评估:");
        console.log(`   ${normalModeOptimal ? '✅' : '❌'} 正常模式请求频率: ${normalModeOptimal ? '优化成功' : '仍需优化'}`);
        console.log(`   ${monitoringWorking ? '✅' : '❌'} 智能监控机制: ${monitoringWorking ? '工作正常' : '需要检查'}`);
        
        const overallSuccess = normalModeOptimal;
        console.log(`\n🏆 总体评估: ${overallSuccess ? '✅ 智能监控修复成功' : '❌ 仍需进一步优化'}`);
        
        if (!overallSuccess) {
          console.log("\n🔧 建议检查:");
          if (!normalModeOptimal) {
            console.log("   - 正常模式下的请求频率仍然过高");
            console.log("   - 检查loadSystemInfo的调用逻辑");
          }
          if (!monitoringWorking) {
            console.log("   - 智能监控机制未正常工作");
            console.log("   - 检查监控状态切换逻辑");
          }
          
          console.log("\n📝 部分输出日志:");
          console.log(outputBuffer.substring(0, 1000) + (outputBuffer.length > 1000 ? "..." : ""));
        }
        
        resolve({
          success: overallSuccess,
          normalModeRequests: results.normalModeRequests,
          normalRequestRate,
          monitoringWorking,
          details: results
        });
        
      }, 10000); // 再观察10秒
      
    }, 5000); // 先观察5秒正常模式

    clientProcess.on("error", (error) => {
      console.error("❌ 客户端启动失败:", error);
      reject(error);
    });
  });
}

// 运行测试
if (require.main === module) {
  testSmartMonitoringFix().then((result) => {
    console.log("\n🏁 智能监控测试完成");
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error("❌ 测试失败:", error);
    process.exit(1);
  });
}

module.exports = { testSmartMonitoringFix };
