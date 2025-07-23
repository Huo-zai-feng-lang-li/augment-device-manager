#!/usr/bin/env node

/**
 * 环境检测脚本
 * 检查环境变量和网络连通性
 */

const { spawn } = require('child_process');
const fetch = require('node-fetch');

console.log("🔍 环境检测");
console.log("=".repeat(50));

async function checkEnvironment() {
  console.log("\n📋 检测项目:");
  console.log("1. 环境变量配置");
  console.log("2. 网络连通性");
  console.log("3. GitHub访问");
  console.log("4. ngrok状态");
  
  // 1. 检查环境变量
  console.log("\n🔧 1. 环境变量检测...");
  await checkEnvironmentVariables();
  
  // 2. 检查网络连通性
  console.log("\n🌐 2. 网络连通性检测...");
  await checkNetworkConnectivity();
  
  // 3. 检查GitHub访问
  console.log("\n🐙 3. GitHub访问检测...");
  await checkGitHubAccess();
  
  // 4. 检查ngrok状态
  console.log("\n🔗 4. ngrok状态检测...");
  await checkNgrokStatus();
  
  console.log("\n" + "=".repeat(50));
  console.log("🎯 检测完成");
}

async function checkEnvironmentVariables() {
  // 检查当前进程环境变量
  const processToken = process.env.GITHUB_TOKEN;
  console.log(`📝 进程环境变量: ${processToken ? '✅ 已设置' : '❌ 未设置'}`);
  
  if (processToken) {
    console.log(`   Token: ${processToken.substring(0, 15)}...`);
  }
  
  // 检查系统环境变量（Windows）
  if (process.platform === 'win32') {
    try {
      const result = await runCommand('echo %GITHUB_TOKEN%');
      const systemToken = result.trim();
      
      if (systemToken && systemToken !== '%GITHUB_TOKEN%') {
        console.log(`🖥️ 系统环境变量: ✅ 已设置`);
        console.log(`   Token: ${systemToken.substring(0, 15)}...`);
      } else {
        console.log(`🖥️ 系统环境变量: ❌ 未设置`);
        console.log("💡 建议: 重启终端或重新设置环境变量");
      }
    } catch (error) {
      console.log(`🖥️ 系统环境变量: ❌ 检测失败`);
    }
  }
  
  // 检查用户环境变量
  try {
    const result = await runCommand('reg query "HKCU\\Environment" /v GITHUB_TOKEN 2>nul');
    if (result.includes('GITHUB_TOKEN')) {
      console.log(`👤 用户环境变量: ✅ 已设置`);
    } else {
      console.log(`👤 用户环境变量: ❌ 未设置`);
    }
  } catch (error) {
    console.log(`👤 用户环境变量: ❓ 无法检测`);
  }
}

async function checkNetworkConnectivity() {
  const testUrls = [
    { name: '百度', url: 'https://www.baidu.com', timeout: 3000 },
    { name: '谷歌', url: 'https://www.google.com', timeout: 3000 },
    { name: '本地回环', url: 'http://localhost', timeout: 1000 }
  ];
  
  for (const test of testUrls) {
    try {
      const response = await fetch(test.url, { timeout: test.timeout });
      console.log(`🌐 ${test.name}: ✅ 可访问 (${response.status})`);
    } catch (error) {
      console.log(`🌐 ${test.name}: ❌ 不可访问 (${error.message})`);
    }
  }
}

async function checkGitHubAccess() {
  const githubTests = [
    { name: 'GitHub主站', url: 'https://github.com' },
    { name: 'GitHub API', url: 'https://api.github.com' },
    { name: 'GitHub Raw', url: 'https://raw.githubusercontent.com' },
    { name: '项目配置', url: 'https://raw.githubusercontent.com/Huo-zai-feng-lang-li/augment-device-manager/main/server-config.json' }
  ];
  
  for (const test of githubTests) {
    try {
      const response = await fetch(test.url, { 
        timeout: 5000,
        headers: { 'User-Agent': 'Augment-Environment-Check' }
      });
      console.log(`🐙 ${test.name}: ✅ 可访问 (${response.status})`);
      
      if (test.name === '项目配置' && response.ok) {
        const config = await response.json();
        console.log(`   📄 配置内容: ${config.server?.host || '未找到服务器配置'}`);
      }
    } catch (error) {
      console.log(`🐙 ${test.name}: ❌ 不可访问 (${error.message})`);
      
      if (test.name === 'GitHub主站') {
        console.log("   💡 可能的解决方案:");
        console.log("      - 使用VPN或代理");
        console.log("      - 修改DNS设置 (8.8.8.8, 1.1.1.1)");
        console.log("      - 检查防火墙设置");
      }
    }
  }
}

async function checkNgrokStatus() {
  try {
    // 检查ngrok API
    const response = await fetch('http://localhost:4040/api/tunnels', { timeout: 3000 });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`🔗 ngrok状态: ✅ 运行中`);
      console.log(`   📊 隧道数量: ${data.tunnels?.length || 0}`);
      
      const httpsTunnel = data.tunnels?.find(t => t.proto === 'https');
      if (httpsTunnel) {
        const url = new URL(httpsTunnel.public_url);
        console.log(`   🌐 HTTPS地址: ${url.hostname}`);
        console.log(`   🔗 完整URL: ${httpsTunnel.public_url}`);
        
        // 测试ngrok地址是否可访问
        try {
          const testResponse = await fetch(`${httpsTunnel.public_url}/api/health`, {
            timeout: 5000,
            headers: { 'ngrok-skip-browser-warning': 'true' }
          });
          console.log(`   🏥 健康检查: ${testResponse.ok ? '✅ 正常' : '❌ 异常'}`);
        } catch (error) {
          console.log(`   🏥 健康检查: ❌ 失败 (${error.message})`);
        }
      } else {
        console.log(`   ⚠️ 未找到HTTPS隧道`);
      }
    } else {
      console.log(`🔗 ngrok状态: ❌ API访问失败 (${response.status})`);
    }
  } catch (error) {
    console.log(`🔗 ngrok状态: ❌ 未运行 (${error.message})`);
    console.log("   💡 启动ngrok: npm run server:start");
  }
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    const process = spawn('cmd', ['/c', command], { shell: true });
    let output = '';
    
    process.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Command failed with code ${code}: ${output}`));
      }
    });
    
    process.on('error', reject);
  });
}

// 运行检测
if (require.main === module) {
  checkEnvironment().catch(console.error);
}

module.exports = { checkEnvironment };
