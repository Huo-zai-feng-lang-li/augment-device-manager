const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 调试MCP保护功能
async function debugMCPProtection() {
  console.log("🔍 调试MCP保护功能...\n");

  try {
    // 1. 检查真实的MCP配置文件路径
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

    console.log("📍 检查MCP配置文件:");
    console.log(`   路径: ${realMcpConfigPath}`);
    
    const mcpExists = await fs.pathExists(realMcpConfigPath);
    console.log(`   存在: ${mcpExists ? "✅ 是" : "❌ 否"}`);

    if (!mcpExists) {
      console.log("\n⚠️ MCP配置文件不存在，创建测试配置...");
      
      const testMCPConfig = {
        "localtime": {
          "command": "node",
          "args": ["test-localtime"],
          "env": {}
        },
        "context7": {
          "command": "npx",
          "args": ["-y", "@augment/mcp-context7"],
          "env": {}
        }
      };

      await fs.ensureDir(path.dirname(realMcpConfigPath));
      await fs.writeJson(realMcpConfigPath, testMCPConfig, { spaces: 2 });
      console.log("✅ 测试MCP配置文件已创建");
    }

    // 2. 读取MCP配置
    const mcpConfig = await fs.readJson(realMcpConfigPath);
    console.log(`\n📋 MCP配置包含 ${Object.keys(mcpConfig).length} 个服务器:`);
    Object.keys(mcpConfig).forEach(server => {
      console.log(`   • ${server}`);
    });

    // 3. 导入DeviceManager并测试cleanAugmentExtensionStorage方法
    console.log("\n🔧 测试cleanAugmentExtensionStorage方法...");
    
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

    // 4. 检查MCP配置是否被保护
    console.log("\n🔍 检查MCP配置保护效果...");
    
    const mcpStillExists = await fs.pathExists(realMcpConfigPath);
    console.log(`   MCP配置文件存在: ${mcpStillExists ? "✅ 是" : "❌ 否"}`);

    if (mcpStillExists) {
      const currentMcpConfig = await fs.readJson(realMcpConfigPath);
      const configMatches = JSON.stringify(currentMcpConfig) === JSON.stringify(mcpConfig);
      console.log(`   配置内容一致: ${configMatches ? "✅ 是" : "❌ 否"}`);
      
      if (!configMatches) {
        console.log("   原始配置:", mcpConfig);
        console.log("   当前配置:", currentMcpConfig);
      }
    }

    // 5. 检查augment.vscode-augment目录
    const augmentDir = path.dirname(path.dirname(realMcpConfigPath));
    const augmentExists = await fs.pathExists(augmentDir);
    console.log(`\n📁 augment.vscode-augment目录存在: ${augmentExists ? "✅ 是" : "❌ 否"}`);

    if (augmentExists) {
      const items = await fs.readdir(augmentDir);
      console.log(`   目录内容 (${items.length} 项):`);
      items.forEach(item => {
        console.log(`   • ${item}`);
      });

      // 检查augment-global-state目录
      const globalStateDir = path.join(augmentDir, "augment-global-state");
      const globalStateExists = await fs.pathExists(globalStateDir);
      console.log(`\n📁 augment-global-state目录存在: ${globalStateExists ? "✅ 是" : "❌ 否"}`);

      if (globalStateExists) {
        const globalStateItems = await fs.readdir(globalStateDir);
        console.log(`   目录内容 (${globalStateItems.length} 项):`);
        globalStateItems.forEach(item => {
          console.log(`   • ${item}`);
        });
      }
    }

    // 6. 检查MCP保护相关的日志
    console.log("\n🛡️ MCP保护相关日志分析:");
    const mcpLogs = results.actions.filter(action => 
      action.includes("MCP") || action.includes("mcp") || 
      action.includes("🛡️") || action.includes("🔄") ||
      action.includes("mcpServers.json")
    );
    
    if (mcpLogs.length > 0) {
      console.log("   找到MCP相关日志:");
      mcpLogs.forEach(log => console.log(`   • ${log}`));
    } else {
      console.log("   ❌ 未找到MCP相关日志");
    }

    // 7. 检查是否有保护和恢复的配对日志
    const protectLogs = results.actions.filter(action => action.includes("🛡️") && action.includes("保护"));
    const restoreLogs = results.actions.filter(action => action.includes("🔄") && action.includes("恢复"));
    
    console.log(`\n🔄 保护/恢复日志配对检查:`);
    console.log(`   保护日志数量: ${protectLogs.length}`);
    console.log(`   恢复日志数量: ${restoreLogs.length}`);
    
    if (protectLogs.length > 0 && restoreLogs.length > 0) {
      console.log("   ✅ 保护和恢复日志都存在");
    } else {
      console.log("   ❌ 保护和恢复日志不完整");
    }

  } catch (error) {
    console.error("❌ 调试过程失败:", error);
  }
}

// 运行调试
if (require.main === module) {
  debugMCPProtection()
    .catch(error => {
      console.error("调试运行失败:", error);
      process.exit(1);
    });
}

module.exports = { debugMCPProtection };
