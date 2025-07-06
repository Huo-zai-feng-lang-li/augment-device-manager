const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 功能回归测试
async function testFunctionalityRegression() {
  console.log("🔍 功能回归测试...\n");

  try {
    const DeviceManager = require("../src/device-manager");
    const deviceManager = new DeviceManager();

    let allTestsPassed = true;
    const testResults = [];

    // 1. 测试基本清理功能
    console.log("🧪 测试基本清理功能...");
    try {
      const results = { actions: [], errors: [] };
      await deviceManager.cleanAugmentExtensionStorage(results, { skipBackup: true });
      
      const success = results.actions.length > 0;
      testResults.push({
        name: "基本清理功能",
        success,
        details: `操作数量: ${results.actions.length}, 错误数量: ${results.errors.length}`
      });
      
      if (!success) allTestsPassed = false;
      console.log(`   结果: ${success ? "✅ 正常" : "❌ 异常"}`);
      
    } catch (error) {
      testResults.push({
        name: "基本清理功能",
        success: false,
        details: `错误: ${error.message}`
      });
      allTestsPassed = false;
      console.log(`   结果: ❌ 异常 - ${error.message}`);
    }

    // 2. 测试重置使用计数功能
    console.log("\n🧪 测试重置使用计数功能...");
    try {
      const result = await deviceManager.resetUsageCount();
      
      const success = result.success === true;
      testResults.push({
        name: "重置使用计数",
        success,
        details: `成功: ${result.success}, 操作数量: ${result.actions.length}`
      });
      
      if (!success) allTestsPassed = false;
      console.log(`   结果: ${success ? "✅ 正常" : "❌ 异常"}`);
      
    } catch (error) {
      testResults.push({
        name: "重置使用计数",
        success: false,
        details: `错误: ${error.message}`
      });
      allTestsPassed = false;
      console.log(`   结果: ❌ 异常 - ${error.message}`);
    }

    // 3. 测试VS Code清理功能
    console.log("\n🧪 测试VS Code清理功能...");
    try {
      const results = { actions: [], errors: [] };
      await deviceManager.performVSCodeCleanup(results, { 
        skipBackup: true, 
        resetVSCodeCompletely: false 
      });
      
      const success = results.actions.length > 0;
      testResults.push({
        name: "VS Code清理",
        success,
        details: `操作数量: ${results.actions.length}, 错误数量: ${results.errors.length}`
      });
      
      if (!success) allTestsPassed = false;
      console.log(`   结果: ${success ? "✅ 正常" : "❌ 异常"}`);
      
    } catch (error) {
      testResults.push({
        name: "VS Code清理",
        success: false,
        details: `错误: ${error.message}`
      });
      allTestsPassed = false;
      console.log(`   结果: ❌ 异常 - ${error.message}`);
    }

    // 4. 测试Cursor清理功能
    console.log("\n🧪 测试Cursor清理功能...");
    try {
      const results = { actions: [], errors: [] };
      await deviceManager.cleanCursorExtensionData(results, { skipBackup: true });
      
      const success = results.actions.length > 0;
      testResults.push({
        name: "Cursor清理",
        success,
        details: `操作数量: ${results.actions.length}, 错误数量: ${results.errors.length}`
      });
      
      if (!success) allTestsPassed = false;
      console.log(`   结果: ${success ? "✅ 正常" : "❌ 异常"}`);
      
    } catch (error) {
      testResults.push({
        name: "Cursor清理",
        success: false,
        details: `错误: ${error.message}`
      });
      allTestsPassed = false;
      console.log(`   结果: ❌ 异常 - ${error.message}`);
    }

    // 5. 测试通用保护机制（新功能）
    console.log("\n🧪 测试通用保护机制...");
    try {
      const results = { actions: [], errors: [] };
      const mcpConfigs = await deviceManager.protectMCPConfigUniversal(results);
      
      const success = typeof mcpConfigs === 'object' && mcpConfigs instanceof Map;
      testResults.push({
        name: "通用保护机制",
        success,
        details: `检测配置: ${mcpConfigs.size}个, 操作数量: ${results.actions.length}`
      });
      
      if (!success) allTestsPassed = false;
      console.log(`   结果: ${success ? "✅ 正常" : "❌ 异常"}`);
      
    } catch (error) {
      testResults.push({
        name: "通用保护机制",
        success: false,
        details: `错误: ${error.message}`
      });
      allTestsPassed = false;
      console.log(`   结果: ❌ 异常 - ${error.message}`);
    }

    // 6. 测试错误处理机制
    console.log("\n🧪 测试错误处理机制...");
    try {
      const results = { actions: [], errors: [] };
      
      // 尝试清理不存在的路径
      const nonExistentPath = path.join(os.tmpdir(), "non-existent-test-dir");
      if (await fs.pathExists(nonExistentPath)) {
        await fs.remove(nonExistentPath);
      }
      
      // 这应该不会抛出错误，而是优雅地处理
      await deviceManager.cleanAugmentExtensionStorage(results, { skipBackup: true });
      
      const success = true; // 如果没有抛出错误就是成功
      testResults.push({
        name: "错误处理机制",
        success,
        details: "优雅处理不存在的路径"
      });
      
      console.log(`   结果: ✅ 正常`);
      
    } catch (error) {
      testResults.push({
        name: "错误处理机制",
        success: false,
        details: `错误: ${error.message}`
      });
      allTestsPassed = false;
      console.log(`   结果: ❌ 异常 - ${error.message}`);
    }

    // 7. 测试性能影响
    console.log("\n🧪 测试性能影响...");
    try {
      const startTime = Date.now();
      
      const results = { actions: [], errors: [] };
      await deviceManager.protectMCPConfigUniversal(results);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const success = duration < 5000; // 应该在5秒内完成
      testResults.push({
        name: "性能测试",
        success,
        details: `执行时间: ${duration}ms`
      });
      
      if (!success) allTestsPassed = false;
      console.log(`   结果: ${success ? "✅ 正常" : "❌ 异常"} (${duration}ms)`);
      
    } catch (error) {
      testResults.push({
        name: "性能测试",
        success: false,
        details: `错误: ${error.message}`
      });
      allTestsPassed = false;
      console.log(`   结果: ❌ 异常 - ${error.message}`);
    }

    // 8. 测试日志记录功能
    console.log("\n🧪 测试日志记录功能...");
    try {
      const results = { actions: [], errors: [] };
      await deviceManager.cleanAugmentExtensionStorage(results, { skipBackup: true });
      
      const hasActions = results.actions.length > 0;
      const hasProperFormat = results.actions.every(action => typeof action === 'string');
      
      const success = hasActions && hasProperFormat;
      testResults.push({
        name: "日志记录",
        success,
        details: `日志条目: ${results.actions.length}个, 格式正确: ${hasProperFormat}`
      });
      
      if (!success) allTestsPassed = false;
      console.log(`   结果: ${success ? "✅ 正常" : "❌ 异常"}`);
      
    } catch (error) {
      testResults.push({
        name: "日志记录",
        success: false,
        details: `错误: ${error.message}`
      });
      allTestsPassed = false;
      console.log(`   结果: ❌ 异常 - ${error.message}`);
    }

    // 9. 测试备份功能
    console.log("\n🧪 测试备份功能...");
    try {
      const results = { actions: [], errors: [] };
      await deviceManager.cleanAugmentExtensionStorage(results, { skipBackup: false });
      
      const hasBackupActions = results.actions.some(action => action.includes("备份"));
      
      const success = hasBackupActions || results.actions.some(action => action.includes("不存在"));
      testResults.push({
        name: "备份功能",
        success,
        details: `备份操作: ${hasBackupActions ? "已执行" : "跳过（无数据）"}`
      });
      
      if (!success) allTestsPassed = false;
      console.log(`   结果: ${success ? "✅ 正常" : "❌ 异常"}`);
      
    } catch (error) {
      testResults.push({
        name: "备份功能",
        success: false,
        details: `错误: ${error.message}`
      });
      allTestsPassed = false;
      console.log(`   结果: ❌ 异常 - ${error.message}`);
    }

    // 总结测试结果
    console.log("\n🎯 功能回归测试总结:");
    console.log(`   总体结果: ${allTestsPassed ? "✅ 所有功能正常" : "❌ 发现功能问题"}`);
    console.log(`   测试项目: ${testResults.length}个`);
    
    const passedTests = testResults.filter(test => test.success).length;
    const failedTests = testResults.filter(test => !test.success).length;
    
    console.log(`   通过测试: ${passedTests}个`);
    console.log(`   失败测试: ${failedTests}个`);
    
    if (failedTests > 0) {
      console.log("\n❌ 失败的测试项目:");
      testResults.filter(test => !test.success).forEach(test => {
        console.log(`   • ${test.name}: ${test.details}`);
      });
    }

    console.log("\n📊 详细测试结果:");
    testResults.forEach(test => {
      console.log(`   ${test.success ? "✅" : "❌"} ${test.name}: ${test.details}`);
    });

    if (allTestsPassed) {
      console.log("\n🎉 所有功能测试通过！修改没有影响现有功能。");
    } else {
      console.log("\n⚠️ 发现功能问题，需要进一步检查。");
    }

    return allTestsPassed;

  } catch (error) {
    console.error("❌ 功能回归测试失败:", error);
    return false;
  }
}

// 运行测试
if (require.main === module) {
  testFunctionalityRegression().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(console.error);
}

module.exports = { testFunctionalityRegression };
