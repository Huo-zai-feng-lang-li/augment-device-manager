const fs = require("fs-extra");
const path = require("path");

// 测试UI描述更新
async function testUIDescriptionUpdates() {
  console.log("🔍 测试UI描述更新");
  console.log("==================================================");

  try {
    const htmlPath = path.join(__dirname, "..", "public", "index.html");
    const htmlContent = await fs.readFile(htmlPath, "utf8");

    // 检查功能说明区域
    const hasFunctionDescription = htmlContent.includes("💡 功能说明");
    console.log(
      `功能说明区域: ${hasFunctionDescription ? "✅ 已添加" : "❌ 缺失"}`
    );

    // 检查默认清理说明（考虑HTML格式化可能的换行）
    const hasDefaultCleanDescription =
      htmlContent.includes("默认清理") &&
      htmlContent.includes("仅清理") &&
      htmlContent.includes("Augment");
    console.log(
      `默认清理说明: ${hasDefaultCleanDescription ? "✅ 已更新" : "❌ 缺失"}`
    );

    // 检查完全重置说明
    const hasCompleteResetDescription =
      htmlContent.includes("清理所有 IDE 数据");
    console.log(
      `完全重置说明: ${hasCompleteResetDescription ? "✅ 已更新" : "❌ 缺失"}`
    );

    // 检查Cursor IDE标签说明
    const hasCursorDescription =
      htmlContent.includes("(默认清理Augment扩展数据)");
    console.log(
      `Cursor IDE标签说明: ${hasCursorDescription ? "✅ 已更新" : "❌ 缺失"}`
    );

    // 检查VS Code标签说明
    const hasVSCodeDescription =
      htmlContent.includes("💙 Visual Studio Code") &&
      htmlContent.includes("(默认清理Augment扩展数据)");
    console.log(
      `VS Code标签说明: ${hasVSCodeDescription ? "✅ 已更新" : "❌ 缺失"}`
    );

    // 检查Augment扩展特定说明
    const hasAugmentSpecificDescription =
      htmlContent.includes("让Augment扩展认为是新设备");
    console.log(
      `Augment扩展特定说明: ${
        hasAugmentSpecificDescription ? "✅ 已更新" : "❌ 缺失"
      }`
    );

    // 总体评估
    const allUpdatesComplete =
      hasFunctionDescription &&
      hasDefaultCleanDescription &&
      hasCompleteResetDescription &&
      hasCursorDescription &&
      hasVSCodeDescription &&
      hasAugmentSpecificDescription;

    console.log("\n" + "=".repeat(50));
    console.log("📋 UI描述更新结果");
    console.log("=".repeat(50));

    if (allUpdatesComplete) {
      console.log("🎉 所有UI描述更新完成！");
      console.log("✅ 功能说明区域已添加");
      console.log("✅ 默认清理和完全重置说明已明确");
      console.log("✅ IDE选择标签说明已更新");
      console.log("✅ Augment扩展特定说明已添加");
      console.log("\n🚀 用户现在可以清楚了解：");
      console.log("   - 默认清理只影响Augment扩展数据");
      console.log("   - 完全重置会清理所有IDE数据");
      console.log("   - 每个选项的具体作用范围");
    } else {
      console.log("⚠️ 部分UI描述更新未完成");
      console.log("请检查上述失败项目");
    }

    return allUpdatesComplete;
  } catch (error) {
    console.error("❌ UI描述测试失败:", error.message);
    return false;
  }
}

// 运行测试
if (require.main === module) {
  testUIDescriptionUpdates()
    .then((success) => {
      console.log(`\n🎯 测试完成，结果: ${success ? "成功" : "失败"}`);
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("\n💥 测试失败:", error);
      process.exit(1);
    });
}

module.exports = { testUIDescriptionUpdates };
