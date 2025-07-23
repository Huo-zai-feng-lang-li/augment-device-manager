const DeviceManager = require("../src/device-manager");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

/**
 * 测试智能清理模式的workspaceStorage清理功能
 */
async function testIntelligentCleanupWorkspaceStorage() {
  console.log("🧪 测试智能清理模式的workspaceStorage清理功能");
  console.log("=" .repeat(60));

  try {
    const deviceManager = new DeviceManager();
    
    // 启用干运行模式 - 重写关键方法避免实际删除
    const originalMethods = {};
    const methodsToMock = [
      "protectMCPConfigUniversal",
      "protectIDESettings", 
      "protectWorkspaceSettings",
      "cleanDeviceIdentityOnly",
      "cleanAugmentDeviceIdentity",
      "regenerateDeviceFingerprint",
      "restoreMCPConfigUniversal",
      "restoreIDESettings",
      "restoreWorkspaceSettings",
      "startEnhancedGuardian",
      "startIDEsAfterCleanup"
    ];

    // 保存原始方法并替换为模拟方法
    for (const methodName of methodsToMock) {
      originalMethods[methodName] = deviceManager[methodName];
      deviceManager[methodName] = async function(results, ...args) {
        results.actions.push(`🧪 [DRY RUN] ${methodName}() - 执行模拟操作`);
        return methodName.startsWith("protect") ? new Map() : undefined;
      };
    }

    // 模拟workspaceStorage路径检查和删除
    const originalPathExists = fs.pathExists;
    const originalRemove = fs.remove;
    const originalCopy = fs.copy;

    // 创建模拟的workspaceStorage目录状态
    const mockWorkspaceStoragePaths = [
      path.join(os.homedir(), "AppData", "Roaming", "Code", "User", "workspaceStorage"),
      path.join(os.homedir(), "AppData", "Roaming", "Cursor", "User", "workspaceStorage"),
      path.join(os.homedir(), "AppData", "Roaming", "Code - Insiders", "User", "workspaceStorage")
    ];

    fs.pathExists = async (checkPath) => {
      // 模拟某些workspaceStorage目录存在
      if (mockWorkspaceStoragePaths.some(p => checkPath.includes("workspaceStorage"))) {
        return checkPath.includes("Code") || checkPath.includes("Cursor");
      }
      return originalPathExists(checkPath);
    };

    fs.remove = async (removePath) => {
      console.log(`  🗑️ [模拟删除] ${removePath}`);
      return Promise.resolve();
    };

    fs.copy = async (src, dest) => {
      console.log(`  📦 [模拟备份] ${src} -> ${dest}`);
      return Promise.resolve();
    };

    console.log("\n📋 测试1: 智能清理模式执行");
    console.log("-".repeat(40));

    const intelligentOptions = {
      intelligentMode: true,
      preserveActivation: true,
      skipBackup: false, // 测试备份功能
      enableEnhancedGuardian: true,
    };

    console.log("🧠 智能清理模式参数:");
    console.log("   - intelligentMode: true");
    console.log("   - preserveActivation: true");
    console.log("   - skipBackup: false (测试备份功能)");

    const testResults = await deviceManager.performCleanup(intelligentOptions);

    console.log("\n🧠 智能清理执行路径:");
    testResults.actions.forEach((action, index) => {
      if (action.includes("workspaceStorage") || action.includes("🗂️")) {
        console.log(`  🎯 ${index + 1}. ${action}`);
      } else {
        console.log(`  ${index + 1}. ${action}`);
      }
    });

    if (testResults.errors.length > 0) {
      console.log("\n❌ 错误信息:");
      testResults.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    console.log("\n📋 测试2: 路径生成功能验证");
    console.log("-".repeat(40));

    // 测试路径生成函数
    console.log("\n🔍 VS Code workspaceStorage路径:");
    const vscodeWorkspacePaths = deviceManager.getVSCodeWorkspaceStoragePaths();
    vscodeWorkspacePaths.forEach((p, index) => {
      console.log(`  ${index + 1}. ${p}`);
    });

    console.log("\n🔍 Cursor workspaceStorage路径:");
    const cursorWorkspacePaths = deviceManager.getCursorWorkspaceStoragePaths();
    cursorWorkspacePaths.forEach((p, index) => {
      console.log(`  ${index + 1}. ${p}`);
    });

    console.log("\n📋 测试3: 跨平台路径验证");
    console.log("-".repeat(40));

    // 测试不同平台的路径
    const platforms = ["win32", "darwin", "linux"];
    const originalPlatform = deviceManager.platform;

    for (const testPlatform of platforms) {
      console.log(`\n🖥️ ${testPlatform} 平台路径:`);
      deviceManager.platform = testPlatform;
      
      const vsPaths = deviceManager.getVSCodeWorkspaceStoragePaths();
      const cursorPaths = deviceManager.getCursorWorkspaceStoragePaths();
      
      console.log(`  VS Code: ${vsPaths.length} 个路径`);
      vsPaths.forEach(p => console.log(`    - ${p}`));
      
      console.log(`  Cursor: ${cursorPaths.length} 个路径`);
      cursorPaths.forEach(p => console.log(`    - ${p}`));
    }

    // 恢复原始平台
    deviceManager.platform = originalPlatform;

    // 恢复原始方法
    for (const methodName of methodsToMock) {
      deviceManager[methodName] = originalMethods[methodName];
    }

    fs.pathExists = originalPathExists;
    fs.remove = originalRemove;
    fs.copy = originalCopy;

    console.log("\n✅ 测试完成");
    console.log("📊 测试结果:");
    console.log(`   - 智能清理执行: ${testResults.success ? "✅ 成功" : "❌ 失败"}`);
    console.log(`   - 操作数量: ${testResults.actions.length}`);
    console.log(`   - 错误数量: ${testResults.errors.length}`);
    console.log(`   - workspaceStorage清理: ${testResults.actions.some(a => a.includes("workspaceStorage")) ? "✅ 已集成" : "❌ 未集成"}`);

  } catch (error) {
    console.error("❌ 测试失败:", error);
  }
}

// 运行测试
if (require.main === module) {
  testIntelligentCleanupWorkspaceStorage();
}

module.exports = { testIntelligentCleanupWorkspaceStorage };
