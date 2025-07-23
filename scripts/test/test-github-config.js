#!/usr/bin/env node

/**
 * GitHub配置测试脚本
 * 测试GitHub Token和自动提交功能
 */

const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

console.log("🧪 GitHub配置测试");
console.log("=".repeat(50));

// GitHub配置
const GITHUB_CONFIG = {
  owner: "Huo-zai-feng-lang-li",
  repo: "augment-device-manager",
  branch: "main",
  configFile: "server-config.json",
  token: process.env.GITHUB_TOKEN, // GitHub Token - 必须通过环境变量设置
};

async function testGitHubConfig() {
  try {
    console.log("\n1. 🔍 检查环境变量...");

    if (!GITHUB_CONFIG.token) {
      console.log("❌ GITHUB_TOKEN 环境变量未设置");
      console.log("💡 请运行: node scripts/setup/setup-tokens.js");
      return false;
    }

    console.log(`✅ GitHub Token: ${GITHUB_CONFIG.token.substring(0, 10)}...`);

    console.log("\n2. 🔗 测试GitHub API连接...");

    // 测试GitHub API
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${GITHUB_CONFIG.token}`,
        "User-Agent": "Augment-Config-Tester",
      },
    });

    if (!userResponse.ok) {
      console.log(
        `❌ GitHub API测试失败: ${userResponse.status} ${userResponse.statusText}`
      );
      return false;
    }

    const userData = await userResponse.json();
    console.log(`✅ GitHub用户: ${userData.login}`);

    console.log("\n3. 📁 检查仓库访问权限...");

    // 测试仓库访问
    const repoResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`,
      {
        headers: {
          Authorization: `token ${GITHUB_CONFIG.token}`,
          "User-Agent": "Augment-Config-Tester",
        },
      }
    );

    if (!repoResponse.ok) {
      console.log(
        `❌ 仓库访问失败: ${repoResponse.status} ${repoResponse.statusText}`
      );
      console.log(
        `💡 请检查仓库 ${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo} 是否存在`
      );
      return false;
    }

    const repoData = await repoResponse.json();
    console.log(`✅ 仓库访问成功: ${repoData.full_name}`);

    console.log("\n4. 📝 测试配置文件创建...");

    // 创建测试配置
    const testConfig = {
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      server: {
        host: "test.ngrok-free.app",
        port: 443,
        protocol: "https",
      },
      metadata: {
        buildTime: new Date().toISOString(),
        ngrokUrl: "https://test.ngrok-free.app",
        status: "test",
        autoUpdated: true,
      },
    };

    // 尝试创建/更新配置文件
    const success = await updateGitHubConfig(testConfig);

    if (success) {
      console.log("✅ 配置文件测试成功");
      console.log(
        `📁 文件位置: https://github.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/blob/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.configFile}`
      );
    } else {
      console.log("❌ 配置文件测试失败");
      return false;
    }

    console.log("\n🎉 所有测试通过！");
    console.log("💡 GitHub自动配置功能已就绪");

    return true;
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
    return false;
  }
}

async function updateGitHubConfig(config) {
  const { owner, repo, branch, configFile, token } = GITHUB_CONFIG;

  try {
    // 获取当前文件内容（如果存在）
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${configFile}`;
    const getResponse = await fetch(getUrl, {
      headers: {
        Authorization: `token ${token}`,
        "User-Agent": "Augment-Config-Tester",
      },
    });

    let sha = null;
    if (getResponse.ok) {
      const fileData = await getResponse.json();
      sha = fileData.sha;
      console.log("📄 找到现有配置文件，将更新");
    } else {
      console.log("📄 配置文件不存在，将创建新文件");
    }

    // 更新文件
    const updateUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${configFile}`;
    const content = Buffer.from(JSON.stringify(config, null, 2)).toString(
      "base64"
    );

    const updateResponse = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "Augment-Config-Tester",
      },
      body: JSON.stringify({
        message: `Test config update: ${config.server.host}`,
        content: content,
        branch: branch,
        ...(sha && { sha }),
      }),
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.text();
      console.log(
        `❌ 文件更新失败: ${updateResponse.status} ${updateResponse.statusText}`
      );
      console.log(`📄 错误详情: ${errorData}`);
      return false;
    }

    const updateData = await updateResponse.json();
    console.log(`✅ 文件更新成功: ${updateData.commit.sha.substring(0, 7)}`);
    return true;
  } catch (error) {
    console.log(`❌ 更新配置失败: ${error.message}`);
    return false;
  }
}

// 运行测试
if (require.main === module) {
  testGitHubConfig().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testGitHubConfig };
