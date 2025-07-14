const fs = require("fs-extra");
const path = require("path");

// 测试客户端UI参数传递的正确性
async function testClientUIParameters() {
  console.log("🖥️ 客户端UI参数传递测试");
  console.log("=".repeat(60));

  try {
    // 读取客户端渲染器代码
    const rendererPath = path.resolve(
      __dirname,
      "../../modules/desktop-client/public/renderer.js"
    );
    console.log("尝试读取文件:", rendererPath);
    const rendererContent = await fs.readFile(rendererPath, "utf8");

    // 提取performCleanup函数
    const performCleanupMatch = rendererContent.match(
      /async function performCleanup\(\) \{([\s\S]*?)\n\}/
    );

    if (!performCleanupMatch) {
      throw new Error("未找到performCleanup函数");
    }

    console.log("✅ 找到performCleanup函数");

    // 分析不同清理模式的参数配置
    const cleanupFunction = performCleanupMatch[1];

    // 提取智能清理模式配置
    const intelligentModeMatch = cleanupFunction.match(
      /case "intelligent":([\s\S]*?)break;/
    );
    if (intelligentModeMatch) {
      console.log("\n🧠 智能清理模式UI配置:");
      console.log("-".repeat(40));

      const intelligentConfig = intelligentModeMatch[1];

      // 检查关键参数
      const keyParams = [
        { key: "cleanCursorExtension", expected: "false", critical: true },
        { key: "autoRestartCursor", expected: "false", critical: true },
        { key: "aggressiveMode", expected: "false", critical: true },
        { key: "multiRoundClean", expected: "false", critical: true },
        { key: "usePowerShellAssist", expected: "false", critical: true },
        { key: "cleanCursor", expected: "false", critical: true },
        { key: "cleanVSCode", expected: "false", critical: true },
        { key: "intelligentMode", expected: "true", critical: true },
      ];

      keyParams.forEach((param) => {
        const regex = new RegExp(`${param.key}:\\s*(\\w+)`, "i");
        const match = intelligentConfig.match(regex);

        if (match) {
          const actualValue = match[1];
          const isCorrect = actualValue === param.expected;
          const status = isCorrect ? "✅" : "❌";
          const importance = param.critical ? "🔥" : "⚠️";

          console.log(
            `  ${status} ${importance} ${param.key}: ${actualValue} (期望: ${param.expected})`
          );

          if (!isCorrect && param.critical) {
            console.log(`    ❗ 关键参数错误！这会导致智能清理执行错误的操作`);
          }
        } else {
          console.log(`  ❌ 🔥 ${param.key}: 未找到 (期望: ${param.expected})`);
        }
      });
    }

    // 提取标准清理模式配置
    const standardModeMatch = cleanupFunction.match(
      /case "standard":([\s\S]*?)break;/
    );
    if (standardModeMatch) {
      console.log("\n🔧 标准清理模式UI配置:");
      console.log("-".repeat(40));

      const standardConfig = standardModeMatch[1];

      const keyParams = [
        { key: "cleanCursorExtension", expected: "true", critical: true },
        { key: "autoRestartCursor", expected: "true", critical: false },
        { key: "aggressiveMode", expected: "true", critical: true },
        { key: "multiRoundClean", expected: "true", critical: true },
        { key: "usePowerShellAssist", expected: "true", critical: true },
        { key: "standardMode", expected: "true", critical: true },
      ];

      keyParams.forEach((param) => {
        const regex = new RegExp(`${param.key}:\\s*(\\w+)`, "i");
        const match = standardConfig.match(regex);

        if (match) {
          const actualValue = match[1];
          const isCorrect = actualValue === param.expected;
          const status = isCorrect ? "✅" : "❌";
          const importance = param.critical ? "🔥" : "⚠️";

          console.log(
            `  ${status} ${importance} ${param.key}: ${actualValue} (期望: ${param.expected})`
          );
        } else {
          console.log(`  ❌ 🔥 ${param.key}: 未找到 (期望: ${param.expected})`);
        }
      });
    }

    // 提取完全清理模式配置
    const completeModeMatch = cleanupFunction.match(
      /case "complete":([\s\S]*?)break;/
    );
    if (completeModeMatch) {
      console.log("\n💥 完全清理模式UI配置:");
      console.log("-".repeat(40));

      const completeConfig = completeModeMatch[1];

      const keyParams = [
        { key: "resetCursorCompletely", expected: "true", critical: true },
        { key: "resetVSCodeCompletely", expected: "true", critical: true },
        { key: "skipCursorLogin", expected: "false", critical: true },
        { key: "aggressiveMode", expected: "true", critical: true },
        { key: "completeMode", expected: "true", critical: true },
      ];

      keyParams.forEach((param) => {
        const regex = new RegExp(`${param.key}:\\s*(\\w+)`, "i");
        const match = completeConfig.match(regex);

        if (match) {
          const actualValue = match[1];
          const isCorrect = actualValue === param.expected;
          const status = isCorrect ? "✅" : "❌";
          const importance = param.critical ? "🔥" : "⚠️";

          console.log(
            `  ${status} ${importance} ${param.key}: ${actualValue} (期望: ${param.expected})`
          );
        } else {
          console.log(`  ❌ 🔥 ${param.key}: 未找到 (期望: ${param.expected})`);
        }
      });
    }

    // 检查参数传递逻辑
    console.log("\n📡 参数传递逻辑检查:");
    console.log("-".repeat(40));

    // 检查ipcRenderer.invoke调用
    const ipcInvokeMatch = cleanupFunction.match(
      /ipcRenderer\.invoke\("perform-device-cleanup",\s*\{([\s\S]*?)\}\);/
    );
    if (ipcInvokeMatch) {
      console.log("✅ 找到IPC调用");

      const ipcParams = ipcInvokeMatch[1];

      // 检查是否正确传递cleanupOptions
      if (ipcParams.includes("...cleanupOptions")) {
        console.log("✅ 正确使用展开运算符传递cleanupOptions");
      } else {
        console.log("❌ 未找到cleanupOptions展开运算符");
      }

      // 检查IDE选择选项
      if (
        ipcParams.includes("cleanCursor:") &&
        ipcParams.includes("cleanVSCode:")
      ) {
        console.log("✅ 包含IDE选择选项");
      } else {
        console.log("❌ 缺少IDE选择选项");
      }
    } else {
      console.log("❌ 未找到IPC调用");
    }

    // 总结
    console.log("\n📊 测试总结:");
    console.log("=".repeat(60));
    console.log("✅ 客户端UI参数配置检查完成");
    console.log("🔍 请查看上述检查结果，确保所有关键参数配置正确");
    console.log(
      "⚠️ 特别关注标记为🔥的关键参数，这些参数错误会导致清理模式执行错误的操作"
    );

    return true;
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
    return false;
  }
}

// 运行测试
if (require.main === module) {
  testClientUIParameters()
    .then((success) => {
      if (success) {
        console.log("\n🎉 客户端UI参数测试完成");
        process.exit(0);
      } else {
        console.log("\n❌ 测试失败");
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("❌ 测试执行失败:", error);
      process.exit(1);
    });
}

module.exports = { testClientUIParameters };
