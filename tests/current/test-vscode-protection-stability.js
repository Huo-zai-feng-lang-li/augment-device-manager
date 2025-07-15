const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { EnhancedDeviceGuardian } = require("../../modules/desktop-client/src/enhanced-device-guardian");

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 测试VSCode防护稳定性 - 验证ID不会循环变化
 */
async function testVSCodeProtectionStability() {
  console.log("🧪 测试VSCode防护稳定性");
  console.log("=".repeat(50));

  const guardian = new EnhancedDeviceGuardian();
  const userHome = os.homedir();
  const vscodeStoragePath = path.join(
    userHome,
    "AppData",
    "Roaming",
    "Code",
    "User",
    "globalStorage",
    "storage.json"
  );

  try {
    // 1. 准备测试环境
    console.log("\n1️⃣ 准备测试环境...");
    await fs.ensureDir(path.dirname(vscodeStoragePath));
    
    const targetDeviceId = "stable-test-device-id-99999";
    const initialData = {
      "telemetry.devDeviceId": targetDeviceId,
      "telemetry.machineId": "test-machine-id",
      "telemetry.sessionCount": 1
    };
    await fs.writeJson(vscodeStoragePath, initialData, { spaces: 2 });
    console.log("✅ 创建初始storage.json");

    // 2. 启动守护进程
    console.log("\n2️⃣ 启动VSCode守护进程...");
    const startResult = await guardian.startGuarding(targetDeviceId, {
      selectedIDE: "vscode"
    });
    
    if (!startResult.success) {
      throw new Error(`启动守护进程失败: ${startResult.message}`);
    }
    console.log("✅ 守护进程已启动");
    console.log(`📍 目标设备ID: ${targetDeviceId}`);
    console.log(`⏱️ 防抖时间: ${guardian.config.fileWatchDebounce}ms`);

    // 3. 模拟VSCode多次尝试修改设备ID
    console.log("\n3️⃣ 模拟VSCode尝试修改设备ID...");
    const modificationAttempts = 5;
    let interceptCount = 0;
    
    for (let i = 1; i <= modificationAttempts; i++) {
      console.log(`\n尝试 ${i}/${modificationAttempts}:`);
      
      // 模拟VSCode创建临时文件
      const tempFileName = `storage.json.vsctmp-${Date.now()}`;
      const tempFilePath = path.join(path.dirname(vscodeStoragePath), tempFileName);
      
      const tempData = {
        "telemetry.devDeviceId": `vscode-attempt-${i}-${Date.now()}`,
        "telemetry.machineId": "test-machine-id",
        "telemetry.sessionCount": i + 1
      };
      
      // 写入临时文件
      await fs.writeJson(tempFilePath, tempData, { spaces: 2 });
      console.log(`📝 创建临时文件: ${tempFileName}`);
      
      // 等待防护系统响应
      await sleep(200);
      
      // 检查临时文件是否被处理
      if (await fs.pathExists(tempFilePath)) {
        // 读取临时文件内容
        const processedData = await fs.readJson(tempFilePath);
        if (processedData["telemetry.devDeviceId"] === targetDeviceId) {
          console.log("✅ 临时文件已被拦截并修正");
          interceptCount++;
        }
        
        // 模拟VSCode的行为：替换原文件
        await fs.move(tempFilePath, vscodeStoragePath, { overwrite: true });
        console.log("📄 临时文件已替换原文件");
      }
      
      // 等待系统稳定
      await sleep(300);
    }

    // 4. 验证最终状态
    console.log("\n4️⃣ 验证最终状态...");
    const finalData = await fs.readJson(vscodeStoragePath);
    const finalDeviceId = finalData["telemetry.devDeviceId"];
    
    console.log(`最终设备ID: ${finalDeviceId}`);
    console.log(`拦截次数: ${interceptCount}/${modificationAttempts}`);
    
    // 5. 监控一段时间，确保没有循环变化
    console.log("\n5️⃣ 监控稳定性（5秒）...");
    const startTime = Date.now();
    let changeCount = 0;
    let lastId = finalDeviceId;
    
    const checkInterval = setInterval(async () => {
      try {
        const currentData = await fs.readJson(vscodeStoragePath);
        const currentId = currentData["telemetry.devDeviceId"];
        
        if (currentId !== lastId) {
          changeCount++;
          console.log(`⚠️ 检测到ID变化 (${changeCount}): ${lastId} -> ${currentId}`);
          lastId = currentId;
        }
      } catch (error) {
        // 忽略读取错误
      }
    }, 500);

    // 等待5秒
    await sleep(5000);
    clearInterval(checkInterval);
    
    const monitorDuration = (Date.now() - startTime) / 1000;
    console.log(`\n监控时长: ${monitorDuration}秒`);
    console.log(`ID变化次数: ${changeCount}`);

    // 6. 获取守护进程状态
    console.log("\n6️⃣ 守护进程状态:");
    const status = await guardian.getStatus();
    console.log(`  - 正在守护: ${status.isGuarding}`);
    console.log(`  - 选择的IDE: ${status.selectedIDE}`);
    console.log(`  - 拦截次数: ${status.stats.interceptedAttempts}`);
    console.log(`  - 恢复次数: ${status.stats.protectionRestored}`);

    // 7. 停止守护进程
    console.log("\n7️⃣ 停止守护进程...");
    await guardian.stopGuarding();
    console.log("✅ 守护进程已停止");

    // 测试结果判断
    console.log("\n" + "=".repeat(50));
    if (finalDeviceId === targetDeviceId && changeCount === 0) {
      console.log("✅ 测试通过！VSCode防护稳定，ID没有循环变化。");
    } else {
      console.log("❌ 测试失败！");
      if (finalDeviceId !== targetDeviceId) {
        console.log("  - 最终ID与目标ID不匹配");
      }
      if (changeCount > 0) {
        console.log(`  - 监控期间检测到${changeCount}次ID变化`);
      }
    }

  } catch (error) {
    console.error("❌ 测试过程中出错:", error);
    
    // 确保停止守护进程
    try {
      await guardian.stopGuarding();
    } catch (e) {
      // 忽略停止错误
    }
  }
}

// 运行测试
(async () => {
  await testVSCodeProtectionStability();
  process.exit(0);
})();