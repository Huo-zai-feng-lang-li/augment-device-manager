const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 全面测试MCP保护机制
async function testComprehensiveMCPProtection() {
  console.log("🔍 全面测试MCP保护机制...\n");

  try {
    // 1. 检查所有可能的MCP配置文件路径
    const mcpPaths = [
      // Cursor路径
      path.join(os.homedir(), "AppData", "Roaming", "Cursor", "User", "globalStorage", "augment.vscode-augment", "augment-global-state", "mcpServers.json"),
      path.join(os.homedir(), "AppData", "Local", "Cursor", "User", "globalStorage", "augment.vscode-augment", "augment-global-state", "mcpServers.json"),
      // VS Code路径
      path.join(os.homedir(), "AppData", "Roaming", "Code", "User", "globalStorage", "augment.vscode-augment", "augment-global-state", "mcpServers.json"),
      path.join(os.homedir(), "AppData", "Local", "Code", "User", "globalStorage", "augment.vscode-augment", "augment-global-state", "mcpServers.json"),
    ];

    console.log("📍 检查所有MCP配置文件路径:");
    const existingMcpPaths = [];
    const originalConfigs = new Map();

    for (const mcpPath of mcpPaths) {
      const exists = await fs.pathExists(mcpPath);
      const ide = mcpPath.includes("Cursor") ? "Cursor" : "VS Code";
      const location = mcpPath.includes("Roaming") ? "Roaming" : "Local";
      
      console.log(`   ${ide} (${location}): ${exists ? "✅ 存在" : "❌ 不存在"}`);
      
      if (exists) {
        existingMcpPaths.push(mcpPath);
        try {
          const config = await fs.readJson(mcpPath);
          originalConfigs.set(mcpPath, config);
          console.log(`     包含 ${Object.keys(config).length} 个MCP服务器`);
        } catch (error) {
          console.log(`     ⚠️ 读取失败: ${error.message}`);
        }
      }
    }

    if (existingMcpPaths.length === 0) {
      console.log("\n⚠️ 未找到任何真实MCP配置文件，将创建测试配置进行验证");
      
      // 创建测试MCP配置
      const testMCPConfig = {
        "localtime": {
          "command": "node",
          "args": ["C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\@augment\\localtime\\dist\\index.js"],
          "env": {}
        },
        "context7": {
          "command": "npx",
          "args": ["-y", "@augment/context7"],
          "env": {}
        },
        "test-server": {
          "command": "echo",
          "args": ["test"],
          "env": {}
        }
      };

      // 为Cursor和VS Code都创建测试配置
      const testPaths = [
        path.join(os.homedir(), "AppData", "Roaming", "Cursor", "User", "globalStorage", "augment.vscode-augment", "augment-global-state", "mcpServers.json"),
        path.join(os.homedir(), "AppData", "Roaming", "Code", "User", "globalStorage", "augment.vscode-augment", "augment-global-state", "mcpServers.json"),
      ];

      for (const testPath of testPaths) {
        await fs.ensureDir(path.dirname(testPath));
        await fs.writeJson(testPath, testMCPConfig, { spaces: 2 });
        existingMcpPaths.push(testPath);
        originalConfigs.set(testPath, testMCPConfig);
        const ide = testPath.includes("Cursor") ? "Cursor" : "VS Code";
        console.log(`   ✅ 已创建${ide}测试MCP配置`);
      }
    }

    // 2. 测试通用保护机制
    console.log("\n🧪 测试通用保护机制...");
    
    const DeviceManager = require("../src/device-manager");
    const deviceManager = new DeviceManager();

    const results = { actions: [], errors: [] };
    const mcpConfigs = await deviceManager.protectMCPConfigUniversal(results);
    
    console.log(`   检测到的MCP配置: ${mcpConfigs.size} 个`);
    console.log(`   保护操作数量: ${results.actions.length}`);
    
    if (mcpConfigs.size > 0) {
      console.log("   📝 检测到的配置路径:");
      for (const [mcpPath] of mcpConfigs) {
        const ide = mcpPath.includes("Cursor") ? "Cursor" : "VS Code";
        console.log(`     • ${ide}: ${mcpPath}`);
      }
    }

    // 3. 测试所有清理场景
    const testScenarios = [
      {
        name: "Cursor扩展清理",
        method: async () => {
          const results = { actions: [], errors: [] };
          await deviceManager.cleanAugmentExtensionStorage(results, { skipBackup: true });
          return results;
        }
      },
      {
        name: "VS Code选择性清理",
        method: async () => {
          const results = { actions: [], errors: [] };
          await deviceManager.performVSCodeCleanup(results, { 
            skipBackup: true, 
            resetVSCodeCompletely: false 
          });
          return results;
        }
      },
      {
        name: "VS Code完全重置",
        method: async () => {
          const results = { actions: [], errors: [] };
          await deviceManager.performVSCodeCleanup(results, { 
            skipBackup: true, 
            resetVSCodeCompletely: true 
          });
          return results;
        }
      },
      {
        name: "重置使用计数",
        method: async () => {
          return await deviceManager.resetUsageCount();
        }
      }
    ];

    let allTestsPassed = true;

    for (const scenario of testScenarios) {
      console.log(`\n🧪 测试场景: ${scenario.name}`);
      
      try {
        const result = await scenario.method();
        
        console.log(`   执行结果: ${result.success !== false ? "✅ 成功" : "❌ 失败"}`);
        console.log(`   操作数量: ${result.actions ? result.actions.length : 0}`);
        console.log(`   错误数量: ${result.errors ? result.errors.length : 0}`);

        // 验证所有MCP配置是否仍然存在且内容正确
        let allMcpProtected = true;
        for (const mcpPath of existingMcpPaths) {
          const stillExists = await fs.pathExists(mcpPath);
          const ide = mcpPath.includes("Cursor") ? "Cursor" : "VS Code";
          
          if (stillExists) {
            const currentConfig = await fs.readJson(mcpPath);
            const originalConfig = originalConfigs.get(mcpPath);
            const configMatches = JSON.stringify(currentConfig) === JSON.stringify(originalConfig);
            
            console.log(`   ${ide} MCP: ${configMatches ? "✅ 完整保护" : "⚠️ 内容变化"}`);
            
            if (!configMatches) {
              allMcpProtected = false;
              console.log(`     原始: ${Object.keys(originalConfig).length} 个服务器`);
              console.log(`     当前: ${Object.keys(currentConfig).length} 个服务器`);
            }
          } else {
            console.log(`   ${ide} MCP: ❌ 文件丢失`);
            allMcpProtected = false;
          }
        }

        if (!allMcpProtected) {
          allTestsPassed = false;
        }

        // 显示MCP相关的操作日志
        if (result.actions) {
          const mcpActions = result.actions.filter(action => 
            action.includes("MCP") || action.includes("mcp") || action.includes("🛡️") || action.includes("🔄")
          );
          if (mcpActions.length > 0) {
            console.log("   📝 MCP相关操作:");
            mcpActions.slice(0, 3).forEach(action => {
              console.log(`     • ${action}`);
            });
            if (mcpActions.length > 3) {
              console.log(`     ... 还有 ${mcpActions.length - 3} 个MCP操作`);
            }
          }
        }

      } catch (error) {
        console.log(`   ❌ 测试失败: ${error.message}`);
        allTestsPassed = false;
      }
    }

    // 4. 最终验证
    console.log("\n🎯 最终验证结果:");
    console.log(`   所有测试通过: ${allTestsPassed ? "✅ 是" : "❌ 否"}`);
    console.log(`   支持的IDE: Cursor ✅ | VS Code ✅`);
    console.log(`   保护的配置文件: ${existingMcpPaths.length} 个`);
    
    if (allTestsPassed) {
      console.log("   🎉 MCP配置在所有清理场景下都得到完全保护！");
    } else {
      console.log("   ⚠️ 发现问题，需要进一步调试");
    }

    // 5. 清理测试文件（如果是我们创建的）
    console.log("\n🧹 清理测试环境...");
    for (const mcpPath of existingMcpPaths) {
      const originalConfig = originalConfigs.get(mcpPath);
      if (originalConfig && originalConfig["test-server"]) {
        await fs.remove(mcpPath);
        const ide = mcpPath.includes("Cursor") ? "Cursor" : "VS Code";
        console.log(`   🗑️ 已清理${ide}测试配置文件`);
      }
    }

  } catch (error) {
    console.error("❌ 测试失败:", error);
  }
}

// 运行测试
if (require.main === module) {
  testComprehensiveMCPProtection().catch(console.error);
}

module.exports = { testComprehensiveMCPProtection };
