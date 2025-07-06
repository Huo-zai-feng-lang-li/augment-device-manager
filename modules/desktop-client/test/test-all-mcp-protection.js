const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 测试所有MCP保护场景
async function testAllMCPProtection() {
  console.log("🔍 测试所有MCP保护场景...\n");

  try {
    // 1. 检查真实的MCP配置文件
    const realMcpConfigPath = path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Cursor",
      "User",
      "globalStorage",
      "augment.vscode-augment",
      "augment-global-state",
      "mcpServers.json"
    );

    console.log("📍 检查真实MCP配置文件:");
    console.log(`   路径: ${realMcpConfigPath}`);
    
    const realMcpExists = await fs.pathExists(realMcpConfigPath);
    console.log(`   存在: ${realMcpExists ? "✅ 是" : "❌ 否"}`);

    let originalMcpConfig = null;
    if (realMcpExists) {
      originalMcpConfig = await fs.readJson(realMcpConfigPath);
      console.log(`   包含 ${Object.keys(originalMcpConfig).length} 个MCP服务器`);
    } else {
      console.log("⚠️ 未找到真实MCP配置文件，跳过真实测试");
      return;
    }

    // 2. 导入DeviceManager
    const DeviceManager = require("../src/device-manager");
    const deviceManager = new DeviceManager();

    // 3. 测试所有可能影响MCP配置的方法
    const testScenarios = [
      {
        name: "cleanAugmentExtensionStorage",
        method: async () => {
          const results = { actions: [], errors: [] };
          await deviceManager.cleanAugmentExtensionStorage(results, { skipBackup: true });
          return results;
        }
      },
      {
        name: "resetUsageCount", 
        method: async () => {
          return await deviceManager.resetUsageCount();
        }
      },
      {
        name: "cleanCursorExtensionData",
        method: async () => {
          const results = { actions: [], errors: [] };
          await deviceManager.cleanCursorExtensionData(results, { skipBackup: true });
          return results;
        }
      }
    ];

    let allTestsPassed = true;

    for (const scenario of testScenarios) {
      console.log(`\n🧪 测试场景: ${scenario.name}`);
      
      try {
        // 执行测试方法
        const result = await scenario.method();
        
        console.log(`   执行结果: ${result.success !== false ? "✅ 成功" : "❌ 失败"}`);
        console.log(`   操作数量: ${result.actions ? result.actions.length : 0}`);
        console.log(`   错误数量: ${result.errors ? result.errors.length : 0}`);

        // 验证MCP配置是否仍然存在
        const mcpStillExists = await fs.pathExists(realMcpConfigPath);
        console.log(`   MCP配置存在: ${mcpStillExists ? "✅ 是" : "❌ 否"}`);

        if (mcpStillExists) {
          const currentMcpConfig = await fs.readJson(realMcpConfigPath);
          const configMatches = JSON.stringify(currentMcpConfig) === JSON.stringify(originalMcpConfig);
          console.log(`   配置内容匹配: ${configMatches ? "✅ 是" : "❌ 否"}`);
          
          if (!configMatches) {
            console.log("   ⚠️ 配置内容发生变化");
            console.log(`   原始服务器数量: ${Object.keys(originalMcpConfig).length}`);
            console.log(`   当前服务器数量: ${Object.keys(currentMcpConfig).length}`);
            allTestsPassed = false;
          }
        } else {
          console.log("   ❌ MCP配置文件丢失！");
          allTestsPassed = false;
        }

        // 显示保护相关的操作日志
        if (result.actions) {
          const mcpActions = result.actions.filter(action => 
            action.includes("MCP") || action.includes("mcp") || action.includes("🛡️") || action.includes("🔄")
          );
          if (mcpActions.length > 0) {
            console.log("   📝 MCP相关操作:");
            mcpActions.forEach(action => {
              console.log(`     • ${action}`);
            });
          }
        }

      } catch (error) {
        console.log(`   ❌ 测试失败: ${error.message}`);
        allTestsPassed = false;
      }
    }

    // 4. 测试通用保护机制
    console.log("\n🧪 测试通用保护机制...");
    
    try {
      const results = { actions: [], errors: [] };
      const mcpConfigs = await deviceManager.protectMCPConfigUniversal(results);
      
      console.log(`   检测到的MCP配置: ${mcpConfigs.size} 个`);
      console.log(`   保护操作数量: ${results.actions.length}`);
      
      if (mcpConfigs.size > 0) {
        console.log("   📝 检测到的配置路径:");
        for (const [mcpPath] of mcpConfigs) {
          console.log(`     • ${mcpPath}`);
        }
      }

    } catch (error) {
      console.log(`   ❌ 通用保护机制测试失败: ${error.message}`);
      allTestsPassed = false;
    }

    // 5. 总结测试结果
    console.log("\n🎯 测试总结:");
    console.log(`   所有测试通过: ${allTestsPassed ? "✅ 是" : "❌ 否"}`);
    
    if (allTestsPassed) {
      console.log("   🎉 所有MCP保护机制正常工作！");
      console.log("   ✅ MCP配置在所有清理场景下都得到完全保护");
    } else {
      console.log("   ⚠️ 发现问题，需要进一步调试");
    }

    // 6. 提供使用建议
    console.log("\n💡 使用建议:");
    console.log("   • 所有清理操作都会自动保护MCP配置");
    console.log("   • 支持Windows、macOS、Linux多平台");
    console.log("   • 支持Cursor和VS Code双IDE");
    console.log("   • 无需用户手动配置，完全自动化");

  } catch (error) {
    console.error("❌ 测试失败:", error);
  }
}

// 运行测试
if (require.main === module) {
  testAllMCPProtection().catch(console.error);
}

module.exports = { testAllMCPProtection };
