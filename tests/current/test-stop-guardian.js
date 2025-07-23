/**
 * 测试停止所有守护进程
 * 验证警告信息中提到的问题是否已解决
 */

const { spawn, exec } = require("child_process");
const path = require("path");
const fs = require("fs-extra");
const { promisify } = require("util");
const execAsync = promisify(exec);

async function stopAllGuardianProcesses() {
  console.log("🛑 停止所有防护进程...");

  try {
    if (process.platform === "win32") {
      // Windows系统 - 查找并终止守护进程
      try {
        // 获取所有Node.js进程的详细信息
        const { stdout } = await execAsync(
          "wmic process where \"name='node.exe'\" get processid,commandline"
        );
        const lines = stdout.split("\n");
        const guardianProcesses = [];

        for (const line of lines) {
          if (
            line.includes("guardian-service-worker.js") ||
            line.includes("enhanced-device-guardian") ||
            line.includes("device-id-guardian") ||
            line.includes("standalone-guardian-service")
          ) {
            // 提取PID - 改进的正则表达式
            const pidMatch = line.trim().match(/\s+(\d+)\s*$/);
            if (pidMatch) {
              guardianProcesses.push(pidMatch[1]);
              console.log(`发现守护进程 PID: ${pidMatch[1]}`);
            }
          }
        }

        if (guardianProcesses.length > 0) {
          console.log(
            `🎯 发现 ${guardianProcesses.length} 个守护进程，正在终止...`
          );

          for (const pid of guardianProcesses) {
            try {
              await execAsync(`taskkill /F /PID ${pid}`);
              console.log(`✅ 已终止守护进程 PID: ${pid}`);
            } catch (error) {
              console.log(`⚠️ 终止进程 ${pid} 失败: ${error.message}`);
            }
          }
        } else {
          console.log("✅ 未发现运行中的守护进程");
        }
      } catch (error) {
        console.warn("扫描守护进程失败:", error.message);
      }
    } else {
      // Unix/Linux/macOS系统
      try {
        await execAsync(
          "pkill -f 'guardian-service-worker\\|enhanced-device-guardian\\|device-id-guardian\\|standalone-guardian-service'"
        );
        console.log("✅ 已终止所有守护进程");
      } catch (error) {
        if (error.code === 1) {
          console.log("✅ 未发现运行中的守护进程");
        } else {
          console.warn("终止守护进程失败:", error.message);
        }
      }
    }
  } catch (error) {
    console.error("停止守护进程失败:", error);
  }
}

async function checkGuardianProcesses() {
  try {
    const { stdout } = await execAsync(
      "wmic process where \"name='node.exe'\" get processid,commandline"
    );
    const lines = stdout.split("\n");
    const guardianProcesses = lines.filter(
      (line) =>
        line.includes("guardian-service-worker.js") ||
        line.includes("enhanced-device-guardian") ||
        line.includes("device-id-guardian") ||
        line.includes("standalone-guardian-service")
    );

    return {
      hasGuardianProcesses: guardianProcesses.length > 0,
      count: guardianProcesses.length,
      processes: guardianProcesses,
    };
  } catch (error) {
    console.error("检查进程失败:", error);
    return {
      hasGuardianProcesses: false,
      count: 0,
      processes: [],
      error: error.message,
    };
  }
}

async function testStopGuardian() {
  console.log("🧪 测试停止所有守护进程");
  console.log("=".repeat(60));

  try {
    // 1. 先启动一些守护进程（模拟之前运行的防护）
    console.log("\n📍 1. 启动一些守护进程（模拟场景）");

    const DeviceManager = require("./modules/desktop-client/src/device-manager");
    const deviceManager = new DeviceManager();

    // 启动防护进程
    console.log("启动防护进程...");
    const startResult = await deviceManager.startEnhancedGuardianIndependently({
      selectedIDE: "vscode",
      enableBackupMonitoring: true,
      enableDatabaseMonitoring: true,
      enableEnhancedProtection: true,
    });

    console.log(`启动结果: ${startResult.success ? "✅ 成功" : "❌ 失败"}`);
    if (startResult.success) {
      console.log(`防护模式: ${startResult.mode}`);
    }

    // 2. 检查防护进程状态
    console.log("\n📍 2. 检查防护进程状态");
    const beforeCheck = await checkGuardianProcesses();
    console.log(`守护进程数量: ${beforeCheck.count}`);
    if (beforeCheck.count > 0) {
      console.log("发现的守护进程:");
      beforeCheck.processes.forEach((process) => {
        console.log(`  - ${process.trim()}`);
      });
    }

    // 3. 停止所有守护进程
    console.log("\n📍 3. 停止所有守护进程");
    await stopAllGuardianProcesses();

    // 4. 验证清理结果
    console.log("\n📍 4. 验证清理结果");

    // 等待一下让进程完全停止
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const afterCheck = await checkGuardianProcesses();
    console.log(`清理后守护进程数量: ${afterCheck.count}`);

    if (afterCheck.count === 0) {
      console.log("✅ 所有守护进程已成功停止");
    } else {
      console.log("⚠️ 仍有守护进程在运行:");
      afterCheck.processes.forEach((process) => {
        console.log(`  - ${process.trim()}`);
      });
    }

    // 5. 测试结果总结
    console.log("\n📊 测试结果总结");

    if (afterCheck.count === 0) {
      console.log("🎉 测试成功！所有守护进程都可以被正确停止！");
      console.log("✅ 警告信息中提到的问题已解决");
    } else {
      console.log("❌ 测试失败！仍有守护进程无法停止");
    }
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
    console.error(error.stack);
  }
}

// 运行测试
if (require.main === module) {
  testStopGuardian()
    .then(() => {
      console.log("\n✅ 测试完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ 测试异常:", error);
      process.exit(1);
    });
}

module.exports = {
  testStopGuardian,
  stopAllGuardianProcesses,
  checkGuardianProcesses,
};
