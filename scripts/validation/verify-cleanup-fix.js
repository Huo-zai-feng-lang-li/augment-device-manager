const fs = require("fs-extra");
const path = require("path");

// 验证清理修复
async function verifyCleanupFix() {
  console.log("🔍 验证清理模式修复...");

  const rendererPath = path.join(
    __dirname,
    "modules",
    "desktop-client",
    "public",
    "renderer.js"
  );

  try {
    const content = await fs.readFile(rendererPath, "utf8");

    // 1. 检查关键的参数传递修复
    console.log("\n📋 检查参数传递修复：");

    const parameterChecks = [
      {
        pattern: /aggressiveMode:\s*cleanupOptions\.aggressiveMode/g,
        description: "使用配置的 aggressiveMode 参数",
        shouldExist: true,
      },
      {
        pattern: /multiRoundClean:\s*cleanupOptions\.multiRoundClean/g,
        description: "使用配置的 multiRoundClean 参数",
        shouldExist: true,
      },
      {
        pattern: /extendedMonitoring:\s*cleanupOptions\.extendedMonitoring/g,
        description: "使用配置的 extendedMonitoring 参数",
        shouldExist: true,
      },
      {
        pattern: /intelligentMode:\s*cleanupOptions\.intelligentMode/g,
        description: "传递智能模式标识",
        shouldExist: true,
      },
      {
        pattern: /standardMode:\s*cleanupOptions\.standardMode/g,
        description: "传递标准模式标识",
        shouldExist: true,
      },
    ];

    parameterChecks.forEach((check) => {
      const matches = content.match(check.pattern);
      const exists = matches && matches.length > 0;
      console.log(
        `   ${exists ? "✅" : "❌"} ${check.description}: ${
          exists ? "已修复" : "未找到"
        }`
      );
    });

    // 2. 检查智能清理模式的日志信息
    console.log("\n📋 检查日志信息修复：");

    const logChecks = [
      {
        pattern: /执行智能清理操作（精准清理设备身份）/g,
        description: "智能清理模式日志",
      },
      {
        pattern: /执行标准清理操作（深度清理保留核心配置）/g,
        description: "标准清理模式日志",
      },
      {
        pattern: /执行完全清理操作（彻底重置仅保护MCP）/g,
        description: "完全清理模式日志",
      },
    ];

    logChecks.forEach((check) => {
      const matches = content.match(check.pattern);
      const exists = matches && matches.length > 0;
      console.log(
        `   ${exists ? "✅" : "❌"} ${check.description}: ${
          exists ? "已添加" : "未找到"
        }`
      );
    });

    // 3. 验证智能清理模式配置
    console.log("\n📋 验证智能清理模式配置：");

    const intelligentModeMatch = content.match(
      /case "intelligent":([\s\S]*?)break;/
    );
    if (intelligentModeMatch) {
      const config = intelligentModeMatch[1];

      const criticalSettings = [
        { key: "cleanCursorExtension", expected: "false" },
        { key: "autoRestartCursor", expected: "false" },
        { key: "aggressiveMode", expected: "false" },
        { key: "multiRoundClean", expected: "false" },
        { key: "cleanCursor", expected: "false" },
      ];

      criticalSettings.forEach((setting) => {
        const regex = new RegExp(`${setting.key}:\\s*(\\w+)`);
        const match = config.match(regex);
        if (match) {
          const value = match[1];
          const isCorrect = value === setting.expected;
          console.log(
            `   ${isCorrect ? "✅" : "❌"} ${setting.key}: ${value} (期望: ${
              setting.expected
            })`
          );
        }
      });
    }

    // 4. 生成修复报告
    console.log("\n" + "=".repeat(60));
    console.log("📊 修复状态报告");
    console.log("=".repeat(60));

    const isFixed =
      !content.includes("aggressiveMode: true") &&
      content.includes("aggressiveMode: cleanupOptions.aggressiveMode") &&
      content.includes("执行智能清理操作");

    if (isFixed) {
      console.log("✅ 修复成功！");
      console.log("📝 修复内容：");
      console.log("   1. 移除了硬编码的激进清理参数");
      console.log("   2. 使用清理模式配置的参数");
      console.log("   3. 添加了模式特定的日志信息");
      console.log("   4. 智能清理模式现在真正执行温和清理");

      console.log("\n🎯 现在的行为：");
      console.log("   • 智能清理：只清理设备身份，保留所有设置");
      console.log("   • 标准清理：深度清理但保留核心配置");
      console.log("   • 完全清理：彻底重置仅保护MCP配置");
    } else {
      console.log("❌ 修复不完整，请检查代码");
    }

    console.log("=".repeat(60));
  } catch (error) {
    console.error(`❌ 验证失败: ${error.message}`);
  }
}

// 创建使用建议
async function createUsageGuide() {
  console.log("\n📖 创建使用建议...");

  const guide = `
# Cursor设置重置问题解决方案

## 🚨 问题原因
之前的代码中存在硬编码的激进清理参数，导致无论选择什么清理模式，都会执行深度清理操作。

## ✅ 修复内容
1. **移除硬编码参数**：不再强制使用激进模式
2. **使用配置参数**：根据选择的清理模式使用对应参数
3. **优化日志信息**：不同模式显示不同的操作提示

## 🎯 现在的清理模式行为

### 🧠 智能清理模式（推荐日常使用）
- ✅ 只清理设备身份数据
- ✅ 保留所有Cursor设置和配置
- ✅ 保留IDE登录状态
- ✅ 保护MCP配置
- ✅ 不重启IDE，不影响工作流程

### 🔧 标准清理模式
- ⚠️ 深度清理大部分数据
- ✅ 保留核心配置和MCP设置
- ⚠️ 可能需要重新配置部分设置

### 💥 完全清理模式（谨慎使用）
- ❌ 彻底重置所有IDE数据
- ✅ 仅保护MCP配置
- ❌ 需要重新配置所有设置

## 💡 使用建议
1. **日常重置**：使用智能清理模式
2. **深度问题**：使用标准清理模式
3. **完全重新开始**：使用完全清理模式

## 🔧 如果设置已被重置
运行恢复脚本：\`node scripts/utils/restore-mcp-config.js\`
`;

  const guidePath = path.join(__dirname, "CURSOR-SETTINGS-FIX-GUIDE.md");
  await fs.writeFile(guidePath, guide);
  console.log(`✅ 使用指南已创建: ${guidePath}`);
}

// 运行验证
if (require.main === module) {
  verifyCleanupFix()
    .then(() => createUsageGuide())
    .catch(console.error);
}

module.exports = { verifyCleanupFix };
