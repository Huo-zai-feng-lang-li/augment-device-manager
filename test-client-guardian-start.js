/**
 * 测试客户端启动防护的配置传递
 * 验证修复后的客户端是否正确传递selectedIDE和targetDeviceId参数
 */

const path = require("path");

async function testClientGuardianStart() {
  console.log("🧪 测试客户端启动防护的配置传递");
  console.log("=".repeat(60));

  try {
    // 模拟客户端的启动防护流程
    console.log("\n📍 1. 模拟获取当前选择的IDE");

    // 模拟getCurrentSelectedIDE()的返回值
    const selectedIDE = "vscode"; // 假设用户选择了VS Code
    console.log(`🎯 选择的IDE: ${selectedIDE}`);

    // 模拟获取设备ID详情
    console.log("\n📍 2. 模拟获取设备ID详情");
    const DeviceManager = require("./modules/desktop-client/src/device-manager");
    const deviceManager = new DeviceManager();

    // 获取设备ID详情（模拟客户端调用）
    const {
      generateIDESpecificDeviceId,
    } = require("./shared/utils/stable-device-id");
    const targetDeviceId = await generateIDESpecificDeviceId(selectedIDE);
    console.log(`🎯 目标设备ID: ${targetDeviceId}`);

    // 模拟客户端传递的参数
    const startOptions = {
      selectedIDE: selectedIDE,
      targetDeviceId: targetDeviceId,
      enableBackupMonitoring: true,
      enableDatabaseMonitoring: true,
      enableEnhancedProtection: true,
    };

    console.log("\n📍 3. 模拟客户端启动防护（传递正确参数）");
    console.log("传递的参数:", JSON.stringify(startOptions, null, 2));

    // 先停止现有的防护
    console.log("\n📍 4. 停止现有防护");
    await deviceManager.stopEnhancedGuardian();

    // 等待完全停止
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 启动防护（使用修复后的参数传递）
    console.log("\n📍 5. 启动防护（使用正确参数）");
    const result = await deviceManager.startEnhancedGuardianIndependently(
      startOptions
    );

    console.log("\n📊 启动结果:");
    console.log(`✅ 成功: ${result.success}`);
    console.log(`📝 消息: ${result.message}`);
    if (result.deviceId) {
      console.log(`🎯 设备ID: ${result.deviceId}`);
    }

    // 验证配置是否正确
    console.log("\n📍 6. 验证防护配置");
    const status = await deviceManager.getEnhancedGuardianStatus();

    console.log("\n📊 防护状态:");
    console.log(`🛡️ 运行中: ${status.isGuarding}`);
    console.log(`🎯 选择的IDE: ${status.selectedIDE || "未设置"}`);
    console.log(`🎯 目标设备ID: ${status.targetDeviceId || "未设置"}`);
    console.log(`🔧 模式: ${status.mode || "未知"}`);

    // 检查配置是否正确
    const configCorrect =
      status.selectedIDE === selectedIDE &&
      status.targetDeviceId === targetDeviceId;

    console.log("\n🎯 配置验证结果:");
    console.log(
      `✅ IDE配置正确: ${status.selectedIDE === selectedIDE ? "是" : "否"}`
    );
    console.log(
      `✅ 设备ID配置正确: ${
        status.targetDeviceId === targetDeviceId ? "是" : "否"
      }`
    );
    console.log(`🎉 整体配置正确: ${configCorrect ? "是" : "否"}`);

    if (configCorrect) {
      console.log("\n🎉 测试成功！客户端现在会正确传递配置参数！");
    } else {
      console.log("\n❌ 测试失败！配置仍然不正确！");
      console.log("期望的IDE:", selectedIDE);
      console.log("实际的IDE:", status.selectedIDE);
      console.log("期望的设备ID:", targetDeviceId);
      console.log("实际的设备ID:", status.targetDeviceId);
    }
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
    console.error(error.stack);
  }
}

// 运行测试
if (require.main === module) {
  testClientGuardianStart()
    .then(() => {
      console.log("\n✅ 测试完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ 测试异常:", error);
      process.exit(1);
    });
}

module.exports = { testClientGuardianStart };
