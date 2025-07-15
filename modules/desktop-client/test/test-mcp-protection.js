const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const DeviceManager = require("../src/device-manager");

// 测试MCP配置保护功能
async function testMCPProtection() {
  console.log("🧪 测试MCP配置保护功能");
  console.log("=".repeat(50));

  const deviceManager = new DeviceManager();
  let allTestsPassed = true;

  try {
    // 测试1：创建模拟的MCP配置
    console.log("\n📊 测试1：创建模拟MCP配置...");

    const testMCPConfig = {
      mcpServers: {
        localtime: {
          command: "npx",
          args: ["@data_wise/localtime-mcp"],
        },
        context7: {
          command: "npx",
          args: ["-y", "@upstash/context7-mcp@latest"],
        },
        "edgeone-pages-mcp-server": {
          command: "npx",
          args: ["edgeone-pages-mcp"],
        },
        playwright: {
          command: "npx",
          args: ["@playwright/mcp@latest"],
        },
        "mcp-server-chart": {
          command: "cmd",
          args: ["/c", "npx", "-y", "@antv/mcp-server-chart"],
        },
        "sequential-thinking": {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
        },
      },
    };

    // 创建测试用的settings.json文件
    const testSettingsPath = path.join(os.tmpdir(), "test-settings.json");
    await fs.writeJson(testSettingsPath, testMCPConfig, { spaces: 2 });
    console.log(`  ✅ 创建测试MCP配置: ${testSettingsPath}`);

    // 测试2：测试Cursor MCP保护功能
    console.log("\n📊 测试2：测试Cursor MCP保护功能...");

    // 模拟Cursor路径
    const mockCursorPaths = {
      settingsJson: testSettingsPath,
    };

    // 临时替换cursorPaths进行测试
    const originalCursorPaths = deviceManager.cursorPaths;
    deviceManager.cursorPaths = mockCursorPaths;

    const results = { actions: [], errors: [] };
    const protectedConfig = await deviceManager.protectCursorMCPConfig(results);

    if (protectedConfig && protectedConfig.mcpServers) {
      console.log("  ✅ Cursor MCP配置保护成功");
      console.log(
        `  📋 保护的服务器数量: ${
          Object.keys(protectedConfig.mcpServers).length
        }`
      );
    } else {
      console.log("  ❌ Cursor MCP配置保护失败");
      allTestsPassed = false;
    }

    // 测试3：测试VS Code MCP保护功能
    console.log("\n📊 测试3：测试VS Code MCP保护功能...");

    const mockVSCodeVariant = {
      name: "stable",
      settingsJson: testSettingsPath,
    };

    const vsCodeResults = { actions: [], errors: [] };
    const vsCodeProtectedConfig = await deviceManager.protectVSCodeMCPConfig(
      vsCodeResults,
      mockVSCodeVariant
    );

    if (vsCodeProtectedConfig && vsCodeProtectedConfig.mcpServers) {
      console.log("  ✅ VS Code MCP配置保护成功");
      console.log(
        `  📋 保护的服务器数量: ${
          Object.keys(vsCodeProtectedConfig.mcpServers).length
        }`
      );
    } else {
      console.log("  ❌ VS Code MCP配置保护失败");
      allTestsPassed = false;
    }

    // 测试4：测试MCP配置恢复功能
    console.log("\n📊 测试4：测试MCP配置恢复功能...");

    // 创建一个空的settings.json
    const emptySettingsPath = path.join(os.tmpdir(), "empty-settings.json");
    await fs.writeJson(emptySettingsPath, {}, { spaces: 2 });

    // 恢复到空文件
    deviceManager.cursorPaths.settingsJson = emptySettingsPath;
    await deviceManager.restoreCursorMCPConfig(results, protectedConfig);

    // 验证恢复结果
    const restoredConfig = await fs.readJson(emptySettingsPath);
    if (
      restoredConfig.mcpServers &&
      Object.keys(restoredConfig.mcpServers).length > 0
    ) {
      console.log("  ✅ Cursor MCP配置恢复成功");
      console.log(
        `  📋 恢复的服务器数量: ${
          Object.keys(restoredConfig.mcpServers).length
        }`
      );
    } else {
      console.log("  ❌ Cursor MCP配置恢复失败");
      allTestsPassed = false;
    }

    // 测试5：测试清理过程中的MCP保护
    console.log("\n📊 测试5：测试清理过程中的MCP保护...");

    // 重新创建包含MCP配置的settings.json
    await fs.writeJson(testSettingsPath, testMCPConfig, { spaces: 2 });
    deviceManager.cursorPaths = mockCursorPaths;

    // 执行选择性清理（应该保护MCP配置）
    const cleanupResults = { actions: [], errors: [] };

    // 模拟清理过程
    const mcpConfigBeforeCleanup = await deviceManager.protectCursorMCPConfig(
      cleanupResults
    );

    console.log(
      "  📋 保护的配置:",
      JSON.stringify(mcpConfigBeforeCleanup, null, 2)
    );

    // 模拟清理操作（这里只是演示，实际清理会更复杂）
    await fs.writeJson(
      testSettingsPath,
      { someOtherConfig: "test" },
      { spaces: 2 }
    );

    // 恢复MCP配置
    await deviceManager.restoreCursorMCPConfig(
      cleanupResults,
      mcpConfigBeforeCleanup
    );

    // 立即检查恢复后的文件
    const immediateConfig = await fs.readJson(testSettingsPath);
    console.log(
      "  📋 恢复后立即读取:",
      JSON.stringify(immediateConfig, null, 2)
    );

    // 验证MCP配置是否被保留
    const finalConfig = await fs.readJson(testSettingsPath);
    console.log("  📋 最终配置内容:", JSON.stringify(finalConfig, null, 2));

    if (
      finalConfig.mcpServers &&
      Object.keys(finalConfig.mcpServers).length > 0
    ) {
      console.log("  ✅ 清理过程中MCP配置保护成功");
      console.log(
        `  📋 最终保留的服务器数量: ${
          Object.keys(finalConfig.mcpServers).length
        }`
      );

      // 验证具体的MCP服务器是否存在
      const expectedServers = [
        "localtime",
        "context7",
        "edgeone-pages-mcp-server",
        "playwright",
        "mcp-server-chart",
        "sequential-thinking",
      ];
      const actualServers = Object.keys(finalConfig.mcpServers);
      const missingServers = expectedServers.filter(
        (server) => !actualServers.includes(server)
      );

      if (missingServers.length === 0) {
        console.log("  ✅ 所有预期的MCP服务器都已保留");
      } else {
        console.log(`  ⚠️ 缺少MCP服务器: ${missingServers.join(", ")}`);
      }
    } else {
      console.log("  ❌ 清理过程中MCP配置保护失败");
      console.log("  📋 最终配置中没有找到mcpServers");
      allTestsPassed = false;
    }

    // 恢复原始配置
    deviceManager.cursorPaths = originalCursorPaths;

    // 清理测试文件
    await fs.remove(testSettingsPath);
    await fs.remove(emptySettingsPath);

    // 测试结果总结
    console.log("\n" + "=".repeat(50));
    if (allTestsPassed) {
      console.log("🎉 所有MCP配置保护测试通过！");
      console.log("✅ MCP配置在清理过程中将被完全保护");
    } else {
      console.log("❌ 部分MCP配置保护测试失败");
      console.log("⚠️ 需要检查MCP保护逻辑");
    }

    // 显示操作日志
    console.log("\n📋 操作日志:");
    [
      ...results.actions,
      ...vsCodeResults.actions,
      ...cleanupResults.actions,
    ].forEach((action) => {
      console.log(`  ${action}`);
    });

    if (
      results.errors.length > 0 ||
      vsCodeResults.errors.length > 0 ||
      cleanupResults.errors.length > 0
    ) {
      console.log("\n❌ 错误日志:");
      [
        ...results.errors,
        ...vsCodeResults.errors,
        ...cleanupResults.errors,
      ].forEach((error) => {
        console.log(`  ${error}`);
      });
    }
  } catch (error) {
    console.error("❌ 测试过程中发生错误:", error.message);
    allTestsPassed = false;
  }

  return allTestsPassed;
}

// 运行测试
if (require.main === module) {
  testMCPProtection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("测试执行失败:", error);
      process.exit(1);
    });
}

module.exports = testMCPProtection;
