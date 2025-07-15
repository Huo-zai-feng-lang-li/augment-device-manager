/**
 * 恢复当前激活码的配置文件
 */

const fs = require("fs-extra");
const path = require("path");
const os = require("os");

async function restoreActivationConfig() {
  console.log("🔄 恢复激活配置文件...\n");

  try {
    const configPath = path.join(os.homedir(), ".augment-device-manager");
    const configFile = path.join(configPath, "config.json");

    // 当前激活的信息（新生成的有效激活码）
    const currentActivation = {
      code: "6F7D499A29EAACCBC053141CC1759BCD",
      deviceId: "c85f8e929c3c14ab",
      activatedAt: new Date().toISOString(), // 当前时间
      expiresAt: "2025-07-10T08:44:39.000Z", // 7天后过期
      version: "1.0.0",
    };

    // 创建配置对象
    const config = {
      activation: currentActivation,
      lastUpdated: new Date().toISOString(),
    };

    console.log("📋 准备恢复的配置:");
    console.log("   激活码:", currentActivation.code);
    console.log("   设备ID:", currentActivation.deviceId);
    console.log(
      "   激活时间:",
      new Date(currentActivation.activatedAt).toLocaleString("zh-CN")
    );
    console.log(
      "   过期时间:",
      new Date(currentActivation.expiresAt).toLocaleString("zh-CN")
    );

    // 时间分析
    const now = new Date();
    const expiryTime = new Date(currentActivation.expiresAt);
    const timeDiff = expiryTime - now;

    console.log("\n⏰ 时间分析:");
    console.log("   当前时间:", now.toLocaleString("zh-CN"));
    console.log("   过期时间:", expiryTime.toLocaleString("zh-CN"));
    console.log("   时间差:", Math.round(timeDiff / 1000), "秒");
    console.log("   本地检查:", timeDiff > 0 ? "未过期" : "已过期");

    if (timeDiff <= 0) {
      console.log("\n⚠️  警告: 激活码已过期，但仍然恢复配置以便调试");
      console.log("💡 建议: 生成新的激活码进行测试");
    }

    // 确保目录存在
    await fs.ensureDir(configPath);

    // 备份现有配置（如果存在）
    if (await fs.pathExists(configFile)) {
      const backupFile = configFile + ".restore-backup." + Date.now();
      await fs.copy(configFile, backupFile);
      console.log("\n📁 已备份现有配置:", path.basename(backupFile));
    }

    // 写入新配置
    await fs.writeJson(configFile, config, { spaces: 2 });

    console.log("\n✅ 配置文件已恢复:", configFile);
    console.log("🔄 请重启客户端应用以应用新配置");

    // 验证写入结果
    const savedConfig = await fs.readJson(configFile);
    if (
      savedConfig.activation &&
      savedConfig.activation.code === currentActivation.code
    ) {
      console.log("✅ 配置验证通过");
    } else {
      console.log("❌ 配置验证失败");
    }
  } catch (error) {
    console.error("❌ 恢复失败:", error.message);
  }
}

// 运行恢复
restoreActivationConfig().catch(console.error);
