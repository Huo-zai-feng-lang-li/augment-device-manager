const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 测试通用MCP保护机制
async function testUniversalMCPProtection() {
  console.log("🔍 测试通用MCP保护机制...\n");

  try {
    // 1. 创建测试环境
    const testDir = path.join(os.tmpdir(), `mcp-test-${Date.now()}`);
    await fs.ensureDir(testDir);
    console.log(`📁 测试目录: ${testDir}`);

    // 2. 创建模拟的MCP配置文件
    const testMCPPaths = [
      // Windows Cursor路径
      path.join(testDir, "AppData", "Roaming", "Cursor", "User", "globalStorage", "augment.vscode-augment", "augment-global-state", "mcpServers.json"),
      // Windows VS Code路径
      path.join(testDir, "AppData", "Roaming", "Code", "User", "globalStorage", "augment.vscode-augment", "augment-global-state", "mcpServers.json"),
    ];

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
      }
    };

    // 创建测试MCP配置文件
    for (const mcpPath of testMCPPaths) {
      await fs.ensureDir(path.dirname(mcpPath));
      await fs.writeJson(mcpPath, testMCPConfig, { spaces: 2 });
      console.log(`✅ 创建测试MCP配置: ${mcpPath}`);
    }

    // 3. 导入DeviceManager并测试
    const DeviceManager = require("../src/device-manager");
    const deviceManager = new DeviceManager();

    // 临时修改os.homedir()返回测试目录
    const originalHomedir = os.homedir;
    os.homedir = () => testDir;

    try {
      // 测试通用MCP保护机制
      console.log("\n🛡️ 测试通用MCP保护机制...");
      const results = { actions: [], errors: [] };
      
      const mcpConfigs = await deviceManager.protectMCPConfigUniversal(results);
      
      console.log(`📊 保护结果:`);
      console.log(`   保护的MCP配置数量: ${mcpConfigs.size}`);
      console.log(`   操作日志数量: ${results.actions.length}`);
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

      // 4. 模拟清理操作（删除目录）
      console.log("\n🗑️ 模拟清理操作...");
      for (const mcpPath of testMCPPaths) {
        const augmentDir = path.dirname(path.dirname(mcpPath));
        if (await fs.pathExists(augmentDir)) {
          await fs.remove(augmentDir);
          console.log(`   删除目录: ${augmentDir}`);
        }
      }

      // 5. 测试恢复机制
      console.log("\n🔄 测试MCP配置恢复...");
      const restoreResults = { actions: [], errors: [] };
      
      await deviceManager.restoreMCPConfigUniversal(restoreResults, mcpConfigs);
      
      console.log(`📊 恢复结果:`);
      console.log(`   操作日志数量: ${restoreResults.actions.length}`);
      console.log(`   错误数量: ${restoreResults.errors.length}`);

      console.log("\n📝 恢复日志:");
      restoreResults.actions.forEach((action, index) => {
        console.log(`   ${index + 1}. ${action}`);
      });

      // 6. 验证恢复结果
      console.log("\n✅ 验证恢复结果...");
      let restoredCount = 0;
      for (const mcpPath of testMCPPaths) {
        if (await fs.pathExists(mcpPath)) {
          const restoredConfig = await fs.readJson(mcpPath);
          if (JSON.stringify(restoredConfig) === JSON.stringify(testMCPConfig)) {
            console.log(`   ✅ ${mcpPath} - 恢复成功`);
            restoredCount++;
          } else {
            console.log(`   ❌ ${mcpPath} - 恢复内容不匹配`);
          }
        } else {
          console.log(`   ❌ ${mcpPath} - 文件未恢复`);
        }
      }

      console.log(`\n🎯 测试总结:`);
      console.log(`   预期恢复: ${testMCPPaths.length} 个配置文件`);
      console.log(`   实际恢复: ${restoredCount} 个配置文件`);
      console.log(`   成功率: ${((restoredCount / testMCPPaths.length) * 100).toFixed(1)}%`);

      if (restoredCount === testMCPPaths.length) {
        console.log(`   🎉 通用MCP保护机制测试通过！`);
      } else {
        console.log(`   ⚠️ 通用MCP保护机制需要进一步优化`);
      }

    } finally {
      // 恢复原始的homedir函数
      os.homedir = originalHomedir;
    }

    // 7. 清理测试环境
    await fs.remove(testDir);
    console.log(`\n🧹 已清理测试环境: ${testDir}`);

  } catch (error) {
    console.error("❌ 测试失败:", error);
  }
}

// 运行测试
if (require.main === module) {
  testUniversalMCPProtection().catch(console.error);
}

module.exports = { testUniversalMCPProtection };
