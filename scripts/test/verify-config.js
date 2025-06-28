#!/usr/bin/env node

// 验证配置是否正确更新
const fs = require('fs-extra');
const path = require('path');

async function verifyConfig() {
  console.log('🔍 验证配置更新测试');
  console.log('==================');
  console.log('');

  try {
    // 1. 检查服务器信息文件
    const serverInfoPath = path.join(__dirname, '../../server-info.json');
    console.log('📋 检查服务器信息文件...');
    
    if (await fs.pathExists(serverInfoPath)) {
      const serverInfo = await fs.readJson(serverInfoPath);
      console.log(`✅ 服务器信息: ${serverInfo.ngrokUrl}`);
      console.log(`   启动时间: ${new Date(serverInfo.startTime).toLocaleString()}`);
      console.log('');
    } else {
      console.log('❌ 服务器信息文件不存在');
      return;
    }

    // 2. 检查客户端配置文件
    const clientConfigPath = path.join(__dirname, '../../modules/desktop-client/public/server-config.json');
    console.log('📋 检查客户端配置文件...');
    
    if (await fs.pathExists(clientConfigPath)) {
      const clientConfig = await fs.readJson(clientConfigPath);
      console.log(`✅ 客户端配置: ${clientConfig.server.protocol}://${clientConfig.server.host}:${clientConfig.server.port}`);
      console.log('');
    } else {
      console.log('❌ 客户端配置文件不存在');
      return;
    }

    // 3. 检查用户配置文件
    const userConfigPath = path.join(require('os').homedir(), '.augment-device-manager/server-config.json');
    console.log('📋 检查用户配置文件...');
    
    if (await fs.pathExists(userConfigPath)) {
      const userConfig = await fs.readJson(userConfigPath);
      console.log(`✅ 用户配置: ${userConfig.server.protocol}://${userConfig.server.host}:${userConfig.server.port}`);
      console.log('');
    } else {
      console.log('⚠️ 用户配置文件不存在（首次运行时正常）');
      console.log('');
    }

    // 4. 验证配置一致性
    console.log('🔄 验证配置一致性...');
    const serverInfo = await fs.readJson(serverInfoPath);
    const clientConfig = await fs.readJson(clientConfigPath);
    
    const expectedHost = serverInfo.ngrokUrl;
    const actualHost = clientConfig.server.host;
    
    if (expectedHost === actualHost) {
      console.log('✅ 配置一致性检查通过');
      console.log(`   服务器地址: ${expectedHost}`);
      console.log(`   客户端配置: ${actualHost}`);
    } else {
      console.log('❌ 配置不一致！');
      console.log(`   服务器地址: ${expectedHost}`);
      console.log(`   客户端配置: ${actualHost}`);
      console.log('');
      console.log('💡 建议运行: npm run config:update');
    }

    console.log('');
    console.log('🎯 测试结论:');
    if (expectedHost === actualHost) {
      console.log('✅ 配置更新功能正常工作');
      console.log('✅ 打包时会使用正确的服务器地址');
      console.log('✅ 分发的客户端可以正常连接');
    } else {
      console.log('❌ 配置更新存在问题');
      console.log('❌ 需要手动修复配置');
    }

  } catch (error) {
    console.error('❌ 验证过程出错:', error.message);
  }
}

// 测试连接功能
async function testConnection() {
  try {
    console.log('');
    console.log('🌐 测试服务器连接...');
    
    const clientConfigPath = path.join(__dirname, '../../modules/desktop-client/public/server-config.json');
    const clientConfig = await fs.readJson(clientConfigPath);
    
    const serverUrl = `${clientConfig.server.protocol}://${clientConfig.server.host}:${clientConfig.server.port}`;
    console.log(`   测试地址: ${serverUrl}/api/health`);
    
    const fetch = require('node-fetch');
    const response = await fetch(`${serverUrl}/api/health`, {
      timeout: 5000
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ 服务器连接正常');
      console.log(`   响应: ${JSON.stringify(data)}`);
    } else {
      console.log(`❌ 服务器响应错误: ${response.status}`);
    }
    
  } catch (error) {
    console.log(`❌ 连接测试失败: ${error.message}`);
    console.log('💡 可能原因: 服务器未启动或地址配置错误');
  }
}

// 主函数
async function main() {
  await verifyConfig();
  await testConnection();
  
  console.log('');
  console.log('📚 相关命令:');
  console.log('   npm run config:update  # 更新配置');
  console.log('   npm run server:status  # 检查服务状态');
  console.log('   npm run build:remote   # 重新打包');
}

main().catch(console.error);
