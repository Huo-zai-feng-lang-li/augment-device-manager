#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// 验证配置脚本
async function verifyConfig() {
  console.log('🔍 验证服务器配置');
  console.log('==================');

  // 检查环境变量
  console.log('📋 环境变量:');
  console.log(`   AUGMENT_SERVER_HOST: ${process.env.AUGMENT_SERVER_HOST || '未设置'}`);
  console.log(`   AUGMENT_SERVER_PORT: ${process.env.AUGMENT_SERVER_PORT || '未设置'}`);
  console.log(`   AUGMENT_SERVER_PROTOCOL: ${process.env.AUGMENT_SERVER_PROTOCOL || '未设置'}`);
  console.log('');

  // 检查配置文件
  const configDir = path.join(os.homedir(), '.augment-device-manager');
  const configFile = path.join(configDir, 'server-config.json');
  
  console.log('📁 配置文件:');
  console.log(`   路径: ${configFile}`);
  
  if (await fs.pathExists(configFile)) {
    try {
      const config = await fs.readJson(configFile);
      console.log('   状态: ✅ 存在');
      console.log(`   服务器: ${config.server.protocol}://${config.server.host}:${config.server.port}`);
    } catch (error) {
      console.log('   状态: ❌ 文件损坏');
    }
  } else {
    console.log('   状态: ⚠️ 不存在（将使用默认配置）');
  }
  console.log('');

  // 检查默认配置
  console.log('⚙️ 默认配置:');
  console.log('   服务器: http://localhost:3002');
  console.log('');

  // 测试服务器连接
  console.log('🌐 测试服务器连接:');
  try {
    const fetch = require('node-fetch').default || require('node-fetch');
    const response = await fetch('http://localhost:3002/api/health', { timeout: 5000 });
    if (response.ok) {
      const data = await response.json();
      console.log('   状态: ✅ 服务器运行正常');
      console.log(`   响应: ${JSON.stringify(data)}`);
    } else {
      console.log(`   状态: ❌ 服务器响应错误 (${response.status})`);
    }
  } catch (error) {
    console.log(`   状态: ❌ 连接失败 (${error.message})`);
    console.log('   提示: 请确保服务器正在运行');
  }
  console.log('');

  console.log('💡 配置优先级:');
  console.log('   1. 环境变量 (最高优先级)');
  console.log('   2. 配置文件');
  console.log('   3. 默认配置 (localhost:3002)');
}

// 运行验证
verifyConfig().catch(console.error);
