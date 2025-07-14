const DeviceManager = require("../src/device-manager");

/**
 * 测试新的IDE管理功能
 * 验证清理前关闭IDE、清理后启动IDE的完整流程
 */

async function testIDEManagement() {
  console.log("🔧 测试IDE管理功能");
  console.log("==================================================");

  const deviceManager = new DeviceManager();

  try {
    // 第1步：测试智能清理模式的IDE管理
    console.log("\n📍 第1步：测试智能清理模式的IDE管理");
    const intelligentResult = await deviceManager.performCleanup({
      intelligentMode: true,
      preserveActivation: true,
      // 注意：智能模式现在默认会关闭/启动Cursor
      autoRestartIDE: true,
    });

    console.log("\n🧠 智能清理结果:");
    console.log("成功:", intelligentResult.success);
    console.log("操作记录:");
    intelligentResult.actions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    if (intelligentResult.errors.length > 0) {
      console.log("\n❌ 错误记录:");
      intelligentResult.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    // 等待一段时间让IDE完全启动
    console.log("\n⏳ 等待10秒让IDE完全启动...");
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // 第2步：测试标准清理模式的IDE管理
    console.log("\n📍 第2步：测试标准清理模式的IDE管理");
    const standardResult = await deviceManager.performCleanup({
      standardMode: true,
      preserveActivation: true,
      cleanCursor: true,
      cleanVSCode: false,
      autoRestartIDE: true,
    });

    console.log("\n🔧 标准清理结果:");
    console.log("成功:", standardResult.success);

    // 只显示IDE相关的操作
    const ideActions = standardResult.actions.filter(
      (action) =>
        action.includes("IDE") ||
        action.includes("Cursor") ||
        action.includes("VS Code") ||
        action.includes("关闭") ||
        action.includes("启动")
    );

    console.log("IDE相关操作:");
    ideActions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    // 第3步：测试VS Code路径查找
    console.log("\n📍 第3步：测试VS Code路径查找");
    const vscodePath = await deviceManager.findVSCodePath();
    console.log("VS Code路径:", vscodePath || "未找到");

    // 第4步：测试Cursor路径查找
    console.log("\n📍 第4步：测试Cursor路径查找");
    const cursorPath = await deviceManager.findCursorPath();
    console.log("Cursor路径:", cursorPath || "未找到");

    console.log("\n✅ IDE管理功能测试完成");
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
    console.error("错误详情:", error);
  }
}

// 分析IDE管理流程
function analyzeIDEManagementFlow() {
  console.log("\n\n🔍 IDE管理流程分析");
  console.log("=".repeat(60));

  console.log("\n📋 新增的功能:");
  console.log("   ✅ 1. 统一的IDE关闭方法");
  console.log("      - closeIDEsBeforeCleanup() 在清理前关闭相关IDE");
  console.log("      - 支持根据cleanCursor和cleanVSCode选项决定操作哪些IDE");
  console.log("      - 等待5秒确保所有IDE进程完全终止");

  console.log("\n   ✅ 2. 统一的IDE启动方法");
  console.log("      - startIDEsAfterCleanup() 在清理后重启IDE");
  console.log("      - 支持autoRestartIDE选项控制是否自动重启");
  console.log("      - 确保新的设备身份生效");

  console.log("\n   ✅ 3. VS Code支持");
  console.log("      - forceCloseVSCodeIDE() 强制关闭VS Code");
  console.log("      - startVSCodeIDE() 启动VS Code");
  console.log("      - findVSCodePath() 智能查找VS Code安装路径");

  console.log("\n   ✅ 4. 改进的清理流程");
  console.log("      - 第1步: 关闭相关IDE");
  console.log("      - 第2步: 停止增强防护");
  console.log("      - 第3步: 执行清理操作");
  console.log("      - 第4步: 启动增强防护");
  console.log("      - 第5步: 重新启动IDE");

  console.log("\n🎯 优势特点:");
  console.log("   🚀 避免文件占用问题");
  console.log("   🛡️ 确保清理更彻底");
  console.log("   🔄 防止IDE在清理过程中恢复数据");
  console.log("   ✨ 清理后重启IDE确保新设备ID生效");
  console.log("   🎛️ 支持用户选择操作哪些IDE");
}

// 运行测试
if (require.main === module) {
  testIDEManagement()
    .then(() => {
      analyzeIDEManagementFlow();
      console.log("\n🎉 所有测试完成");
    })
    .catch((error) => {
      console.error("💥 测试运行失败:", error);
    });
}

module.exports = {
  testIDEManagement,
  analyzeIDEManagementFlow,
};
