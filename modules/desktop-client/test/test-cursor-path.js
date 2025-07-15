const DeviceManager = require("../src/device-manager");
const fs = require("fs-extra");

async function testCursorPathDetection() {
  console.log("🔍 测试Cursor IDE路径检测功能...\n");

  try {
    const deviceManager = new DeviceManager();

    console.log("📋 测试多种检测方法:");
    console.log("1. where命令检测");
    console.log("2. 注册表检测");
    console.log("3. 常见路径检测");
    console.log("4. 多驱动器搜索\n");

    console.log("🔍 开始检测...");
    const cursorPath = await deviceManager.findCursorPath();

    if (cursorPath) {
      console.log(`✅ 成功找到Cursor IDE路径: ${cursorPath}`);

      // 验证文件是否真的存在
      if (await fs.pathExists(cursorPath)) {
        console.log("✅ 路径验证成功，文件确实存在");

        // 获取文件信息
        const stats = await fs.stat(cursorPath);
        console.log(`📊 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`📅 修改时间: ${stats.mtime.toLocaleString()}`);
      } else {
        console.log("❌ 路径验证失败，文件不存在");
      }
    } else {
      console.log("❌ 未找到Cursor IDE安装路径");

      console.log("\n🔍 手动检查常见位置:");
      const manualPaths = [
        "C:\\Program Files\\Cursor\\Cursor.exe",
        "C:\\Program Files (x86)\\Cursor\\Cursor.exe",
        "D:\\cursor\\Cursor.exe",
        require("path").join(
          require("os").homedir(),
          "AppData",
          "Local",
          "Programs",
          "cursor",
          "Cursor.exe"
        ),
      ];

      for (const manualPath of manualPaths) {
        const exists = await fs.pathExists(manualPath);
        console.log(`  ${exists ? "✅" : "❌"} ${manualPath}`);
      }
    }

    // 测试where命令
    console.log("\n🔍 测试where命令:");
    try {
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);

      const { stdout } = await execAsync("where cursor");
      console.log("✅ where cursor 输出:");
      stdout
        .trim()
        .split("\n")
        .forEach((line) => {
          console.log(`  📄 ${line.trim()}`);
        });
    } catch (error) {
      console.log("❌ where命令失败:", error.message);
    }

    console.log("\n🎯 检测完成！");
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
    console.error(error.stack);
  }
}

// 运行测试
testCursorPathDetection();
