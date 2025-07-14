// 全面测试Cursor和VS Code功能一致性
const path = require("path");
const fs = require("fs");

// 导入设备管理器
const DeviceManager = require("../../modules/desktop-client/src/device-manager");

async function testDualIDEConsistency() {
  console.log("🎯 全面测试Cursor和VS Code功能一致性");
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
    "forceCloseVSCodeIDE",
    "performCompleteCursorReset",
    "performCompleteVSCodeReset",
    "performVSCodeCleanup",
    "updateIDEDeviceIdentity",
    "cleanAugmentIdentityFiles",
    "detectInstalledVSCodeVariants",
    "performSelectiveVSCodeCleanup",
    "performVSCodeIntelligentCleanup",
    "protectMCPConfigUniversal",
    "protectIDESettings",
    "protectWorkspaceSettings",
    "restoreMCPConfigUniversal",
    "restoreIDESettings",
    "restoreWorkspaceSettings",
    "startCursorIDE",
    "startVSCodeIDE",
  ];

  // 保存原方法并创建模拟方法
  methodsToMock.forEach((methodName) => {
    if (typeof deviceManager[methodName] === "function") {
      originalMethods[methodName] = deviceManager[methodName];

      if (methodName === "detectInstalledVSCodeVariants") {
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
  const consistencyReport = {
    intelligent: { cursor: [], vscode: [] },
    standard: { cursor: [], vscode: [] },
    complete: { cursor: [], vscode: [] },
  };

  try {
    // 测试1: 智能清理模式 - 双IDE一致性
    console.log("📋 测试1: 智能清理模式 - 双IDE一致性");
    console.log("-".repeat(50));

    // 测试Cursor + VS Code
    const intelligentOptions = {
      intelligentMode: true,
      cleanCursor: true,
      cleanVSCode: true,
      preserveActivation: true,
      deepClean: false,
      cleanCursorExtension: false,
      autoRestartIDE: true, // 修复：使用正确的参数名
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

    const intelligentResult = await deviceManager.performCleanup(
      intelligentOptions
    );

    // 分析Cursor和VS Code操作
    consistencyReport.intelligent.cursor = intelligentResult.actions.filter(
      (action) =>
        action.includes("Cursor") ||
        action.includes("cleanDeviceIdentityOnly") ||
        action.includes("cleanAugmentDeviceIdentity") ||
        action.includes("startCursorIDE")
    );
    consistencyReport.intelligent.vscode = intelligentResult.actions.filter(
      (action) =>
        action.includes("VS Code") ||
        action.includes("performVSCodeIntelligentCleanup") ||
        action.includes("startVSCodeIDE")
    );

    console.log(
      `🧠 智能清理 - Cursor操作: ${consistencyReport.intelligent.cursor.length}`
    );
    console.log(
      `🧠 智能清理 - VS Code操作: ${consistencyReport.intelligent.vscode.length}`
    );

    // 测试2: 标准清理模式 - 双IDE一致性
    console.log("\n📋 测试2: 标准清理模式 - 双IDE一致性");
    console.log("-".repeat(50));

    const standardOptions = {
      standardMode: true,
      cleanCursor: true,
      cleanVSCode: true,
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartIDE: true, // 修复：使用正确的参数名
      skipBackup: true,
      enableEnhancedGuardian: true,
      skipCursorLogin: true,
      resetCursorCompletely: false,
      resetVSCodeCompletely: false,
      aggressiveMode: true,
      multiRoundClean: true,
      extendedMonitoring: true,
      usePowerShellAssist: true,
    };

    const standardResult = await deviceManager.performCleanup(standardOptions);

    consistencyReport.standard.cursor = standardResult.actions.filter(
      (action) =>
        action.includes("Cursor") ||
        action.includes("cleanCursorExtensionData") ||
        action.includes("startCursorIDE")
    );
    consistencyReport.standard.vscode = standardResult.actions.filter(
      (action) =>
        action.includes("VS Code") ||
        action.includes("performVSCodeCleanup") ||
        action.includes("startVSCodeIDE")
    );

    console.log(
      `🔧 标准清理 - Cursor操作: ${consistencyReport.standard.cursor.length}`
    );
    console.log(
      `🔧 标准清理 - VS Code操作: ${consistencyReport.standard.vscode.length}`
    );

    // 测试3: 完全清理模式 - 双IDE一致性
    console.log("\n📋 测试3: 完全清理模式 - 双IDE一致性");
    console.log("-".repeat(50));

    const completeOptions = {
      completeMode: true,
      cleanCursor: true,
      cleanVSCode: true,
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartIDE: true, // 修复：使用正确的参数名
      skipBackup: true,
      enableEnhancedGuardian: true,
      skipCursorLogin: false,
      resetCursorCompletely: true,
      resetVSCodeCompletely: true,
      aggressiveMode: true,
      multiRoundClean: true,
      extendedMonitoring: true,
      usePowerShellAssist: true,
    };

    const completeResult = await deviceManager.performCleanup(completeOptions);

    consistencyReport.complete.cursor = completeResult.actions.filter(
      (action) =>
        action.includes("Cursor") ||
        action.includes("performCompleteCursorReset") ||
        action.includes("startCursorIDE")
    );
    consistencyReport.complete.vscode = completeResult.actions.filter(
      (action) =>
        action.includes("VS Code") ||
        action.includes("performCompleteVSCodeReset") ||
        action.includes("startVSCodeIDE")
    );

    console.log(
      `💥 完全清理 - Cursor操作: ${consistencyReport.complete.cursor.length}`
    );
    console.log(
      `💥 完全清理 - VS Code操作: ${consistencyReport.complete.vscode.length}`
    );

    // 一致性分析
    console.log("\n\n📊 双IDE功能一致性分析");
    console.log("=".repeat(60));

    // 检查核心功能对等性
    const coreFeatures = [
      { name: "MCP配置保护", pattern: /保护MCP配置|protectMCP/ },
      { name: "设备身份清理", pattern: /设备身份|DeviceIdentity/ },
      { name: "IDE关闭", pattern: /关闭.*IDE|forceClose/ },
      { name: "IDE启动", pattern: /启动.*IDE|start.*IDE/ },
      { name: "完全重置", pattern: /完全重置|CompleteReset/ },
    ];

    console.log("🔍 核心功能对等性检查:");
    coreFeatures.forEach((feature) => {
      const intelligentCursor = consistencyReport.intelligent.cursor.some(
        (action) => feature.pattern.test(action)
      );
      const intelligentVSCode = consistencyReport.intelligent.vscode.some(
        (action) => feature.pattern.test(action)
      );
      const standardCursor = consistencyReport.standard.cursor.some((action) =>
        feature.pattern.test(action)
      );
      const standardVSCode = consistencyReport.standard.vscode.some((action) =>
        feature.pattern.test(action)
      );
      const completeCursor = consistencyReport.complete.cursor.some((action) =>
        feature.pattern.test(action)
      );
      const completeVSCode = consistencyReport.complete.vscode.some((action) =>
        feature.pattern.test(action)
      );

      console.log(`\n  ${feature.name}:`);
      console.log(
        `    智能模式: Cursor ${intelligentCursor ? "✅" : "❌"} | VS Code ${
          intelligentVSCode ? "✅" : "❌"
        }`
      );
      console.log(
        `    标准模式: Cursor ${standardCursor ? "✅" : "❌"} | VS Code ${
          standardVSCode ? "✅" : "❌"
        }`
      );
      console.log(
        `    完全模式: Cursor ${completeCursor ? "✅" : "❌"} | VS Code ${
          completeVSCode ? "✅" : "❌"
        }`
      );
    });

    // 操作数量对比
    console.log("\n📈 操作数量对比:");
    console.log(
      `  智能模式: Cursor ${consistencyReport.intelligent.cursor.length} vs VS Code ${consistencyReport.intelligent.vscode.length}`
    );
    console.log(
      `  标准模式: Cursor ${consistencyReport.standard.cursor.length} vs VS Code ${consistencyReport.standard.vscode.length}`
    );
    console.log(
      `  完全模式: Cursor ${consistencyReport.complete.cursor.length} vs VS Code ${consistencyReport.complete.vscode.length}`
    );

    // 一致性评分
    console.log("\n⭐ 一致性评分:");
    const intelligentConsistency =
      Math.abs(
        consistencyReport.intelligent.cursor.length -
          consistencyReport.intelligent.vscode.length
      ) <= 2;
    const standardConsistency =
      Math.abs(
        consistencyReport.standard.cursor.length -
          consistencyReport.standard.vscode.length
      ) <= 2;
    const completeConsistency =
      Math.abs(
        consistencyReport.complete.cursor.length -
          consistencyReport.complete.vscode.length
      ) <= 2;

    console.log(
      `  智能模式一致性: ${intelligentConsistency ? "✅ 优秀" : "⚠️ 需改进"}`
    );
    console.log(
      `  标准模式一致性: ${standardConsistency ? "✅ 优秀" : "⚠️ 需改进"}`
    );
    console.log(
      `  完全模式一致性: ${completeConsistency ? "✅ 优秀" : "⚠️ 需改进"}`
    );

    const overallScore = [
      intelligentConsistency,
      standardConsistency,
      completeConsistency,
    ].filter(Boolean).length;
    console.log(
      `\n🎯 总体一致性评分: ${overallScore}/3 ${
        overallScore === 3
          ? "🏆 完美"
          : overallScore >= 2
          ? "👍 良好"
          : "⚠️ 需改进"
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

  return consistencyReport;
}

// 运行测试
if (require.main === module) {
  testDualIDEConsistency()
    .then((report) => {
      console.log("\n🎉 双IDE一致性测试完成");

      // 生成详细报告
      const detailedReport = {
        timestamp: new Date().toISOString(),
        consistency: report,
        summary: {
          intelligent_cursor_ops: report.intelligent.cursor.length,
          intelligent_vscode_ops: report.intelligent.vscode.length,
          standard_cursor_ops: report.standard.cursor.length,
          standard_vscode_ops: report.standard.vscode.length,
          complete_cursor_ops: report.complete.cursor.length,
          complete_vscode_ops: report.complete.vscode.length,
        },
      };

      // 保存测试报告
      const reportPath = path.join(
        __dirname,
        "dual-ide-consistency-report.json"
      );
      fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
      console.log(`📄 一致性测试报告已保存: ${reportPath}`);
    })
    .catch((error) => {
      console.error("❌ 测试失败:", error);
      process.exit(1);
    });
}

module.exports = { testDualIDEConsistency };
