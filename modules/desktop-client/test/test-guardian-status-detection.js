const DeviceManager = require("../src/device-manager");
const path = require("path");
const fs = require("fs-extra");

/**
 * 测试防护状态检测机制
 * 验证客户端重启后能正确识别已运行的防护服务
 */

async function testGuardianStatusDetection() {
  console.log("🔍 测试防护状态检测机制");
  console.log("==================================================");

  const deviceManager = new DeviceManager();

  try {
    // 第1步：启动独立防护服务
    console.log("\n🚀 第1步：启动独立防护服务...");
    const cleanupResult = await deviceManager.performCleanup({
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartCursor: false,
      skipBackup: true,
      enableEnhancedGuardian: true,
      useStandaloneService: true, // 强制使用独立服务
      skipCursorLogin: true,
      aggressiveMode: false,
      multiRoundClean: false,
      extendedMonitoring: false,
    });

    if (cleanupResult.success) {
      console.log("✅ 清理操作成功");
      console.log("📋 操作结果:");
      cleanupResult.actions.forEach((action) => console.log(`  ${action}`));
    } else {
      console.log("❌ 清理操作失败");
      cleanupResult.errors.forEach((error) => console.log(`  ${error}`));
      return;
    }

    // 第2步：等待服务完全启动
    console.log("\n⏳ 第2步：等待服务完全启动...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 第3步：检查初始状态
    console.log("\n📊 第3步：检查初始状态...");
    const initialStatus = await deviceManager.getEnhancedGuardianStatus();
    console.log("  初始状态检测结果:");
    console.log(
      `    总体防护状态: ${
        initialStatus.isGuarding ? "✅ 运行中" : "❌ 未运行"
      }`
    );
    console.log(`    运行模式: ${initialStatus.mode}`);
    console.log(
      `    独立服务运行: ${
        initialStatus.standalone?.isRunning ? "✅ 是" : "❌ 否"
      }`
    );
    console.log(`    独立服务PID: ${initialStatus.standalone?.pid || "无"}`);
    console.log(
      `    内置进程运行: ${
        initialStatus.inProcess?.isGuarding ? "✅ 是" : "❌ 否"
      }`
    );

    if (initialStatus.standalone?.config) {
      console.log(
        `    守护设备ID: ${initialStatus.standalone.config.deviceId}`
      );
    }

    // 第4步：模拟客户端重启 - 创建新的DeviceManager实例
    console.log("\n🔄 第4步：模拟客户端重启...");
    const newDeviceManager = new DeviceManager();

    // 等待一下模拟启动延迟
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 第5步：检查重启后的状态检测
    console.log("\n🔍 第5步：检查重启后的状态检测...");
    const restartStatus = await newDeviceManager.getEnhancedGuardianStatus();
    console.log("  重启后状态检测结果:");
    console.log(
      `    总体防护状态: ${
        restartStatus.isGuarding ? "✅ 运行中" : "❌ 未运行"
      }`
    );
    console.log(`    运行模式: ${restartStatus.mode}`);
    console.log(
      `    独立服务运行: ${
        restartStatus.standalone?.isRunning ? "✅ 是" : "❌ 否"
      }`
    );
    console.log(`    独立服务PID: ${restartStatus.standalone?.pid || "无"}`);
    console.log(
      `    内置进程运行: ${
        restartStatus.inProcess?.isGuarding ? "✅ 是" : "❌ 否"
      }`
    );

    // 第6步：验证状态一致性
    console.log("\n✅ 第6步：验证状态一致性...");
    const statusConsistent =
      initialStatus.isGuarding === restartStatus.isGuarding &&
      initialStatus.mode === restartStatus.mode &&
      initialStatus.standalone?.isRunning ===
        restartStatus.standalone?.isRunning;

    if (statusConsistent) {
      console.log("✅ 状态检测一致性测试通过");
      console.log("🎉 客户端重启后能正确识别防护服务状态");
    } else {
      console.log("❌ 状态检测一致性测试失败");
      console.log("⚠️ 客户端重启后状态检测存在问题");
    }

    // 第7步：检查服务健康状态
    console.log("\n🏥 第7步：检查服务健康状态...");
    const serviceStatus = await newDeviceManager.getStandaloneServiceStatus();
    console.log("  服务健康检查结果:");
    console.log(
      `    服务运行: ${serviceStatus.isRunning ? "✅ 正常" : "❌ 异常"}`
    );
    console.log(
      `    配置文件: ${serviceStatus.config ? "✅ 存在" : "❌ 缺失"}`
    );
    console.log(
      `    日志文件: ${
        serviceStatus.recentLogs?.length > 0 ? "✅ 有日志" : "❌ 无日志"
      }`
    );

    if (serviceStatus.recentLogs?.length > 0) {
      console.log("  最近日志:");
      serviceStatus.recentLogs.slice(-3).forEach((log) => {
        console.log(`    ${log}`);
      });
    }

    // 第8步：清理测试环境
    console.log("\n🧹 第8步：清理测试环境...");
    try {
      // 停止独立服务
      const stopResult =
        await newDeviceManager.standaloneService.stopStandaloneService();
      if (stopResult.success) {
        console.log("✅ 独立防护服务已停止");
      } else {
        console.log(`⚠️ 停止服务时出现问题: ${stopResult.message}`);
      }
    } catch (error) {
      console.log(`⚠️ 清理过程中出现错误: ${error.message}`);
    }

    console.log("\n🎯 测试总结:");
    console.log(
      `  状态检测一致性: ${statusConsistent ? "✅ 通过" : "❌ 失败"}`
    );
    console.log(
      `  服务健康检查: ${serviceStatus.isRunning ? "✅ 正常" : "❌ 异常"}`
    );
    console.log(
      `  重启后识别: ${restartStatus.isGuarding ? "✅ 成功" : "❌ 失败"}`
    );
  } catch (error) {
    console.error("❌ 测试过程中发生错误:", error);
  }
}

// 运行测试
if (require.main === module) {
  testGuardianStatusDetection()
    .then(() => {
      console.log("\n✅ 测试完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ 测试失败:", error);
      process.exit(1);
    });
}

module.exports = { testGuardianStatusDetection };
