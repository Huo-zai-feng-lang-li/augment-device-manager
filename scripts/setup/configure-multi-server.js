#!/usr/bin/env node

// 配置多服务器地址，支持自动发现
const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

const CONFIG_DIR = path.join(require('os').homedir(), '.augment-device-manager');
const CONFIG_FILE = path.join(CONFIG_DIR, 'server-config.json');
const CLIENT_CONFIG_FILE = path.join(__dirname, '../../modules/desktop-client/public/server-config.json');

async function main() {
  console.log('🌐 Augment设备管理器 - 多服务器配置');
  console.log('=====================================');
  console.log('');
  console.log('此工具可以配置多个候选服务器地址，客户端会自动选择可用的服务器');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    // 收集服务器地址
    const servers = [];
    
    console.log('📝 请输入服务器地址（按回车添加下一个，输入空行结束）:');
    console.log('   格式: 主机名 端口 协议');
    console.log('   示例: augment-server.ngrok.io 443 https');
    console.log('   示例: 192.168.1.100 3002 http');
    console.log('');

    let index = 1;
    while (true) {
      const input = await askQuestion(rl, `服务器 ${index}: `);
      
      if (!input.trim()) {
        break;
      }

      const parts = input.trim().split(/\s+/);
      if (parts.length >= 1) {
        const host = parts[0];
        const port = parseInt(parts[1]) || (host.includes('ngrok.io') ? 443 : 3002);
        const protocol = parts[2] || (host.includes('ngrok.io') ? 'https' : 'http');
        
        servers.push({ host, port, protocol });
        console.log(`   ✅ 已添加: ${protocol}://${host}:${port}`);
        index++;
      } else {
        console.log('   ❌ 格式错误，请重新输入');
      }
    }

    if (servers.length === 0) {
      console.log('❌ 未配置任何服务器地址');
      return;
    }

    // 选择主服务器
    console.log('');
    console.log('📋 已配置的服务器:');
    servers.forEach((server, i) => {
      console.log(`   ${i + 1}. ${server.protocol}://${server.host}:${server.port}`);
    });

    const primaryIndex = await askQuestion(rl, '\n请选择主服务器 (1-' + servers.length + '): ');
    const primaryIdx = parseInt(primaryIndex) - 1;
    
    if (primaryIdx < 0 || primaryIdx >= servers.length) {
      console.log('❌ 无效的选择');
      return;
    }

    const primaryServer = servers[primaryIdx];

    // 生成配置
    const config = {
      server: {
        host: primaryServer.host,
        port: primaryServer.port,
        protocol: primaryServer.protocol
      },
      client: {
        autoConnect: true,
        verifyInterval: 5 * 60 * 1000, // 5分钟
        reconnectDelay: 5000, // 5秒
        serverDiscovery: {
          enabled: true,
          candidates: servers.map(s => `${s.protocol}://${s.host}:${s.port}`)
        }
      }
    };

    // 保存用户配置
    await fs.ensureDir(CONFIG_DIR);
    await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });

    // 保存客户端配置
    await fs.writeJson(CLIENT_CONFIG_FILE, config, { spaces: 2 });

    console.log('');
    console.log('✅ 多服务器配置已保存:');
    console.log(`   主服务器: ${primaryServer.protocol}://${primaryServer.host}:${primaryServer.port}`);
    console.log(`   候选服务器: ${servers.length} 个`);
    console.log(`   用户配置: ${CONFIG_FILE}`);
    console.log(`   客户端配置: ${CLIENT_CONFIG_FILE}`);
    console.log('');
    console.log('🎯 客户端将按以下顺序尝试连接:');
    config.client.serverDiscovery.candidates.forEach((url, i) => {
      console.log(`   ${i + 1}. ${url}`);
    });
    console.log('');
    console.log('💡 提示: 重启客户端应用以应用新配置');

  } catch (error) {
    console.error('❌ 配置失败:', error.message);
  } finally {
    rl.close();
  }
}

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// 从命令行参数快速配置
if (process.argv.length > 2) {
  const servers = [];
  
  // 解析命令行参数
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    const parts = arg.split(':');
    
    if (parts.length >= 2) {
      const host = parts[0];
      const port = parseInt(parts[1]) || 443;
      const protocol = parts[2] || (host.includes('ngrok.io') ? 'https' : 'http');
      
      servers.push({ host, port, protocol });
    }
  }

  if (servers.length > 0) {
    console.log('🚀 快速配置模式');
    console.log('================');
    
    const primaryServer = servers[0];
    const config = {
      server: {
        host: primaryServer.host,
        port: primaryServer.port,
        protocol: primaryServer.protocol
      },
      client: {
        autoConnect: true,
        verifyInterval: 5 * 60 * 1000,
        reconnectDelay: 5000,
        serverDiscovery: {
          enabled: true,
          candidates: servers.map(s => `${s.protocol}://${s.host}:${s.port}`)
        }
      }
    };

    Promise.all([
      fs.ensureDir(CONFIG_DIR).then(() => fs.writeJson(CONFIG_FILE, config, { spaces: 2 })),
      fs.writeJson(CLIENT_CONFIG_FILE, config, { spaces: 2 })
    ]).then(() => {
      console.log('✅ 配置完成');
      servers.forEach((server, i) => {
        console.log(`   ${i + 1}. ${server.protocol}://${server.host}:${server.port}`);
      });
    }).catch(error => {
      console.error('❌ 配置失败:', error.message);
    });
  } else {
    main().catch(console.error);
  }
} else {
  main().catch(console.error);
}
