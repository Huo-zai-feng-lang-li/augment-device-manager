const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 安全检查MCP保护机制，不会真的删除扩展数据
async function safeMCPProtectionCheck() {
  console.log("🔍 安全检查MCP保护机制（不删除真实数据）...\n");

  let allTestsPassed = true;
  const testCleanupTasks = []; // 记录需要清理的测试数据

  try {
    // 1. 检查真实MCP配置文件是否存在
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
    }

    // 2. 创建测试环境（独立的测试目录）
    const testDir = path.join(os.tmpdir(), `mcp-protection-safe-test-${Date.now()}`);
    const testAugmentDir = path.join(testDir, "augment.vscode-augment");
    const testGlobalStateDir = path.join(testAugmentDir, "augment-global-state");
    const testMcpConfigPath = path.join(testGlobalStateDir, "mcpServers.json");

    testCleanupTasks.push(testDir); // 记录需要清理的测试目录

    console.log("\n🧪 创建测试环境:");
    console.log(`   测试目录: ${testDir}`);

    await fs.ensureDir(testGlobalStateDir);

    // 创建测试MCP配置
    const testMCPConfig = {
      "test-localtime": {
        "command": "node",
        "args": ["test-localtime-path"],
        "env": {}
      },
      "test-context7": {
        "command": "npx",
        "args": ["-y", "@augment/mcp-context7"],
        "env": {}
      },
      "test-playwright": {
        "command": "npx",
        "args": ["-y", "@augment/mcp-playwright"],
        "env": {}
      }
    };

    await fs.writeJson(testMcpConfigPath, testMCPConfig, { spaces: 2 });
    console.log("✅ 测试MCP配置文件已创建");

    // 3. 导入DeviceManager并测试保护机制
    console.log("\n🔧 测试MCP保护机制...");
    
    const DeviceManager = require("../src/device-manager");
    const deviceManager = new DeviceManager();

    // 临时替换augmentStorage路径为测试目录
    const originalAugmentStorage = deviceManager.cursorPaths.augmentStorage;
    deviceManager.cursorPaths.augmentStorage = testAugmentDir;

    console.log("   使用测试目录替代真实目录");
    console.log(`   原始路径: ${originalAugmentStorage}`);
    console.log(`   测试路径: ${testAugmentDir}`);

    // 4. 测试cleanAugmentStorage方法（应该保护MCP目录）
    console.log("\n📊 测试1: cleanAugmentStorage方法保护机制...");
    
    const results1 = { actions: [], errors: [] };
    await deviceManager.cleanAugmentStorage(results1);

    // 检查MCP配置是否被保护
    const mcpExistsAfterCleanAugmentStorage = await fs.pathExists(testMcpConfigPath);
    console.log(`   MCP配置文件存在: ${mcpExistsAfterCleanAugmentStorage ? "✅ 是" : "❌ 否"}`);
    
    if (mcpExistsAfterCleanAugmentStorage) {
      const configAfterClean = await fs.readJson(testMcpConfigPath);
      const configMatches = JSON.stringify(configAfterClean) === JSON.stringify(testMCPConfig);
      console.log(`   配置内容一致: ${configMatches ? "✅ 是" : "❌ 否"}`);
      
      if (!configMatches) {
        console.log("   ❌ 配置内容发生变化");
        allTestsPassed = false;
      }
    } else {
      console.log("   ❌ cleanAugmentStorage删除了MCP配置");
      allTestsPassed = false;
    }

    // 查看相关日志
    const cleanAugmentStorageLogs = results1.actions.filter(action => 
      action.includes("augment") || action.includes("Augment")
    );
    console.log("   相关日志:");
    cleanAugmentStorageLogs.forEach(log => console.log(`     • ${log}`));

    // 5. 测试cleanAugmentExtensionStorage方法（完整的保护-删除-恢复流程）
    console.log("\n📊 测试2: cleanAugmentExtensionStorage方法保护机制...");
    
    const results2 = { actions: [], errors: [] };
    const options = { skipBackup: true };

    await deviceManager.cleanAugmentExtensionStorage(results2, options);

    // 检查MCP配置是否被保护和恢复
    const mcpExistsAfterCleanExtension = await fs.pathExists(testMcpConfigPath);
    console.log(`   MCP配置文件存在: ${mcpExistsAfterCleanExtension ? "✅ 是" : "❌ 否"}`);
    
    if (mcpExistsAfterCleanExtension) {
      const configAfterExtensionClean = await fs.readJson(testMcpConfigPath);
      const configMatches = JSON.stringify(configAfterExtensionClean) === JSON.stringify(testMCPConfig);
      console.log(`   配置内容一致: ${configMatches ? "✅ 是" : "❌ 否"}`);
      
      if (!configMatches) {
        console.log("   ❌ 配置内容发生变化");
        allTestsPassed = false;
      }
    } else {
      console.log("   ❌ cleanAugmentExtensionStorage未能恢复MCP配置");
      allTestsPassed = false;
    }

    // 查看MCP保护相关日志
    const mcpProtectionLogs = results2.actions.filter(action => 
      action.includes("🛡️") || action.includes("🔄") || action.includes("MCP") || action.includes("mcp")
    );
    console.log("   MCP保护日志:");
    mcpProtectionLogs.forEach(log => console.log(`     • ${log}`));

    // 6. 测试完整的清理流程（模拟真实清理但使用测试目录）
    console.log("\n📊 测试3: 完整清理流程保护机制...");
    
    // 重新创建测试MCP配置
    await fs.writeJson(testMcpConfigPath, testMCPConfig, { spaces: 2 });
    
    const cleanupOptions = {
      cleanCursor: true,
      cleanCursorExtension: true,
      usePowerShellAssist: false,
      preserveActivation: true,
      deepClean: true,
      autoRestartCursor: false,
      skipBackup: true,
      aggressiveMode: false,
    };

    // 执行部分清理流程（只测试关键步骤）
    const results3 = { actions: [], errors: [] };
    
    // 步骤1: cleanAugmentStorage
    await deviceManager.cleanAugmentStorage(results3);
    const mcpAfterStep1 = await fs.pathExists(testMcpConfigPath);
    console.log(`   步骤1后MCP存在: ${mcpAfterStep1 ? "✅" : "❌"}`);
    
    // 步骤2: cleanCursorExtensionData (如果启用)
    if (cleanupOptions.cleanCursor && cleanupOptions.cleanCursorExtension) {
      await deviceManager.cleanAugmentExtensionStorage(results3, cleanupOptions);
      const mcpAfterStep2 = await fs.pathExists(testMcpConfigPath);
      console.log(`   步骤2后MCP存在: ${mcpAfterStep2 ? "✅" : "❌"}`);
      
      if (mcpAfterStep2) {
        const finalConfig = await fs.readJson(testMcpConfigPath);
        const finalMatches = JSON.stringify(finalConfig) === JSON.stringify(testMCPConfig);
        console.log(`   最终配置一致: ${finalMatches ? "✅" : "❌"}`);
        
        if (!finalMatches) {
          allTestsPassed = false;
        }
      } else {
        allTestsPassed = false;
      }
    }

    // 恢复原始路径
    deviceManager.cursorPaths.augmentStorage = originalAugmentStorage;

    // 7. 验证真实MCP配置未被影响
    console.log("\n🔍 验证真实MCP配置未被影响...");
    
    if (realMcpExists) {
      const currentRealConfig = await fs.readJson(realMcpConfigPath);
      const realConfigMatches = JSON.stringify(currentRealConfig) === JSON.stringify(originalMcpConfig);
      console.log(`   真实MCP配置完整: ${realConfigMatches ? "✅ 是" : "❌ 否"}`);
      
      if (!realConfigMatches) {
        console.log("   ❌ 警告：真实MCP配置发生了变化！");
        allTestsPassed = false;
      }
    } else {
      console.log("   ℹ️ 真实MCP配置文件不存在（正常）");
    }

    // 测试结果
    console.log("\n" + "=".repeat(60));
    if (allTestsPassed) {
      console.log("🎉 MCP保护机制安全检查通过！");
      console.log("✅ cleanAugmentStorage方法正确保护MCP目录");
      console.log("✅ cleanAugmentExtensionStorage方法正确保护和恢复MCP配置");
      console.log("✅ 完整清理流程中MCP配置被完全保护");
      console.log("✅ 真实MCP配置未受影响");
    } else {
      console.log("❌ MCP保护机制存在问题！");
      console.log("❌ 需要进一步检查和修复");
    }

  } catch (error) {
    console.error("❌ 安全检查失败:", error);
    allTestsPassed = false;
  } finally {
    // 8. 清理测试数据
    console.log("\n🧹 清理测试数据...");
    
    for (const cleanupPath of testCleanupTasks) {
      try {
        if (await fs.pathExists(cleanupPath)) {
          await fs.remove(cleanupPath);
          console.log(`✅ 已清理测试目录: ${path.basename(cleanupPath)}`);
        }
      } catch (error) {
        console.log(`⚠️ 清理测试目录失败: ${error.message}`);
      }
    }
    
    console.log("✅ 测试数据清理完成");
  }

  return allTestsPassed;
}

// 运行安全检查
if (require.main === module) {
  safeMCPProtectionCheck()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error("安全检查运行失败:", error);
      process.exit(1);
    });
}

module.exports = { safeMCPProtectionCheck };
