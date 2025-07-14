const path = require("path");
const fs = require("fs-extra");

// 综合测试：验证完整的清理流程
async function testCleanupFlowComprehensive() {
  console.log("🔄 清理流程综合测试");
  console.log("=".repeat(60));

  const results = {
    uiParameterCheck: false,
    backendRouting: false,
    executionPaths: false,
    protectionFlow: false,
    overall: false,
  };

  try {
    // 1. 客户端UI参数检查
    console.log("\n📋 第1步：客户端UI参数检查");
    console.log("-".repeat(40));

    const rendererPath = path.resolve(
      __dirname,
      "../../modules/desktop-client/public/renderer.js"
    );
    const rendererContent = await fs.readFile(rendererPath, "utf8");

    // 检查智能清理模式配置
    const intelligentModeMatch = rendererContent.match(
      /case "intelligent":([\s\S]*?)break;/
    );
    if (intelligentModeMatch) {
      const config = intelligentModeMatch[1];
      const criticalParams = [
        "cleanCursorExtension: false",
        "autoRestartCursor: false",
        "aggressiveMode: false",
        "multiRoundClean: false",
        "usePowerShellAssist: false",
        "intelligentMode: true",
        "cleanCursor: false",
        "cleanVSCode: false",
      ];

      const allCorrect = criticalParams.every((param) =>
        config.includes(param)
      );
      results.uiParameterCheck = allCorrect;

      console.log(`🧠 智能清理UI配置: ${allCorrect ? "✅ 正确" : "❌ 错误"}`);

      if (!allCorrect) {
        criticalParams.forEach((param) => {
          if (!config.includes(param)) {
            console.log(`  ❌ 缺少或错误: ${param}`);
          }
        });
      }
    }

    // 2. 后端路由检查
    console.log("\n📋 第2步：后端路由检查");
    console.log("-".repeat(40));

    const deviceManagerPath = path.resolve(
      __dirname,
      "../../modules/desktop-client/src/device-manager.js"
    );
    const deviceManagerContent = await fs.readFile(deviceManagerPath, "utf8");

    // 检查清理模式路由逻辑
    const performCleanupMatch = deviceManagerContent.match(
      /async performCleanup\(options = \{\}\) \{([\s\S]*?)(?=async|\Z)/
    );
    if (performCleanupMatch) {
      const cleanupMethod = performCleanupMatch[1];

      const hasIntelligentRoute =
        cleanupMethod.includes("if (options.intelligentMode)") &&
        cleanupMethod.includes("performIntelligentCleanup");
      const hasStandardRoute =
        cleanupMethod.includes("else if (options.standardMode)") &&
        cleanupMethod.includes("performStandardModeCleanup");
      const hasCompleteRoute =
        cleanupMethod.includes("else if (options.completeMode)") &&
        cleanupMethod.includes("performCompleteModeCleanup");

      results.backendRouting =
        hasIntelligentRoute && hasStandardRoute && hasCompleteRoute;

      console.log(`🧠 智能清理路由: ${hasIntelligentRoute ? "✅" : "❌"}`);
      console.log(`🔧 标准清理路由: ${hasStandardRoute ? "✅" : "❌"}`);
      console.log(`💥 完全清理路由: ${hasCompleteRoute ? "✅" : "❌"}`);
    }

    // 3. 执行路径验证（干运行）
    console.log("\n📋 第3步：执行路径验证（干运行）");
    console.log("-".repeat(40));

    const DeviceManager = require("../../modules/desktop-client/src/device-manager");
    const deviceManager = new DeviceManager();

    // 模拟干运行
    const originalMethods = {};
    const dryRunMethods = [
      "cleanDeviceIdentityOnly",
      "cleanAugmentDeviceIdentity",
      "regenerateDeviceFingerprint",
    ];

    dryRunMethods.forEach((methodName) => {
      if (typeof deviceManager[methodName] === "function") {
        originalMethods[methodName] = deviceManager[methodName];
        deviceManager[methodName] = async function (results) {
          results.actions.push(`[DRY RUN] ${methodName}() executed`);
          return { success: true };
        };
      }
    });

    // 测试智能清理执行路径
    const intelligentResult = await deviceManager.performCleanup({
      intelligentMode: true,
      cleanCursor: false,
      cleanVSCode: false,
      aggressiveMode: false,
      multiRoundClean: false,
    });

    const hasIntelligentExecution = intelligentResult.actions.some(
      (action) =>
        action.includes("智能清理模式") || action.includes("精准清理设备身份")
    );
    const hasCorrectIntelligentFlow = intelligentResult.actions.some((action) =>
      action.includes("cleanDeviceIdentityOnly")
    );

    results.executionPaths =
      hasIntelligentExecution && hasCorrectIntelligentFlow;

    console.log(`🧠 智能清理执行: ${hasIntelligentExecution ? "✅" : "❌"}`);
    console.log(`🎯 正确执行流程: ${hasCorrectIntelligentFlow ? "✅" : "❌"}`);

    // 恢复原方法
    Object.keys(originalMethods).forEach((methodName) => {
      deviceManager[methodName] = originalMethods[methodName];
    });

    // 4. 防护停止流程检查
    console.log("\n📋 第4步：防护停止流程检查");
    console.log("-".repeat(40));

    const hasProtectionStopMethod = deviceManagerContent.includes(
      "stopEnhancedProtectionBeforeCleanup"
    );
    const hasProtectionCheck =
      deviceManagerContent.includes("检查增强防护状态");

    results.protectionFlow = hasProtectionStopMethod && hasProtectionCheck;

    console.log(`🛑 防护停止方法: ${hasProtectionStopMethod ? "✅" : "❌"}`);
    console.log(`🔍 防护状态检查: ${hasProtectionCheck ? "✅" : "❌"}`);

    // 5. 综合评估
    console.log("\n📊 综合评估结果");
    console.log("=".repeat(60));

    // 排除overall字段本身，只检查其他测试结果
    const testResults = Object.keys(results)
      .filter((key) => key !== "overall")
      .map((key) => results[key]);

    const allTestsPassed = testResults.every((result) => result === true);
    results.overall = allTestsPassed;

    console.log(
      `📱 UI参数配置: ${results.uiParameterCheck ? "✅ 通过" : "❌ 失败"}`
    );
    console.log(
      `🔀 后端路由逻辑: ${results.backendRouting ? "✅ 通过" : "❌ 失败"}`
    );
    console.log(
      `⚡ 执行路径验证: ${results.executionPaths ? "✅ 通过" : "❌ 失败"}`
    );
    console.log(
      `🛡️ 防护停止流程: ${results.protectionFlow ? "✅ 通过" : "❌ 失败"}`
    );
    console.log(
      `🎯 综合评估: ${results.overall ? "✅ 全部通过" : "❌ 存在问题"}`
    );

    if (results.overall) {
      console.log("\n🎉 清理流程验证完成！");
      console.log("✅ 所有清理模式的执行路径都正确配置");
      console.log("✅ 客户端UI参数传递正确");
      console.log("✅ 后端路由逻辑正确");
      console.log("✅ 防护停止流程正常");
      console.log("\n💡 建议：");
      console.log("  1. 可以进行实际清理测试");
      console.log("  2. 建议先用智能清理模式测试");
      console.log("  3. 测试前确保已备份重要数据");
    } else {
      console.log("\n⚠️ 发现问题需要修复！");
      console.log("❌ 请检查上述失败的测试项");
      console.log("❌ 修复后再进行实际清理测试");
    }

    return results;
  } catch (error) {
    console.error("❌ 综合测试失败:", error.message);
    console.error(error.stack);
    return results;
  }
}

// 运行测试
if (require.main === module) {
  testCleanupFlowComprehensive()
    .then((results) => {
      if (results.overall) {
        console.log("\n🎉 所有测试通过");
        process.exit(0);
      } else {
        console.log("\n❌ 测试未完全通过");
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("❌ 测试执行失败:", error);
      process.exit(1);
    });
}

module.exports = { testCleanupFlowComprehensive };
