/**
 * VSCode集成测试脚本
 * 测试通过设备管理器界面进行VSCode清理的完整流程
 */

const fs = require("fs-extra");
const path = require("path");
const os = require("os");

const DeviceManager = require("../src/device-manager");

async function testVSCodeIntegration() {
  console.log("🔧 开始VSCode集成测试...\n");

  try {
    const deviceManager = new DeviceManager();

    // 1. 模拟用户选择VSCode清理选项
    console.log("📋 模拟用户选择VSCode清理选项:");
    const cleanupOptions = {
      // 基础选项
      preserveActivation: true,
      deepClean: false,
      autoRestartCursor: false,

      // IDE选择
      cleanCursor: false, // 不清理Cursor
      cleanVSCode: true, // 清理VSCode

      // 清理模式
      skipCursorLogin: true,
      resetCursorCompletely: false,
      resetVSCodeCompletely: false, // 智能清理模式

      // 其他选项
      aggressiveMode: false,
      multiRoundClean: false,
      extendedMonitoring: false,
      skipBackup: true, // 跳过备份以防止恢复
    };

    console.log("选择的清理选项:");
    console.log(`   清理Cursor: ${cleanupOptions.cleanCursor}`);
    console.log(`   清理VSCode: ${cleanupOptions.cleanVSCode}`);
    console.log(`   VSCode完全重置: ${cleanupOptions.resetVSCodeCompletely}`);
    console.log(`   跳过备份: ${cleanupOptions.skipBackup}`);

    // 2. 检查清理前的VSCode状态
    console.log("\n📄 检查清理前的VSCode状态:");
    const vscodeVariants = await deviceManager.detectInstalledVSCodeVariants();
    const beforeState = {};

    for (const variant of vscodeVariants) {
      const storageJsonPath = path.join(variant.globalStorage, "storage.json");
      if (await fs.pathExists(storageJsonPath)) {
        const storageData = await fs.readJson(storageJsonPath);
        beforeState[variant.name] = {
          devDeviceId: storageData["telemetry.devDeviceId"],
          machineId: storageData["telemetry.machineId"],
          sqmId: storageData["telemetry.sqmId"],
        };
        console.log(
          `   ${variant.name} 清理前设备ID: ${storageData["telemetry.devDeviceId"]}`
        );
      }
    }

    // 3. 执行智能清理（模拟设备管理器的主要清理流程）
    console.log("\n🧠 执行智能清理流程:");

    // 初始化结果对象
    const results = {
      success: true,
      actions: [],
      errors: [],
      options: cleanupOptions,
    };

    // 执行智能清理
    await deviceManager.performIntelligentCleanup(results, cleanupOptions);

    // 4. 显示清理结果
    console.log("\n📊 清理结果摘要:");
    console.log(`   成功: ${results.success}`);
    console.log(`   执行的操作数: ${results.actions.length}`);
    console.log(`   错误数: ${results.errors.length}`);

    // 显示关键操作
    console.log("\n🔍 关键操作:");
    const vscodeActions = results.actions.filter(
      (action) => action.includes("VS Code") || action.includes("VSCode")
    );
    vscodeActions.forEach((action) => console.log(`   ${action}`));

    // 显示错误（如果有）
    if (results.errors.length > 0) {
      console.log("\n❌ 错误信息:");
      results.errors.forEach((error) => console.log(`   ${error}`));
    }

    // 5. 验证清理后的状态
    console.log("\n🔍 验证清理后的状态:");
    const afterState = {};

    for (const variant of vscodeVariants) {
      const storageJsonPath = path.join(variant.globalStorage, "storage.json");
      if (await fs.pathExists(storageJsonPath)) {
        const storageData = await fs.readJson(storageJsonPath);
        afterState[variant.name] = {
          devDeviceId: storageData["telemetry.devDeviceId"],
          machineId: storageData["telemetry.machineId"],
          sqmId: storageData["telemetry.sqmId"],
        };
        console.log(
          `   ${variant.name} 清理后设备ID: ${storageData["telemetry.devDeviceId"]}`
        );
      }
    }

    // 6. 比较清理前后的变化
    console.log("\n📈 设备ID变化对比:");
    for (const variant of vscodeVariants) {
      if (beforeState[variant.name] && afterState[variant.name]) {
        const before = beforeState[variant.name];
        const after = afterState[variant.name];

        console.log(`\n${variant.name} 变化情况:`);
        console.log(
          `   devDeviceId: ${
            before.devDeviceId !== after.devDeviceId ? "✅ 已更新" : "❌ 未更新"
          }`
        );
        console.log(
          `   machineId: ${
            before.machineId !== after.machineId ? "✅ 已更新" : "❌ 未更新"
          }`
        );
        console.log(
          `   sqmId: ${
            before.sqmId !== after.sqmId ? "✅ 已更新" : "❌ 未更新"
          }`
        );
      }
    }

    console.log("\n✅ VSCode集成测试完成!");

    return {
      success: results.success,
      vscodeProcessed: vscodeVariants.length > 0,
      deviceIdUpdated: Object.keys(afterState).some(
        (variant) =>
          beforeState[variant] &&
          beforeState[variant].devDeviceId !== afterState[variant].devDeviceId
      ),
    };
  } catch (error) {
    console.error("❌ 集成测试失败:", error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

// 运行测试
if (require.main === module) {
  testVSCodeIntegration()
    .then((result) => {
      console.log("\n🎯 测试结果总结:");
      console.log(`   整体成功: ${result.success}`);
      console.log(`   VSCode已处理: ${result.vscodeProcessed}`);
      console.log(`   设备ID已更新: ${result.deviceIdUpdated}`);
    })
    .catch(console.error);
}

module.exports = { testVSCodeIntegration };
