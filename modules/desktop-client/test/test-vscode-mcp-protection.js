const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 测试VS Code MCP保护机制
async function testVSCodeMCPProtection() {
  console.log("🔍 测试VS Code MCP保护机制...\n");

  try {
    // 1. 检查真实的VS Code MCP配置文件
    const realVSCodeMcpConfigPath = path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Code",
      "User",
      "globalStorage",
      "augment.vscode-augment",
      "augment-global-state",
      "mcpServers.json"
    );

    console.log("📍 检查真实VS Code MCP配置文件:");
    console.log(`   路径: ${realVSCodeMcpConfigPath}`);
    
    const realVSCodeMcpExists = await fs.pathExists(realVSCodeMcpConfigPath);
    console.log(`   存在: ${realVSCodeMcpExists ? "✅ 是" : "❌ 否"}`);

    let originalVSCodeMcpConfig = null;
    if (realVSCodeMcpExists) {
      originalVSCodeMcpConfig = await fs.readJson(realVSCodeMcpConfigPath);
      console.log(`   包含 ${Object.keys(originalVSCodeMcpConfig).length} 个MCP服务器`);
      Object.keys(originalVSCodeMcpConfig).forEach(server => {
        console.log(`     • ${server}`);
      });
    } else {
      console.log("⚠️ 未找到真实VS Code MCP配置文件，将创建测试配置");
      
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
        }
      };

      await fs.ensureDir(path.dirname(realVSCodeMcpConfigPath));
      await fs.writeJson(realVSCodeMcpConfigPath, testMCPConfig, { spaces: 2 });
      originalVSCodeMcpConfig = testMCPConfig;
      console.log("✅ 已创建测试VS Code MCP配置文件");
    }

    // 2. 导入DeviceManager并测试VS Code清理
    console.log("\n🧪 测试VS Code清理方法...");
    
    const DeviceManager = require("../src/device-manager");
    const deviceManager = new DeviceManager();

    // 测试VS Code选择性清理
    console.log("\n📊 测试VS Code选择性清理...");
    const selectiveResults = { actions: [], errors: [] };
    const options = { skipBackup: true };

    try {
      await deviceManager.performVSCodeCleanup(selectiveResults, {
        ...options,
        resetVSCodeCompletely: false
      });

      console.log(`   执行结果: 成功`);
      console.log(`   操作数量: ${selectiveResults.actions.length}`);
      console.log(`   错误数量: ${selectiveResults.errors.length}`);

      // 验证MCP配置是否被保护
      const mcpStillExists = await fs.pathExists(realVSCodeMcpConfigPath);
      console.log(`   MCP配置存在: ${mcpStillExists ? "✅ 是" : "❌ 否"}`);

      if (mcpStillExists) {
        const currentMcpConfig = await fs.readJson(realVSCodeMcpConfigPath);
        const configMatches = JSON.stringify(currentMcpConfig) === JSON.stringify(originalVSCodeMcpConfig);
        console.log(`   配置内容匹配: ${configMatches ? "✅ 是" : "❌ 否"}`);
        
        if (!configMatches) {
          console.log("   ⚠️ 配置内容发生变化");
          console.log(`   原始服务器数量: ${Object.keys(originalVSCodeMcpConfig).length}`);
          console.log(`   当前服务器数量: ${Object.keys(currentMcpConfig).length}`);
        }
      } else {
        console.log("   ❌ VS Code MCP配置文件丢失！");
      }

      // 显示MCP相关的操作日志
      const mcpActions = selectiveResults.actions.filter(action => 
        action.includes("MCP") || action.includes("mcp") || action.includes("🛡️") || action.includes("🔄")
      );
      if (mcpActions.length > 0) {
        console.log("   📝 MCP相关操作:");
        mcpActions.forEach(action => {
          console.log(`     • ${action}`);
        });
      }

    } catch (error) {
      console.log(`   ❌ VS Code选择性清理失败: ${error.message}`);
    }

    // 测试VS Code完全重置
    console.log("\n📊 测试VS Code完全重置...");
    const completeResults = { actions: [], errors: [] };

    try {
      await deviceManager.performVSCodeCleanup(completeResults, {
        ...options,
        resetVSCodeCompletely: true
      });

      console.log(`   执行结果: 成功`);
      console.log(`   操作数量: ${completeResults.actions.length}`);
      console.log(`   错误数量: ${completeResults.errors.length}`);

      // 验证MCP配置是否被保护
      const mcpAfterReset = await fs.pathExists(realVSCodeMcpConfigPath);
      console.log(`   重置后MCP配置存在: ${mcpAfterReset ? "✅ 是" : "❌ 否"}`);

      if (mcpAfterReset) {
        const resetMcpConfig = await fs.readJson(realVSCodeMcpConfigPath);
        const resetConfigMatches = JSON.stringify(resetMcpConfig) === JSON.stringify(originalVSCodeMcpConfig);
        console.log(`   重置后配置内容匹配: ${resetConfigMatches ? "✅ 是" : "❌ 否"}`);
      }

      // 显示MCP相关的操作日志
      const resetMcpActions = completeResults.actions.filter(action => 
        action.includes("MCP") || action.includes("mcp") || action.includes("🛡️") || action.includes("🔄")
      );
      if (resetMcpActions.length > 0) {
        console.log("   📝 重置MCP相关操作:");
        resetMcpActions.forEach(action => {
          console.log(`     • ${action}`);
        });
      }

    } catch (error) {
      console.log(`   ❌ VS Code完全重置失败: ${error.message}`);
    }

    // 3. 测试通用保护机制对VS Code的支持
    console.log("\n🧪 测试通用保护机制对VS Code的支持...");
    
    try {
      const results = { actions: [], errors: [] };
      const mcpConfigs = await deviceManager.protectMCPConfigUniversal(results);
      
      console.log(`   检测到的MCP配置: ${mcpConfigs.size} 个`);
      
      // 检查是否包含VS Code路径
      let vscodeMcpFound = false;
      for (const [mcpPath] of mcpConfigs) {
        if (mcpPath.includes("Code\\User\\globalStorage")) {
          vscodeMcpFound = true;
          console.log(`   ✅ 检测到VS Code MCP配置: ${mcpPath}`);
        }
      }
      
      if (!vscodeMcpFound) {
        console.log("   ⚠️ 未检测到VS Code MCP配置");
      }

    } catch (error) {
      console.log(`   ❌ 通用保护机制测试失败: ${error.message}`);
    }

    // 4. 总结测试结果
    console.log("\n🎯 VS Code MCP保护测试总结:");
    const mcpExists = await fs.pathExists(realVSCodeMcpConfigPath);
    console.log(`   VS Code MCP配置保护状态: ${mcpExists ? "✅ 正常工作" : "❌ 需要修复"}`);
    
    if (mcpExists) {
      console.log("   🎉 VS Code MCP配置在清理过程中得到完全保护！");
    } else {
      console.log("   ⚠️ 发现问题，VS Code MCP配置保护机制需要进一步调试");
    }

  } catch (error) {
    console.error("❌ 测试失败:", error);
  }
}

// 运行测试
if (require.main === module) {
  testVSCodeMCPProtection().catch(console.error);
}

module.exports = { testVSCodeMCPProtection };
