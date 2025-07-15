const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { EnhancedDeviceGuardian } = require("../../modules/desktop-client/src/enhanced-device-guardian");

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testVSCodeDeviceIdRestoration() {
  console.log("🧪 测试VSCode设备ID恢复功能");
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
    // 1. 确保VS Code storage.json存在
    console.log("\n1️⃣ 准备测试环境...");
    await fs.ensureDir(path.dirname(vscodeStoragePath));
    
    // 创建初始storage.json
    const initialData = {
      "telemetry.devDeviceId": "initial-device-id-12345",
      "telemetry.machineId": "test-machine-id",
      "telemetry.sessionCount": 1
    };
    await fs.writeJson(vscodeStoragePath, initialData, { spaces: 2 });
    console.log("✅ 创建初始storage.json");

    // 2. 启动守护进程，选择VSCode
    console.log("\n2️⃣ 启动VSCode设备ID守护进程...");
    const targetDeviceId = "target-device-id-67890";
    const startResult = await guardian.startGuarding(targetDeviceId, {
      selectedIDE: "vscode"
    });
    
    if (!startResult.success) {
      throw new Error(`启动守护进程失败: ${startResult.message}`);
    }
    console.log("✅ 守护进程已启动");
    console.log(`📍 目标设备ID: ${targetDeviceId}`);
    console.log(`🎯 选择的IDE: VSCode`);

    // 等待初始保护生效
    await sleep(1000);

    // 3. 验证初始设备ID是否被设置
    console.log("\n3️⃣ 验证初始设备ID设置...");
    let currentData = await fs.readJson(vscodeStoragePath);
    console.log(`当前设备ID: ${currentData["telemetry.devDeviceId"]}`);
    
    if (currentData["telemetry.devDeviceId"] !== targetDeviceId) {
      console.log("❌ 初始设备ID设置失败");
    } else {
      console.log("✅ 初始设备ID已正确设置");
    }

    // 4. 手动修改设备ID
    console.log("\n4️⃣ 手动修改设备ID...");
    const modifiedDeviceId = "manually-modified-device-id-99999";
    currentData["telemetry.devDeviceId"] = modifiedDeviceId;
    await fs.writeJson(vscodeStoragePath, currentData, { spaces: 2 });
    console.log(`📝 已手动修改设备ID为: ${modifiedDeviceId}`);

    // 5. 等待定期验证恢复设备ID
    console.log("\n5️⃣ 等待定期验证恢复设备ID...");
    console.log("⏳ 等待2秒（验证间隔为1秒）...");
    await sleep(2000);

    // 6. 验证设备ID是否被恢复
    console.log("\n6️⃣ 验证设备ID恢复结果...");
    const finalData = await fs.readJson(vscodeStoragePath);
    const finalDeviceId = finalData["telemetry.devDeviceId"];
    
    console.log(`最终设备ID: ${finalDeviceId}`);
    
    if (finalDeviceId === targetDeviceId) {
      console.log("✅ 设备ID已成功恢复！");
    } else {
      console.log("❌ 设备ID恢复失败");
      console.log(`  期望: ${targetDeviceId}`);
      console.log(`  实际: ${finalDeviceId}`);
    }

    // 7. 获取守护进程状态
    console.log("\n7️⃣ 守护进程状态:");
    const status = await guardian.getStatus();
    console.log(`  - 正在守护: ${status.isGuarding}`);
    console.log(`  - 选择的IDE: ${status.selectedIDE}`);
    console.log(`  - 拦截次数: ${status.stats.interceptedAttempts}`);
    console.log(`  - 恢复次数: ${status.stats.protectionRestored}`);
    console.log(`  - 备份清理: ${status.stats.backupFilesRemoved}`);

    // 8. 停止守护进程
    console.log("\n8️⃣ 停止守护进程...");
    await guardian.stopGuarding();
    console.log("✅ 守护进程已停止");

    // 测试总结
    console.log("\n" + "=".repeat(50));
    if (finalDeviceId === targetDeviceId) {
      console.log("✅ VSCode设备ID恢复功能测试通过！");
    } else {
      console.log("❌ VSCode设备ID恢复功能测试失败！");
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
  await testVSCodeDeviceIdRestoration();
  process.exit(0);
})();