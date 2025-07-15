const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { EnhancedDeviceGuardian } = require("../../modules/desktop-client/src/enhanced-device-guardian");

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testVSCodePeriodicVerification() {
  console.log("🧪 测试VSCode设备ID定期验证功能");
  console.log("=".repeat(50));

  const guardian = new EnhancedDeviceGuardian();
  const userHome = os.homedir();
  const vscodeStoragePath = path.join(
    userHome,
    "AppData",
    "Roaming",
    "Code",
    "User",
    "globalStorage",
    "storage.json"
  );

  try {
    // 1. 准备测试环境
    console.log("\n1️⃣ 准备测试环境...");
    await fs.ensureDir(path.dirname(vscodeStoragePath));
    
    const targetDeviceId = "periodic-test-device-id-12345";
    const initialData = {
      "telemetry.devDeviceId": targetDeviceId,
      "telemetry.machineId": "test-machine-id"
    };
    await fs.writeJson(vscodeStoragePath, initialData, { spaces: 2 });
    console.log("✅ 创建初始storage.json");

    // 2. 启动守护进程，选择VSCode
    console.log("\n2️⃣ 启动VSCode守护进程...");
    
    // 暂时禁用文件监控，只测试定期验证
    guardian.config.fileWatchDebounce = 10000; // 设置很长的防抖时间
    
    const startResult = await guardian.startGuarding(targetDeviceId, {
      selectedIDE: "vscode"
    });
    
    if (!startResult.success) {
      throw new Error(`启动守护进程失败: ${startResult.message}`);
    }
    console.log("✅ 守护进程已启动");
    console.log(`📍 目标设备ID: ${targetDeviceId}`);
    console.log(`🔄 定期验证间隔: ${guardian.config.deviceIdVerifyInterval}ms`);

    // 3. 等待一下让系统稳定
    await sleep(500);

    // 4. 手动修改设备ID（模拟外部修改）
    console.log("\n3️⃣ 手动修改设备ID（禁用文件监控触发）...");
    const modifiedId = "external-modified-id-99999";
    
    // 直接修改文件，不触发文件监控
    const data = await fs.readJson(vscodeStoragePath);
    data["telemetry.devDeviceId"] = modifiedId;
    await fs.writeJson(vscodeStoragePath, data, { spaces: 2 });
    console.log(`📝 已修改设备ID为: ${modifiedId}`);

    // 5. 立即验证修改是否生效
    const modifiedData = await fs.readJson(vscodeStoragePath);
    console.log(`✅ 确认修改生效: ${modifiedData["telemetry.devDeviceId"]}`);

    // 6. 等待定期验证触发
    console.log("\n4️⃣ 等待定期验证触发...");
    console.log("⏳ 等待1.5秒（定期验证间隔1秒）...");
    
    // 记录恢复前的状态
    const beforeStats = await guardian.getStatus();
    console.log(`恢复前状态 - 恢复次数: ${beforeStats.stats.protectionRestored}`);
    
    await sleep(1500);

    // 7. 验证设备ID是否被恢复
    console.log("\n5️⃣ 验证定期恢复结果...");
    const finalData = await fs.readJson(vscodeStoragePath);
    const finalDeviceId = finalData["telemetry.devDeviceId"];
    
    console.log(`最终设备ID: ${finalDeviceId}`);
    
    // 获取恢复后的状态
    const afterStats = await guardian.getStatus();
    console.log(`恢复后状态 - 恢复次数: ${afterStats.stats.protectionRestored}`);
    
    if (finalDeviceId === targetDeviceId) {
      console.log("✅ 定期验证成功恢复了设备ID！");
      if (afterStats.stats.protectionRestored > beforeStats.stats.protectionRestored) {
        console.log("✅ 恢复统计计数正确增加");
      }
    } else {
      console.log("❌ 定期验证未能恢复设备ID");
      console.log(`  期望: ${targetDeviceId}`);
      console.log(`  实际: ${finalDeviceId}`);
    }

    // 8. 停止守护进程
    console.log("\n6️⃣ 停止守护进程...");
    await guardian.stopGuarding();
    console.log("✅ 守护进程已停止");

    // 测试总结
    console.log("\n" + "=".repeat(50));
    if (finalDeviceId === targetDeviceId && 
        afterStats.stats.protectionRestored > beforeStats.stats.protectionRestored) {
      console.log("✅ VSCode设备ID定期验证功能测试通过！");
    } else {
      console.log("❌ VSCode设备ID定期验证功能测试失败！");
    }

  } catch (error) {
    console.error("❌ 测试过程中出错:", error);
    
    // 确保停止守护进程
    try {
      await guardian.stopGuarding();
    } catch (e) {
      // 忽略停止错误
    }
  }
}

// 运行测试
(async () => {
  await testVSCodePeriodicVerification();
  process.exit(0);
})();