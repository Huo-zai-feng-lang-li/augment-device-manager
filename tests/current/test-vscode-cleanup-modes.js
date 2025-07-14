// 测试VS Code在三种清理模式中的支持
const path = require("path");
const fs = require("fs");

// 导入设备管理器
const DeviceManager = require("../../modules/desktop-client/src/device-manager");

async function testVSCodeCleanupModes() {
  console.log("🧪 测试VS Code在三种清理模式中的支持");
  console.log("=".repeat(60));

  const deviceManager = new DeviceManager();

  // 启用干运行模式
  const originalMethods = {};
  const methodsToMock = [
    "cleanActivationData",
    "cleanAugmentStorage",
    "cleanStateDatabase",
    "cleanWindowsRegistry",
    "cleanTempFiles",
    "cleanBrowserData",
    "cleanCursorExtensionData",
    "regenerateDeviceFingerprint",
    "cleanDeviceIdentityOnly",
    "cleanAugmentDeviceIdentity",
    "forceCloseCursorIDE",
    "performCompleteCursorReset",
    "performCompleteVSCodeReset",
    "performVSCodeCleanup",
    "updateIDEDeviceIdentity",
    "cleanAugmentIdentityFiles",
    "detectInstalledVSCodeVariants",
    "performSelectiveVSCodeCleanup",
  ];

  // 保存原方法并创建模拟方法
  methodsToMock.forEach((methodName) => {
    if (typeof deviceManager[methodName] === "function") {
      originalMethods[methodName] = deviceManager[methodName];

      if (methodName === "detectInstalledVSCodeVariants") {
        // 特殊处理：返回模拟的VS Code变体
        deviceManager[methodName] = async function () {
          return [
            {
              name: "stable",
              globalStorage:
                "C:\\Users\\Administrator\\AppData\\Roaming\\Code\\User\\globalStorage",
              extensions: "C:\\Users\\Administrator\\.vscode\\extensions",
            },
          ];
        };
      } else {
        deviceManager[methodName] = async function (results, ...args) {
          if (results && results.actions) {
            results.actions.push(`🧪 [DRY RUN] ${methodName}() - 执行模拟操作`);
          }
          return { success: true };
        };
      }
    }
  });

  console.log("✅ 干运行模式已启用 - 不会执行实际删除操作\n");

  // 测试结果收集
  const testResults = {
    intelligent: null,
    standard: null,
    complete: null,
  };

  try {
    // 测试1: 智能清理模式 - VS Code支持
    console.log("📋 测试1: 智能清理模式 - VS Code支持");
    console.log("-".repeat(40));

    const intelligentOptions = {
      intelligentMode: true,
      cleanCursor: true,
      cleanVSCode: true, // 重点：启用VS Code清理
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
    };

    console.log("🧠 智能清理模式 - VS Code参数:");
    console.log("   - intelligentMode: true");
    console.log("   - cleanVSCode: true (启用VS Code清理)");
    console.log("   - resetVSCodeCompletely: false (不完全重置)");

    testResults.intelligent = await deviceManager.performCleanup(
      intelligentOptions
    );

    console.log("\n🧠 智能清理执行路径:");
    testResults.intelligent.actions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    // 测试2: 标准清理模式 - VS Code支持
    console.log("\n\n📋 测试2: 标准清理模式 - VS Code支持");
    console.log("-".repeat(40));

    const standardOptions = {
      standardMode: true,
      cleanCursor: true,
      cleanVSCode: true, // 重点：启用VS Code清理
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartCursor: true,
      skipBackup: true,
      enableEnhancedGuardian: true,
      skipCursorLogin: true,
      resetCursorCompletely: false,
      resetVSCodeCompletely: false, // 标准模式不完全重置
      aggressiveMode: true,
      multiRoundClean: true,
      extendedMonitoring: true,
      usePowerShellAssist: true,
    };

    console.log("🔧 标准清理模式 - VS Code参数:");
    console.log("   - standardMode: true");
    console.log("   - cleanVSCode: true (启用VS Code清理)");
    console.log("   - resetVSCodeCompletely: false (不完全重置)");

    testResults.standard = await deviceManager.performCleanup(standardOptions);

    console.log("\n🔧 标准清理执行路径:");
    testResults.standard.actions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    // 测试3: 完全清理模式 - VS Code支持
    console.log("\n\n📋 测试3: 完全清理模式 - VS Code支持");
    console.log("-".repeat(40));

    const completeOptions = {
      completeMode: true,
      cleanCursor: true,
      cleanVSCode: true, // 重点：启用VS Code清理
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartCursor: true,
      skipBackup: true,
      enableEnhancedGuardian: true,
      skipCursorLogin: false,
      resetCursorCompletely: true,
      resetVSCodeCompletely: true, // 完全模式完全重置
      aggressiveMode: true,
      multiRoundClean: true,
      extendedMonitoring: true,
      usePowerShellAssist: true,
    };

    console.log("💥 完全清理模式 - VS Code参数:");
    console.log("   - completeMode: true");
    console.log("   - cleanVSCode: true (启用VS Code清理)");
    console.log("   - resetVSCodeCompletely: true (完全重置VS Code)");

    testResults.complete = await deviceManager.performCleanup(completeOptions);

    console.log("\n💥 完全清理执行路径:");
    testResults.complete.actions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    // VS Code支持验证
    console.log("\n\n📊 VS Code支持验证");
    console.log("=".repeat(60));

    // 检查智能模式VS Code支持
    const intelligentHasVSCodeSupport = testResults.intelligent.actions.some(
      (action) =>
        action.includes("VS Code") ||
        action.includes("updateIDEDeviceIdentity") ||
        action.includes("cleanAugmentIdentityFiles")
    );

    // 检查标准模式VS Code支持
    const standardHasVSCodeSupport = testResults.standard.actions.some(
      (action) => action.includes("performVSCodeCleanup")
    );

    // 检查完全模式VS Code支持
    const completeHasVSCodeSupport = testResults.complete.actions.some(
      (action) =>
        action.includes("performCompleteVSCodeReset") ||
        action.includes("detectInstalledVSCodeVariants")
    );

    console.log(
      `🧠 智能清理模式 VS Code支持: ${
        intelligentHasVSCodeSupport ? "✅" : "❌"
      }`
    );
    console.log(
      `🔧 标准清理模式 VS Code支持: ${standardHasVSCodeSupport ? "✅" : "❌"}`
    );
    console.log(
      `💥 完全清理模式 VS Code支持: ${completeHasVSCodeSupport ? "✅" : "❌"}`
    );

    // 检查VS Code特定操作
    console.log("\n🔍 VS Code特定操作验证:");

    const intelligentVSCodeOps = testResults.intelligent.actions.filter(
      (action) => action.includes("VS Code")
    );
    const standardVSCodeOps = testResults.standard.actions.filter(
      (action) =>
        action.includes("VS Code") || action.includes("performVSCodeCleanup")
    );
    const completeVSCodeOps = testResults.complete.actions.filter(
      (action) =>
        action.includes("VS Code") ||
        action.includes("performCompleteVSCodeReset")
    );

    console.log(`  智能模式 VS Code操作数量: ${intelligentVSCodeOps.length}`);
    console.log(`  标准模式 VS Code操作数量: ${standardVSCodeOps.length}`);
    console.log(`  完全模式 VS Code操作数量: ${completeVSCodeOps.length}`);

    // 功能对等性验证
    console.log("\n⚖️ 功能对等性验证:");

    const cursorOpsIntelligent = testResults.intelligent.actions.filter(
      (action) => action.includes("Cursor")
    ).length;
    const vscodeOpsIntelligent = intelligentVSCodeOps.length;

    console.log(
      `  智能模式 - Cursor操作: ${cursorOpsIntelligent}, VS Code操作: ${vscodeOpsIntelligent}`
    );
    console.log(
      `  功能对等性: ${
        vscodeOpsIntelligent > 0 ? "✅ VS Code有专门支持" : "❌ VS Code支持不足"
      }`
    );
  } catch (error) {
    console.error("❌ 测试过程中发生错误:", error.message);
  } finally {
    // 恢复原方法
    Object.keys(originalMethods).forEach((methodName) => {
      deviceManager[methodName] = originalMethods[methodName];
    });

    console.log("\n✅ 干运行测试完成 - 原方法已恢复");
  }

  return testResults;
}

// 运行测试
if (require.main === module) {
  testVSCodeCleanupModes()
    .then((results) => {
      console.log("\n🎉 VS Code清理模式测试完成");

      // 生成测试报告
      const report = {
        timestamp: new Date().toISOString(),
        results: results,
        summary: {
          intelligent_vscode_support:
            results.intelligent?.actions.some((a) => a.includes("VS Code")) ||
            false,
          standard_vscode_support:
            results.standard?.actions.some((a) =>
              a.includes("performVSCodeCleanup")
            ) || false,
          complete_vscode_support:
            results.complete?.actions.some((a) =>
              a.includes("performCompleteVSCodeReset")
            ) || false,
        },
      };

      // 保存测试报告
      const reportPath = path.join(
        __dirname,
        "vscode-cleanup-modes-test-report.json"
      );
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 VS Code测试报告已保存: ${reportPath}`);
    })
    .catch((error) => {
      console.error("❌ 测试失败:", error);
      process.exit(1);
    });
}

module.exports = { testVSCodeCleanupModes };
