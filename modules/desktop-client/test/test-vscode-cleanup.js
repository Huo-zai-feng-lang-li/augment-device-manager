/**
 * VSCode清理功能测试脚本
 * 测试VSCode设备身份更新和恢复机制
 */

const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 获取共享模块路径
function getSharedPath(relativePath) {
  return path.join(__dirname, "..", "..", "..", "shared", relativePath);
}

// 直接引入设备ID生成函数
const {
  generateVSCodeDeviceId,
} = require("../../../shared/utils/stable-device-id");

const DeviceManager = require("../src/device-manager");

async function testVSCodeCleanup() {
  console.log("🧪 开始测试VSCode清理功能...\n");

  try {
    const deviceManager = new DeviceManager();

    // 1. 检查VSCode安装情况
    console.log("📋 检查VSCode安装情况:");
    const vscodeVariants = await deviceManager.detectInstalledVSCodeVariants();

    if (vscodeVariants.length === 0) {
      console.log("❌ 未检测到已安装的VSCode，无法进行测试");
      return;
    }

    console.log(`✅ 检测到 ${vscodeVariants.length} 个VSCode变体:`);
    vscodeVariants.forEach((variant) => {
      console.log(`   - ${variant.name}: ${variant.globalStorage}`);
    });

    // 2. 检查当前VSCode storage.json状态
    console.log("\n📄 检查当前VSCode storage.json状态:");
    for (const variant of vscodeVariants) {
      const storageJsonPath = path.join(variant.globalStorage, "storage.json");
      if (await fs.pathExists(storageJsonPath)) {
        const storageData = await fs.readJson(storageJsonPath);
        console.log(`\n${variant.name} 当前设备ID:`);
        console.log(
          `   telemetry.devDeviceId: ${
            storageData["telemetry.devDeviceId"] || "未设置"
          }`
        );
        console.log(
          `   telemetry.machineId: ${
            storageData["telemetry.machineId"] || "未设置"
          }`
        );
        console.log(
          `   telemetry.sqmId: ${storageData["telemetry.sqmId"] || "未设置"}`
        );
      } else {
        console.log(`   ${variant.name}: storage.json 不存在`);
      }
    }

    // 3. 执行VSCode智能清理
    console.log("\n🧠 执行VSCode智能清理测试:");
    const results = {
      success: true,
      actions: [],
      errors: [],
    };

    for (const variant of vscodeVariants) {
      console.log(`\n处理 ${variant.name}...`);
      await deviceManager.performVSCodeIntelligentCleanup(results, variant, {});
    }

    // 4. 显示清理结果
    console.log("\n📊 清理结果:");
    results.actions.forEach((action) => console.log(`   ${action}`));
    if (results.errors.length > 0) {
      console.log("\n❌ 错误信息:");
      results.errors.forEach((error) => console.log(`   ${error}`));
    }

    // 5. 验证清理后的状态
    console.log("\n🔍 验证清理后的状态:");
    for (const variant of vscodeVariants) {
      const storageJsonPath = path.join(variant.globalStorage, "storage.json");
      if (await fs.pathExists(storageJsonPath)) {
        const storageData = await fs.readJson(storageJsonPath);
        console.log(`\n${variant.name} 清理后设备ID:`);
        console.log(
          `   telemetry.devDeviceId: ${
            storageData["telemetry.devDeviceId"] || "未设置"
          }`
        );
        console.log(
          `   telemetry.machineId: ${
            storageData["telemetry.machineId"] || "未设置"
          }`
        );
        console.log(
          `   telemetry.sqmId: ${storageData["telemetry.sqmId"] || "未设置"}`
        );
        console.log(
          `   telemetry.installTime: ${
            storageData["telemetry.installTime"] || "未设置"
          }`
        );
        console.log(
          `   telemetry.sessionCount: ${
            storageData["telemetry.sessionCount"] || "未设置"
          }`
        );
      }
    }

    console.log("\n✅ VSCode清理功能测试完成!");
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
    console.error(error.stack);
  }
}

// 运行测试
if (require.main === module) {
  testVSCodeCleanup().catch(console.error);
}

module.exports = { testVSCodeCleanup };
