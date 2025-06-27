#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

console.log('🚀 超级智能打包 - 自动获取ngrok地址并内置配置');
console.log('===============================================');
console.log('');
console.log('📋 将自动执行以下步骤：');
console.log('1. 启动后端服务');
console.log('2. 启动ngrok获取公网地址');
console.log('3. 将服务器配置内置到客户端');
console.log('4. 打包客户端（清理后自动连接）');
console.log('5. 清理临时进程');
console.log('');

let serverProcess = null;
let ngrokProcess = null;

async function main() {
  try {
    // 检查ngrok是否安装
    await checkNgrok();

    // 1. 启动后端服务
    console.log('🌐 启动后端服务...');
    serverProcess = await startServer();
    await sleep(3000);

    // 2. 启动ngrok
    console.log('🔗 启动ngrok...');
    ngrokProcess = await startNgrok();
    await sleep(5000);

    // 3. 获取ngrok地址
    const ngrokUrl = await getNgrokUrl();
    if (!ngrokUrl) {
      throw new Error('无法获取ngrok地址');
    }

    console.log(`✅ 获取到公网地址: ${ngrokUrl}`);

    // 4. 使用内置配置打包
    console.log('🔨 开始内置配置打包...');
    await buildWithEmbeddedConfig(ngrokUrl, 443, 'https');

    console.log('');
    console.log('🎉 超级智能打包完成！');
    console.log('');
    console.log('✅ 客户端特性:');
    console.log('   • 默认连接到您的ngrok服务器');
    console.log('   • 清理后自动恢复连接，无需用户操作');
    console.log('   • 多重配置保障机制');
    console.log('   • 完全自动化，用户无感知');
    console.log('');
    console.log('📦 安装包位置: desktop-client/build-output/');
    console.log(`🌐 管理界面: https://${ngrokUrl}`);
    console.log('');
    console.log('💡 提示: 保持终端运行以维持ngrok连接');

  } catch (error) {
    console.error('❌ 打包失败:', error.message);
    process.exit(1);
  } finally {
    // 不自动清理，让用户决定何时停止
    console.log('');
    console.log('🔄 服务器和ngrok将继续运行...');
    console.log('💡 按 Ctrl+C 停止所有服务');
  }
}

// 检查ngrok是否安装
async function checkNgrok() {
  try {
    execSync('ngrok version', { stdio: 'ignore' });
    console.log('✅ 检测到ngrok');
  } catch (error) {
    console.error('❌ 未检测到ngrok，请先安装：');
    console.error('   1. 访问 https://ngrok.com/ 注册账号');
    console.error('   2. 下载并安装ngrok');
    console.error('   3. 配置认证令牌：ngrok authtoken YOUR_TOKEN');
    process.exit(1);
  }
}

// 启动后端服务
function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('npm', ['run', 'server-only'], {
      shell: true,
      stdio: 'pipe'
    });

    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('3002') && (output.includes('运行在') || output.includes('listening'))) {
        console.log('✅ 后端服务已启动');
        resolve(server);
      }
    });

    server.on('error', reject);

    setTimeout(() => {
      reject(new Error('后端服务启动超时'));
    }, 30000);
  });
}

// 启动ngrok
function startNgrok() {
  return new Promise((resolve, reject) => {
    const ngrok = spawn('ngrok', ['http', '3002'], {
      shell: true,
      stdio: 'pipe'
    });

    ngrok.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('started tunnel') || output.includes('Forwarding') || output.includes('ngrok.io')) {
        console.log('✅ ngrok隧道已建立');
        resolve(ngrok);
      }
    });

    ngrok.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('started tunnel') || output.includes('Forwarding') || output.includes('ngrok.io')) {
        console.log('✅ ngrok隧道已建立');
        resolve(ngrok);
      }
    });

    ngrok.on('error', reject);

    setTimeout(() => {
      reject(new Error('ngrok启动超时'));
    }, 30000);
  });
}

// 获取ngrok地址
async function getNgrokUrl() {
  try {
    const response = await fetch('http://localhost:4040/api/tunnels');
    const data = await response.json();
    const httpsTunnel = data.tunnels.find(t => t.proto === 'https');
    if (httpsTunnel) {
      const url = new URL(httpsTunnel.public_url);
      return url.hostname;
    }
  } catch (error) {
    console.error('获取ngrok地址失败:', error.message);
  }
  return null;
}

// 使用内置配置打包
async function buildWithEmbeddedConfig(host, port, protocol) {
  return new Promise((resolve, reject) => {
    const build = spawn('node', [
      path.join(__dirname, 'build-with-embedded-config.js'),
      host, port.toString(), protocol
    ], {
      shell: true,
      stdio: 'inherit'
    });

    build.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`内置配置打包失败，退出码: ${code}`));
      }
    });

    build.on('error', reject);
  });
}

// 睡眠函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 清理进程
function cleanup() {
  console.log('🧹 清理进程...');

  if (serverProcess) {
    serverProcess.kill();
    console.log('✅ 后端服务已停止');
  }

  if (ngrokProcess) {
    ngrokProcess.kill();
    console.log('✅ ngrok已停止');
  }
}

// 处理退出信号
process.on('SIGINT', () => {
  console.log('\n🛑 收到退出信号...');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 收到终止信号...');
  cleanup();
  process.exit(0);
});

// 运行主函数
main().catch(console.error);
