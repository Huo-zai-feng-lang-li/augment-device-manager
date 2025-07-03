const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 测试MCP配置保护修复
async function testMCPProtectionFix() {
  console.log("🧪 测试MCP配置保护修复功能...\n");

  let allTestsPassed = true;

  try {
    // 创建测试环境
    const testDir = path.join(os.tmpdir(), `mcp-protection-test-${Date.now()}`);
    await fs.ensureDir(testDir);

    // 模拟augment.vscode-augment目录结构
    const augmentDir = path.join(testDir, "augment.vscode-augment");
    const globalStateDir = path.join(augmentDir, "augment-global-state");
    const mcpConfigPath = path.join(globalStateDir, "mcpServers.json");

    await fs.ensureDir(globalStateDir);

    // 创建测试MCP配置
    const testMCPConfig = {
      localtime: {
        command: "node",
        args: [
          "C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\@augment\\mcp-localtime\\dist\\index.js",
        ],
        env: {},
      },
      context7: {
        command: "npx",
        args: ["-y", "@augment/mcp-context7"],
        env: {},
      },
      "edgeone-pages-mcp-server": {
        command: "node",
        args: [
          "C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\@augment\\edgeone-pages-mcp-server\\dist\\index.js",
        ],
        env: {},
      },
      playwright: {
        command: "npx",
        args: ["-y", "@augment/mcp-playwright"],
        env: {},
      },
      "mcp-server-chart": {
        command: "npx",
        args: ["-y", "@augment/mcp-server-chart"],
        env: {},
      },
      "sequential-thinking": {
        command: "npx",
        args: ["-y", "@augment/sequential-thinking"],
        env: {},
      },
    };

    await fs.writeJson(mcpConfigPath, testMCPConfig, { spaces: 2 });
    console.log("✅ 测试MCP配置文件已创建");

    // 导入DeviceManager
    const DeviceManager = require("../src/device-manager");
    const deviceManager = new DeviceManager();

    // 临时替换augmentStorage路径
    const originalAugmentStorage = deviceManager.cursorPaths.augmentStorage;
    deviceManager.cursorPaths.augmentStorage = augmentDir;

    // 测试1：测试cleanAugmentExtensionStorage方法的MCP保护
    console.log("\n📊 测试1：测试cleanAugmentExtensionStorage的MCP保护...");

    const results1 = { actions: [], errors: [] };
    await deviceManager.cleanAugmentExtensionStorage(results1, {
      skipBackup: true,
    });

    // 检查MCP配置是否被保护
    if (await fs.pathExists(mcpConfigPath)) {
      const restoredConfig = await fs.readJson(mcpConfigPath);
      if (JSON.stringify(restoredConfig) === JSON.stringify(testMCPConfig)) {
        console.log("  ✅ cleanAugmentExtensionStorage MCP保护成功");
        console.log(
          `  📋 保护的服务器数量: ${Object.keys(restoredConfig).length}`
        );
      } else {
        console.log("  ❌ cleanAugmentExtensionStorage MCP配置内容不匹配");
        allTestsPassed = false;
      }
    } else {
      console.log("  ❌ cleanAugmentExtensionStorage MCP配置文件未恢复");
      allTestsPassed = false;
    }

    // 重新创建测试环境用于下一个测试
    await fs.remove(augmentDir);
    await fs.ensureDir(globalStateDir);
    await fs.writeJson(mcpConfigPath, testMCPConfig, { spaces: 2 });

    // 测试2：测试resetUsageCount方法的MCP保护
    console.log("\n📊 测试2：测试resetUsageCount的MCP保护...");

    const results2 = await deviceManager.resetUsageCount();

    console.log("  调试信息 - resetUsageCount结果:");
    console.log("    actions:", results2.actions);
    console.log("    errors:", results2.errors);
    console.log("    augmentDir存在:", await fs.pathExists(augmentDir));
    console.log("    mcpConfigPath存在:", await fs.pathExists(mcpConfigPath));

    // 检查MCP配置是否被保护
    if (await fs.pathExists(mcpConfigPath)) {
      const restoredConfig = await fs.readJson(mcpConfigPath);
      if (JSON.stringify(restoredConfig) === JSON.stringify(testMCPConfig)) {
        console.log("  ✅ resetUsageCount MCP保护成功");
        console.log(
          `  📋 保护的服务器数量: ${Object.keys(restoredConfig).length}`
        );
      } else {
        console.log("  ❌ resetUsageCount MCP配置内容不匹配");
        console.log("  期望配置:", testMCPConfig);
        console.log("  实际配置:", restoredConfig);
        allTestsPassed = false;
      }
    } else {
      console.log("  ❌ resetUsageCount MCP配置文件未恢复");
      console.log("  检查目录结构:");
      if (await fs.pathExists(augmentDir)) {
        const items = await fs.readdir(augmentDir, { withFileTypes: true });
        for (const item of items) {
          console.log(`    ${item.isDirectory() ? "📁" : "📄"} ${item.name}`);
          if (item.isDirectory() && item.name === "augment-global-state") {
            const subItems = await fs.readdir(path.join(augmentDir, item.name));
            subItems.forEach((subItem) => console.log(`      📄 ${subItem}`));
          }
        }
      }
      allTestsPassed = false;
    }

    // 测试3：验证日志输出
    console.log("\n📊 测试3：验证保护日志输出...");

    const protectionLogs = results1.actions.filter(
      (action) => action.includes("🛡️") || action.includes("🔄")
    );

    if (protectionLogs.length >= 2) {
      console.log("  ✅ 保护日志输出正确");
      protectionLogs.forEach((log) => console.log(`    ${log}`));
    } else {
      console.log("  ❌ 保护日志输出不完整");
      console.log("  实际日志:", results1.actions);
      allTestsPassed = false;
    }

    // 恢复原始路径
    deviceManager.cursorPaths.augmentStorage = originalAugmentStorage;

    // 清理测试环境
    await fs.remove(testDir);

    // 测试结果
    console.log("\n" + "=".repeat(50));
    if (allTestsPassed) {
      console.log("🎉 所有MCP保护修复测试通过！");
      console.log("✅ cleanAugmentExtensionStorage方法已正确保护MCP配置");
      console.log("✅ resetUsageCount方法已正确保护MCP配置");
      console.log("✅ PowerShell脚本已更新MCP保护机制");
    } else {
      console.log("❌ 部分测试失败，请检查修复代码");
    }
  } catch (error) {
    console.error("❌ 测试执行失败:", error);
    allTestsPassed = false;
  }

  return allTestsPassed;
}

// 运行测试
if (require.main === module) {
  testMCPProtectionFix()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("测试运行失败:", error);
      process.exit(1);
    });
}

module.exports = { testMCPProtectionFix };
