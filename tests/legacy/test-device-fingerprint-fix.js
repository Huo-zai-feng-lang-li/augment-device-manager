/**
 * 测试设备指纹清理修复效果
 * 验证：
 * 1. 设备指纹缓存清理是否正常工作
 * 2. 清理后设备指纹是否真正更新
 * 3. 循环请求问题是否已解决
 */

const path = require("path");
const fs = require("fs-extra");
const os = require("os");

// 获取共享模块路径
function getSharedPath(relativePath) {
  return path.join(__dirname, "shared", relativePath);
}

async function testDeviceFingerprintFix() {
  console.log("🧪 开始测试设备指纹清理修复效果...\n");

  try {
    // 1. 测试设备指纹生成
    console.log("1️⃣ 测试设备指纹生成...");
    const { generateDeviceFingerprint } = require(getSharedPath("crypto/encryption"));
    
    const originalFingerprint = await generateDeviceFingerprint();
    console.log(`   原始设备指纹: ${originalFingerprint.substring(0, 16)}...`);

    // 2. 测试稳定设备ID缓存清理
    console.log("\n2️⃣ 测试稳定设备ID缓存清理...");
    const { clearDeviceIdCache, hasDeviceIdCache } = require(getSharedPath("utils/stable-device-id"));
    
    console.log(`   清理前缓存状态: ${hasDeviceIdCache() ? '存在' : '不存在'}`);
    
    const clearResult = clearDeviceIdCache();
    console.log(`   缓存清理结果: ${clearResult ? '成功' : '失败'}`);
    console.log(`   清理后缓存状态: ${hasDeviceIdCache() ? '存在' : '不存在'}`);

    // 3. 测试清理后设备指纹是否更新
    console.log("\n3️⃣ 测试清理后设备指纹更新...");
    
    const newFingerprint = await generateDeviceFingerprint();
    console.log(`   新设备指纹: ${newFingerprint.substring(0, 16)}...`);
    
    const fingerprintChanged = originalFingerprint !== newFingerprint;
    console.log(`   设备指纹是否变化: ${fingerprintChanged ? '✅ 是' : '❌ 否'}`);
    
    if (fingerprintChanged) {
      console.log(`   变化详情:`);
      console.log(`     原指纹: ${originalFingerprint}`);
      console.log(`     新指纹: ${newFingerprint}`);
    }

    // 4. 测试强制生成新设备ID
    console.log("\n4️⃣ 测试强制生成新设备ID...");
    const { StableDeviceId } = require(getSharedPath("utils/stable-device-id"));
    
    const deviceIdGenerator = new StableDeviceId();
    const forceNewId = await deviceIdGenerator.forceGenerateNewDeviceId();
    console.log(`   强制生成的新ID: ${forceNewId.substring(0, 16)}...`);
    
    const forceIdDifferent = forceNewId !== originalFingerprint && forceNewId !== newFingerprint;
    console.log(`   强制ID是否不同: ${forceIdDifferent ? '✅ 是' : '❌ 否'}`);

    // 5. 测试设备管理器清理逻辑
    console.log("\n5️⃣ 测试设备管理器清理逻辑...");
    const DeviceManager = require("./desktop-client/src/device-manager");
    
    const deviceManager = new DeviceManager();
    
    // 模拟清理操作
    const cleanupOptions = {
      preserveActivation: false,
      aggressiveMode: false,
      cleanCursorExtension: true
    };
    
    console.log("   执行模拟清理操作...");
    const cleanupResult = await deviceManager.regenerateDeviceFingerprint(
      { actions: [], errors: [] }, 
      cleanupOptions
    );
    
    console.log(`   清理操作完成`);
    
    // 验证清理后的设备指纹
    const finalFingerprint = await generateDeviceFingerprint();
    console.log(`   清理后设备指纹: ${finalFingerprint.substring(0, 16)}...`);
    
    const finalChanged = finalFingerprint !== originalFingerprint;
    console.log(`   最终指纹是否变化: ${finalChanged ? '✅ 是' : '❌ 否'}`);

    // 6. 总结测试结果
    console.log("\n📊 测试结果总结:");
    console.log(`   ✅ 设备指纹生成: 正常`);
    console.log(`   ${clearResult ? '✅' : '❌'} 缓存清理功能: ${clearResult ? '正常' : '异常'}`);
    console.log(`   ${fingerprintChanged ? '✅' : '❌'} 指纹更新能力: ${fingerprintChanged ? '正常' : '异常'}`);
    console.log(`   ${forceIdDifferent ? '✅' : '❌'} 强制生成能力: ${forceIdDifferent ? '正常' : '异常'}`);
    console.log(`   ${finalChanged ? '✅' : '❌'} 清理后更新: ${finalChanged ? '正常' : '异常'}`);
    
    const allTestsPassed = clearResult && fingerprintChanged && forceIdDifferent && finalChanged;
    console.log(`\n🎯 总体评估: ${allTestsPassed ? '✅ 修复成功' : '❌ 仍有问题'}`);
    
    if (!allTestsPassed) {
      console.log("\n🔧 问题分析:");
      if (!clearResult) console.log("   - 缓存清理功能异常");
      if (!fingerprintChanged) console.log("   - 设备指纹未能更新");
      if (!forceIdDifferent) console.log("   - 强制生成功能异常");
      if (!finalChanged) console.log("   - 清理流程未生效");
    }

  } catch (error) {
    console.error("❌ 测试过程中发生错误:", error);
    console.error("错误堆栈:", error.stack);
  }
}

// 运行测试
if (require.main === module) {
  testDeviceFingerprintFix().then(() => {
    console.log("\n🏁 测试完成");
    process.exit(0);
  }).catch(error => {
    console.error("❌ 测试失败:", error);
    process.exit(1);
  });
}

module.exports = { testDeviceFingerprintFix };
