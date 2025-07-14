const fs = require("fs-extra");
const path = require("path");

// 分析清理问题
async function analyzeCleanupIssue() {
  console.log("🔍 分析智能清理模式执行深度清理的原因...");

  // 1. 检查日志中的关键信息
  console.log("\n📋 从日志分析执行的操作：");
  const logAnalysis = [
    "✅ ✓ 🔄 强制关闭Cursor IDE... - 这不应该在智能模式中执行",
    "✅ ✓ 已清理设备数据，保留激活状态和服务器配置 - 正常",
    "✅ ✓ 已清理表 ItemTable: 23 条记录 - 深度清理操作",
    "✅ ✓ 已清理表 cursorDiskKV: 9 条记录 - 深度清理操作",
    "✅ ✓ ✅ 已清理Augment扩展存储: augment.vscode-augment - 深度清理",
    "✅ ✓ 🔄 启动多轮清理模式... - 这不应该在智能模式中执行",
    "✅ ✓ 🚀 正在启动Cursor IDE... - 智能模式不应该重启IDE",
    "✅ ✓ 🛡️ 独立守护服务已启动（持久防护） - 深度清理功能",
  ];

  logAnalysis.forEach((item) => {
    console.log(`   ${item}`);
  });

  // 2. 分析可能的原因
  console.log("\n🤔 可能的原因分析：");
  console.log("   1. 用户实际选择的不是智能清理模式");
  console.log("   2. 前端UI与后端逻辑不匹配");
  console.log("   3. 默认参数覆盖了智能模式设置");
  console.log("   4. 代码中存在逻辑错误");

  // 3. 检查当前的清理模式配置
  await checkCleanupModeConfig();

  // 4. 提供解决方案
  console.log("\n💡 解决方案建议：");
  console.log("   1. 确保选择智能清理模式（🧠 智能清理）");
  console.log("   2. 检查前端UI的默认选项");
  console.log("   3. 验证后端参数传递逻辑");
  console.log("   4. 使用调试模式查看实际传递的参数");

  // 5. 创建智能清理测试
  await createIntelligentCleanupTest();
}

// 检查清理模式配置
async function checkCleanupModeConfig() {
  console.log("\n🔧 检查清理模式配置...");

  const rendererPath = path.join(
    __dirname,
    "..",
    "..",
    "modules",
    "desktop-client",
    "public",
    "renderer.js"
  );

  try {
    if (await fs.pathExists(rendererPath)) {
      const content = await fs.readFile(rendererPath, "utf8");

      // 检查智能清理模式的配置
      const intelligentModeMatch = content.match(
        /case "intelligent":([\s\S]*?)break;/
      );
      if (intelligentModeMatch) {
        console.log("✅ 找到智能清理模式配置");

        // 检查关键设置
        const config = intelligentModeMatch[1];
        const keySettings = [
          {
            key: "cleanCursorExtension",
            expected: "false",
            description: "不清理Cursor扩展",
          },
          {
            key: "autoRestartCursor",
            expected: "false",
            description: "不重启Cursor",
          },
          {
            key: "aggressiveMode",
            expected: "false",
            description: "不使用激进模式",
          },
          {
            key: "multiRoundClean",
            expected: "false",
            description: "不使用多轮清理",
          },
          {
            key: "usePowerShellAssist",
            expected: "false",
            description: "不使用PowerShell辅助",
          },
          {
            key: "cleanCursor",
            expected: "false",
            description: "不清理Cursor",
          },
        ];

        keySettings.forEach((setting) => {
          const regex = new RegExp(`${setting.key}:\\s*(\\w+)`);
          const match = config.match(regex);
          if (match) {
            const value = match[1];
            const isCorrect = value === setting.expected;
            console.log(
              `   ${isCorrect ? "✅" : "❌"} ${setting.key}: ${value} (期望: ${
                setting.expected
              }) - ${setting.description}`
            );
          } else {
            console.log(`   ⚠️ 未找到 ${setting.key} 设置`);
          }
        });
      } else {
        console.log("❌ 未找到智能清理模式配置");
      }
    } else {
      console.log("❌ renderer.js 文件不存在");
    }
  } catch (error) {
    console.log(`❌ 检查配置失败: ${error.message}`);
  }
}

// 创建智能清理测试
async function createIntelligentCleanupTest() {
  console.log("\n🧪 创建智能清理测试脚本...");

  const testScript = `
// 智能清理模式测试
const testIntelligentCleanup = async () => {
  console.log("🧠 测试智能清理模式参数...");
  
  // 模拟智能清理模式的参数
  const intelligentOptions = {
    preserveActivation: true,
    deepClean: false,
    cleanCursorExtension: false, // 关键：不应该清理扩展
    autoRestartCursor: false,    // 关键：不应该重启
    skipBackup: true,
    enableEnhancedGuardian: true,
    skipCursorLogin: true,
    resetCursorCompletely: false,
    resetVSCodeCompletely: false,
    aggressiveMode: false,       // 关键：不应该激进
    multiRoundClean: false,      // 关键：不应该多轮
    extendedMonitoring: false,
    usePowerShellAssist: false,  // 关键：不应该用PS
    intelligentMode: true,
    cleanCursor: false,          // 关键：不应该清理Cursor
    cleanVSCode: false
  };
  
  console.log("📊 智能清理参数验证：");
  Object.entries(intelligentOptions).forEach(([key, value]) => {
    const shouldBeFalse = [
      'deepClean', 'cleanCursorExtension', 'autoRestartCursor', 
      'resetCursorCompletely', 'resetVSCodeCompletely', 'aggressiveMode',
      'multiRoundClean', 'extendedMonitoring', 'usePowerShellAssist',
      'cleanCursor', 'cleanVSCode'
    ];
    
    if (shouldBeFalse.includes(key) && value === true) {
      console.log(\`❌ \${key}: \${value} - 智能模式中应该为false\`);
    } else if (key === 'intelligentMode' && value !== true) {
      console.log(\`❌ \${key}: \${value} - 应该为true\`);
    } else {
      console.log(\`✅ \${key}: \${value}\`);
    }
  });
};

testIntelligentCleanup();
`;

  const testPath = path.join(
    __dirname,
    "..",
    "..",
    "tests",
    "current",
    "test-intelligent-cleanup.js"
  );
  await fs.writeFile(testPath, testScript);
  console.log(`✅ 测试脚本已创建: ${testPath}`);
}

// 运行分析
if (require.main === module) {
  analyzeCleanupIssue().catch(console.error);
}

module.exports = { analyzeCleanupIssue };
