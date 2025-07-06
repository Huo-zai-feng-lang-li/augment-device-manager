const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 测试真实场景下的MCP保护
async function testRealMCPProtection() {
  console.log("🔍 测试真实场景下的MCP保护...\n");

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
      console.log(`   包含 ${Object.keys(originalMcpConfig).length} 个MCP服务器:`);
      Object.keys(originalMcpConfig).forEach(server => {
        console.log(`     • ${server}`);
      });
    } else {
      console.log("⚠️ 未找到真实MCP配置文件，将创建测试配置");
      
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

      await fs.ensureDir(path.dirname(realMcpConfigPath));
      await fs.writeJson(realMcpConfigPath, testMCPConfig, { spaces: 2 });
      originalMcpConfig = testMCPConfig;
      console.log("✅ 已创建测试MCP配置文件");
    }

    // 2. 导入DeviceManager并测试cleanAugmentExtensionStorage
    console.log("\n🧪 测试cleanAugmentExtensionStorage方法...");
    
    const DeviceManager = require("../src/device-manager");
    const deviceManager = new DeviceManager();

    const results = { actions: [], errors: [] };
    const options = { skipBackup: true };

    console.log("   调用cleanAugmentExtensionStorage...");
    await deviceManager.cleanAugmentExtensionStorage(results, options);

    console.log("\n📊 cleanAugmentExtensionStorage结果:");
    console.log(`   操作数量: ${results.actions.length}`);
    console.log(`   错误数量: ${results.errors.length}`);

    console.log("\n📝 操作日志:");
    results.actions.forEach((action, index) => {
      console.log(`   ${index + 1}. ${action}`);
    });

    if (results.errors.length > 0) {
      console.log("\n❌ 错误日志:");
      results.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    // 3. 验证MCP配置是否被保护
    console.log("\n✅ 验证MCP配置保护结果...");
    
    const mcpStillExists = await fs.pathExists(realMcpConfigPath);
    console.log(`   MCP配置文件存在: ${mcpStillExists ? "✅ 是" : "❌ 否"}`);

    if (mcpStillExists) {
      const currentMcpConfig = await fs.readJson(realMcpConfigPath);
      const configMatches = JSON.stringify(currentMcpConfig) === JSON.stringify(originalMcpConfig);
      console.log(`   配置内容匹配: ${configMatches ? "✅ 是" : "❌ 否"}`);
      
      if (configMatches) {
        console.log("   🎉 MCP配置成功保护！");
      } else {
        console.log("   ⚠️ MCP配置内容发生变化");
        console.log("   原始配置服务器数量:", Object.keys(originalMcpConfig).length);
        console.log("   当前配置服务器数量:", Object.keys(currentMcpConfig).length);
      }
    } else {
      console.log("   ❌ MCP配置文件丢失！保护机制失败");
    }

    // 4. 测试resetUsageCount方法
    console.log("\n🧪 测试resetUsageCount方法...");
    
    const resetResults = await deviceManager.resetUsageCount();
    
    console.log("📊 resetUsageCount结果:");
    console.log(`   成功: ${resetResults.success ? "✅ 是" : "❌ 否"}`);
    console.log(`   操作数量: ${resetResults.actions.length}`);
    console.log(`   错误数量: ${resetResults.errors.length}`);

    console.log("\n📝 重置操作日志:");
    resetResults.actions.forEach((action, index) => {
      console.log(`   ${index + 1}. ${action}`);
    });

    // 5. 再次验证MCP配置
    console.log("\n✅ 验证重置后的MCP配置...");
    
    const mcpAfterReset = await fs.pathExists(realMcpConfigPath);
    console.log(`   MCP配置文件存在: ${mcpAfterReset ? "✅ 是" : "❌ 否"}`);

    if (mcpAfterReset) {
      const resetMcpConfig = await fs.readJson(realMcpConfigPath);
      const resetConfigMatches = JSON.stringify(resetMcpConfig) === JSON.stringify(originalMcpConfig);
      console.log(`   配置内容匹配: ${resetConfigMatches ? "✅ 是" : "❌ 否"}`);
      
      if (resetConfigMatches) {
        console.log("   🎉 重置后MCP配置依然完整！");
      } else {
        console.log("   ⚠️ 重置后MCP配置内容发生变化");
      }
    }

    // 6. 总结测试结果
    console.log("\n🎯 测试总结:");
    const protectionSuccess = mcpStillExists && mcpAfterReset;
    console.log(`   MCP保护机制状态: ${protectionSuccess ? "✅ 正常工作" : "❌ 需要修复"}`);
    
    if (protectionSuccess) {
      console.log("   🎉 所有测试通过！MCP配置在清理过程中得到完全保护");
    } else {
      console.log("   ⚠️ 发现问题，需要进一步调试和修复");
    }

  } catch (error) {
    console.error("❌ 测试失败:", error);
  }
}

// 运行测试
if (require.main === module) {
  testRealMCPProtection().catch(console.error);
}

module.exports = { testRealMCPProtection };
