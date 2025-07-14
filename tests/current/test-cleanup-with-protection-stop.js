const DeviceManager = require("../../modules/desktop-client/src/device-manager");

// 测试清理前停止增强防护的功能
async function testCleanupWithProtectionStop() {
  console.log("🧪 测试清理前停止增强防护功能");
  console.log("=".repeat(60));

  const deviceManager = new DeviceManager();

  try {
    // 1. 检查当前防护状态
    console.log("\n📍 步骤1: 检查当前防护状态");
    const initialStatus = await deviceManager.getEnhancedGuardianStatus();
    console.log("当前防护状态:", {
      isGuarding: initialStatus.isGuarding,
      standaloneRunning: initialStatus.standaloneService?.isRunning || false,
      mode: initialStatus.mode || "none",
    });

    // 2. 测试智能清理模式（包含防护停止逻辑）
    console.log("\n📍 步骤2: 测试智能清理模式");
    const intelligentResult = await deviceManager.performCleanup({
      intelligentMode: true,
      preserveActivation: true,
      cleanCursor: false,
      cleanVSCode: false,
    });

    console.log("\n🧠 智能清理结果:");
    console.log("成功:", intelligentResult.success);
    console.log("操作记录:");
    intelligentResult.actions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    if (intelligentResult.errors.length > 0) {
      console.log("错误记录:");
      intelligentResult.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    // 3. 检查防护停止逻辑是否被调用
    console.log("\n📍 步骤3: 验证防护停止逻辑");
    const protectionStopActions = intelligentResult.actions.filter(
      (action) =>
        action.includes("检查增强防护状态") ||
        action.includes("停止防护") ||
        action.includes("防护未运行")
    );

    if (protectionStopActions.length > 0) {
      console.log("✅ 防护停止逻辑已执行:");
      protectionStopActions.forEach((action) => {
        console.log(`   • ${action}`);
      });
    } else {
      console.log("❌ 未检测到防护停止逻辑执行");
    }

    // 4. 检查清理后的防护状态
    console.log("\n📍 步骤4: 检查清理后的防护状态");
    const finalStatus = await deviceManager.getEnhancedGuardianStatus();
    console.log("清理后防护状态:", {
      isGuarding: finalStatus.isGuarding,
      standaloneRunning: finalStatus.standaloneService?.isRunning || false,
      mode: finalStatus.mode || "none",
    });

    // 5. 测试其他清理模式
    console.log("\n📍 步骤5: 测试标准清理模式");
    const standardResult = await deviceManager.performCleanup({
      standardMode: true,
      preserveActivation: true,
      cleanCursor: false,
      cleanVSCode: false,
    });

    const standardProtectionActions = standardResult.actions.filter(
      (action) =>
        action.includes("检查增强防护状态") ||
        action.includes("停止防护") ||
        action.includes("防护未运行")
    );

    console.log(
      "🔧 标准清理模式防护停止逻辑:",
      standardProtectionActions.length > 0 ? "✅ 已执行" : "❌ 未执行"
    );

    console.log("\n📍 步骤6: 测试完全清理模式");
    const completeResult = await deviceManager.performCleanup({
      completeMode: true,
      preserveActivation: true,
      cleanCursor: false,
      cleanVSCode: false,
    });

    const completeProtectionActions = completeResult.actions.filter(
      (action) =>
        action.includes("检查增强防护状态") ||
        action.includes("停止防护") ||
        action.includes("防护未运行")
    );

    console.log(
      "💥 完全清理模式防护停止逻辑:",
      completeProtectionActions.length > 0 ? "✅ 已执行" : "❌ 未执行"
    );

    // 6. 总结测试结果
    console.log("\n📊 测试总结");
    console.log("=".repeat(60));
    console.log(
      "✅ 智能清理模式: 防护停止逻辑",
      protectionStopActions.length > 0 ? "已实现" : "未实现"
    );
    console.log(
      "✅ 标准清理模式: 防护停止逻辑",
      standardProtectionActions.length > 0 ? "已实现" : "未实现"
    );
    console.log(
      "✅ 完全清理模式: 防护停止逻辑",
      completeProtectionActions.length > 0 ? "已实现" : "未实现"
    );

    const allModesImplemented = [
      protectionStopActions.length > 0,
      standardProtectionActions.length > 0,
      completeProtectionActions.length > 0,
    ].every(Boolean);

    console.log(
      "\n🎯 总体结果:",
      allModesImplemented
        ? "✅ 所有清理模式都已实现防护停止逻辑"
        : "⚠️ 部分清理模式缺少防护停止逻辑"
    );
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
    console.error("错误详情:", error.stack);
  }
}

// 运行测试
if (require.main === module) {
  testCleanupWithProtectionStop().catch(console.error);
}

module.exports = testCleanupWithProtectionStop;
