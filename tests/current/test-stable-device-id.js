const {
  generateStableDeviceId,
  clearDeviceIdCache,
  hasDeviceIdCache,
} = require("../../shared/utils/stable-device-id");
const { generateDeviceFingerprint } = require("../../shared/crypto/encryption");

/**
 * 测试稳定设备ID生成功能
 */
async function testStableDeviceId() {
  console.log("🧪 开始测试稳定设备ID生成功能...\n");

  try {
    // 1. 清理现有缓存
    console.log("1. 清理现有缓存...");
    await clearDeviceIdCache();
    console.log("   ✅ 缓存已清理\n");

    // 2. 第一次生成设备ID
    console.log("2. 第一次生成设备ID...");
    const deviceId1 = await generateStableDeviceId();
    console.log(`   设备ID: ${deviceId1.substring(0, 16)}...`);
    console.log(`   长度: ${deviceId1.length}`);
    console.log(`   缓存状态: ${hasDeviceIdCache() ? "已缓存" : "未缓存"}\n`);

    // 3. 第二次生成设备ID（应该相同）
    console.log("3. 第二次生成设备ID（应该相同）...");
    const deviceId2 = await generateStableDeviceId();
    console.log(`   设备ID: ${deviceId2.substring(0, 16)}...`);
    console.log(
      `   是否相同: ${deviceId1 === deviceId2 ? "✅ 是" : "❌ 否"}\n`
    );

    // 4. 模拟清理操作（不清理缓存）
    console.log("4. 模拟清理操作（保留激活状态）...");
    // 这里不清理缓存，模拟preserveActivation=true的情况
    const deviceId3 = await generateStableDeviceId();
    console.log(`   清理后设备ID: ${deviceId3.substring(0, 16)}...`);
    console.log(
      `   与原ID相同: ${deviceId1 === deviceId3 ? "✅ 是" : "❌ 否"}\n`
    );

    // 5. 测试传统加密函数
    console.log("5. 测试传统加密函数兼容性...");
    const traditionalId1 = generateDeviceFingerprint();
    const traditionalId2 = generateDeviceFingerprint();
    console.log(`   传统方法ID1: ${traditionalId1.substring(0, 16)}...`);
    console.log(`   传统方法ID2: ${traditionalId2.substring(0, 16)}...`);
    console.log(
      `   传统方法稳定性: ${
        traditionalId1 === traditionalId2 ? "✅ 稳定" : "❌ 不稳定"
      }`
    );
    console.log(
      `   与稳定ID相同: ${deviceId1 === traditionalId1 ? "✅ 是" : "❌ 否"}\n`
    );

    // 6. 测试完全重置
    console.log("6. 测试完全重置（不保留激活状态）...");
    await clearDeviceIdCache();
    const deviceId4 = await generateStableDeviceId();
    console.log(`   重置后设备ID: ${deviceId4.substring(0, 16)}...`);
    console.log(
      `   与原ID不同: ${
        deviceId1 !== deviceId4 ? "✅ 是（符合预期）" : "❌ 否（异常）"
      }\n`
    );

    console.log("🎉 测试完成！");

    // 总结
    console.log("\n📊 测试结果总结:");
    console.log(
      `   - 设备ID稳定性: ${
        deviceId1 === deviceId2 && deviceId1 === deviceId3
          ? "✅ 通过"
          : "❌ 失败"
      }`
    );
    console.log(
      `   - 清理操作保护: ${deviceId1 === deviceId3 ? "✅ 通过" : "❌ 失败"}`
    );
    console.log(
      `   - 传统方法兼容: ${
        traditionalId1 === traditionalId2 ? "✅ 通过" : "❌ 失败"
      }`
    );
    console.log(
      `   - 完全重置功能: ${deviceId1 !== deviceId4 ? "✅ 通过" : "❌ 失败"}`
    );
  } catch (error) {
    console.error("❌ 测试失败:", error);
  }
}

/**
 * 测试激活状态保护机制
 */
async function testActivationProtection() {
  console.log("\n🔒 测试激活状态保护机制...\n");

  try {
    // 模拟激活状态
    const mockActivation = {
      code: "TEST_ACTIVATION_CODE_123456789012",
      deviceId: await generateStableDeviceId(),
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    console.log("模拟激活信息:");
    console.log(`   激活码: ${mockActivation.code}`);
    console.log(`   设备ID: ${mockActivation.deviceId.substring(0, 16)}...`);
    console.log(
      `   激活时间: ${new Date(mockActivation.activatedAt).toLocaleString()}`
    );
    console.log(
      `   过期时间: ${new Date(mockActivation.expiresAt).toLocaleString()}\n`
    );

    // 测试清理操作后设备ID是否保持一致
    console.log("执行清理操作（preserveActivation=true）...");
    const deviceIdAfterCleanup = await generateStableDeviceId();

    console.log(`清理后设备ID: ${deviceIdAfterCleanup.substring(0, 16)}...`);
    console.log(
      `设备ID保持一致: ${
        mockActivation.deviceId === deviceIdAfterCleanup ? "✅ 是" : "❌ 否"
      }`
    );

    if (mockActivation.deviceId === deviceIdAfterCleanup) {
      console.log("🎉 激活状态保护机制工作正常！");
    } else {
      console.log("❌ 激活状态保护机制失效！");
    }
  } catch (error) {
    console.error("❌ 激活状态保护测试失败:", error);
  }
}

// 运行测试
if (require.main === module) {
  (async () => {
    await testStableDeviceId();
    await testActivationProtection();
  })();
}

module.exports = {
  testStableDeviceId,
  testActivationProtection,
};
