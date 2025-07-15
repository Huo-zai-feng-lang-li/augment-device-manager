const path = require("path");

// 获取共享模块路径的辅助函数
function getSharedPath(relativePath) {
  return path.join(__dirname, "../shared", relativePath);
}

async function debugDeviceIds() {
  console.log("🔍 调试设备ID生成函数");
  console.log("=".repeat(60));

  try {
    // 1. 测试 generateDeviceFingerprint (encryption-simple)
    console.log("\n1️⃣ 测试 generateDeviceFingerprint (encryption-simple):");
    const {
      generateDeviceFingerprint: simpleFingerprint,
    } = require(getSharedPath("crypto/encryption-simple"));
    const simpleResult = simpleFingerprint();
    console.log(`   结果: ${simpleResult}`);
    console.log(`   长度: ${simpleResult.length}`);

    // 2. 测试 generateDeviceFingerprint (encryption)
    console.log("\n2️⃣ 测试 generateDeviceFingerprint (encryption):");
    const {
      generateDeviceFingerprint: advancedFingerprint,
    } = require(getSharedPath("crypto/encryption"));
    const advancedResult = await advancedFingerprint();
    console.log(`   结果: ${advancedResult}`);
    console.log(`   长度: ${advancedResult.length}`);

    // 3. 测试 generateStableDeviceId
    console.log("\n3️⃣ 测试 generateStableDeviceId:");
    const { generateStableDeviceId } = require(getSharedPath(
      "utils/stable-device-id"
    ));
    const stableResult = await generateStableDeviceId();
    console.log(`   结果: ${stableResult}`);
    console.log(`   长度: ${stableResult.length}`);

    // 4. 测试 DeviceDetection
    console.log("\n4️⃣ 测试 DeviceDetection:");
    const DeviceDetection = require(getSharedPath("utils/device-detection"));
    const detector = new DeviceDetection();
    const detectionResult = await detector.generateFingerprint();
    console.log(`   结果: ${detectionResult}`);
    console.log(`   长度: ${detectionResult.length}`);

    // 5. 对比分析
    console.log("\n📊 对比分析:");
    console.log(
      `   简化指纹 vs 高级指纹: ${
        simpleResult === advancedResult ? "相同" : "不同"
      }`
    );
    console.log(
      `   高级指纹 vs 稳定ID: ${
        advancedResult === stableResult ? "相同" : "不同"
      }`
    );
    console.log(
      `   稳定ID vs 设备检测: ${
        stableResult === detectionResult ? "相同" : "不同"
      }`
    );

    // 6. 检查缓存状态
    console.log("\n💾 缓存状态检查:");
    const { hasDeviceIdCache } = require(getSharedPath(
      "utils/stable-device-id"
    ));
    console.log(`   设备ID缓存存在: ${hasDeviceIdCache()}`);

    // 7. 显示我们之前获取的指纹
    console.log("\n🔍 之前获取的指纹对比:");
    const previousFingerprint =
      "e3650fba0cf08a40a6438c6f438386aa5bdf5cf12f5e78252279b0f95c15c803";
    console.log(`   之前获取的: ${previousFingerprint}`);
    console.log(
      `   与简化指纹匹配: ${
        simpleResult === previousFingerprint ? "✅ 是" : "❌ 否"
      }`
    );
    console.log(
      `   与高级指纹匹配: ${
        advancedResult === previousFingerprint ? "✅ 是" : "❌ 否"
      }`
    );
    console.log(
      `   与稳定ID匹配: ${
        stableResult === previousFingerprint ? "✅ 是" : "❌ 否"
      }`
    );
  } catch (error) {
    console.error("❌ 调试失败:", error);
  }
}

// 运行调试
debugDeviceIds().catch(console.error);
