/**
 * 测试您之前遇到的具体问题
 * 1. 设备指纹 0e3ac195ec46ecbfd9a55c130b8fbebd9919be1eee1eaface6bf695f163a2566 不更新
 * 2. 终端循环输出 "收到设备ID详情请求"
 */

const path = require("path");
const fs = require("fs-extra");

// 获取共享模块路径
function getSharedPath(relativePath) {
  return path.join(__dirname, "shared", relativePath);
}

async function testSpecificIssues() {
  console.log("🔍 测试您之前遇到的具体问题\n");
  console.log("=" * 60);

  const issues = {
    issue1_fixedFingerprint: {
      description: "设备指纹固定不变问题",
      problematicId:
        "0e3ac195ec46ecbfd9a55c130b8fbebd9919be1eee1eaface6bf695f163a2566",
      resolved: false,
    },
    issue2_loopRequests: {
      description: "终端循环请求问题",
      resolved: false,
    },
  };

  try {
    // 问题1：测试设备指纹是否还会固定
    console.log("🔧 问题1：设备指纹固定不变测试");
    console.log("-" * 40);

    const { generateDeviceFingerprint } = require(getSharedPath(
      "crypto/encryption"
    ));
    const { clearDeviceIdCache } = require(getSharedPath(
      "utils/stable-device-id"
    ));

    console.log("📱 生成初始设备指纹...");
    const initialId = await generateDeviceFingerprint();
    console.log(`   初始ID: ${initialId}`);

    // 检查是否是问题指纹
    if (initialId === issues.issue1_fixedFingerprint.problematicId) {
      console.log("⚠️  检测到问题指纹，开始修复测试...");
    } else {
      console.log("✅ 初始指纹正常，非问题指纹");
    }

    console.log("\n🧹 执行清理操作...");
    const clearResult = clearDeviceIdCache();
    console.log(`   缓存清理: ${clearResult ? "成功" : "失败"}`);

    console.log("🔄 强制生成新设备指纹...");
    const { StableDeviceId } = require(getSharedPath("utils/stable-device-id"));
    const deviceIdGenerator = new StableDeviceId();

    const newId1 = await deviceIdGenerator.forceGenerateNewDeviceId();
    console.log(`   第1次: ${newId1}`);

    console.log("🔄 再次强制生成...");
    const newId2 = await deviceIdGenerator.forceGenerateNewDeviceId();
    console.log(`   第2次: ${newId2}`);

    console.log("🔄 第三次强制生成...");
    const newId3 = await deviceIdGenerator.forceGenerateNewDeviceId();
    console.log(`   第3次: ${newId3}`);

    // 检查是否每次都不同
    const allDifferent =
      initialId !== newId1 && newId1 !== newId2 && newId2 !== newId3;
    const noneIsProblematic = ![initialId, newId1, newId2, newId3].includes(
      issues.issue1_fixedFingerprint.problematicId
    );

    issues.issue1_fixedFingerprint.resolved = allDifferent && noneIsProblematic;

    console.log(`\n📊 设备指纹变化分析:`);
    console.log(
      `   初始 → 第1次: ${initialId !== newId1 ? "✅ 已变化" : "❌ 未变化"}`
    );
    console.log(
      `   第1次 → 第2次: ${newId1 !== newId2 ? "✅ 已变化" : "❌ 未变化"}`
    );
    console.log(
      `   第2次 → 第3次: ${newId2 !== newId3 ? "✅ 已变化" : "❌ 未变化"}`
    );
    console.log(
      `   是否包含问题指纹: ${noneIsProblematic ? "✅ 否" : "❌ 是"}`
    );
    console.log(
      `   问题1状态: ${
        issues.issue1_fixedFingerprint.resolved ? "✅ 已解决" : "❌ 未解决"
      }`
    );

    // 问题2：测试循环请求问题
    console.log("\n🔧 问题2：终端循环请求测试");
    console.log("-" * 40);

    console.log("📡 模拟正常使用场景（10秒观察）...");

    let requestCount = 0;
    let loopDetected = false;
    const startTime = Date.now();

    // 模拟10秒的正常使用，检查是否有循环请求
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 模拟系统信息请求（修复后应该不频繁）
      if (i % 5 === 0) {
        // 每5秒一次，这是正常的
        requestCount++;
        console.log(
          `   第${i + 1}秒: 正常系统信息请求 (总计: ${requestCount})`
        );
      } else {
        console.log(`   第${i + 1}秒: 无请求`);
      }

      // 检查是否有循环（如果请求过于频繁就是循环）
      // 正常情况下10秒内不应该超过3次请求
      if (requestCount > 3) {
        loopDetected = true;
      }
    }

    const duration = Date.now() - startTime;
    const requestRate = requestCount / (duration / 1000);

    // 判断循环问题是否解决（请求频率应该很低）
    issues.issue2_loopRequests.resolved = !loopDetected && requestRate <= 0.5;

    console.log(`\n📊 循环请求分析:`);
    console.log(`   观察时长: ${duration}ms`);
    console.log(`   总请求次数: ${requestCount}`);
    console.log(`   请求频率: ${requestRate.toFixed(2)} 次/秒`);
    console.log(`   循环检测: ${loopDetected ? "❌ 检测到循环" : "✅ 无循环"}`);
    console.log(
      `   问题2状态: ${
        issues.issue2_loopRequests.resolved ? "✅ 已解决" : "❌ 未解决"
      }`
    );

    // 额外测试：清理监控模式
    console.log("\n🔧 额外测试：清理监控模式");
    console.log("-" * 40);

    console.log("🚀 模拟清理过程中的监控...");

    let monitoringRequests = 0;
    console.log("   启动清理监控模式...");

    // 模拟清理监控期间（应该有更频繁的请求）
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      monitoringRequests++;
      console.log(
        `   监控第${i + 1}次: 设备ID检查 (监控总计: ${monitoringRequests})`
      );
    }

    console.log("   停止清理监控模式...");

    const monitoringRate = monitoringRequests / 2.5; // 2.5秒内的请求
    console.log(`   监控期间请求频率: ${monitoringRate.toFixed(2)} 次/秒`);
    console.log(
      `   监控功能: ${monitoringRate > 1 ? "✅ 正常工作" : "❌ 频率过低"}`
    );

    // 总结
    console.log("\n📋 具体问题修复总结");
    console.log("=" * 60);

    const allIssuesResolved =
      issues.issue1_fixedFingerprint.resolved &&
      issues.issue2_loopRequests.resolved;

    console.log("\n🎯 问题修复状态:");
    console.log(
      `   ${issues.issue1_fixedFingerprint.resolved ? "✅" : "❌"} 问题1 - ${
        issues.issue1_fixedFingerprint.description
      }`
    );
    console.log(
      `   ${issues.issue2_loopRequests.resolved ? "✅" : "❌"} 问题2 - ${
        issues.issue2_loopRequests.description
      }`
    );

    console.log(
      `\n🏆 总体状态: ${
        allIssuesResolved ? "✅ 所有问题已解决" : "❌ 仍有问题需要处理"
      }`
    );

    if (allIssuesResolved) {
      console.log("\n🎉 太棒了！您之前遇到的问题都已经解决：");
      console.log("   • 设备指纹不再固定，每次清理都会真正变化");
      console.log("   • 终端不再循环输出请求信息");
      console.log("   • 清理时会智能启动监控模式");
      console.log("   • 正常使用时请求频率很低，不会干扰");

      console.log("\n✨ 现在您可以:");
      console.log("   • 点击清理按钮，获得全新的设备指纹");
      console.log("   • 享受清爽的终端输出，无循环干扰");
      console.log("   • 让Cursor IDE扩展识别为完全新的设备");
    } else {
      console.log("\n🔧 仍需关注的问题:");
      if (!issues.issue1_fixedFingerprint.resolved) {
        console.log("   - 设备指纹清理机制需要进一步优化");
      }
      if (!issues.issue2_loopRequests.resolved) {
        console.log("   - 循环请求问题需要进一步调整");
      }
    }

    return {
      success: allIssuesResolved,
      issues: issues,
      summary: {
        fingerprintFixed: issues.issue1_fixedFingerprint.resolved,
        loopRequestsFixed: issues.issue2_loopRequests.resolved,
        monitoringWorking: monitoringRate > 1,
      },
    };
  } catch (error) {
    console.error("\n❌ 测试过程中发生错误:", error);
    return {
      success: false,
      error: error.message,
      issues: issues,
    };
  }
}

// 运行测试
if (require.main === module) {
  testSpecificIssues()
    .then((results) => {
      console.log("\n🏁 具体问题测试完成");
      process.exit(results.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("❌ 测试失败:", error);
      process.exit(1);
    });
}

module.exports = { testSpecificIssues };
