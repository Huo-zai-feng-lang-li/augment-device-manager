#!/usr/bin/env node

// 客户端服务器配置工具
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.augment-device-manager');
const CONFIG_FILE = path.join(CONFIG_DIR, 'server-config.json');

async function configureServer() {
  console.log('🔧 Augment设备管理器 - 服务器配置工具');
  console.log('=====================================');
  
  // 获取命令行参数
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('使用方法:');
    console.log('  node configure-server.js <服务器地址> [端口] [协议]');
    console.log('');
    console.log('示例:');
    console.log('  node configure-server.js abc123.ngrok.io 443 https');
    console.log('  node configure-server.js localhost 3002 http');
    console.log('  node configure-server.js 192.168.1.100 3002 http');
    console.log('');
    console.log('当前配置:');
    await showCurrentConfig();
    return;
  }
  
  const host = args[0];
  const port = parseInt(args[1]) || (host.includes('ngrok.io') ? 443 : 3002);
  const protocol = args[2] || (host.includes('ngrok.io') ? 'https' : 'http');
  
  const config = {
    server: {
      host: host,
      port: port,
      protocol: protocol
    },
    client: {
      autoConnect: true,
      verifyInterval: 5 * 60 * 1000, // 5分钟
      reconnectDelay: 5000 // 5秒
    }
  };
  
  try {
    // 确保配置目录存在
    await fs.ensureDir(CONFIG_DIR);
    
    // 保存配置
    await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
    
    console.log('✅ 服务器配置已更新:');
    console.log(`   服务器地址: ${protocol}://${host}:${port}`);
    console.log(`   WebSocket: ${protocol === 'https' ? 'wss' : 'ws'}://${host}:${port}/ws`);
    console.log('');
    console.log('💡 提示: 重启客户端应用以应用新配置');
    
  } catch (error) {
    console.error('❌ 配置保存失败:', error.message);
  }
}

async function showCurrentConfig() {
  try {
    if (await fs.pathExists(CONFIG_FILE)) {
      const config = await fs.readJson(CONFIG_FILE);
      const { host, port, protocol } = config.server;
      console.log(`   服务器地址: ${protocol}://${host}:${port}`);
      console.log(`   WebSocket: ${protocol === 'https' ? 'wss' : 'ws'}://${host}:${port}/ws`);
    } else {
      console.log('   未找到配置文件，将使用默认配置 (localhost:3002)');
    }
  } catch (error) {
    console.log('   配置文件读取失败');
  }
}

// 运行配置工具
configureServer().catch(console.error);
