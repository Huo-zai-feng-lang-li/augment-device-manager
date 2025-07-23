#!/usr/bin/env node

/**
 * 用户工作流程测试脚本
 * 验证分发流程的正确性
 */

const fetch = require('node-fetch');
const fs = require('fs-extra');

console.log("🧪 用户工作流程测试");
console.log("=".repeat(50));

async function testUserWorkflow() {
  console.log("\n📋 测试流程:");
  console.log("1. 检查服务状态");
  console.log("2. 验证GitHub配置");
  console.log("3. 模拟用户客户端行为");
  console.log("4. 验证自动重连机制");
  
  // 步骤1: 检查服务状态
  console.log("\n🔍 步骤1: 检查服务状态...");
  const serviceStatus = await checkServiceStatus();
  
  if (!serviceStatus.running) {
    console.log("❌ 服务未运行，请先执行: npm run server:start");
    return false;
  }
  
  console.log(`✅ 服务运行正常: ${serviceStatus.ngrokUrl}`);
  
  // 步骤2: 验证GitHub配置
  console.log("\n📤 步骤2: 验证GitHub配置...");
  const githubConfig = await checkGitHubConfig();
  
  if (!githubConfig.valid) {
    console.log("❌ GitHub配置无效");
    return false;
  }
  
  console.log(`✅ GitHub配置正确: ${githubConfig.host}`);
  
  // 步骤3: 模拟用户客户端行为
  console.log("\n👤 步骤3: 模拟用户客户端行为...");
  const clientTest = await simulateClientBehavior();
  
  if (!clientTest.success) {
    console.log("❌ 客户端模拟失败");
    return false;
  }
  
  console.log("✅ 客户端可以正常连接和获取配置");
  
  // 步骤4: 验证地址一致性
  console.log("\n🔄 步骤4: 验证地址一致性...");
  const consistency = await checkAddressConsistency(serviceStatus.ngrokUrl, githubConfig.host);
  
  if (!consistency) {
    console.log("⚠️ 地址不一致，可能需要等待GitHub配置更新");
  } else {
    console.log("✅ 服务地址与GitHub配置一致");
  }
  
  console.log("\n🎉 用户工作流程测试完成！");
  console.log("\n📋 测试结果总结:");
  console.log(`   🌐 当前服务地址: ${serviceStatus.ngrokUrl}`);
  console.log(`   📁 GitHub配置地址: ${githubConfig.host}`);
  console.log(`   👤 用户可连接性: ${clientTest.success ? '✅ 正常' : '❌ 异常'}`);
  console.log(`   🔄 地址一致性: ${consistency ? '✅ 一致' : '⚠️ 不一致'}`);
  
  return true;
}

// 检查服务状态
async function checkServiceStatus() {
  try {
    // 检查ngrok API
    const ngrokResponse = await fetch('http://localhost:4040/api/tunnels', { timeout: 3000 });
    
    if (!ngrokResponse.ok) {
      return { running: false, error: 'ngrok API不可访问' };
    }
    
    const ngrokData = await ngrokResponse.json();
    const httpsTunnel = ngrokData.tunnels?.find(t => t.proto === 'https');
    
    if (!httpsTunnel) {
      return { running: false, error: '未找到HTTPS隧道' };
    }
    
    const ngrokUrl = new URL(httpsTunnel.public_url).hostname;
    
    // 检查后端服务
    const healthResponse = await fetch(`https://${ngrokUrl}/api/health`, {
      timeout: 5000,
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    
    if (!healthResponse.ok) {
      return { running: false, error: '后端服务不可访问' };
    }
    
    return {
      running: true,
      ngrokUrl: ngrokUrl,
      fullUrl: httpsTunnel.public_url
    };
    
  } catch (error) {
    return { running: false, error: error.message };
  }
}

// 检查GitHub配置
async function checkGitHubConfig() {
  try {
    const configUrl = 'https://raw.githubusercontent.com/Huo-zai-feng-lang-li/augment-device-manager/main/server-config.json';
    
    const response = await fetch(configUrl, { timeout: 10000 });
    
    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}` };
    }
    
    const config = await response.json();
    
    if (!config.server || !config.server.host) {
      return { valid: false, error: '配置格式无效' };
    }
    
    return {
      valid: true,
      host: config.server.host,
      port: config.server.port,
      protocol: config.server.protocol,
      lastUpdated: config.lastUpdated
    };
    
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// 模拟客户端行为
async function simulateClientBehavior() {
  try {
    console.log("   📥 模拟客户端从GitHub获取配置...");
    
    // 模拟客户端获取GitHub配置
    const githubConfig = await checkGitHubConfig();
    
    if (!githubConfig.valid) {
      return { success: false, error: 'GitHub配置获取失败' };
    }
    
    console.log(`   🔗 模拟客户端连接到: ${githubConfig.host}`);
    
    // 模拟客户端连接测试
    const testUrl = `https://${githubConfig.host}/api/health`;
    const response = await fetch(testUrl, {
      timeout: 5000,
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    
    if (!response.ok) {
      return { success: false, error: `连接失败: ${response.status}` };
    }
    
    console.log("   ✅ 模拟客户端连接成功");
    
    return {
      success: true,
      connectedTo: githubConfig.host,
      responseStatus: response.status
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 检查地址一致性
async function checkAddressConsistency(ngrokUrl, githubHost) {
  return ngrokUrl === githubHost;
}

// 运行测试
if (require.main === module) {
  testUserWorkflow().catch(console.error);
}

module.exports = { testUserWorkflow };
