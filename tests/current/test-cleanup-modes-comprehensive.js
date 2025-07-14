// 综合测试所有清理模式的完整执行流程
const path = require('path');
const fs = require('fs');

// 导入设备管理器
const DeviceManager = require('../../modules/desktop-client/src/device-manager');

async function testAllCleanupModes() {
  console.log("🧪 综合测试所有清理模式的完整执行流程");
  console.log("=" .repeat(60));

  const deviceManager = new DeviceManager();
  
  // 启用干运行模式
  const originalMethods = {};
  const methodsToMock = [
    'cleanActivationData', 'cleanAugmentStorage', 'cleanStateDatabase',
    'cleanWindowsRegistry', 'cleanTempFiles', 'cleanBrowserData',
    'cleanCursorExtensionData', 'regenerateDeviceFingerprint',
    'cleanDeviceIdentityOnly', 'cleanAugmentDeviceIdentity',
    'forceCloseCursorIDE', 'performCompleteCursorReset', 'performCompleteVSCodeReset',
    'performDeepCleanupVerification', 'performMultiRoundCleanup', 'startCursorIDE',
    'startContinuousMonitoring'
  ];

  // 保存原方法并创建模拟方法
  methodsToMock.forEach(methodName => {
    if (typeof deviceManager[methodName] === 'function') {
      originalMethods[methodName] = deviceManager[methodName];
      deviceManager[methodName] = async function(results, options = {}) {
        results.actions.push(`🧪 [DRY RUN] ${methodName}() - 执行模拟操作`);
        return { success: true };
      };
    }
  });

  console.log("✅ 干运行模式已启用 - 不会执行实际删除操作\n");

  // 测试结果收集
  const testResults = {
    intelligent: null,
    standard: null,
    complete: null
  };

  try {
    // 测试1: 智能清理模式
    console.log("📋 测试1: 智能清理模式");
    console.log("-".repeat(40));

    const intelligentOptions = {
      intelligentMode: true,
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
      cleanCursor: false,
      cleanVSCode: false,
    };

    console.log("🧠 智能清理模式参数:");
    console.log("   - intelligentMode: true");
    console.log("   - cleanCursorExtension: false (不清理扩展)");
    console.log("   - autoRestartCursor: false (不重启IDE)");
    console.log("   - aggressiveMode: false (不激进清理)");
    console.log("   - cleanCursor: false (不清理Cursor)");

    testResults.intelligent = await deviceManager.performCleanup(intelligentOptions);

    console.log("\n🧠 智能清理执行路径:");
    testResults.intelligent.actions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    // 测试2: 标准清理模式
    console.log("\n\n📋 测试2: 标准清理模式");
    console.log("-".repeat(40));

    const standardOptions = {
      standardMode: true,
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
      cleanCursor: true,
      cleanVSCode: false,
    };

    console.log("🔧 标准清理模式参数:");
    console.log("   - standardMode: true");
    console.log("   - cleanCursorExtension: true (清理扩展)");
    console.log("   - autoRestartCursor: true (重启IDE)");
    console.log("   - aggressiveMode: true (激进清理)");
    console.log("   - cleanCursor: true (清理Cursor)");

    testResults.standard = await deviceManager.performCleanup(standardOptions);

    console.log("\n🔧 标准清理执行路径:");
    testResults.standard.actions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    // 测试3: 完全清理模式
    console.log("\n\n📋 测试3: 完全清理模式");
    console.log("-".repeat(40));

    const completeOptions = {
      completeMode: true,
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
      cleanCursor: true,
      cleanVSCode: true,
    };

    console.log("💥 完全清理模式参数:");
    console.log("   - completeMode: true");
    console.log("   - resetCursorCompletely: true (完全重置Cursor)");
    console.log("   - resetVSCodeCompletely: true (完全重置VS Code)");
    console.log("   - skipCursorLogin: false (不保留登录)");
    console.log("   - cleanCursor: true (清理Cursor)");

    testResults.complete = await deviceManager.performCleanup(completeOptions);

    console.log("\n💥 完全清理执行路径:");
    testResults.complete.actions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    // 分析对比
    console.log("\n\n📊 执行路径对比分析");
    console.log("=".repeat(60));

    console.log(`🧠 智能清理: ${testResults.intelligent.actions.length} 个步骤`);
    console.log(`🔧 标准清理: ${testResults.standard.actions.length} 个步骤`);
    console.log(`💥 完全清理: ${testResults.complete.actions.length} 个步骤`);

    // 检查关键差异
    console.log("\n🔍 关键差异分析:");

    // 检查是否调用了专用清理方法
    const hasIntelligentCleanup = testResults.intelligent.actions.some(action => 
      action.includes("智能清理")
    );
    const hasStandardCleanup = testResults.standard.actions.some(action => 
      action.includes("标准清理")
    );
    const hasCompleteCleanup = testResults.complete.actions.some(action => 
      action.includes("完全清理")
    );

    console.log(`  智能清理调用专用方法: ${hasIntelligentCleanup ? "✅" : "❌"}`);
    console.log(`  标准清理调用专用方法: ${hasStandardCleanup ? "✅" : "❌"}`);
    console.log(`  完全清理调用专用方法: ${hasCompleteCleanup ? "✅" : "❌"}`);

    // 检查关键操作差异
    console.log("\n🎯 关键操作差异:");
    
    const intelligentHasDeviceIdentityOnly = testResults.intelligent.actions.some(action => 
      action.includes("cleanDeviceIdentityOnly")
    );
    const standardHasRegistryClean = testResults.standard.actions.some(action => 
      action.includes("cleanWindowsRegistry")
    );
    const completeHasCompleteReset = testResults.complete.actions.some(action => 
      action.includes("performCompleteCursorReset") || action.includes("performCompleteVSCodeReset")
    );

    console.log(`  智能清理-仅设备身份: ${intelligentHasDeviceIdentityOnly ? "✅" : "❌"}`);
    console.log(`  标准清理-注册表清理: ${standardHasRegistryClean ? "✅" : "❌"}`);
    console.log(`  完全清理-完全重置: ${completeHasCompleteReset ? "✅" : "❌"}`);

    // 验证保护机制
    console.log("\n🛡️ 保护机制验证:");
    
    const allHaveMCPProtection = [testResults.intelligent, testResults.standard, testResults.complete]
      .every(result => result.actions.some(action => action.includes("保护MCP配置") || action.includes("protectMCP")));
    
    const intelligentHasIDEProtection = testResults.intelligent.actions.some(action => 
      action.includes("保护IDE设置") || action.includes("protectIDESettings")
    );

    console.log(`  所有模式都保护MCP配置: ${allHaveMCPProtection ? "✅" : "❌"}`);
    console.log(`  智能模式保护IDE设置: ${intelligentHasIDEProtection ? "✅" : "❌"}`);

    // 验证清理深度差异
    console.log("\n⚡ 清理深度验证:");
    
    const intelligentIsMinimal = !testResults.intelligent.actions.some(action => 
      action.includes("cleanCursorExtensionData") || action.includes("cleanWindowsRegistry")
    );
    const standardIsDeep = testResults.standard.actions.some(action => 
      action.includes("cleanCursorExtensionData") && action.includes("cleanWindowsRegistry")
    );
    const completeIsComplete = testResults.complete.actions.some(action => 
      action.includes("performCompleteCursorReset")
    );

    console.log(`  智能清理-最小化清理: ${intelligentIsMinimal ? "✅" : "❌"}`);
    console.log(`  标准清理-深度清理: ${standardIsDeep ? "✅" : "❌"}`);
    console.log(`  完全清理-彻底重置: ${completeIsComplete ? "✅" : "❌"}`);

  } catch (error) {
    console.error("❌ 测试过程中发生错误:", error.message);
  } finally {
    // 恢复原方法
    Object.keys(originalMethods).forEach(methodName => {
      deviceManager[methodName] = originalMethods[methodName];
    });

    console.log("\n✅ 干运行测试完成 - 原方法已恢复");
  }

  return testResults;
}

// 运行测试
if (require.main === module) {
  testAllCleanupModes()
    .then(results => {
      console.log("\n🎉 所有清理模式测试完成");
      
      // 生成测试报告
      const report = {
        timestamp: new Date().toISOString(),
        results: results,
        summary: {
          intelligent_steps: results.intelligent?.actions.length || 0,
          standard_steps: results.standard?.actions.length || 0,
          complete_steps: results.complete?.actions.length || 0
        }
      };

      // 保存测试报告
      const reportPath = path.join(__dirname, 'cleanup-modes-test-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 测试报告已保存: ${reportPath}`);
    })
    .catch(error => {
      console.error("❌ 测试失败:", error);
      process.exit(1);
    });
}

module.exports = { testAllCleanupModes };
