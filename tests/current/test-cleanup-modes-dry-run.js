const path = require("path");
const fs = require("fs-extra");

// 干运行测试：验证不同清理模式的执行路径
async function testCleanupModesDryRun() {
  console.log("🧪 清理模式干运行测试");
  console.log("=".repeat(60));

  try {
    // 加载设备管理器
    const DeviceManager = require("../../modules/desktop-client/src/device-manager");
    const deviceManager = new DeviceManager();

    // 模拟干运行模式 - 重写关键方法避免实际删除
    const originalMethods = {};
    const dryRunMethods = [
      "cleanActivationData",
      "cleanAugmentStorage",
      "cleanStateDatabase",
      "cleanWindowsRegistry",
      "cleanTempFiles",
      "cleanBrowserData",
      "cleanCursorExtensionData",
      "performVSCodeCleanup",
      "cleanDeviceIdentityOnly",
      "cleanAugmentDeviceIdentity",
      "regenerateDeviceFingerprint",
      "forceCloseCursorIDE",
      "performCompleteCursorReset",
      "performCompleteVSCodeReset",
    ];

    // 保存原方法并替换为干运行版本
    dryRunMethods.forEach((methodName) => {
      if (typeof deviceManager[methodName] === "function") {
        originalMethods[methodName] = deviceManager[methodName];
        deviceManager[methodName] = async function (results, options = {}) {
          results.actions.push(
            `🔍 [DRY RUN] ${methodName}() - 参数: ${JSON.stringify(
              options,
              null,
              2
            )}`
          );
          return { success: true };
        };
      }
    });

    console.log("✅ 干运行模式已启用 - 不会执行实际删除操作\n");

    // 测试1: 智能清理模式
    console.log("📋 测试1: 智能清理模式");
    console.log("-".repeat(40));

    const intelligentOptions = {
      preserveActivation: true,
      deepClean: false,
      cleanCursorExtension: false,
      autoRestartCursor: false,
      skipBackup: true,
      enableEnhancedGuardian: true,
      skipCursorLogin: true,
      resetCursorCompletely: false,
      resetVSCodeCompletely: false,
      aggressiveMode: false,
      multiRoundClean: false,
      extendedMonitoring: false,
      usePowerShellAssist: false,
      intelligentMode: true,
      cleanCursor: false,
      cleanVSCode: false,
    };

    console.log("🧠 智能清理模式参数:");
    console.log(JSON.stringify(intelligentOptions, null, 2));

    const intelligentResult = await deviceManager.performCleanup(
      intelligentOptions
    );

    console.log("\n🧠 智能清理执行路径:");
    intelligentResult.actions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    // 测试2: 标准清理模式
    console.log("\n\n📋 测试2: 标准清理模式");
    console.log("-".repeat(40));

    const standardOptions = {
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartCursor: true,
      skipBackup: true,
      enableEnhancedGuardian: true,
      skipCursorLogin: true,
      resetCursorCompletely: false,
      resetVSCodeCompletely: false,
      aggressiveMode: true,
      multiRoundClean: true,
      extendedMonitoring: true,
      usePowerShellAssist: true,
      standardMode: true,
      cleanCursor: true,
      cleanVSCode: false,
    };

    console.log("🔧 标准清理模式参数:");
    console.log(JSON.stringify(standardOptions, null, 2));

    const standardResult = await deviceManager.performCleanup(standardOptions);

    console.log("\n🔧 标准清理执行路径:");
    standardResult.actions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    // 测试3: 完全清理模式
    console.log("\n\n📋 测试3: 完全清理模式");
    console.log("-".repeat(40));

    const completeOptions = {
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartCursor: true,
      skipBackup: true,
      enableEnhancedGuardian: true,
      skipCursorLogin: false,
      resetCursorCompletely: true,
      resetVSCodeCompletely: true,
      aggressiveMode: true,
      multiRoundClean: true,
      extendedMonitoring: true,
      usePowerShellAssist: true,
      completeMode: true,
      cleanCursor: true,
      cleanVSCode: true,
    };

    console.log("💥 完全清理模式参数:");
    console.log(JSON.stringify(completeOptions, null, 2));

    const completeResult = await deviceManager.performCleanup(completeOptions);

    console.log("\n💥 完全清理执行路径:");
    completeResult.actions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    // 分析对比
    console.log("\n\n📊 执行路径对比分析");
    console.log("=".repeat(60));

    console.log(`🧠 智能清理: ${intelligentResult.actions.length} 个步骤`);
    console.log(`🔧 标准清理: ${standardResult.actions.length} 个步骤`);
    console.log(`💥 完全清理: ${completeResult.actions.length} 个步骤`);

    // 检查关键差异
    console.log("\n🔍 关键差异分析:");

    const hasIntelligentCleanup = intelligentResult.actions.some((action) =>
      action.includes("performIntelligentCleanup")
    );
    const hasStandardCleanup = standardResult.actions.some((action) =>
      action.includes("performStandardModeCleanup")
    );
    const hasCompleteCleanup = completeResult.actions.some((action) =>
      action.includes("performCompleteModeCleanup")
    );

    console.log(
      `  智能清理调用专用方法: ${hasIntelligentCleanup ? "✅" : "❌"}`
    );
    console.log(`  标准清理调用专用方法: ${hasStandardCleanup ? "✅" : "❌"}`);
    console.log(`  完全清理调用专用方法: ${hasCompleteCleanup ? "✅" : "❌"}`);

    // 恢复原方法
    Object.keys(originalMethods).forEach((methodName) => {
      deviceManager[methodName] = originalMethods[methodName];
    });

    console.log("\n✅ 干运行测试完成 - 原方法已恢复");

    return {
      intelligent: intelligentResult,
      standard: standardResult,
      complete: completeResult,
    };
  } catch (error) {
    console.error("❌ 干运行测试失败:", error.message);
    console.error(error.stack);
    return null;
  }
}

// 运行测试
if (require.main === module) {
  testCleanupModesDryRun()
    .then((results) => {
      if (results) {
        console.log("\n🎉 所有清理模式测试完成");
        process.exit(0);
      } else {
        console.log("\n❌ 测试失败");
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("❌ 测试执行失败:", error);
      process.exit(1);
    });
}

module.exports = { testCleanupModesDryRun };
