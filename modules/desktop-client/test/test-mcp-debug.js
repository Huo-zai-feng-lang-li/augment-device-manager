const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 调试MCP保护机制
async function debugMCPProtection() {
  console.log("🔍 调试MCP保护机制...\n");

  try {
    // 定义测试路径
    const cursorMcpPath = path.join(os.homedir(), "AppData", "Roaming", "Cursor", "User", "globalStorage", "augment.vscode-augment", "augment-global-state", "mcpServers.json");
    const vscodeMcpPath = path.join(os.homedir(), "AppData", "Roaming", "Code", "User", "globalStorage", "augment.vscode-augment", "augment-global-state", "mcpServers.json");

    // 创建测试MCP配置
    const testMCPConfig = {
      "test-server-1": { "command": "echo", "args": ["test1"], "env": {} },
      "test-server-2": { "command": "echo", "args": ["test2"], "env": {} },
      "test-server-3": { "command": "echo", "args": ["test3"], "env": {} }
    };

    // 确保VS Code MCP配置存在
    if (!await fs.pathExists(vscodeMcpPath)) {
      await fs.ensureDir(path.dirname(vscodeMcpPath));
      await fs.writeJson(vscodeMcpPath, testMCPConfig, { spaces: 2 });
      console.log("✅ 已创建VS Code测试MCP配置");
    }

    // 检查初始状态
    console.log("📍 初始状态检查:");
    const cursorExists = await fs.pathExists(cursorMcpPath);
    const vscodeExists = await fs.pathExists(vscodeMcpPath);
    console.log(`   Cursor MCP: ${cursorExists ? "✅ 存在" : "❌ 不存在"}`);
    console.log(`   VS Code MCP: ${vscodeExists ? "✅ 存在" : "❌ 不存在"}`);

    if (cursorExists) {
      const cursorConfig = await fs.readJson(cursorMcpPath);
      console.log(`   Cursor服务器数量: ${Object.keys(cursorConfig).length}`);
    }

    if (vscodeExists) {
      const vscodeConfig = await fs.readJson(vscodeMcpPath);
      console.log(`   VS Code服务器数量: ${Object.keys(vscodeConfig).length}`);
    }

    // 导入DeviceManager
    const DeviceManager = require("../src/device-manager");
    const deviceManager = new DeviceManager();

    // 测试通用保护机制
    console.log("\n🛡️ 测试通用保护机制:");
    const protectionResults = { actions: [], errors: [] };
    const mcpConfigs = await deviceManager.protectMCPConfigUniversal(protectionResults);
    
    console.log(`   检测到的配置: ${mcpConfigs.size} 个`);
    for (const [mcpPath] of mcpConfigs) {
      console.log(`   📁 ${mcpPath}`);
    }

    // 测试resetUsageCount方法
    console.log("\n🧪 测试resetUsageCount方法:");
    console.log("   执行前状态:");
    console.log(`     Cursor MCP: ${await fs.pathExists(cursorMcpPath) ? "✅ 存在" : "❌ 不存在"}`);
    console.log(`     VS Code MCP: ${await fs.pathExists(vscodeMcpPath) ? "✅ 存在" : "❌ 不存在"}`);

    const resetResult = await deviceManager.resetUsageCount();
    
    console.log("   执行后状态:");
    console.log(`     Cursor MCP: ${await fs.pathExists(cursorMcpPath) ? "✅ 存在" : "❌ 不存在"}`);
    console.log(`     VS Code MCP: ${await fs.pathExists(vscodeMcpPath) ? "✅ 存在" : "❌ 不存在"}`);
    
    console.log(`   重置结果: ${resetResult.success ? "✅ 成功" : "❌ 失败"}`);
    console.log(`   操作数量: ${resetResult.actions.length}`);
    
    // 显示MCP相关操作
    const mcpActions = resetResult.actions.filter(action => 
      action.includes("MCP") || action.includes("mcp") || action.includes("🛡️") || action.includes("🔄")
    );
    if (mcpActions.length > 0) {
      console.log("   📝 MCP相关操作:");
      mcpActions.forEach(action => console.log(`     • ${action}`));
    }

    // 测试cleanAugmentExtensionStorage方法
    console.log("\n🧪 测试cleanAugmentExtensionStorage方法:");
    
    // 重新创建VS Code配置（如果丢失）
    if (!await fs.pathExists(vscodeMcpPath)) {
      await fs.ensureDir(path.dirname(vscodeMcpPath));
      await fs.writeJson(vscodeMcpPath, testMCPConfig, { spaces: 2 });
      console.log("   🔄 重新创建VS Code MCP配置");
    }

    console.log("   执行前状态:");
    console.log(`     Cursor MCP: ${await fs.pathExists(cursorMcpPath) ? "✅ 存在" : "❌ 不存在"}`);
    console.log(`     VS Code MCP: ${await fs.pathExists(vscodeMcpPath) ? "✅ 存在" : "❌ 不存在"}`);

    const cleanResults = { actions: [], errors: [] };
    await deviceManager.cleanAugmentExtensionStorage(cleanResults, { skipBackup: true });
    
    console.log("   执行后状态:");
    console.log(`     Cursor MCP: ${await fs.pathExists(cursorMcpPath) ? "✅ 存在" : "❌ 不存在"}`);
    console.log(`     VS Code MCP: ${await fs.pathExists(vscodeMcpPath) ? "✅ 存在" : "❌ 不存在"}`);
    
    console.log(`   清理结果: 成功`);
    console.log(`   操作数量: ${cleanResults.actions.length}`);
    console.log(`   错误数量: ${cleanResults.errors.length}`);

    // 显示MCP相关操作
    const cleanMcpActions = cleanResults.actions.filter(action => 
      action.includes("MCP") || action.includes("mcp") || action.includes("🛡️") || action.includes("🔄")
    );
    if (cleanMcpActions.length > 0) {
      console.log("   📝 MCP相关操作:");
      cleanMcpActions.forEach(action => console.log(`     • ${action}`));
    }

    // 测试VS Code清理方法
    console.log("\n🧪 测试VS Code清理方法:");
    
    // 重新创建VS Code配置（如果丢失）
    if (!await fs.pathExists(vscodeMcpPath)) {
      await fs.ensureDir(path.dirname(vscodeMcpPath));
      await fs.writeJson(vscodeMcpPath, testMCPConfig, { spaces: 2 });
      console.log("   🔄 重新创建VS Code MCP配置");
    }

    console.log("   执行前状态:");
    console.log(`     Cursor MCP: ${await fs.pathExists(cursorMcpPath) ? "✅ 存在" : "❌ 不存在"}`);
    console.log(`     VS Code MCP: ${await fs.pathExists(vscodeMcpPath) ? "✅ 存在" : "❌ 不存在"}`);

    const vscodeResults = { actions: [], errors: [] };
    await deviceManager.performVSCodeCleanup(vscodeResults, { 
      skipBackup: true, 
      resetVSCodeCompletely: false 
    });
    
    console.log("   执行后状态:");
    console.log(`     Cursor MCP: ${await fs.pathExists(cursorMcpPath) ? "✅ 存在" : "❌ 不存在"}`);
    console.log(`     VS Code MCP: ${await fs.pathExists(vscodeMcpPath) ? "✅ 存在" : "❌ 不存在"}`);
    
    console.log(`   VS Code清理结果: 成功`);
    console.log(`   操作数量: ${vscodeResults.actions.length}`);
    console.log(`   错误数量: ${vscodeResults.errors.length}`);

    // 显示MCP相关操作
    const vscodeMcpActions = vscodeResults.actions.filter(action => 
      action.includes("MCP") || action.includes("mcp") || action.includes("🛡️") || action.includes("🔄")
    );
    if (vscodeMcpActions.length > 0) {
      console.log("   📝 MCP相关操作:");
      vscodeMcpActions.forEach(action => console.log(`     • ${action}`));
    }

    // 最终状态检查
    console.log("\n🎯 最终状态检查:");
    const finalCursorExists = await fs.pathExists(cursorMcpPath);
    const finalVscodeExists = await fs.pathExists(vscodeMcpPath);
    console.log(`   Cursor MCP: ${finalCursorExists ? "✅ 存在" : "❌ 不存在"}`);
    console.log(`   VS Code MCP: ${finalVscodeExists ? "✅ 存在" : "❌ 不存在"}`);

    if (finalCursorExists) {
      const finalCursorConfig = await fs.readJson(cursorMcpPath);
      console.log(`   Cursor最终服务器数量: ${Object.keys(finalCursorConfig).length}`);
    }

    if (finalVscodeExists) {
      const finalVscodeConfig = await fs.readJson(vscodeMcpPath);
      console.log(`   VS Code最终服务器数量: ${Object.keys(finalVscodeConfig).length}`);
    }

    // 清理测试文件
    if (await fs.pathExists(vscodeMcpPath)) {
      const config = await fs.readJson(vscodeMcpPath);
      if (config["test-server-1"]) {
        await fs.remove(vscodeMcpPath);
        console.log("\n🧹 已清理VS Code测试配置");
      }
    }

    const success = finalCursorExists && finalVscodeExists;
    console.log(`\n🏆 调试结果: ${success ? "✅ MCP保护正常" : "❌ 发现保护问题"}`);
    
    return success;

  } catch (error) {
    console.error("❌ 调试失败:", error);
    return false;
  }
}

// 运行调试
if (require.main === module) {
  debugMCPProtection().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(console.error);
}

module.exports = { debugMCPProtection };
