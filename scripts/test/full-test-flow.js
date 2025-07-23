#!/usr/bin/env node

/**
 * 完整测试流程脚本
 * 测试整个GitHub自动配置和打包流程
 */

const { spawn } = require('child_process');
const fetch = require("node-fetch");
const path = require('path');

console.log("🚀 完整测试流程");
console.log("=".repeat(50));

async function runFullTest() {
  try {
    console.log("\n📋 测试流程:");
    console.log("1. 检查环境配置");
    console.log("2. 测试GitHub连接");
    console.log("3. 启动服务并获取ngrok地址");
    console.log("4. 自动更新GitHub配置");
    console.log("5. 构建客户端");
    console.log("6. 验证配置文件");
    
    // 步骤1: 检查环境
    console.log("\n🔍 步骤1: 检查环境配置...");
    if (!process.env.GITHUB_TOKEN) {
      console.log("❌ GITHUB_TOKEN 未设置");
      console.log("💡 请先运行: npm run setup:tokens");
      return false;
    }
    console.log("✅ GitHub Token已配置");
    
    // 步骤2: 测试GitHub连接
    console.log("\n🔗 步骤2: 测试GitHub连接...");
    const githubTest = await runScript('test:github');
    if (!githubTest) {
      console.log("❌ GitHub连接测试失败");
      return false;
    }
    console.log("✅ GitHub连接正常");
    
    // 步骤3: 启动服务
    console.log("\n🚀 步骤3: 启动服务...");
    console.log("💡 请在新终端运行: npm run server:start");
    console.log("⏰ 等待30秒让服务启动...");
    await sleep(30000);
    
    // 检查ngrok是否运行
    const ngrokUrl = await getNgrokUrl();
    if (!ngrokUrl) {
      console.log("❌ 未检测到ngrok地址");
      console.log("💡 请确保服务已启动: npm run server:start");
      return false;
    }
    console.log(`✅ 检测到ngrok地址: ${ngrokUrl}`);
    
    // 步骤4: 等待自动更新
    console.log("\n📤 步骤4: 等待自动配置更新...");
    console.log("⏰ 等待60秒让系统自动更新GitHub配置...");
    await sleep(60000);
    
    // 步骤5: 验证GitHub配置
    console.log("\n🔍 步骤5: 验证GitHub配置...");
    const configValid = await verifyGitHubConfig(ngrokUrl);
    if (!configValid) {
      console.log("❌ GitHub配置验证失败");
      return false;
    }
    console.log("✅ GitHub配置验证成功");
    
    // 步骤6: 构建客户端
    console.log("\n📦 步骤6: 构建客户端...");
    const buildSuccess = await runScript('build:github');
    if (!buildSuccess) {
      console.log("❌ 客户端构建失败");
      return false;
    }
    console.log("✅ 客户端构建成功");
    
    console.log("\n🎉 完整测试流程成功！");
    console.log("📁 客户端文件位置: modules/desktop-client/dist/");
    console.log("🌐 GitHub配置: https://github.com/Huo-zai-feng-lang-li/augment-device-manager/blob/main/server-config.json");
    console.log("💡 现在可以分发客户端给用户测试");
    
    return true;
    
  } catch (error) {
    console.error("❌ 测试流程失败:", error.message);
    return false;
  }
}

async function runScript(scriptName) {
  return new Promise((resolve) => {
    console.log(`🔧 运行: npm run ${scriptName}`);
    
    const process = spawn('npm', ['run', scriptName], {
      shell: true,
      stdio: 'inherit'
    });
    
    process.on('close', (code) => {
      resolve(code === 0);
    });
    
    process.on('error', (error) => {
      console.error(`脚本执行错误: ${error.message}`);
      resolve(false);
    });
  });
}

async function getNgrokUrl() {
  try {
    const response = await fetch("http://localhost:4040/api/tunnels", { timeout: 3000 });
    if (!response.ok) return null;

    const data = await response.json();
    const httpsTunnel = data.tunnels?.find(t => t.proto === "https");
    
    if (httpsTunnel) {
      const url = new URL(httpsTunnel.public_url);
      return url.hostname;
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function verifyGitHubConfig(expectedUrl) {
  try {
    const configUrl = "https://raw.githubusercontent.com/Huo-zai-feng-lang-li/augment-device-manager/main/server-config.json";
    
    const response = await fetch(configUrl, { timeout: 10000 });
    if (!response.ok) {
      console.log("❌ 无法获取GitHub配置文件");
      return false;
    }
    
    const config = await response.json();
    
    if (config.server && config.server.host === expectedUrl) {
      console.log(`✅ 配置文件地址匹配: ${expectedUrl}`);
      return true;
    } else {
      console.log(`❌ 配置文件地址不匹配:`);
      console.log(`   期望: ${expectedUrl}`);
      console.log(`   实际: ${config.server?.host || '未找到'}`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ 验证配置失败: ${error.message}`);
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行测试
if (require.main === module) {
  runFullTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runFullTest };
