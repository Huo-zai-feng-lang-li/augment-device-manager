#!/usr/bin/env node

/**
 * 简化的客户端连接测试
 */

const fetch = require("node-fetch");

async function testConnection() {
  try {
    console.log("🔍 开始测试客户端连接...");
    
    // 1. 获取GitHub配置
    console.log("📥 获取GitHub配置...");
    const githubUrl = "https://raw.githubusercontent.com/Huo-zai-feng-lang-li/augment-device-manager/main/server-config.json";
    
    const githubResponse = await fetch(githubUrl, { timeout: 10000 });
    if (!githubResponse.ok) {
      throw new Error(`GitHub配置获取失败: ${githubResponse.status}`);
    }
    
    const config = await githubResponse.json();
    console.log(`✅ GitHub配置获取成功: ${config.server.host}`);
    
    // 2. 测试服务连接
    console.log("🔗 测试服务连接...");
    const serviceUrl = `https://${config.server.host}/api/health`;
    console.log(`   连接地址: ${serviceUrl}`);
    
    const serviceResponse = await fetch(serviceUrl, {
      timeout: 15000,
      headers: { 
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'Augment-Client-Test/1.0.0'
      }
    });
    
    console.log(`   响应状态: ${serviceResponse.status}`);
    
    if (!serviceResponse.ok) {
      const errorText = await serviceResponse.text().catch(() => 'Unknown error');
      throw new Error(`服务连接失败: ${serviceResponse.status} - ${errorText}`);
    }
    
    const healthData = await serviceResponse.json();
    console.log(`✅ 服务连接成功!`);
    console.log(`   服务状态: ${healthData.status}`);
    console.log(`   服务版本: ${healthData.version || 'Unknown'}`);
    
    return true;
    
  } catch (error) {
    console.log(`❌ 连接测试失败: ${error.message}`);
    return false;
  }
}

// 运行测试
testConnection().then(success => {
  if (success) {
    console.log("\n🎉 客户端连接测试通过!");
  } else {
    console.log("\n💥 客户端连接测试失败!");
    process.exit(1);
  }
});
