const path = require("path");
const fs = require("fs-extra");
const os = require("os");

// 测试设备ID详情功能
async function testDeviceIdDetails() {
  console.log("🧪 测试设备ID详情功能...\n");

  try {
    // 导入设备ID相关工具
    const { 
      generateStableDeviceId, 
      hasDeviceIdCache 
    } = require("./shared/utils/stable-device-id");
    
    const DeviceDetection = require("./shared/utils/device-detection");

    console.log("=== 1. 稳定设备ID ===");
    const stableDeviceId = await generateStableDeviceId();
    const hasCachedId = hasDeviceIdCache();
    console.log(`稳定设备ID: ${stableDeviceId}`);
    console.log(`缓存状态: ${hasCachedId ? "已缓存" : "无缓存"}`);
    console.log(`清理能力: 可清理 ✅`);

    console.log("\n=== 2. 设备指纹 ===");
    const detector = new DeviceDetection();
    const deviceFingerprint = await detector.generateFingerprint();
    console.log(`设备指纹: ${deviceFingerprint}`);
    console.log(`清理能力: 可清理 ✅`);

    console.log("\n=== 3. Cursor遥测ID ===");
    try {
      const storageJsonPath = path.join(
        os.homedir(),
        "AppData",
        "Roaming", 
        "Cursor",
        "User",
        "globalStorage",
        "storage.json"
      );

      console.log(`Cursor存储路径: ${storageJsonPath}`);
      console.log(`文件存在: ${await fs.pathExists(storageJsonPath)}`);

      if (await fs.pathExists(storageJsonPath)) {
        const data = await fs.readJson(storageJsonPath);
        const cursorTelemetry = {
          devDeviceId: data["telemetry.devDeviceId"],
          machineId: data["telemetry.machineId"],
          macMachineId: data["telemetry.macMachineId"],
          sessionId: data["telemetry.sessionId"],
          sqmId: data["telemetry.sqmId"]
        };

        console.log("Cursor遥测ID详情:");
        Object.entries(cursorTelemetry).forEach(([key, value]) => {
          console.log(`  ${key}: ${value || "未设置"}`);
        });
        console.log(`清理能力: 可清理 ✅`);
      } else {
        console.log("Cursor存储文件不存在");
        console.log(`清理能力: 无需清理 ⚪`);
      }
    } catch (error) {
      console.error("获取Cursor遥测ID失败:", error.message);
    }

    console.log("\n=== 4. 虚拟机检测 ===");
    const vmInfo = await detector.detectVirtualMachine();
    console.log(`虚拟机状态: ${vmInfo.isVM ? "虚拟机" : "物理机"}`);
    console.log(`虚拟机类型: ${vmInfo.type}`);
    console.log(`详细信息: ${vmInfo.details || "无"}`);

    console.log("\n=== 5. 系统基础信息 ===");
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      username: os.userInfo().username,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + "GB"
    };

    Object.entries(systemInfo).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    console.log("\n=== 6. 清理能力总结 ===");
    const cleanupCapabilities = {
      "稳定设备ID": "可清理 ✅",
      "设备指纹": "可清理 ✅", 
      "Cursor遥测ID": await fs.pathExists(path.join(os.homedir(), "AppData", "Roaming", "Cursor", "User", "globalStorage", "storage.json")) ? "可清理 ✅" : "无需清理 ⚪",
      "设备缓存": hasCachedId ? "可清理 ✅" : "无需清理 ⚪"
    };

    Object.entries(cleanupCapabilities).forEach(([name, status]) => {
      console.log(`  ${name}: ${status}`);
    });

    console.log("\n✅ 设备ID详情功能测试完成！");
    console.log("\n💡 说明:");
    console.log("- ✅ 可清理: 支持通过清理操作重置");
    console.log("- ⚪ 无需清理: 当前状态无需清理或不存在");
    console.log("- 清理操作会生成新的设备标识符，让IDE扩展认为是新设备");

  } catch (error) {
    console.error("❌ 测试失败:", error);
    console.error(error.stack);
  }
}

// 运行测试
testDeviceIdDetails();
