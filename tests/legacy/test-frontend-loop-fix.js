/**
 * 测试前端循环请求修复效果
 * 模拟前端行为，验证是否还会出现循环请求
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

async function testFrontendLoopFix() {
  console.log("🧪 开始测试前端循环请求修复效果...\n");

  return new Promise((resolve, reject) => {
    let requestCount = 0;
    let deviceIdRequestCount = 0;
    let systemInfoRequestCount = 0;
    
    const startTime = Date.now();
    const testDuration = 10000; // 测试10秒
    
    console.log("1️⃣ 启动客户端应用...");
    
    // 启动客户端
    const clientProcess = spawn("npm", ["start"], {
      cwd: path.join(__dirname, "desktop-client"),
      stdio: ["pipe", "pipe", "pipe"],
      shell: true
    });

    let outputBuffer = "";
    
    clientProcess.stdout.on("data", (data) => {
      const output = data.toString();
      outputBuffer += output;
      
      // 统计请求次数
      const deviceIdMatches = output.match(/收到设备ID详情请求/g);
      if (deviceIdMatches) {
        deviceIdRequestCount += deviceIdMatches.length;
      }
      
      const systemInfoMatches = output.match(/get-system-info/g);
      if (systemInfoMatches) {
        systemInfoRequestCount += systemInfoMatches.length;
      }
      
      requestCount += (deviceIdMatches?.length || 0) + (systemInfoMatches?.length || 0);
    });

    clientProcess.stderr.on("data", (data) => {
      const output = data.toString();
      outputBuffer += output;
      
      // 也检查stderr中的请求
      const deviceIdMatches = output.match(/收到设备ID详情请求/g);
      if (deviceIdMatches) {
        deviceIdRequestCount += deviceIdMatches.length;
      }
    });

    // 10秒后停止测试
    setTimeout(() => {
      console.log("\n2️⃣ 停止测试，分析结果...");
      
      clientProcess.kill("SIGTERM");
      
      const elapsedTime = Date.now() - startTime;
      const requestsPerSecond = requestCount / (elapsedTime / 1000);
      
      console.log("\n📊 测试结果分析:");
      console.log(`   测试时长: ${elapsedTime}ms`);
      console.log(`   设备ID详情请求次数: ${deviceIdRequestCount}`);
      console.log(`   系统信息请求次数: ${systemInfoRequestCount}`);
      console.log(`   总请求次数: ${requestCount}`);
      console.log(`   平均请求频率: ${requestsPerSecond.toFixed(2)} 次/秒`);
      
      // 判断是否存在循环请求问题
      const hasLoopIssue = requestsPerSecond > 2; // 如果每秒超过2次请求，认为有循环问题
      const deviceIdLoopIssue = deviceIdRequestCount > 5; // 如果设备ID请求超过5次，认为有循环
      
      console.log("\n🎯 问题诊断:");
      console.log(`   ${hasLoopIssue ? '❌' : '✅'} 总体请求频率: ${hasLoopIssue ? '异常（可能存在循环）' : '正常'}`);
      console.log(`   ${deviceIdLoopIssue ? '❌' : '✅'} 设备ID请求频率: ${deviceIdLoopIssue ? '异常（存在循环）' : '正常'}`);
      
      const isFixed = !hasLoopIssue && !deviceIdLoopIssue;
      console.log(`\n🏆 修复状态: ${isFixed ? '✅ 循环请求问题已修复' : '❌ 仍存在循环请求问题'}`);
      
      if (!isFixed) {
        console.log("\n🔧 建议检查:");
        if (hasLoopIssue) {
          console.log("   - 检查定时器设置是否合理");
          console.log("   - 检查是否有不必要的自动刷新");
        }
        if (deviceIdLoopIssue) {
          console.log("   - 检查设备ID详情请求的触发条件");
          console.log("   - 确认loadDeviceIdDetails调用是否过于频繁");
        }
        
        console.log("\n📝 详细输出日志:");
        console.log(outputBuffer.substring(0, 2000) + (outputBuffer.length > 2000 ? "..." : ""));
      }
      
      resolve({
        isFixed,
        requestCount,
        deviceIdRequestCount,
        systemInfoRequestCount,
        requestsPerSecond,
        testDuration: elapsedTime
      });
      
    }, testDuration);

    clientProcess.on("error", (error) => {
      console.error("❌ 客户端启动失败:", error);
      reject(error);
    });
  });
}

// 运行测试
if (require.main === module) {
  testFrontendLoopFix().then((result) => {
    console.log("\n🏁 前端循环请求测试完成");
    process.exit(result.isFixed ? 0 : 1);
  }).catch(error => {
    console.error("❌ 测试失败:", error);
    process.exit(1);
  });
}

module.exports = { testFrontendLoopFix };
