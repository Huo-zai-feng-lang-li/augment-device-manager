const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 追踪清理流程，找出MCP配置被删除的确切位置
async function traceCleanupFlow() {
  console.log("🔍 追踪清理流程，找出MCP配置被删除的位置...\n");

  try {
    // 1. 确保MCP配置文件存在
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

    console.log("📍 准备MCP配置文件:");
    console.log(`   路径: ${realMcpConfigPath}`);

    // 创建测试MCP配置
    const testMCPConfig = {
      "test-server": {
        "command": "node",
        "args": ["test-args"],
        "env": {}
      }
    };

    await fs.ensureDir(path.dirname(realMcpConfigPath));
    await fs.writeJson(realMcpConfigPath, testMCPConfig, { spaces: 2 });
    console.log("✅ 测试MCP配置文件已创建");

    // 2. 创建检查函数
    const checkMCPExists = async (step) => {
      const exists = await fs.pathExists(realMcpConfigPath);
      const dirExists = await fs.pathExists(path.dirname(path.dirname(realMcpConfigPath)));
      console.log(`   ${step}: MCP文件存在=${exists ? "✅" : "❌"}, augment.vscode-augment目录存在=${dirExists ? "✅" : "❌"}`);
      return exists;
    };

    // 3. 导入DeviceManager并逐步执行清理方法
    console.log("\n🔧 逐步执行清理方法...");
    
    const DeviceManager = require("../src/device-manager");
    const deviceManager = new DeviceManager();

    const cleanupOptions = {
      cleanCursor: true,
      cleanCursorExtension: true,
      usePowerShellAssist: false,
      preserveActivation: true,
      deepClean: true,
      autoRestartCursor: false,
      skipBackup: true,
      skipCursorLogin: true,
      aggressiveMode: false,
    };

    const results = { actions: [], errors: [] };

    // 检查初始状态
    await checkMCPExists("初始状态");

    // 4. 逐步执行清理方法
    console.log("\n📋 执行清理步骤:");

    // 步骤1: cleanActivationData
    console.log("\n1️⃣ 执行 cleanActivationData...");
    await deviceManager.cleanActivationData(results, cleanupOptions);
    await checkMCPExists("cleanActivationData后");

    // 步骤2: cleanAugmentStorage
    console.log("\n2️⃣ 执行 cleanAugmentStorage...");
    await deviceManager.cleanAugmentStorage(results);
    await checkMCPExists("cleanAugmentStorage后");

    // 步骤3: cleanStateDatabase
    console.log("\n3️⃣ 执行 cleanStateDatabase...");
    await deviceManager.cleanStateDatabase(results, cleanupOptions);
    await checkMCPExists("cleanStateDatabase后");

    // 步骤4: cleanWindowsRegistry
    console.log("\n4️⃣ 执行 cleanWindowsRegistry...");
    if (deviceManager.platform === "win32") {
      await deviceManager.cleanWindowsRegistry(results);
    }
    await checkMCPExists("cleanWindowsRegistry后");

    // 步骤5: cleanTempFiles
    console.log("\n5️⃣ 执行 cleanTempFiles...");
    await deviceManager.cleanTempFiles(results);
    await checkMCPExists("cleanTempFiles后");

    // 步骤6: cleanBrowserData
    console.log("\n6️⃣ 执行 cleanBrowserData...");
    await deviceManager.cleanBrowserData(results);
    await checkMCPExists("cleanBrowserData后");

    // 步骤7: cleanCursorExtensionData (关键步骤)
    if (cleanupOptions.cleanCursor && cleanupOptions.cleanCursorExtension) {
      console.log("\n7️⃣ 执行 cleanCursorExtensionData...");
      await deviceManager.cleanCursorExtensionData(results, cleanupOptions);
      await checkMCPExists("cleanCursorExtensionData后");
    }

    // 5. 分析结果
    console.log("\n📊 清理结果分析:");
    console.log(`   总操作数: ${results.actions.length}`);
    console.log(`   总错误数: ${results.errors.length}`);

    // 查找MCP相关日志
    const mcpLogs = results.actions.filter(action => 
      action.includes("MCP") || action.includes("mcp") || 
      action.includes("🛡️") || action.includes("🔄") ||
      action.includes("mcpServers.json") || action.includes("augment.vscode-augment")
    );

    if (mcpLogs.length > 0) {
      console.log("\n🛡️ MCP相关日志:");
      mcpLogs.forEach(log => console.log(`   • ${log}`));
    } else {
      console.log("\n❌ 未找到MCP相关日志");
    }

    // 查找删除augment.vscode-augment的日志
    const deleteLogs = results.actions.filter(action => 
      action.includes("删除") || action.includes("清理") || action.includes("remove")
    );

    if (deleteLogs.length > 0) {
      console.log("\n🗑️ 删除相关日志:");
      deleteLogs.forEach(log => console.log(`   • ${log}`));
    }

    // 6. 最终检查
    console.log("\n🔍 最终状态检查:");
    const finalExists = await checkMCPExists("最终状态");

    if (!finalExists) {
      console.log("\n❌ MCP配置文件被删除！");
      
      // 检查是否有错误日志提示删除原因
      const relevantErrors = results.errors.filter(error => 
        error.includes("augment") || error.includes("MCP") || error.includes("mcp")
      );
      
      if (relevantErrors.length > 0) {
        console.log("\n⚠️ 相关错误信息:");
        relevantErrors.forEach(error => console.log(`   • ${error}`));
      }
    } else {
      console.log("\n✅ MCP配置文件保护成功！");
    }

  } catch (error) {
    console.error("❌ 追踪过程失败:", error);
  }
}

// 运行追踪
if (require.main === module) {
  traceCleanupFlow()
    .catch(error => {
      console.error("追踪运行失败:", error);
      process.exit(1);
    });
}

module.exports = { traceCleanupFlow };
