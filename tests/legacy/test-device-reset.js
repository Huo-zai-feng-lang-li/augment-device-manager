const DeviceManager = require("./desktop-client/src/device-manager");

async function testDeviceReset() {
  console.log("🧪 开始测试设备重置功能...\n");

  try {
    const deviceManager = new DeviceManager();

    // 检查清理前的设备ID
    console.log("📊 清理前设备ID状态:");
    const beforeDeviceId = await deviceManager.getCurrentDeviceId();
    console.log(`  当前设备ID: ${beforeDeviceId || "未找到"}\n`);

    // 执行清理操作（包含Cursor扩展重置）
    console.log("🧹 执行设备清理（包含Cursor扩展重置）...");
    const cleanupOptions = {
      preserveActivation: true, // 保留激活状态
      cleanCursor: true, // 清理Cursor
      cleanCursorExtension: true, // 清理Cursor扩展数据
      autoRestartCursor: false, // 不自动重启
      aggressiveMode: true, // 激进模式
      multiRoundClean: true, // 多轮清理
    };

    const results = await deviceManager.performCleanup(cleanupOptions);

    console.log("\n📋 清理结果:");
    console.log(`  成功: ${results.success ? "✅" : "❌"}`);
    console.log(`  操作数量: ${results.actions.length}`);
    console.log(`  错误数量: ${results.errors.length}`);

    if (results.errors.length > 0) {
      console.log("\n❌ 错误详情:");
      results.errors.forEach((error) => console.log(`  • ${error}`));
    }

    // 等待一下让清理完全生效
    console.log("\n⏳ 等待3秒让清理生效...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 检查清理后的设备ID
    console.log("\n📊 清理后设备ID状态:");
    const afterDeviceId = await deviceManager.getCurrentDeviceId();
    console.log(`  新设备ID: ${afterDeviceId || "未找到"}`);

    // 比较设备ID变化
    if (beforeDeviceId && afterDeviceId) {
      const deviceIdChanged = beforeDeviceId !== afterDeviceId;
      console.log(`  设备ID已更新: ${deviceIdChanged ? "✅ 是" : "❌ 否"}`);

      if (deviceIdChanged) {
        console.log(
          `  变化: ${beforeDeviceId.substring(
            0,
            16
          )}... → ${afterDeviceId.substring(0, 16)}...`
        );
      }
    }

    // 检查是否不再是老的设备ID
    const oldDeviceId = "36987e70-60fe-4401-85a4-f463c269f069";
    if (afterDeviceId !== oldDeviceId) {
      console.log("🎉 扩展插件重置成功！设备不再被识别为老用户");
    } else {
      console.log("⚠️ 扩展插件重置可能未完全成功，仍然是老的设备ID");
    }
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
  }
}

// 运行测试
if (require.main === module) {
  testDeviceReset();
}

module.exports = { testDeviceReset };
