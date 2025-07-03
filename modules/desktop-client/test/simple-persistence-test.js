/**
 * 简化的防护进程持久性测试
 * 验证防护进程的启动、状态检测和持久性
 */

const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

async function testGuardianPersistence() {
  console.log("🚀 开始简化的防护进程持久性测试");

  try {
    // 1. 导入DeviceManager
    const DeviceManager = require("../src/device-manager");
    const deviceManager = new DeviceManager();

    console.log("\n📍 步骤1: 启动防护服务");
    const startResult = await deviceManager.startEnhancedGuardianIndependently({
      enableBackupMonitoring: true,
      enableDatabaseMonitoring: true,
      enableEnhancedProtection: true,
    });

    console.log("启动结果:", {
      success: startResult.success,
      message: startResult.message,
      mode: startResult.mode,
      deviceId: startResult.deviceId,
    });

    if (!startResult.success) {
      console.log("❌ 防护服务启动失败");
      return;
    }

    console.log("\n📍 步骤2: 检查防护状态");
    const status1 = await deviceManager.getEnhancedGuardianStatus();
    console.log("防护状态:", {
      isGuarding: status1.isGuarding,
      mode: status1.mode,
      standalone: {
        isRunning: status1.standalone?.isRunning,
        pid: status1.standalone?.pid,
        deviceId: status1.standalone?.config?.deviceId,
      },
      inProcess: {
        isGuarding: status1.inProcess?.isGuarding,
      },
    });

    if (!status1.isGuarding) {
      console.log("❌ 防护状态检测失败");
      return;
    }

    console.log("\n📍 步骤3: 检查进程是否存在");
    const pid = status1.standalone?.pid;
    if (pid) {
      const processExists = await checkProcessExists(pid);
      console.log(`进程 ${pid} 存在: ${processExists}`);

      if (!processExists) {
        console.log("❌ 防护进程不存在");
        return;
      }
    } else {
      console.log("⚠️ 无法获取防护进程PID");
    }

    console.log("\n📍 步骤4: 模拟客户端重新启动（重新创建DeviceManager）");
    // 重新创建DeviceManager实例，模拟客户端重启
    const newDeviceManager = new DeviceManager();

    // 等待一下，模拟客户端重启过程
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("\n📍 步骤5: 重新检查防护状态");
    const status2 = await newDeviceManager.getEnhancedGuardianStatus();
    console.log("重启后的防护状态:", {
      isGuarding: status2.isGuarding,
      mode: status2.mode,
      standalone: {
        isRunning: status2.standalone?.isRunning,
        pid: status2.standalone?.pid,
        deviceId: status2.standalone?.config?.deviceId,
      },
    });

    if (status2.isGuarding && status2.standalone?.isRunning) {
      console.log("✅ 防护进程持久性测试成功！");
      console.log("✅ 客户端重启后能正确检测到运行中的防护进程");
    } else {
      console.log("❌ 防护进程持久性测试失败");
      console.log("❌ 客户端重启后无法检测到防护进程");
    }

    console.log("\n📍 步骤6: 清理测试环境");
    try {
      const stopResult = await newDeviceManager.stopEnhancedGuardian();
      console.log("停止结果:", {
        success: stopResult.success,
        message: stopResult.message,
        actions: stopResult.actions?.length || 0,
        errors: stopResult.errors?.length || 0,
      });
    } catch (error) {
      console.log("清理过程中出现错误:", error.message);
    }

    console.log("\n🎉 测试完成");
  } catch (error) {
    console.error("❌ 测试过程中出现错误:", error.message);
  }
}

async function checkProcessExists(pid) {
  try {
    if (process.platform === "win32") {
      const { stdout } = await execAsync(
        `tasklist /fi "PID eq ${pid}" /fo csv`
      );
      return stdout.includes(pid.toString());
    } else {
      try {
        process.kill(pid, 0);
        return true;
      } catch (error) {
        return false;
      }
    }
  } catch (error) {
    return false;
  }
}

// 运行测试
if (require.main === module) {
  testGuardianPersistence().catch(console.error);
}

module.exports = testGuardianPersistence;
