const DeviceManager = require("../src/device-manager");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 测试VS Code支持功能
async function testVSCodeSupport() {
  console.log("🔍 测试VS Code支持功能");
  console.log("==================================================");

  const deviceManager = new DeviceManager();

  try {
    // 1. 测试VS Code路径检测
    console.log("\n📊 第1步：测试VS Code路径检测...");
    const vscodeVariants = await deviceManager.detectInstalledVSCodeVariants();
    console.log(`检测到 ${vscodeVariants.length} 个VS Code变体:`);

    vscodeVariants.forEach((variant) => {
      console.log(`  - ${variant.name}: ${variant.globalStorage}`);
    });

    if (vscodeVariants.length === 0) {
      console.log("⚠️ 未检测到VS Code安装，创建模拟环境进行测试...");
      await createMockVSCodeEnvironment();

      // 重新检测
      const mockVariants = await deviceManager.detectInstalledVSCodeVariants();
      console.log(`模拟环境创建后检测到 ${mockVariants.length} 个VS Code变体`);
    }

    // 2. 测试VS Code选择性清理功能
    console.log("\n📊 第2步：测试VS Code选择性清理...");
    const selectiveResult = await deviceManager.performCleanup({
      cleanCursor: false,
      cleanVSCode: true,
      resetVSCodeCompletely: false,
      autoRestartCursor: false,
    });

    console.log(`选择性清理结果: ${selectiveResult.success ? "成功" : "失败"}`);
    if (selectiveResult.actions.length > 0) {
      console.log("清理操作:");
      selectiveResult.actions.slice(0, 5).forEach((action) => {
        console.log(`  ✓ ${action}`);
      });
      if (selectiveResult.actions.length > 5) {
        console.log(`  ... 还有 ${selectiveResult.actions.length - 5} 个操作`);
      }
    }

    if (selectiveResult.errors.length > 0) {
      console.log("清理错误:");
      selectiveResult.errors.slice(0, 3).forEach((error) => {
        console.log(`  ❌ ${error}`);
      });
    }

    // 3. 测试VS Code完全重置功能
    console.log("\n📊 第3步：测试VS Code完全重置...");
    const completeResult = await deviceManager.performCleanup({
      cleanCursor: false,
      cleanVSCode: true,
      resetVSCodeCompletely: true,
      autoRestartCursor: false,
    });

    console.log(`完全重置结果: ${completeResult.success ? "成功" : "失败"}`);
    if (completeResult.actions.length > 0) {
      console.log("重置操作:");
      completeResult.actions.slice(0, 5).forEach((action) => {
        console.log(`  ✓ ${action}`);
      });
      if (completeResult.actions.length > 5) {
        console.log(`  ... 还有 ${completeResult.actions.length - 5} 个操作`);
      }
    }

    // 4. 测试混合清理（Cursor + VS Code）
    console.log("\n📊 第4步：测试混合清理...");
    const mixedResult = await deviceManager.performCleanup({
      cleanCursor: true,
      cleanVSCode: true,
      resetCursorCompletely: false,
      resetVSCodeCompletely: false,
      autoRestartCursor: false,
      cleanCursorExtension: true,
    });

    console.log(`混合清理结果: ${mixedResult.success ? "成功" : "失败"}`);
    console.log(`总操作数: ${mixedResult.actions.length}`);
    console.log(`错误数: ${mixedResult.errors.length}`);

    // 5. 验证设备ID生成
    console.log("\n📊 第5步：验证VS Code设备ID生成...");
    try {
      const {
        generateVSCodeDeviceId,
      } = require("../../shared/utils/stable-device-id");

      const vscodeDeviceId1 = await generateVSCodeDeviceId();
      const vscodeDeviceId2 = await generateVSCodeDeviceId();

      console.log(`VS Code设备ID 1: ${vscodeDeviceId1.substring(0, 16)}...`);
      console.log(`VS Code设备ID 2: ${vscodeDeviceId2.substring(0, 16)}...`);
      console.log(
        `设备ID唯一性: ${
          vscodeDeviceId1 !== vscodeDeviceId2 ? "✅ 通过" : "❌ 失败"
        }`
      );
    } catch (error) {
      console.log(`⚠️ 设备ID生成测试跳过: ${error.message}`);
    }

    console.log("\n✅ VS Code支持功能测试完成");
  } catch (error) {
    console.error("❌ VS Code支持功能测试失败:", error.message);
    console.error(error.stack);
  }
}

// 创建模拟VS Code环境用于测试
async function createMockVSCodeEnvironment() {
  console.log("🔧 创建模拟VS Code环境...");

  const userHome = os.homedir();
  const mockPaths = [
    // VS Code Stable
    path.join(userHome, "AppData", "Roaming", "Code", "User", "globalStorage"),
    path.join(
      userHome,
      "AppData",
      "Roaming",
      "Code",
      "User",
      "globalStorage",
      "augment.vscode-augment"
    ),

    // VS Code Insiders
    path.join(
      userHome,
      "AppData",
      "Roaming",
      "Code - Insiders",
      "User",
      "globalStorage"
    ),
  ];

  for (const mockPath of mockPaths) {
    try {
      await fs.ensureDir(mockPath);

      // 创建模拟的storage.json
      if (mockPath.includes("globalStorage") && !mockPath.includes("augment")) {
        const storageJsonPath = path.join(mockPath, "storage.json");
        const mockStorageData = {
          "telemetry.devDeviceId": "mock-device-id-12345",
          "telemetry.machineId": "mock-machine-id-67890",
          "telemetry.firstSessionDate": new Date().toUTCString(),
        };
        await fs.writeJson(storageJsonPath, mockStorageData, { spaces: 2 });
      }

      // 创建模拟的Augment扩展数据
      if (mockPath.includes("augment.vscode-augment")) {
        const mockAugmentFile = path.join(mockPath, "mock-augment-data.json");
        const mockAugmentData = {
          lastUsed: Date.now(),
          userSession: "mock-session-token",
        };
        await fs.writeJson(mockAugmentFile, mockAugmentData, { spaces: 2 });
      }

      console.log(`  ✓ 创建模拟路径: ${mockPath}`);
    } catch (error) {
      console.log(`  ⚠️ 创建模拟路径失败 ${mockPath}: ${error.message}`);
    }
  }
}

// 清理模拟环境
async function cleanupMockEnvironment() {
  console.log("🧹 清理模拟VS Code环境...");

  const userHome = os.homedir();
  const mockPaths = [
    path.join(userHome, "AppData", "Roaming", "Code"),
    path.join(userHome, "AppData", "Roaming", "Code - Insiders"),
  ];

  for (const mockPath of mockPaths) {
    try {
      if (await fs.pathExists(mockPath)) {
        await fs.remove(mockPath);
        console.log(`  ✓ 清理模拟路径: ${mockPath}`);
      }
    } catch (error) {
      console.log(`  ⚠️ 清理模拟路径失败 ${mockPath}: ${error.message}`);
    }
  }
}

// 运行测试
if (require.main === module) {
  testVSCodeSupport()
    .then(() => {
      console.log("\n🎉 测试完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 测试失败:", error);
      process.exit(1);
    });
}

module.exports = {
  testVSCodeSupport,
  createMockVSCodeEnvironment,
  cleanupMockEnvironment,
};
