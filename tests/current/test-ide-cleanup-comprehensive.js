// 全面对比测试：VS Code和Cursor清理功能完全一致性验证
const path = require("path");
const fs = require("fs");

// 导入设备管理器
const DeviceManager = require("../../modules/desktop-client/src/device-manager");

async function testIDECleanupComprehensive() {
  console.log("🔬 全面对比测试：VS Code和Cursor清理功能完全一致性验证");
  console.log("=".repeat(80));

  const deviceManager = new DeviceManager();

  // 启用干运行模式 - 扩展方法列表
  const originalMethods = {};
  const methodsToMock = [
    // 基础清理方法
    "cleanActivationData",
    "cleanAugmentStorage",
    "cleanStateDatabase",
    "cleanWindowsRegistry",
    "cleanTempFiles",
    "cleanBrowserData",
    "cleanDeviceIdentityOnly",
    "cleanAugmentDeviceIdentity",
    "cleanAugmentIdentityFiles",
    "regenerateDeviceFingerprint",

    // Cursor专用方法
    "forceCloseCursorIDE",
    "startCursorIDE",
    "cleanCursorExtensionData",
    "performCompleteCursorReset",
    "performSelectiveCursorCleanup",
    "cleanCursorAugmentData",
    "updateCursorDeviceId",
    "generateFreshCursorIdentity",
    "cleanAdditionalCursorData",

    // VS Code专用方法
    "forceCloseVSCodeIDE",
    "startVSCodeIDE",
    "performVSCodeCleanup",
    "performCompleteVSCodeReset",
    "performSelectiveVSCodeCleanup",
    "performVSCodeIntelligentCleanup",
    "cleanVSCodeAugmentData",
    "updateVSCodeDeviceId",
    "generateFreshVSCodeIdentity",
    "detectInstalledVSCodeVariants",

    // 保护机制方法
    "protectMCPConfigUniversal",
    "protectIDESettings",
    "protectWorkspaceSettings",
    "protectCursorMCPConfig",
    "protectVSCodeMCPConfig",
    "restoreMCPConfigUniversal",
    "restoreIDESettings",
    "restoreWorkspaceSettings",
    "restoreCursorMCPConfig",
    "restoreVSCodeMCPConfig",

    // 流程控制方法
    "closeIDEsBeforeCleanup",
    "startIDEsAfterCleanup",
    "stopEnhancedProtectionBeforeCleanup",
    "startEnhancedGuardian",

    // 模式执行方法
    "performIntelligentCleanup",
    "performStandardModeCleanup",
    "performCompleteModeCleanup",

    // 辅助方法
    "updateIDEDeviceIdentity",
    "performPowerShellAssistedCleanup",
    "performSmartAdminCleanup",
  ];

  // 创建详细的操作记录器
  const operationLogger = {
    cursor: { paths: [], steps: [], protections: [], errors: [] },
    vscode: { paths: [], steps: [], protections: [], errors: [] },
    common: { paths: [], steps: [], protections: [], errors: [] },
  };

  // 保存原方法并创建增强的模拟方法
  methodsToMock.forEach((methodName) => {
    if (typeof deviceManager[methodName] === "function") {
      originalMethods[methodName] = deviceManager[methodName];

      // 特殊处理VS Code变体检测
      if (methodName === "detectInstalledVSCodeVariants") {
        deviceManager[methodName] = async function () {
          const variants = [
            {
              name: "stable",
              globalStorage:
                "C:\\Users\\Administrator\\AppData\\Roaming\\Code\\User\\globalStorage",
              extensions: "C:\\Users\\Administrator\\.vscode\\extensions",
              stateDb:
                "C:\\Users\\Administrator\\AppData\\Roaming\\Code\\User\\globalStorage\\state.vscdb",
              augmentStorage:
                "C:\\Users\\Administrator\\AppData\\Roaming\\Code\\User\\globalStorage\\augment.vscode-augment",
              workspaceStorage:
                "C:\\Users\\Administrator\\AppData\\Roaming\\Code\\User\\workspaceStorage",
              settingsJson:
                "C:\\Users\\Administrator\\AppData\\Roaming\\Code\\User\\settings.json",
            },
            {
              name: "insiders",
              globalStorage:
                "C:\\Users\\Administrator\\AppData\\Roaming\\Code - Insiders\\User\\globalStorage",
              extensions:
                "C:\\Users\\Administrator\\.vscode-insiders\\extensions",
              stateDb:
                "C:\\Users\\Administrator\\AppData\\Roaming\\Code - Insiders\\User\\globalStorage\\state.vscdb",
              augmentStorage:
                "C:\\Users\\Administrator\\AppData\\Roaming\\Code - Insiders\\User\\globalStorage\\augment.vscode-augment",
              workspaceStorage:
                "C:\\Users\\Administrator\\AppData\\Roaming\\Code - Insiders\\User\\workspaceStorage",
              settingsJson:
                "C:\\Users\\Administrator\\AppData\\Roaming\\Code - Insiders\\User\\settings.json",
            },
          ];

          operationLogger.vscode.paths.push(
            ...variants.map((v) => v.globalStorage)
          );
          return variants;
        };
      } else {
        // 增强的模拟方法，记录详细操作信息
        deviceManager[methodName] = async function (results, ...args) {
          if (results && results.actions) {
            const operation = `🧪 [DRY RUN] ${methodName}()`;
            results.actions.push(operation);

            // 分类记录操作
            if (methodName.toLowerCase().includes("cursor")) {
              operationLogger.cursor.steps.push(methodName);
              if (
                methodName.includes("protect") ||
                methodName.includes("restore")
              ) {
                operationLogger.cursor.protections.push(methodName);
              }
            } else if (methodName.toLowerCase().includes("vscode")) {
              operationLogger.vscode.steps.push(methodName);
              if (
                methodName.includes("protect") ||
                methodName.includes("restore")
              ) {
                operationLogger.vscode.protections.push(methodName);
              }
            } else {
              operationLogger.common.steps.push(methodName);
              if (
                methodName.includes("protect") ||
                methodName.includes("restore")
              ) {
                operationLogger.common.protections.push(methodName);
              }
            }
          }
          return { success: true };
        };
      }
    }
  });

  console.log("✅ 干运行模式已启用 - 不会执行实际删除操作");
  console.log("📊 操作记录器已启动 - 将详细记录所有操作\n");

  // 测试结果收集
  const comprehensiveReport = {
    pathComparison: {},
    stepComparison: {},
    protectionComparison: {},
    modeComparison: {},
    consistencyScore: {},
  };

  try {
    // 第一部分：路径配置对比测试
    console.log("📁 第一部分：路径配置对比测试");
    console.log("-".repeat(60));

    // 获取Cursor路径配置
    const cursorPaths = deviceManager.getCursorPaths();
    console.log("🔵 Cursor路径配置:");
    Object.entries(cursorPaths).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
      operationLogger.cursor.paths.push(value);
    });

    // 获取VS Code路径配置
    const vscodePaths = deviceManager.getVSCodePaths();
    console.log("\n🟢 VS Code路径配置:");
    if (vscodePaths.variants) {
      Object.entries(vscodePaths.variants).forEach(([variant, config]) => {
        console.log(`  ${variant}:`);
        Object.entries(config).forEach(([key, value]) => {
          console.log(`    ${key}: ${value}`);
          operationLogger.vscode.paths.push(value);
        });
      });
    }

    // 路径结构对比
    const cursorPathTypes = Object.keys(cursorPaths);
    const vscodePathTypes = vscodePaths.variants
      ? Object.keys(Object.values(vscodePaths.variants)[0] || {})
      : [];

    comprehensiveReport.pathComparison = {
      cursor: {
        types: cursorPathTypes,
        count: operationLogger.cursor.paths.length,
      },
      vscode: {
        types: vscodePathTypes,
        count: operationLogger.vscode.paths.length,
      },
      commonTypes: cursorPathTypes.filter((type) =>
        vscodePathTypes.includes(type)
      ),
      structureMatch: cursorPathTypes.length === vscodePathTypes.length,
    };

    console.log(`\n📊 路径结构对比:`);
    console.log(
      `  Cursor路径类型: ${cursorPathTypes.length} (${cursorPathTypes.join(
        ", "
      )})`
    );
    console.log(
      `  VS Code路径类型: ${vscodePathTypes.length} (${vscodePathTypes.join(
        ", "
      )})`
    );
    console.log(
      `  共同路径类型: ${comprehensiveReport.pathComparison.commonTypes.length}`
    );
    console.log(
      `  结构匹配: ${
        comprehensiveReport.pathComparison.structureMatch ? "✅" : "❌"
      }`
    );
  } catch (error) {
    console.error("❌ 路径配置测试失败:", error.message);
    operationLogger.common.errors.push(`路径配置测试: ${error.message}`);
  }

  // 第二部分：清理模式详细对比测试
  console.log("\n\n🔧 第二部分：清理模式详细对比测试");
  console.log("-".repeat(60));

  const testModes = [
    {
      name: "智能清理模式",
      options: {
        intelligentMode: true,
        cleanCursor: true,
        cleanVSCode: true,
        preserveActivation: true,
        deepClean: false,
        cleanCursorExtension: false,
        autoRestartIDE: true,
        skipBackup: true,
        enableEnhancedGuardian: true,
        skipCursorLogin: true,
        resetCursorCompletely: false,
        resetVSCodeCompletely: false,
        aggressiveMode: false,
        multiRoundClean: false,
        extendedMonitoring: false,
        usePowerShellAssist: false,
      },
    },
    {
      name: "标准清理模式",
      options: {
        standardMode: true,
        cleanCursor: true,
        cleanVSCode: true,
        preserveActivation: true,
        deepClean: true,
        cleanCursorExtension: true,
        autoRestartIDE: true,
        skipBackup: true,
        enableEnhancedGuardian: true,
        skipCursorLogin: true,
        resetCursorCompletely: false,
        resetVSCodeCompletely: false,
        aggressiveMode: true,
        multiRoundClean: true,
        extendedMonitoring: true,
        usePowerShellAssist: true,
      },
    },
    {
      name: "完全清理模式",
      options: {
        completeMode: true,
        cleanCursor: true,
        cleanVSCode: true,
        preserveActivation: true,
        deepClean: true,
        cleanCursorExtension: true,
        autoRestartIDE: true,
        skipBackup: true,
        enableEnhancedGuardian: true,
        skipCursorLogin: false,
        resetCursorCompletely: true,
        resetVSCodeCompletely: true,
        aggressiveMode: true,
        multiRoundClean: true,
        extendedMonitoring: true,
        usePowerShellAssist: true,
      },
    },
  ];

  for (const mode of testModes) {
    console.log(`\n🧪 测试 ${mode.name}`);
    console.log("-".repeat(40));

    // 重置操作记录器
    operationLogger.cursor.steps = [];
    operationLogger.vscode.steps = [];
    operationLogger.common.steps = [];
    operationLogger.cursor.protections = [];
    operationLogger.vscode.protections = [];
    operationLogger.common.protections = [];

    try {
      const result = await deviceManager.performCleanup(mode.options);

      // 分析操作步骤
      const cursorOps = operationLogger.cursor.steps.length;
      const vscodeOps = operationLogger.vscode.steps.length;
      const commonOps = operationLogger.common.steps.length;
      const totalOps = result.actions ? result.actions.length : 0;

      // 分析保护机制
      const cursorProtections = operationLogger.cursor.protections.length;
      const vscodeProtections = operationLogger.vscode.protections.length;
      const commonProtections = operationLogger.common.protections.length;

      console.log(`  📊 操作统计:`);
      console.log(`    Cursor专用操作: ${cursorOps}`);
      console.log(`    VS Code专用操作: ${vscodeOps}`);
      console.log(`    通用操作: ${commonOps}`);
      console.log(`    总操作数: ${totalOps}`);
      console.log(`  🛡️ 保护机制:`);
      console.log(`    Cursor保护: ${cursorProtections}`);
      console.log(`    VS Code保护: ${vscodeProtections}`);
      console.log(`    通用保护: ${commonProtections}`);

      // 计算一致性分数
      const operationBalance = Math.abs(cursorOps - vscodeOps) <= 1;
      const protectionBalance =
        Math.abs(cursorProtections - vscodeProtections) <= 1;
      const consistencyScore =
        operationBalance && protectionBalance
          ? 100
          : operationBalance || protectionBalance
          ? 75
          : 50;

      console.log(
        `  ⭐ 一致性评分: ${consistencyScore}% ${
          consistencyScore >= 90 ? "🏆" : consistencyScore >= 75 ? "👍" : "⚠️"
        }`
      );

      // 记录到报告
      comprehensiveReport.modeComparison[mode.name] = {
        cursorOps,
        vscodeOps,
        commonOps,
        totalOps,
        cursorProtections,
        vscodeProtections,
        commonProtections,
        operationBalance,
        protectionBalance,
        consistencyScore,
        success: result.success,
      };
    } catch (error) {
      console.error(`  ❌ ${mode.name}测试失败:`, error.message);
      operationLogger.common.errors.push(`${mode.name}: ${error.message}`);
    }
  }

  // 第三部分：详细步骤序列对比
  console.log("\n\n🔍 第三部分：详细步骤序列对比");
  console.log("-".repeat(60));

  // 分析步骤序列的相似性
  const stepSequenceAnalysis = {};
  Object.keys(comprehensiveReport.modeComparison).forEach((modeName) => {
    const modeData = comprehensiveReport.modeComparison[modeName];
    stepSequenceAnalysis[modeName] = {
      hasIDEClose: operationLogger.common.steps.includes(
        "closeIDEsBeforeCleanup"
      ),
      hasProtectionStop: operationLogger.common.steps.includes(
        "stopEnhancedProtectionBeforeCleanup"
      ),
      hasProtectionStart: operationLogger.common.steps.includes(
        "startEnhancedGuardian"
      ),
      hasIDEStart: operationLogger.common.steps.includes(
        "startIDEsAfterCleanup"
      ),
      followsStandardFlow: true, // 将在后续验证中更新
    };
  });

  console.log("📋 标准清理流程验证:");
  Object.entries(stepSequenceAnalysis).forEach(([mode, analysis]) => {
    console.log(`  ${mode}:`);
    console.log(`    IDE关闭: ${analysis.hasIDEClose ? "✅" : "❌"}`);
    console.log(`    防护停止: ${analysis.hasProtectionStop ? "✅" : "❌"}`);
    console.log(`    防护启动: ${analysis.hasProtectionStart ? "✅" : "❌"}`);
    console.log(`    IDE启动: ${analysis.hasIDEStart ? "✅" : "❌"}`);
  });

  // 第四部分：最终一致性评估
  console.log("\n\n📈 第四部分：最终一致性评估");
  console.log("-".repeat(60));

  const overallScores = Object.values(comprehensiveReport.modeComparison).map(
    (mode) => mode.consistencyScore
  );
  const averageScore =
    overallScores.reduce((a, b) => a + b, 0) / overallScores.length;

  const pathConsistency = comprehensiveReport.pathComparison.structureMatch
    ? 100
    : 75;
  const errorCount =
    operationLogger.common.errors.length +
    operationLogger.cursor.errors.length +
    operationLogger.vscode.errors.length;
  const errorPenalty = Math.min(errorCount * 10, 50);

  const finalScore = Math.max(
    0,
    (averageScore + pathConsistency) / 2 - errorPenalty
  );

  comprehensiveReport.consistencyScore = {
    pathConsistency,
    averageModeScore: averageScore,
    errorCount,
    errorPenalty,
    finalScore,
    grade:
      finalScore >= 90
        ? "A+"
        : finalScore >= 80
        ? "A"
        : finalScore >= 70
        ? "B"
        : finalScore >= 60
        ? "C"
        : "D",
  };

  console.log(`🎯 最终一致性评估:`);
  console.log(`  路径结构一致性: ${pathConsistency}%`);
  console.log(`  清理模式平均分: ${averageScore.toFixed(1)}%`);
  console.log(`  错误数量: ${errorCount} (扣分: ${errorPenalty}%)`);
  console.log(
    `  最终得分: ${finalScore.toFixed(1)}% (等级: ${
      comprehensiveReport.consistencyScore.grade
    })`
  );

  if (finalScore >= 90) {
    console.log(`\n🏆 结论: VS Code和Cursor清理功能完全一致！`);
  } else if (finalScore >= 75) {
    console.log(`\n👍 结论: VS Code和Cursor清理功能基本一致，存在轻微差异`);
  } else {
    console.log(
      `\n⚠️ 结论: VS Code和Cursor清理功能存在明显差异，需要进一步优化`
    );
  }

  return { comprehensiveReport, operationLogger };
}

// 运行测试
if (require.main === module) {
  testIDECleanupComprehensive()
    .then(({ comprehensiveReport, operationLogger }) => {
      console.log("\n🎉 全面对比测试第一阶段完成");

      // 保存初步报告
      const reportPath = path.join(
        __dirname,
        "ide-cleanup-comprehensive-report.json"
      );
      fs.writeFileSync(
        reportPath,
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            report: comprehensiveReport,
            operations: operationLogger,
          },
          null,
          2
        )
      );

      console.log(`📄 测试报告已保存: ${reportPath}`);
    })
    .catch((error) => {
      console.error("❌ 测试失败:", error);
      process.exit(1);
    });
}

module.exports = { testIDECleanupComprehensive };
