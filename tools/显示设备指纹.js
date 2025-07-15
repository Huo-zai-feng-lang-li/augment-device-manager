const os = require("os");
const crypto = require("crypto");
const path = require("path");

// 获取共享模块路径的辅助函数
function getSharedPath(relativePath) {
  return path.join(__dirname, "../shared", relativePath);
}

async function showDeviceFingerprint() {
  console.log("🔍 设备指纹详细信息");
  console.log("=".repeat(50));

  try {
    // 1. 显示基础系统信息
    console.log("\n📱 基础系统信息:");
    console.log(`   操作系统: ${os.platform()}`);
    console.log(`   架构: ${os.arch()}`);
    console.log(`   主机名: ${os.hostname()}`);
    console.log(`   用户名: ${os.userInfo().username}`);
    console.log(`   用户目录: ${os.homedir()}`);
    console.log(
      `   总内存: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`
    );

    // 2. 显示CPU信息
    console.log("\n💻 CPU信息:");
    const cpus = os.cpus();
    console.log(`   CPU型号: ${cpus[0].model}`);
    console.log(`   CPU核心数: ${cpus.length}`);
    console.log(`   CPU频率: ${cpus[0].speed} MHz`);

    // 3. 显示网络接口信息
    console.log("\n🌐 网络接口信息:");
    const networkInterfaces = os.networkInterfaces();
    for (const [name, addrs] of Object.entries(networkInterfaces)) {
      const externalAddrs = addrs.filter((addr) => !addr.internal);
      if (externalAddrs.length > 0) {
        console.log(`   接口 ${name}:`);
        externalAddrs.forEach((addr) => {
          console.log(
            `     ${addr.family}: ${addr.address} (MAC: ${addr.mac})`
          );
        });
      }
    }

    // 4. 生成并显示设备指纹
    console.log("\n🔐 设备指纹生成:");

    // 使用简化版本的设备指纹生成
    const { generateDeviceFingerprint } = require(getSharedPath(
      "crypto/encryption-simple"
    ));
    const simpleFingerprint = generateDeviceFingerprint();
    console.log(`   简化指纹: ${simpleFingerprint}`);

    // 使用稳定设备ID生成器
    try {
      const { generateStableDeviceId } = require(getSharedPath(
        "utils/stable-device-id"
      ));
      const stableId = await generateStableDeviceId();
      console.log(`   稳定设备ID: ${stableId}`);
    } catch (error) {
      console.log(`   稳定设备ID: 生成失败 - ${error.message}`);
    }

    // 使用高级设备检测
    try {
      const DeviceDetection = require(getSharedPath("utils/device-detection"));
      const detector = new DeviceDetection();
      const advancedFingerprint = await detector.generateFingerprint();
      console.log(`   高级指纹: ${advancedFingerprint}`);
    } catch (error) {
      console.log(`   高级指纹: 生成失败 - ${error.message}`);
    }

    // 5. 显示指纹组成要素
    console.log("\n🧩 指纹组成要素:");
    const deviceInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os
        .cpus()
        .map((cpu) => cpu.model)
        .join(""),
      totalmem: os.totalmem(),
      username: os.userInfo().username,
      homedir: os.homedir(),
    };

    console.log("   用于生成指纹的数据:");
    Object.entries(deviceInfo).forEach(([key, value]) => {
      if (typeof value === "string" && value.length > 50) {
        console.log(`     ${key}: ${value.substring(0, 50)}...`);
      } else {
        console.log(`     ${key}: ${value}`);
      }
    });

    // 6. 显示指纹哈希过程
    console.log("\n🔢 指纹生成过程:");
    const jsonString = JSON.stringify(deviceInfo);
    console.log(`   原始数据长度: ${jsonString.length} 字符`);
    console.log(
      `   SHA256哈希: ${crypto
        .createHash("sha256")
        .update(jsonString)
        .digest("hex")}`
    );

    // 7. 检查缓存状态
    console.log("\n💾 缓存状态:");
    try {
      const { hasDeviceIdCache } = require(getSharedPath(
        "utils/stable-device-id"
      ));
      console.log(`   设备ID缓存: ${hasDeviceIdCache() ? "存在" : "不存在"}`);
    } catch (error) {
      console.log(`   设备ID缓存: 检查失败 - ${error.message}`);
    }
  } catch (error) {
    console.error("❌ 获取设备指纹失败:", error);
  }
}

// 运行脚本
showDeviceFingerprint().catch(console.error);
