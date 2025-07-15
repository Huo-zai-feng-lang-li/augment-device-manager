/**
 * 综合测试脚本 - 验证所有修复效果
 * 包括：
 * 1. 设备指纹清理修复
 * 2. 前端循环请求修复
 * 3. 清理功能完整性测试
 */

const { testDeviceFingerprintFix } = require("./test-device-fingerprint-fix");
const { testSmartMonitoringFix } = require("./test-smart-monitoring-fix");
const path = require("path");
const fs = require("fs-extra");

async function testCleanupFunctionality() {
  console.log("🧪 测试清理功能完整性...\n");

  try {
    // 导入设备管理器
    const DeviceManager = require("./desktop-client/src/device-manager");
    const deviceManager = new DeviceManager();

    // 获取清理前的设备指纹
    const { generateDeviceFingerprint } = require("./shared/crypto/encryption");
    const beforeCleanup = await generateDeviceFingerprint();
    console.log(`清理前设备指纹: ${beforeCleanup.substring(0, 16)}...`);

    // 执行完整清理操作
    console.log("\n执行完整清理操作...");
    const cleanupOptions = {
      preserveActivation: false,
      aggressiveMode: true,
      cleanCursorExtension: true,
      cleanCursor: true,
      multiRoundClean: false, // 避免过长的测试时间
    };

    const cleanupResult = await deviceManager.performCleanup(cleanupOptions);

    console.log("\n清理操作结果:");
    console.log(`成功: ${cleanupResult.success}`);
    console.log(`执行的操作数: ${cleanupResult.actions?.length || 0}`);
    console.log(`错误数: ${cleanupResult.errors?.length || 0}`);

    if (cleanupResult.errors?.length > 0) {
      console.log("\n错误详情:");
      cleanupResult.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    // 验证清理后的设备指纹
    const afterCleanup = await generateDeviceFingerprint();
    console.log(`\n清理后设备指纹: ${afterCleanup.substring(0, 16)}...`);

    const fingerprintChanged = beforeCleanup !== afterCleanup;
    console.log(`设备指纹是否变化: ${fingerprintChanged ? "✅ 是" : "❌ 否"}`);

    return {
      success: cleanupResult.success,
      fingerprintChanged,
      actionCount: cleanupResult.actions?.length || 0,
      errorCount: cleanupResult.errors?.length || 0,
      errors: cleanupResult.errors || [],
    };
  } catch (error) {
    console.error("❌ 清理功能测试失败:", error);
    return {
      success: false,
      fingerprintChanged: false,
      actionCount: 0,
      errorCount: 1,
      errors: [error.message],
    };
  }
}

async function runComprehensiveTest() {
  console.log("🚀 开始综合修复效果测试\n");
  console.log("=" * 60);

  const results = {
    deviceFingerprintFix: false,
    smartMonitoringFix: false,
    cleanupFunctionality: false,
    overallSuccess: false,
  };

  try {
    // 1. 测试设备指纹修复
    console.log("\n📋 第一阶段：设备指纹清理修复测试");
    console.log("-" * 40);

    await testDeviceFingerprintFix();
    results.deviceFingerprintFix = true;
    console.log("✅ 设备指纹修复测试通过");

    // 2. 测试智能监控修复
    console.log("\n📋 第二阶段：智能监控修复测试");
    console.log("-" * 40);

    const monitoringTest = await testSmartMonitoringFix();
    results.smartMonitoringFix = monitoringTest.success;

    if (results.smartMonitoringFix) {
      console.log("✅ 智能监控修复测试通过");
    } else {
      console.log("❌ 智能监控修复测试失败");
      console.log(
        `正常模式请求频率: ${monitoringTest.normalRequestRate.toFixed(2)} 次/秒`
      );
    }

    // 3. 测试清理功能完整性
    console.log("\n📋 第三阶段：清理功能完整性测试");
    console.log("-" * 40);

    const cleanupTest = await testCleanupFunctionality();
    results.cleanupFunctionality =
      cleanupTest.success && cleanupTest.fingerprintChanged;

    if (results.cleanupFunctionality) {
      console.log("✅ 清理功能完整性测试通过");
    } else {
      console.log("❌ 清理功能完整性测试失败");
      if (cleanupTest.errors.length > 0) {
        console.log("错误详情:");
        cleanupTest.errors.forEach((error) => console.log(`  - ${error}`));
      }
    }

    // 4. 总结测试结果
    console.log("\n📋 第四阶段：测试结果总结");
    console.log("-" * 40);

    results.overallSuccess =
      results.deviceFingerprintFix &&
      results.smartMonitoringFix &&
      results.cleanupFunctionality;

    console.log("\n🎯 测试结果汇总:");
    console.log(
      `   ${results.deviceFingerprintFix ? "✅" : "❌"} 设备指纹清理修复`
    );
    console.log(`   ${results.smartMonitoringFix ? "✅" : "❌"} 智能监控修复`);
    console.log(
      `   ${results.cleanupFunctionality ? "✅" : "❌"} 清理功能完整性`
    );
    console.log(`   ${results.overallSuccess ? "✅" : "❌"} 总体修复状态`);

    if (results.overallSuccess) {
      console.log("\n🎉 恭喜！所有修复都已成功完成！");
      console.log("\n✨ 修复成果:");
      console.log("   • 设备指纹清理功能正常工作");
      console.log("   • 清理后设备指纹能够正确更新");
      console.log("   • 智能监控系统正常工作");
      console.log("   • 前端循环请求问题已解决");
      console.log("   • 清理功能完整性得到保证");

      console.log("\n🔧 用户现在可以:");
      console.log("   • 正常使用设备清理功能");
      console.log("   • 清理后获得全新的设备指纹");
      console.log("   • 让Cursor IDE扩展识别为新设备");
      console.log("   • 避免前端界面卡顿或循环请求");
    } else {
      console.log("\n⚠️ 仍有部分问题需要解决");
      console.log("\n🔧 需要进一步检查:");
      if (!results.deviceFingerprintFix) {
        console.log("   • 设备指纹清理逻辑");
        console.log("   • 缓存清理机制");
      }
      if (!results.cleanupFunctionality) {
        console.log("   • 清理流程完整性");
        console.log("   • 错误处理机制");
      }
    }
  } catch (error) {
    console.error("\n❌ 综合测试过程中发生错误:", error);
    results.overallSuccess = false;
  }

  console.log("\n" + "=" * 60);
  console.log("🏁 综合测试完成");

  return results;
}

// 运行综合测试
if (require.main === module) {
  runComprehensiveTest()
    .then((results) => {
      process.exit(results.overallSuccess ? 0 : 1);
    })
    .catch((error) => {
      console.error("❌ 综合测试失败:", error);
      process.exit(1);
    });
}

module.exports = { runComprehensiveTest };
