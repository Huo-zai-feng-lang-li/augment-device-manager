const fs = require("fs-extra");
const path = require("path");
const os = require("os");

/**
 * 测试VSCode智能清理功能是否能正确清理Augment扩展数据
 */
async function testVSCodeAugmentCleanup() {
  console.log("🧪 测试VSCode智能清理 - Augment扩展数据清理");
  console.log("=".repeat(50));

  const userHome = os.homedir();
  const vscodeGlobalStorage = path.join(
    userHome,
    "AppData",
    "Roaming",
    "Code",
    "User",
    "globalStorage"
  );
  const augmentStoragePath = path.join(vscodeGlobalStorage, "augment.vscode-augment");

  try {
    // 1. 准备测试环境
    console.log("\n1️⃣ 准备测试环境...");
    
    // 创建模拟的Augment身份文件
    await fs.ensureDir(augmentStoragePath);
    
    const testIdentityFiles = [
      "user-id-12345.json",
      "session-token-abc.json",
      "auth-credentials.json",
      "device-fingerprint.json",
      "cache-userdata.json",
      "config-settings.json", // 这个不应该被清理
      "mcp-server-list.json"  // 这个不应该被清理
    ];

    for (const file of testIdentityFiles) {
      await fs.writeJson(path.join(augmentStoragePath, file), { test: true });
    }
    
    console.log("✅ 创建了模拟的Augment身份文件");

    // 2. 列出清理前的文件
    console.log("\n2️⃣ 清理前的文件列表:");
    const filesBefore = await fs.readdir(augmentStoragePath);
    filesBefore.forEach(file => console.log(`  - ${file}`));
    console.log(`总文件数: ${filesBefore.length}`);

    // 3. 导入DeviceManager并执行VSCode智能清理
    console.log("\n3️⃣ 执行VSCode智能清理...");
    const DeviceManager = require("../../modules/desktop-client/src/device-manager");
    const deviceManager = new DeviceManager();
    
    const results = {
      success: true,
      actions: [],
      errors: []
    };
    
    const variant = {
      name: "stable",
      globalStorage: vscodeGlobalStorage,
      stateDb: path.join(vscodeGlobalStorage, "state.vscdb"),
      settingsJson: path.join(
        userHome,
        "AppData",
        "Roaming",
        "Code",
        "User",
        "settings.json"
      )
    };

    // 执行智能清理
    await deviceManager.performVSCodeIntelligentCleanup(results, variant, {});

    // 4. 显示清理结果
    console.log("\n4️⃣ 清理操作日志:");
    results.actions.forEach(action => console.log(`  ${action}`));
    
    if (results.errors.length > 0) {
      console.log("\n❌ 错误信息:");
      results.errors.forEach(error => console.log(`  ${error}`));
    }

    // 5. 列出清理后的文件
    console.log("\n5️⃣ 清理后的文件列表:");
    if (await fs.pathExists(augmentStoragePath)) {
      const filesAfter = await fs.readdir(augmentStoragePath);
      filesAfter.forEach(file => console.log(`  - ${file}`));
      console.log(`总文件数: ${filesAfter.length}`);

      // 验证哪些文件被清理了
      console.log("\n6️⃣ 清理验证:");
      const identityFilesRemoved = testIdentityFiles.filter(file => {
        const shouldBeKept = file.includes("config") || file.includes("settings") || file.includes("mcp");
        const exists = filesAfter.includes(file);
        return !exists && !shouldBeKept;
      });

      const configFilesKept = testIdentityFiles.filter(file => {
        const shouldBeKept = file.includes("config") || file.includes("settings") || file.includes("mcp");
        const exists = filesAfter.includes(file);
        return exists && shouldBeKept;
      });

      console.log(`✅ 已清理的身份文件 (${identityFilesRemoved.length}):`);
      identityFilesRemoved.forEach(file => console.log(`  - ${file}`));
      
      console.log(`\n✅ 保留的配置文件 (${configFilesKept.length}):`);
      configFilesKept.forEach(file => console.log(`  - ${file}`));

      // 测试结果判断
      const shouldBeRemoved = ["user-id-12345.json", "session-token-abc.json", "auth-credentials.json", "device-fingerprint.json", "cache-userdata.json"];
      const shouldBeKept = ["config-settings.json", "mcp-server-list.json"];
      
      const allRemovedCorrectly = shouldBeRemoved.every(file => !filesAfter.includes(file));
      const allKeptCorrectly = shouldBeKept.every(file => filesAfter.includes(file));

      if (allRemovedCorrectly && allKeptCorrectly) {
        console.log("\n✅ 测试通过！VSCode智能清理正确清理了Augment身份文件，并保留了配置文件。");
      } else {
        console.log("\n❌ 测试失败！清理结果不符合预期。");
      }
    } else {
      console.log("  Augment存储目录已被完全删除");
    }

  } catch (error) {
    console.error("\n❌ 测试过程中出错:", error);
  } finally {
    // 清理测试文件
    console.log("\n7️⃣ 清理测试环境...");
    if (await fs.pathExists(augmentStoragePath)) {
      await fs.remove(augmentStoragePath);
      console.log("✅ 测试文件已清理");
    }
  }
}

// 运行测试
(async () => {
  await testVSCodeAugmentCleanup();
  process.exit(0);
})();