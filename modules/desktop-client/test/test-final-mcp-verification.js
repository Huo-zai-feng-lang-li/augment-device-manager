const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 最终MCP保护验证测试
async function testFinalMCPVerification() {
  console.log("🔍 最终MCP保护深度验证...\n");

  try {
    // 1. 定义所有MCP配置路径
    const mcpPaths = {
      cursor: {
        roaming: path.join(os.homedir(), "AppData", "Roaming", "Cursor", "User", "globalStorage", "augment.vscode-augment", "augment-global-state", "mcpServers.json"),
        local: path.join(os.homedir(), "AppData", "Local", "Cursor", "User", "globalStorage", "augment.vscode-augment", "augment-global-state", "mcpServers.json"),
      },
      vscode: {
        roaming: path.join(os.homedir(), "AppData", "Roaming", "Code", "User", "globalStorage", "augment.vscode-augment", "augment-global-state", "mcpServers.json"),
        local: path.join(os.homedir(), "AppData", "Local", "Code", "User", "globalStorage", "augment.vscode-augment", "augment-global-state", "mcpServers.json"),
        insiders: path.join(os.homedir(), "AppData", "Roaming", "Code - Insiders", "User", "globalStorage", "augment.vscode-augment", "augment-global-state", "mcpServers.json"),
      }
    };

    // 2. 检查现有MCP配置
    console.log("📍 检查现有MCP配置文件:");
    const existingConfigs = new Map();
    const testConfigs = new Map();

    for (const [ide, paths] of Object.entries(mcpPaths)) {
      console.log(`\n${ide.toUpperCase()}:`);
      for (const [location, mcpPath] of Object.entries(paths)) {
        const exists = await fs.pathExists(mcpPath);
        console.log(`   ${location}: ${exists ? "✅ 存在" : "❌ 不存在"}`);
        
        if (exists) {
          try {
            const config = await fs.readJson(mcpPath);
            existingConfigs.set(mcpPath, config);
            console.log(`     包含 ${Object.keys(config).length} 个MCP服务器`);
          } catch (error) {
            console.log(`     ⚠️ 读取失败: ${error.message}`);
          }
        }
      }
    }

    // 3. 创建测试MCP配置（如果不存在）
    console.log("\n🧪 创建测试MCP配置...");
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
      "edgeone-pages-mcp-server": {
        "command": "npx",
        "args": ["-y", "@augment/edgeone-pages-mcp-server"],
        "env": {}
      },
      "test-verification": {
        "command": "echo",
        "args": ["verification-test"],
        "env": {}
      }
    };

    // 为每个IDE创建测试配置
    const testPaths = [
      mcpPaths.cursor.roaming,
      mcpPaths.vscode.roaming,
    ];

    for (const testPath of testPaths) {
      if (!await fs.pathExists(testPath)) {
        await fs.ensureDir(path.dirname(testPath));
        await fs.writeJson(testPath, testMCPConfig, { spaces: 2 });
        testConfigs.set(testPath, testMCPConfig);
        const ide = testPath.includes("Cursor") ? "Cursor" : "VS Code";
        console.log(`   ✅ 已创建${ide}测试MCP配置`);
      } else {
        // 如果存在，添加测试标记
        const existingConfig = await fs.readJson(testPath);
        existingConfig["test-verification"] = testMCPConfig["test-verification"];
        await fs.writeJson(testPath, existingConfig, { spaces: 2 });
        testConfigs.set(testPath, existingConfig);
        const ide = testPath.includes("Cursor") ? "Cursor" : "VS Code";
        console.log(`   ✅ 已更新${ide}MCP配置（添加测试标记）`);
      }
    }

    // 4. 测试通用保护机制
    console.log("\n🛡️ 测试通用保护机制...");
    const DeviceManager = require("../src/device-manager");
    const deviceManager = new DeviceManager();

    const protectionResults = { actions: [], errors: [] };
    const mcpConfigs = await deviceManager.protectMCPConfigUniversal(protectionResults);
    
    console.log(`   检测到的MCP配置: ${mcpConfigs.size} 个`);
    console.log(`   保护操作数量: ${protectionResults.actions.length}`);
    
    // 验证是否检测到所有测试配置
    let cursorDetected = false;
    let vscodeDetected = false;
    
    for (const [mcpPath] of mcpConfigs) {
      if (mcpPath.includes("Cursor")) cursorDetected = true;
      if (mcpPath.includes("Code")) vscodeDetected = true;
      console.log(`   📁 ${mcpPath.includes("Cursor") ? "Cursor" : "VS Code"}: ${mcpPath}`);
    }
    
    console.log(`   Cursor检测: ${cursorDetected ? "✅" : "❌"}`);
    console.log(`   VS Code检测: ${vscodeDetected ? "✅" : "❌"}`);

    // 5. 测试所有清理场景
    const cleanupScenarios = [
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
      },
      {
        name: "混合清理（Cursor+VS Code）",
        method: async () => {
          const results = { actions: [], errors: [] };
          // 先清理Cursor
          await deviceManager.cleanAugmentExtensionStorage(results, { skipBackup: true });
          // 再清理VS Code
          await deviceManager.performVSCodeCleanup(results, { 
            skipBackup: true, 
            resetVSCodeCompletely: false 
          });
          return results;
        }
      }
    ];

    let allScenariosPass = true;

    for (const scenario of cleanupScenarios) {
      console.log(`\n🧪 测试场景: ${scenario.name}`);
      
      try {
        const result = await scenario.method();
        
        console.log(`   执行状态: ${result.success !== false ? "✅ 成功" : "❌ 失败"}`);
        console.log(`   操作数量: ${result.actions ? result.actions.length : 0}`);
        console.log(`   错误数量: ${result.errors ? result.errors.length : 0}`);

        // 验证所有MCP配置是否完整保存
        let allMcpSaved = true;
        for (const testPath of testPaths) {
          const stillExists = await fs.pathExists(testPath);
          const ide = testPath.includes("Cursor") ? "Cursor" : "VS Code";
          
          if (stillExists) {
            const currentConfig = await fs.readJson(testPath);
            const originalConfig = testConfigs.get(testPath);
            
            // 检查关键MCP服务器是否存在
            const hasTestMarker = currentConfig["test-verification"] !== undefined;
            const serverCount = Object.keys(currentConfig).length;
            const originalCount = Object.keys(originalConfig).length;
            
            if (hasTestMarker && serverCount >= originalCount - 1) {
              console.log(`   ${ide} MCP: ✅ 完整保存 (${serverCount}个服务器)`);
            } else {
              console.log(`   ${ide} MCP: ⚠️ 可能丢失 (${serverCount}/${originalCount}个服务器)`);
              allMcpSaved = false;
            }
          } else {
            console.log(`   ${ide} MCP: ❌ 文件丢失`);
            allMcpSaved = false;
          }
        }

        if (!allMcpSaved) {
          allScenariosPass = false;
        }

        // 显示MCP保护相关日志
        if (result.actions) {
          const mcpActions = result.actions.filter(action => 
            action.includes("MCP") || action.includes("mcp") || 
            action.includes("🛡️") || action.includes("🔄")
          );
          if (mcpActions.length > 0) {
            console.log(`   📝 MCP保护操作: ${mcpActions.length}个`);
          }
        }

      } catch (error) {
        console.log(`   ❌ 场景失败: ${error.message}`);
        allScenariosPass = false;
      }
    }

    // 6. 最终验证结果
    console.log("\n🎯 最终验证结果:");
    console.log(`   通用保护机制: ${cursorDetected && vscodeDetected ? "✅ 完整" : "❌ 不完整"}`);
    console.log(`   所有清理场景: ${allScenariosPass ? "✅ 通过" : "❌ 失败"}`);
    console.log(`   Cursor MCP保护: ${cursorDetected ? "✅ 支持" : "❌ 不支持"}`);
    console.log(`   VS Code MCP保护: ${vscodeDetected ? "✅ 支持" : "❌ 不支持"}`);
    
    const overallSuccess = cursorDetected && vscodeDetected && allScenariosPass;
    console.log(`\n🏆 总体结果: ${overallSuccess ? "✅ MCP工具可以完全保存" : "❌ 存在保护问题"}`);
    
    if (overallSuccess) {
      console.log("   🎉 Cursor和VS Code的MCP配置在所有清理场景下都能完全保存！");
    } else {
      console.log("   ⚠️ 发现MCP保护问题，需要进一步修复");
    }

    // 7. 清理测试标记
    console.log("\n🧹 清理测试环境...");
    for (const testPath of testPaths) {
      if (await fs.pathExists(testPath)) {
        const config = await fs.readJson(testPath);
        if (config["test-verification"]) {
          delete config["test-verification"];
          await fs.writeJson(testPath, config, { spaces: 2 });
          const ide = testPath.includes("Cursor") ? "Cursor" : "VS Code";
          console.log(`   🗑️ 已清理${ide}测试标记`);
        }
      }
    }

    return overallSuccess;

  } catch (error) {
    console.error("❌ 深度验证失败:", error);
    return false;
  }
}

// 运行测试
if (require.main === module) {
  testFinalMCPVerification().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(console.error);
}

module.exports = { testFinalMCPVerification };
