const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 测试真实的清理扩展插件功能是否保护MCP配置
async function testRealCleanupMCPProtection() {
  console.log("🧪 测试真实清理扩展插件功能的MCP保护...\n");

  let allTestsPassed = true;

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

    console.log("📍 检查真实MCP配置文件路径:");
    console.log(`   ${realMcpConfigPath}`);

    // 检查文件是否存在
    const mcpExists = await fs.pathExists(realMcpConfigPath);
    console.log(`   文件存在: ${mcpExists ? "✅ 是" : "❌ 否"}`);

    if (!mcpExists) {
      console.log("\n⚠️ 真实MCP配置文件不存在，创建测试配置...");
      
      // 创建测试MCP配置
      const testMCPConfig = {
        "localtime": {
          "command": "node",
          "args": ["C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\@augment\\mcp-localtime\\dist\\index.js"],
          "env": {}
        },
        "context7": {
          "command": "npx",
          "args": ["-y", "@augment/mcp-context7"],
          "env": {}
        },
        "edgeone-pages-mcp-server": {
          "command": "node",
          "args": ["C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\@augment\\edgeone-pages-mcp-server\\dist\\index.js"],
          "env": {}
        },
        "playwright": {
          "command": "npx",
          "args": ["-y", "@augment/mcp-playwright"],
          "env": {}
        },
        "mcp-server-chart": {
          "command": "npx",
          "args": ["-y", "@augment/mcp-server-chart"],
          "env": {}
        },
        "sequential-thinking": {
          "command": "npx",
          "args": ["-y", "@augment/sequential-thinking"],
          "env": {}
        }
      };

      await fs.ensureDir(path.dirname(realMcpConfigPath));
      await fs.writeJson(realMcpConfigPath, testMCPConfig, { spaces: 2 });
      console.log("✅ 测试MCP配置文件已创建");
    }

    // 2. 读取原始MCP配置
    const originalMcpConfig = await fs.readJson(realMcpConfigPath);
    console.log(`\n📋 原始MCP配置包含 ${Object.keys(originalMcpConfig).length} 个服务器:`);
    Object.keys(originalMcpConfig).forEach(server => {
      console.log(`   • ${server}`);
    });

    // 3. 导入DeviceManager并执行真实的清理操作
    console.log("\n🔧 执行真实的清理扩展插件操作...");
    
    const DeviceManager = require("../src/device-manager");
    const deviceManager = new DeviceManager();

    // 模拟真实的清理选项（与UI中的选项一致）
    const cleanupOptions = {
      // IDE选择选项
      cleanCursor: true,
      cleanVSCode: false,

      // PowerShell辅助选项
      usePowerShellAssist: false, // 关闭PowerShell以便测试JavaScript代码

      // 传统清理选项
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true, // 这是关键选项，会触发cleanAugmentExtensionStorage
      autoRestartCursor: false,
      skipBackup: true,

      // 重置选项
      skipCursorLogin: true,
      resetCursorCompletely: false,
      resetVSCodeCompletely: false,

      // 激进模式选项
      aggressiveMode: false, // 关闭激进模式以便专注测试MCP保护
      multiRoundClean: false,
      extendedMonitoring: false,
    };

    console.log("   清理选项:", {
      cleanCursor: cleanupOptions.cleanCursor,
      cleanCursorExtension: cleanupOptions.cleanCursorExtension,
      usePowerShellAssist: cleanupOptions.usePowerShellAssist
    });

    // 执行清理操作
    const result = await deviceManager.performCleanup(cleanupOptions);

    console.log("\n📊 清理操作结果:");
    console.log(`   状态: ${result.success ? "✅ 成功" : "❌ 失败"}`);
    
    if (result.success) {
      console.log(`   执行的操作数量: ${result.actions ? result.actions.length : 0}`);
      
      // 查找MCP相关的日志
      const mcpLogs = result.actions.filter(action => 
        action.includes("MCP") || action.includes("mcp") || action.includes("🛡️") || action.includes("🔄")
      );
      
      if (mcpLogs.length > 0) {
        console.log("\n🛡️ MCP保护相关日志:");
        mcpLogs.forEach(log => console.log(`   ${log}`));
      } else {
        console.log("\n⚠️ 未发现MCP保护相关日志");
      }
    }

    if (result.errors && result.errors.length > 0) {
      console.log("\n❌ 错误信息:");
      result.errors.forEach(error => console.log(`   ${error}`));
    }

    // 4. 验证MCP配置是否被保护
    console.log("\n🔍 验证MCP配置保护效果...");
    
    const mcpStillExists = await fs.pathExists(realMcpConfigPath);
    console.log(`   MCP配置文件存在: ${mcpStillExists ? "✅ 是" : "❌ 否"}`);

    if (mcpStillExists) {
      const currentMcpConfig = await fs.readJson(realMcpConfigPath);
      const currentServers = Object.keys(currentMcpConfig);
      const originalServers = Object.keys(originalMcpConfig);

      console.log(`   当前MCP服务器数量: ${currentServers.length}`);
      console.log(`   原始MCP服务器数量: ${originalServers.length}`);

      // 检查配置内容是否一致
      const configMatches = JSON.stringify(currentMcpConfig) === JSON.stringify(originalMcpConfig);
      console.log(`   配置内容一致: ${configMatches ? "✅ 是" : "❌ 否"}`);

      if (configMatches) {
        console.log("\n🎉 MCP配置完全保护成功！");
        console.log("   所有MCP服务器配置都被正确保留:");
        currentServers.forEach(server => {
          console.log(`   • ${server}`);
        });
      } else {
        console.log("\n❌ MCP配置内容发生变化");
        console.log("   原始服务器:", originalServers);
        console.log("   当前服务器:", currentServers);
        allTestsPassed = false;
      }
    } else {
      console.log("\n❌ MCP配置文件被删除，保护失败");
      allTestsPassed = false;
    }

    // 5. 检查augment.vscode-augment目录是否存在
    const augmentDir = path.dirname(path.dirname(realMcpConfigPath));
    const augmentExists = await fs.pathExists(augmentDir);
    console.log(`\n📁 augment.vscode-augment目录存在: ${augmentExists ? "✅ 是" : "❌ 否"}`);

    if (augmentExists) {
      const items = await fs.readdir(augmentDir);
      console.log(`   目录内容 (${items.length} 项):`);
      items.forEach(item => {
        console.log(`   • ${item}`);
      });
    }

    // 测试结果
    console.log("\n" + "=".repeat(60));
    if (allTestsPassed) {
      console.log("🎉 真实清理扩展插件功能MCP保护测试通过！");
      console.log("✅ MCP配置文件在清理过程中被完全保护");
      console.log("✅ 所有MCP服务器配置都被正确保留");
      console.log("✅ 清理功能正常工作，MCP配置不受影响");
    } else {
      console.log("❌ 真实清理扩展插件功能MCP保护测试失败！");
      console.log("❌ MCP配置在清理过程中丢失或被修改");
    }

  } catch (error) {
    console.error("❌ 测试执行失败:", error);
    allTestsPassed = false;
  }

  return allTestsPassed;
}

// 运行测试
if (require.main === module) {
  testRealCleanupMCPProtection()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error("测试运行失败:", error);
      process.exit(1);
    });
}

module.exports = { testRealCleanupMCPProtection };
