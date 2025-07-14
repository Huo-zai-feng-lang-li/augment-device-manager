const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 恢复MCP配置文件
async function restoreMCPConfig() {
  console.log("🔄 正在恢复MCP配置...");

  const mcpConfigPath = path.join(
    os.homedir(),
    "AppData",
    "Roaming",
    "Cursor",
    "User",
    "globalStorage",
    "augment.vscode-augment",
    "augment-global-state",
    "mcpServers.json"
  );

  // 检查Cursor设置状态
  await checkCursorSettings();

  // 标准MCP配置
  const mcpConfig = {
    localtime: {
      command: "node",
      args: [
        "C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\@augment\\localtime\\dist\\index.js",
      ],
      env: {},
    },
    context7: {
      command: "npx",
      args: ["-y", "@augment/context7"],
      env: {},
    },
    "edgeone-pages-mcp-server": {
      command: "npx",
      args: ["-y", "@augment/edgeone-pages-mcp-server"],
      env: {},
    },
    playwright: {
      command: "npx",
      args: ["-y", "@augment/playwright"],
      env: {},
    },
    "mcp-server-chart": {
      command: "npx",
      args: ["-y", "@augment/mcp-server-chart"],
      env: {},
    },
    "sequential-thinking": {
      command: "npx",
      args: ["-y", "@augment/sequential-thinking"],
      env: {},
    },
  };

  try {
    // 确保目录存在
    await fs.ensureDir(path.dirname(mcpConfigPath));

    // 写入MCP配置
    await fs.writeJson(mcpConfigPath, mcpConfig, { spaces: 2 });

    console.log("✅ MCP配置已恢复到:", mcpConfigPath);
    console.log("📊 恢复的MCP服务器:");
    Object.keys(mcpConfig).forEach((server) => {
      console.log(`   - ${server}`);
    });

    return true;
  } catch (error) {
    console.error("❌ 恢复MCP配置失败:", error);
    return false;
  }
}

// 运行完整恢复
async function runFullRestore() {
  console.log("🚀 开始完整的Cursor配置恢复...");

  let allSuccess = true;

  // 1. 恢复MCP配置
  const mcpSuccess = await restoreMCPConfig();
  if (!mcpSuccess) allSuccess = false;

  // 2. 恢复基本设置
  const settingsSuccess = await restoreCursorBasicSettings();
  if (!settingsSuccess) allSuccess = false;

  console.log("\n" + "=".repeat(50));
  if (allSuccess) {
    console.log("✅ 完整恢复成功！");
    console.log("📝 建议操作：");
    console.log("   1. 重启Cursor IDE");
    console.log("   2. 检查MCP服务器是否正常工作");
    console.log("   3. 根据需要调整个人设置");
  } else {
    console.log("⚠️ 部分恢复失败，请检查错误信息");
  }
  console.log("=".repeat(50));

  return allSuccess;
}

// 运行恢复
if (require.main === module) {
  runFullRestore().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

// 检查Cursor设置状态
async function checkCursorSettings() {
  console.log("\n📊 检查Cursor设置状态...");

  const settingsPaths = [
    // Cursor用户设置
    path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Cursor",
      "User",
      "settings.json"
    ),
    // Cursor键盘快捷键
    path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Cursor",
      "User",
      "keybindings.json"
    ),
    // Cursor扩展列表
    path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Cursor",
      "User",
      "extensions.json"
    ),
    // Cursor工作区设置
    path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Cursor",
      "User",
      "globalStorage"
    ),
    // Cursor状态数据库
    path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Cursor",
      "User",
      "globalStorage",
      "state.vscdb"
    ),
  ];

  for (const settingsPath of settingsPaths) {
    try {
      if (await fs.pathExists(settingsPath)) {
        const stats = await fs.stat(settingsPath);
        console.log(
          `✅ ${path.basename(settingsPath)}: 存在 (${
            stats.size
          } bytes, 修改时间: ${stats.mtime.toLocaleString()})`
        );

        // 如果是settings.json，显示部分内容
        if (settingsPath.includes("settings.json")) {
          try {
            const settings = await fs.readJson(settingsPath);
            const keyCount = Object.keys(settings).length;
            console.log(`   📝 设置项数量: ${keyCount}`);
            if (keyCount > 0) {
              console.log(
                `   🔧 主要设置: ${Object.keys(settings)
                  .slice(0, 5)
                  .join(", ")}${keyCount > 5 ? "..." : ""}`
              );
            }
          } catch (error) {
            console.log(`   ⚠️ 无法读取设置内容: ${error.message}`);
          }
        }
      } else {
        console.log(`❌ ${path.basename(settingsPath)}: 不存在`);
      }
    } catch (error) {
      console.log(
        `❌ ${path.basename(settingsPath)}: 检查失败 - ${error.message}`
      );
    }
  }
}

// 恢复Cursor基本设置
async function restoreCursorBasicSettings() {
  console.log("\n🔧 恢复Cursor基本设置...");

  const settingsPath = path.join(
    os.homedir(),
    "AppData",
    "Roaming",
    "Cursor",
    "User",
    "settings.json"
  );

  // 基本的Cursor设置
  const basicSettings = {
    "workbench.colorTheme": "Default Dark+",
    "editor.fontSize": 14,
    "editor.fontFamily": "Consolas, 'Courier New', monospace",
    "editor.tabSize": 2,
    "editor.insertSpaces": true,
    "editor.wordWrap": "on",
    "files.autoSave": "afterDelay",
    "files.autoSaveDelay": 1000,
    "terminal.integrated.fontSize": 14,
    "workbench.startupEditor": "welcomePage",
    "extensions.autoUpdate": true,
    "update.mode": "start",
  };

  try {
    // 确保目录存在
    await fs.ensureDir(path.dirname(settingsPath));

    // 检查是否已有设置文件
    let existingSettings = {};
    if (await fs.pathExists(settingsPath)) {
      try {
        existingSettings = await fs.readJson(settingsPath);
        console.log(
          `📄 发现现有设置文件，包含 ${
            Object.keys(existingSettings).length
          } 个设置项`
        );
      } catch (error) {
        console.log(`⚠️ 现有设置文件损坏，将创建新的: ${error.message}`);
      }
    }

    // 合并设置（保留现有设置，添加缺失的基本设置）
    const mergedSettings = { ...basicSettings, ...existingSettings };

    // 写入设置文件
    await fs.writeJson(settingsPath, mergedSettings, { spaces: 2 });

    console.log(`✅ Cursor基本设置已恢复到: ${settingsPath}`);
    console.log(`📊 总设置项数量: ${Object.keys(mergedSettings).length}`);

    return true;
  } catch (error) {
    console.error(`❌ 恢复Cursor基本设置失败: ${error.message}`);
    return false;
  }
}

module.exports = {
  restoreMCPConfig,
  checkCursorSettings,
  restoreCursorBasicSettings,
};
