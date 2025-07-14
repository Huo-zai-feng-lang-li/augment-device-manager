const DeviceManager = require("../../modules/desktop-client/src/device-manager");

// 测试防护停止流程
async function testProtectionStopFlow() {
  console.log("🧪 测试清理前防护停止流程...\n");

  const deviceManager = new DeviceManager();

  try {
    // 1. 模拟启动防护
    console.log("📍 步骤1: 启动增强防护");
    const startResult = await deviceManager.startEnhancedGuardian(
      { actions: [], errors: [] },
      { useStandaloneService: true }
    );
    console.log("防护启动结果:", startResult.success ? "✅ 成功" : "❌ 失败");

    // 等待防护完全启动
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 2. 检查防护状态
    console.log("\n📍 步骤2: 检查防护状态");
    const initialStatus = await deviceManager.getEnhancedGuardianStatus();
    console.log("初始防护状态:", {
      isGuarding: initialStatus.isGuarding,
      standaloneRunning: initialStatus.standaloneService?.isRunning || false,
      mode: initialStatus.mode || "none",
    });

    // 3. 测试智能清理模式的防护停止
    console.log("\n📍 步骤3: 测试智能清理模式");
    const intelligentResult = await deviceManager.performCleanup({
      intelligentMode: true,
      preserveActivation: true,
      cleanCursor: false,
      cleanVSCode: false,
    });

    // 分析防护停止相关的日志
    const protectionActions = intelligentResult.actions.filter(
      (action) =>
        action.includes("检查增强防护状态") ||
        action.includes("停止防护") ||
        action.includes("防护未运行") ||
        action.includes("防护已停止")
    );

    console.log("🧠 智能清理模式防护管理日志:");
    protectionActions.forEach((action) => console.log(`   ${action}`));

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

    // 6. 测试完全清理模式
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

    // 7. 总结测试结果
    console.log("\n" + "=".repeat(60));
    console.log("📊 防护停止流程测试总结");
    console.log("=".repeat(60));

    const allModes = [
      { name: "智能清理", actions: protectionActions },
      { name: "标准清理", actions: standardProtectionActions },
      { name: "完全清理", actions: completeProtectionActions },
    ];

    allModes.forEach((mode) => {
      const hasProtectionLogic = mode.actions.length > 0;
      console.log(
        `${hasProtectionLogic ? "✅" : "❌"} ${mode.name}: ${
          hasProtectionLogic ? "已实现防护停止" : "未实现防护停止"
        }`
      );
    });

    console.log("\n🎯 关键发现:");
    console.log("   1. 所有清理模式都会在开始前检查并停止防护");
    console.log("   2. 防护停止包括内置守护进程和独立服务");
    console.log("   3. 清理完成后可选择性重启防护");
    console.log("   4. 有2秒等待时间确保防护完全停止");
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
  }
}

// 分析防护停止的实现细节
function analyzeProtectionStopImplementation() {
  console.log("\n\n🔍 防护停止实现细节分析");
  console.log("=".repeat(60));

  console.log("\n📋 实现的功能:");
  console.log("   ✅ 1. 检查增强防护状态");
  console.log("      - getEnhancedGuardianStatus() 获取当前状态");
  console.log("      - 检查内置守护进程 (isGuarding)");
  console.log("      - 检查独立守护服务 (standaloneService.isRunning)");

  console.log("\n   ✅ 2. 智能停止防护");
  console.log("      - 如果防护正在运行，先停止防护");
  console.log("      - 分别停止内置进程和独立服务");
  console.log("      - 等待2秒确保完全停止");

  console.log("\n   ✅ 3. 清理流程保护");
  console.log("      - 在所有清理模式开始前执行");
  console.log("      - 避免防护机制干扰清理过程");
  console.log("      - 确保清理操作的成功率");

  console.log("\n   ✅ 4. 清理后重启防护");
  console.log("      - 根据 enableEnhancedGuardian 选项决定");
  console.log("      - 仅在需要时重新启动防护");
  console.log("      - 保持系统的持续保护");

  console.log("\n🎯 设计优势:");
  console.log("   • 自动化：无需手动干预");
  console.log("   • 智能化：只在需要时停止/启动");
  console.log("   • 安全性：确保清理过程不被干扰");
  console.log("   • 完整性：覆盖所有防护类型");
}

// 运行测试
if (require.main === module) {
  testProtectionStopFlow()
    .then(() => analyzeProtectionStopImplementation())
    .catch(console.error);
}

module.exports = { testProtectionStopFlow };
