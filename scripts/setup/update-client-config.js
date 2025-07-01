#!/usr/bin/env node

// 动态更新客户端配置 - 解决ngrok地址变化问题
const fs = require("fs-extra");
const path = require("path");

async function updateClientConfig() {
  console.log("🔄 动态更新客户端配置");
  console.log("======================");
  console.log("");

  try {
    // 1. 读取当前服务器信息
    const serverInfoPath = path.join(__dirname, "../../server-info.json");

    if (!(await fs.pathExists(serverInfoPath))) {
      console.log("❌ 服务器未启动，请先运行: npm run server:start");
      return;
    }

    const serverInfo = await fs.readJson(serverInfoPath);
    const ngrokUrl = serverInfo.ngrokUrl;

    console.log(`📡 检测到当前ngrok地址: ${ngrokUrl}`);

    // 2. 更新客户端配置文件
    const clientConfigPath = path.join(
      __dirname,
      "../../modules/desktop-client/public/server-config.json"
    );

    const newConfig = {
      server: {
        host: ngrokUrl,
        port: 443,
        protocol: "https",
      },
      client: {
        autoConnect: true,
        verifyInterval: 300000,
        reconnectDelay: 5000,
      },
    };

    await fs.writeJson(clientConfigPath, newConfig, { spaces: 2 });
    console.log("✅ 客户端配置已更新");

    // 3. 更新用户配置目录
    const userConfigDir = path.join(
      require("os").homedir(),
      ".augment-device-manager"
    );
    const userConfigPath = path.join(userConfigDir, "server-config.json");

    await fs.ensureDir(userConfigDir);
    await fs.writeJson(userConfigPath, newConfig, { spaces: 2 });
    console.log("✅ 用户配置已更新");

    console.log("");
    console.log("🎯 配置详情:");
    console.log(`   服务器地址: https://${ngrokUrl}`);
    console.log(`   WebSocket: wss://${ngrokUrl}/ws`);
    console.log("");
    console.log("💡 下一步操作:");
    console.log("1. 重新打包客户端: npm run build:remote");
    console.log("2. 分发新的安装包给用户");
    console.log("3. 或者让用户重启现有客户端（如果已安装）");
  } catch (error) {
    console.error("❌ 更新配置失败:", error.message);
  }
}

// 自动监听服务器信息变化
async function watchServerChanges() {
  console.log("👀 监听服务器地址变化...");

  const serverInfoPath = path.join(__dirname, "../../server-info.json");
  let lastNgrokUrl = null;

  setInterval(async () => {
    try {
      if (await fs.pathExists(serverInfoPath)) {
        const serverInfo = await fs.readJson(serverInfoPath);
        const currentNgrokUrl = serverInfo.ngrokUrl;

        if (currentNgrokUrl && currentNgrokUrl !== lastNgrokUrl) {
          console.log(`🔄 检测到地址变化: ${currentNgrokUrl}`);
          lastNgrokUrl = currentNgrokUrl;
          await updateClientConfig();
        }
      }
    } catch (error) {
      // 忽略错误，继续监听
    }
  }, 5000); // 每5秒检查一次
}

// 命令行参数处理
if (process.argv.includes("--watch")) {
  console.log("⚠️ 服务器地址监听功能已禁用");
  console.log("💡 原因: 打包时会自动配置服务器地址，无需实时监听");
  console.log("💡 如需更新配置，请运行: npm run config:update");
  process.exit(0);
} else {
  updateClientConfig().catch(console.error);
}
