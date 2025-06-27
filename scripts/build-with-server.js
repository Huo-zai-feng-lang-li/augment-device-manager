#!/usr/bin/env node

/**
 * 一键打包脚本 - 自动配置服务器地址并打包
 * 使用方法：node build-with-server.js [ngrok地址]
 */

const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");

console.log("🚀 一键打包脚本 - 自动配置远程控制");
console.log("=====================================");

async function main() {
  try {
    const args = process.argv.slice(2);
    let serverUrl = args[0];

    // 如果没有提供服务器地址，尝试自动获取ngrok地址
    if (!serverUrl) {
      console.log("🔍 未提供服务器地址，尝试自动检测ngrok...");
      serverUrl = await detectNgrokUrl();
    }

    if (!serverUrl) {
      console.log("❌ 无法检测到ngrok地址，请手动提供：");
      console.log("   node build-with-server.js your-ngrok-url.ngrok.io");
      console.log("");
      console.log("💡 或者先启动ngrok：");
      console.log("   1. npm run server-only");
      console.log("   2. ngrok http 3002");
      console.log("   3. 复制ngrok地址重新运行此脚本");
      process.exit(1);
    }

    console.log(`✅ 使用服务器地址: ${serverUrl}`);

    // 解析地址信息
    const { host, port, protocol } = parseServerUrl(serverUrl);

    // 1. 备份原始配置
    await backupOriginalConfig();

    // 2. 设置服务器地址
    await setDefaultServer(host, port, protocol);

    // 3. 打包客户端
    await buildClient();

    // 4. 恢复原始配置
    await restoreOriginalConfig();

    console.log("");
    console.log("🎉 打包完成！");
    console.log("📦 安装包位置: desktop-client/exe-output/");
    console.log("📤 现在可以直接分发给用户，无需任何配置！");
    console.log("🌐 管理界面: " + `${protocol}://${host}:${port}`);
  } catch (error) {
    console.error("❌ 打包失败:", error.message);

    // 确保恢复原始配置
    try {
      await restoreOriginalConfig();
    } catch (restoreError) {
      console.error("⚠️ 恢复配置失败:", restoreError.message);
    }

    process.exit(1);
  }
}

// 自动检测ngrok地址
async function detectNgrokUrl() {
  try {
    console.log("🔍 正在检测ngrok地址...");

    // 尝试访问ngrok API
    const response = await fetch("http://localhost:4040/api/tunnels");
    if (response.ok) {
      const data = await response.json();
      const httpsTunnel = data.tunnels.find((t) => t.proto === "https");
      if (httpsTunnel) {
        const url = new URL(httpsTunnel.public_url);
        return url.hostname;
      }
    }
  } catch (error) {
    // ngrok API不可用，继续其他检测方法
  }

  return null;
}

// 解析服务器地址
function parseServerUrl(serverUrl) {
  // 移除协议前缀
  const cleanUrl = serverUrl.replace(/^https?:\/\//, "");

  let host, port, protocol;

  if (cleanUrl.includes("ngrok.io")) {
    host = cleanUrl;
    port = 443;
    protocol = "https";
  } else if (cleanUrl.includes(":")) {
    [host, port] = cleanUrl.split(":");
    port = parseInt(port);
    protocol = port === 443 ? "https" : "http";
  } else {
    host = cleanUrl;
    port = 3002;
    protocol = "http";
  }

  return { host, port, protocol };
}

// 备份原始配置
async function backupOriginalConfig() {
  const configPath = path.join(__dirname, "../desktop-client/src/config.js");
  const backupPath = path.join(
    __dirname,
    "../desktop-client/src/config.js.backup"
  );

  const content = await fs.readFile(configPath, "utf8");
  await fs.writeFile(backupPath, content, "utf8");
  console.log("📋 已备份原始配置");
}

// 恢复原始配置
async function restoreOriginalConfig() {
  const configPath = path.join(__dirname, "../desktop-client/src/config.js");
  const backupPath = path.join(
    __dirname,
    "../desktop-client/src/config.js.backup"
  );

  try {
    const content = await fs.readFile(backupPath, "utf8");
    await fs.writeFile(configPath, content, "utf8");
    await fs.unlink(backupPath);
    console.log("🔄 已恢复原始配置");
  } catch (error) {
    // 备份文件不存在，忽略
  }
}

// 设置默认服务器
async function setDefaultServer(host, port, protocol) {
  const configPath = path.join(__dirname, "../desktop-client/src/config.js");

  let content = await fs.readFile(configPath, "utf8");

  const newConfig = `// 默认配置
const DEFAULT_CONFIG = {
  server: {
    host: "${host}", // 预设服务器地址
    port: ${port}, // 预设端口
    protocol: "${protocol}", // 预设协议
  },
  client: {
    autoConnect: true,
    verifyInterval: 5 * 60 * 1000, // 5分钟
    reconnectDelay: 5000, // 5秒
  },
};`;

  const configRegex = /\/\/ 默认配置\s*\nconst DEFAULT_CONFIG = \{[\s\S]*?\};/;

  if (configRegex.test(content)) {
    content = content.replace(configRegex, newConfig);
    await fs.writeFile(configPath, content, "utf8");
    console.log(`⚙️ 已设置服务器: ${protocol}://${host}:${port}`);
  } else {
    throw new Error("无法找到配置部分");
  }
}

// 打包客户端
async function buildClient() {
  console.log("🔨 正在打包客户端...");

  return new Promise((resolve, reject) => {
    const buildProcess = spawn("npm", ["run", "build"], {
      cwd: path.join(__dirname, "../desktop-client"),
      stdio: "inherit",
      shell: true,
    });

    buildProcess.on("close", (code) => {
      if (code === 0) {
        console.log("✅ 客户端打包完成");
        resolve();
      } else {
        reject(new Error(`打包失败，退出码: ${code}`));
      }
    });

    buildProcess.on("error", (error) => {
      reject(error);
    });
  });
}

// 运行主函数
main().catch(console.error);
