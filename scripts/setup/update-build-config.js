#!/usr/bin/env node

/**
 * 自动更新打包配置脚本
 * 从GitHub获取最新的ngrok地址并更新打包配置
 */

const fs = require("fs-extra");
const path = require("path");
const https = require("https");

// 简单的fetch实现
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          json: () => Promise.resolve(JSON.parse(data)),
          text: () => Promise.resolve(data),
        });
      });
    });

    req.on("error", reject);
    req.setTimeout(options.timeout || 10000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

// GitHub配置
const GITHUB_CONFIG = {
  owner: "Huo-zai-feng-lang-li",
  repo: "augment-device-manager",
  branch: "main",
  configFile: "server-config.json",
};

async function updateBuildConfig() {
  try {
    console.log("🔄 自动更新打包配置...");
    console.log("========================");

    // 1. 从GitHub获取最新配置
    console.log("📥 从GitHub获取最新服务器配置...");
    const latestConfig = await fetchLatestConfig();

    if (!latestConfig) {
      console.log("❌ 无法获取最新配置，使用本地配置");
      return false;
    }

    const ngrokHost = latestConfig.server.host;
    console.log(`✅ 获取到最新ngrok地址: ${ngrokHost}`);

    // 2. 更新客户端配置文件
    console.log("📝 更新客户端配置文件...");
    await updateClientConfig(latestConfig);

    // 3. 更新打包配置
    console.log("📦 更新打包配置...");
    await updatePackageConfig(ngrokHost);

    console.log("");
    console.log("🎉 配置更新完成！");
    console.log(`📡 当前ngrok地址: ${ngrokHost}`);
    console.log("💡 现在可以运行 npm run build 进行打包");

    return true;
  } catch (error) {
    console.error("❌ 更新配置失败:", error.message);
    return false;
  }
}

// 从GitHub获取最新配置
async function fetchLatestConfig() {
  const urls = [
    `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.configFile}`,
    `https://cdn.jsdelivr.net/gh/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}@${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.configFile}`,
  ];

  for (const url of urls) {
    try {
      console.log(`   尝试: ${url}`);
      const response = await fetch(url, { timeout: 10000 });

      if (response.ok) {
        const config = await response.json();
        console.log(`   ✅ 成功获取配置`);
        return config;
      }
    } catch (error) {
      console.log(`   ❌ 失败: ${error.message}`);
    }
  }

  return null;
}

// 更新客户端配置文件
async function updateClientConfig(config) {
  const configPath = path.join(
    __dirname,
    "../../modules/desktop-client/src/config.js"
  );

  try {
    let content = await fs.readFile(configPath, "utf8");

    // 使用正则表达式替换生产环境的host配置
    const hostRegex = /host:\s*"[^"]+\.ngrok-free\.app"/;
    const newHost = `host: "${config.server.host}"`;

    if (hostRegex.test(content)) {
      content = content.replace(hostRegex, newHost);
      await fs.writeFile(configPath, content, "utf8");
      console.log("   ✅ 客户端配置已更新");
    } else {
      console.log("   ⚠️ 未找到ngrok配置模式，请手动检查");
    }
  } catch (error) {
    console.log(`   ❌ 更新客户端配置失败: ${error.message}`);
  }
}

// 更新package.json中的发布配置
async function updatePackageConfig(ngrokHost) {
  const packagePath = path.join(
    __dirname,
    "../../modules/desktop-client/package.json"
  );

  try {
    const packageJson = await fs.readJson(packagePath);

    // 确保发布配置正确
    if (packageJson.build && packageJson.build.publish) {
      packageJson.build.publish.owner = GITHUB_CONFIG.owner;
      packageJson.build.publish.repo = GITHUB_CONFIG.repo;

      await fs.writeJson(packagePath, packageJson, { spaces: 2 });
      console.log("   ✅ package.json发布配置已更新");
    }
  } catch (error) {
    console.log(`   ❌ 更新package.json失败: ${error.message}`);
  }
}

// 显示当前配置状态
async function showCurrentStatus() {
  console.log("\n📊 当前配置状态:");
  console.log("================");

  try {
    // 检查本地配置
    const configPath = path.join(__dirname, "../../server-config.json");
    if (await fs.pathExists(configPath)) {
      const localConfig = await fs.readJson(configPath);
      console.log(`📍 本地配置: ${localConfig.server.host}`);
    }

    // 检查客户端配置
    const clientConfigPath = path.join(
      __dirname,
      "../../modules/desktop-client/src/config.js"
    );
    const clientContent = await fs.readFile(clientConfigPath, "utf8");
    const hostMatch = clientContent.match(/host:\s*"([^"]+\.ngrok-free\.app)"/);
    if (hostMatch) {
      console.log(`📱 客户端配置: ${hostMatch[1]}`);
    }

    // 检查GitHub配置
    console.log("🐙 GitHub配置: 正在检查...");
    const githubConfig = await fetchLatestConfig();
    if (githubConfig) {
      console.log(`🌐 GitHub配置: ${githubConfig.server.host}`);
    }
  } catch (error) {
    console.log(`❌ 检查配置状态失败: ${error.message}`);
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--status") || args.includes("-s")) {
    await showCurrentStatus();
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log("🔧 打包配置更新工具");
    console.log("==================");
    console.log("");
    console.log("用法:");
    console.log("  node update-build-config.js          # 更新配置");
    console.log("  node update-build-config.js --status # 显示当前状态");
    console.log("  node update-build-config.js --help   # 显示帮助");
    console.log("");
    return;
  }

  await updateBuildConfig();
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { updateBuildConfig, showCurrentStatus };
