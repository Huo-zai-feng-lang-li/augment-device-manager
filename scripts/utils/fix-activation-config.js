/**
 * 修正激活配置文件的过期时间
 */

const fs = require("fs-extra");
const path = require("path");
const os = require("os");

async function fixActivationConfig() {
  console.log("🔧 修正激活配置文件...\n");

  try {
    const configPath = path.join(os.homedir(), ".augment-device-manager");
    const configFile = path.join(configPath, "config.json");

    // 新激活码信息（从生成结果获取）
    // 🚨 安全修复：移除本地时间使用，使用固定的测试数据
    const newActivation = {
      code: "6F7D499A29EAACCBC053141CC1759BCD",
      deviceId: "c85f8e929c3c14ab",
      activatedAt: "2025-07-03T08:50:00.000Z", // 固定测试时间
      // 过期时间：2025/7/10 16:44:39 北京时间 = 2025-07-10T08:44:39.000Z UTC
      expiresAt: "2025-07-10T08:44:39.000Z",
      version: "1.0.0",
    };

    // 创建配置对象
    const config = {
      activation: newActivation,
      lastUpdated: "2025-07-03T08:50:00.000Z", // 固定测试时间
    };

    console.log("📋 新的激活配置:");
    console.log("   激活码:", newActivation.code);
    console.log("   设备ID:", newActivation.deviceId);
    console.log(
      "   激活时间:",
      new Date(newActivation.activatedAt).toLocaleString("zh-CN")
    );
    console.log(
      "   过期时间:",
      new Date(newActivation.expiresAt).toLocaleString("zh-CN")
    );

    // 🚨 安全修复：移除本地时间验证，仅显示配置信息
    const expiryTime = new Date(newActivation.expiresAt);

    console.log("\n⏰ 配置信息:");
    console.log("   过期时间:", expiryTime.toLocaleString("zh-CN"));
    console.log("   💡 注意: 实际过期验证将通过服务端在线时间进行");
    console.log("   🛡️ 本地时间无法用于绕过激活验证");

    // 确保目录存在
    await fs.ensureDir(configPath);

    // 备份现有配置
    if (await fs.pathExists(configFile)) {
      const backupFile = configFile + ".fix-backup." + Date.now();
      await fs.copy(configFile, backupFile);
      console.log("\n📁 已备份现有配置:", path.basename(backupFile));
    }

    // 写入新配置
    await fs.writeJson(configFile, config, { spaces: 2 });

    console.log("\n✅ 配置文件已更新:", configFile);

    // 验证写入结果
    const savedConfig = await fs.readJson(configFile);
    if (
      savedConfig.activation &&
      savedConfig.activation.code === newActivation.code
    ) {
      console.log("✅ 配置验证通过");

      // 再次验证时间
      const savedExpiryTime = new Date(savedConfig.activation.expiresAt);
      const savedTimeDiff = savedExpiryTime - now;

      if (savedTimeDiff > 0) {
        console.log("✅ 过期时间验证通过 - 激活码有效");
        console.log("\n🎉 配置修正完成！现在可以重启客户端测试了");
      } else {
        console.log("❌ 过期时间验证失败 - 激活码已过期");
      }
    } else {
      console.log("❌ 配置验证失败");
    }
  } catch (error) {
    console.error("❌ 修正失败:", error.message);
  }
}

// 运行修正
fixActivationConfig().catch(console.error);
