const path = require("path");

/**
 * 直接测试守护进程启动
 * 绕过UI，直接启动和测试守护进程
 */

async function testDirectGuardian() {
  console.log("🚀 直接测试守护进程启动...\n");

  try {
    // 导入守护进程类
    const {
      EnhancedDeviceGuardian,
    } = require("../src/enhanced-device-guardian");

    console.log("📦 已导入EnhancedDeviceGuardian类");

    // 创建守护进程实例
    const guardian = new EnhancedDeviceGuardian();
    console.log("🔧 已创建守护进程实例");

    // 设置目标设备ID
    const targetDeviceId = "d5c5ecfe-adfd-4a19-8325-c324932c9525";
    console.log(`🎯 目标设备ID: ${targetDeviceId}`);

    // 启动守护进程
    console.log("\n🛡️ 启动守护进程...");
    const result = await guardian.startGuarding(targetDeviceId);

    if (result.success) {
      console.log("✅ 守护进程启动成功");
      console.log(`📝 消息: ${result.message}`);

      // 获取状态
      const status = guardian.getStatus();
      console.log("\n📊 守护进程状态:");
      console.log(
        `  运行状态: ${status.isGuarding ? "✅ 运行中" : "❌ 未运行"}`
      );
      console.log(`  目标设备ID: ${status.targetDeviceId}`);
      console.log(`  拦截次数: ${status.stats.interceptedAttempts}`);
      console.log(`  启动时间: ${status.stats.startTime}`);

      // 等待一段时间让监控器初始化
      console.log("\n⏳ 等待监控器初始化...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 测试拦截功能
      console.log("\n🧪 测试拦截功能...");
      await testInterception(guardian);

      // 停止守护进程
      console.log("\n🛑 停止守护进程...");
      await guardian.stopGuarding();
      console.log("✅ 守护进程已停止");
    } else {
      console.log("❌ 守护进程启动失败");
      console.log(`📝 错误: ${result.message}`);
    }
  } catch (error) {
    console.error("❌ 测试过程中发生错误:", error);
    console.error("堆栈信息:", error.stack);
  }
}

async function testInterception(guardian) {
  const fs = require("fs-extra");
  const os = require("os");

  const storageJsonPath = path.join(
    os.homedir(),
    "AppData",
    "Roaming",
    "Cursor",
    "User",
    "globalStorage",
    "storage.json"
  );

  try {
    // 读取原始内容
    const originalContent = await fs.readJson(storageJsonPath);
    const originalDeviceId = originalContent["telemetry.devDeviceId"];

    console.log(`📖 原始设备ID: ${originalDeviceId}`);

    // 修改设备ID
    const testDeviceId = "direct-test-" + Date.now();
    originalContent["telemetry.devDeviceId"] = testDeviceId;

    await fs.writeJson(storageJsonPath, originalContent, { spaces: 2 });
    console.log(`✏️ 已修改设备ID为: ${testDeviceId}`);

    // 等待拦截
    console.log("⏳ 等待拦截响应...");
    let intercepted = false;

    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const currentContent = await fs.readJson(storageJsonPath);
      const currentDeviceId = currentContent["telemetry.devDeviceId"];

      console.log(`  ${(i + 1) * 500}ms: ${currentDeviceId}`);

      if (currentDeviceId !== testDeviceId) {
        intercepted = true;
        console.log(`✅ 拦截成功！响应时间: ${(i + 1) * 500}ms`);
        break;
      }
    }

    if (!intercepted) {
      console.log("❌ 拦截失败，手动恢复...");
      originalContent["telemetry.devDeviceId"] = originalDeviceId;
      await fs.writeJson(storageJsonPath, originalContent, { spaces: 2 });
    }

    // 获取最新状态
    const finalStatus = guardian.getStatus();
    console.log(`📊 最终拦截次数: ${finalStatus.stats.interceptedAttempts}`);
  } catch (error) {
    console.error("❌ 拦截测试失败:", error);
  }
}

// 运行测试
if (require.main === module) {
  testDirectGuardian().catch(console.error);
}

module.exports = { testDirectGuardian };
