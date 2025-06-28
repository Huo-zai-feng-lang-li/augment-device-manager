const DeviceManager = require("../src/device-manager");
const path = require("path");
const os = require("os");
const fs = require("fs-extra");

async function testCleanup() {
  console.log("🧹 开始测试设备清理功能...\n");

  try {
    // 初始化设备管理器
    const deviceManager = new DeviceManager();

    // 1. 获取清理前的状态
    console.log("📊 清理前状态检查:");

    // 获取设备ID
    const {
      generateDeviceFingerprint,
    } = require("../shared/crypto/encryption");
    const deviceId = await generateDeviceFingerprint();
    console.log(`  设备ID: ${deviceId}`);

    // 检查激活状态
    const configDir = path.join(os.homedir(), ".augment-device-manager");
    const activationPath = path.join(configDir, "activation.json");
    let isActivated = false;

    if (await fs.pathExists(activationPath)) {
      try {
        const activationData = await fs.readJson(activationPath);
        isActivated = activationData.isActivated || false;
      } catch (error) {
        console.log(`  ⚠️ 读取激活状态失败: ${error.message}`);
      }
    }
    console.log(`  激活状态: ${isActivated ? "已激活" : "未激活"}`);

    // 检查关键文件是否存在
    const keyFiles = [
      "stable-device-id.cache",
      "device-fingerprint.cache",
      "activation.json",
      "server-config.json",
    ];

    console.log("\n📁 关键文件检查:");
    for (const file of keyFiles) {
      const filePath = path.join(configDir, file);
      const exists = await fs.pathExists(filePath);
      console.log(`  ${file}: ${exists ? "✅ 存在" : "❌ 不存在"}`);
    }

    // 检查Cursor相关文件
    console.log("\n📁 Cursor相关文件检查:");
    const cursorPaths = [
      path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "globalStorage",
        "storage.json"
      ),
      path.join(os.homedir(), "AppData", "Roaming", "Cursor", "logs"),
      path.join(
        os.homedir(),
        "AppData",
        "Local",
        "Cursor",
        "User",
        "workspaceStorage"
      ),
    ];

    for (const cursorPath of cursorPaths) {
      const exists = await fs.pathExists(cursorPath);
      console.log(
        `  ${path.basename(cursorPath)}: ${exists ? "✅ 存在" : "❌ 不存在"}`
      );
    }

    // 2. 执行清理操作（98%成功率目标配置）
    console.log("\n🧹 执行清理操作（98%成功率目标配置）...");
    const cleanupResult = await deviceManager.performCleanup({
      preserveActivation: true, // 保留激活状态
      deepClean: true, // 深度清理
      cleanCursorExtension: true, // 清理Cursor扩展数据
      autoRestartCursor: true, // 自动重启Cursor
      skipCursorLogin: true, // 跳过Cursor IDE登录清理
      aggressiveMode: true, // 激进模式
      multiRoundClean: true, // 多轮清理
      extendedMonitoring: true, // 延长监控时间
    });

    console.log("\n📋 清理结果:");
    console.log(`  成功: ${cleanupResult.success ? "✅" : "❌"}`);

    if (cleanupResult.actions && cleanupResult.actions.length > 0) {
      console.log("\n✅ 执行的操作:");
      cleanupResult.actions.forEach((action) => {
        console.log(`  • ${action}`);
      });
    }

    if (cleanupResult.errors && cleanupResult.errors.length > 0) {
      console.log("\n❌ 错误信息:");
      cleanupResult.errors.forEach((error) => {
        console.log(`  • ${error}`);
      });
    }

    // 3. 检查清理后的状态
    console.log("\n📊 清理后状态检查:");

    // 重新获取设备ID
    const afterDeviceId = await generateDeviceFingerprint();
    console.log(`  设备ID: ${afterDeviceId}`);

    // 重新检查激活状态
    let afterIsActivated = false;
    if (await fs.pathExists(activationPath)) {
      try {
        const activationData = await fs.readJson(activationPath);
        afterIsActivated = activationData.isActivated || false;
      } catch (error) {
        console.log(`  ⚠️ 读取激活状态失败: ${error.message}`);
      }
    }
    console.log(`  激活状态: ${afterIsActivated ? "已激活" : "未激活"}`);

    // 检查关键文件状态
    console.log("\n📁 清理后文件检查:");
    for (const file of keyFiles) {
      const filePath = path.join(configDir, file);
      const exists = await fs.pathExists(filePath);
      console.log(`  ${file}: ${exists ? "✅ 存在" : "❌ 不存在"}`);
    }

    // 检查Cursor文件清理情况
    console.log("\n📁 Cursor文件清理检查:");
    for (const cursorPath of cursorPaths) {
      const exists = await fs.pathExists(cursorPath);
      console.log(
        `  ${path.basename(cursorPath)}: ${exists ? "⚠️ 仍存在" : "✅ 已清理"}`
      );
    }

    // 4. 验证激活状态是否保留
    console.log("\n🔍 激活状态验证:");
    if (isActivated === afterIsActivated) {
      console.log("  ✅ 激活状态已正确保留");
    } else {
      console.log("  ❌ 激活状态发生变化");
      console.log(`    清理前: ${isActivated ? "已激活" : "未激活"}`);
      console.log(`    清理后: ${afterIsActivated ? "已激活" : "未激活"}`);
    }

    // 5. 检查设备ID是否变化
    console.log("\n🔍 设备ID验证:");
    if (deviceId === afterDeviceId) {
      console.log("  ✅ 设备ID保持稳定");
    } else {
      console.log("  ⚠️ 设备ID发生变化");
      console.log(`    清理前: ${deviceId}`);
      console.log(`    清理后: ${afterDeviceId}`);
    }

    // 6. 检查注册表清理情况（Windows）
    if (os.platform() === "win32") {
      console.log("\n🗂️ 检查Windows注册表清理情况...");
      await checkRegistryCleanup();
    }

    // 7. 检查临时文件清理
    console.log("\n🗑️ 检查临时文件清理情况...");
    await checkTempFilesCleanup();

    console.log("\n✅ 清理测试完成！");
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
    console.error(error.stack);
  }
}

// 检查注册表清理情况
async function checkRegistryCleanup() {
  const { exec } = require("child_process");
  const { promisify } = require("util");
  const execAsync = promisify(exec);

  const registryKeys = [
    "HKEY_CURRENT_USER\\Software\\Augment",
    "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Augment",
  ];

  for (const key of registryKeys) {
    try {
      await execAsync(`reg query "${key}"`);
      console.log(`  ❌ 注册表项仍存在: ${key}`);
    } catch (error) {
      if (
        error.message.includes("找不到指定的注册表项") ||
        error.message.includes(
          "ERROR: The system was unable to find the specified registry key"
        )
      ) {
        console.log(`  ✅ 注册表项已清理: ${key}`);
      } else {
        console.log(`  ⚠️ 检查注册表项失败: ${key} - ${error.message}`);
      }
    }
  }
}

// 检查临时文件清理情况
async function checkTempFilesCleanup() {
  const tempDirs = [
    path.join(os.tmpdir(), "augment-*"),
    path.join(os.tmpdir(), "cursor-*"),
    path.join(os.homedir(), "AppData", "Local", "Temp", "augment-*"),
  ];

  for (const tempPattern of tempDirs) {
    try {
      const glob = require("glob");
      const files = glob.sync(tempPattern);
      if (files.length === 0) {
        console.log(`  ✅ 临时文件已清理: ${tempPattern}`);
      } else {
        console.log(
          `  ⚠️ 仍有临时文件: ${tempPattern} (${files.length}个文件)`
        );
      }
    } catch (error) {
      console.log(`  ⚠️ 检查临时文件失败: ${tempPattern} - ${error.message}`);
    }
  }
}

// 运行测试
if (require.main === module) {
  testCleanup();
}

module.exports = { testCleanup };
