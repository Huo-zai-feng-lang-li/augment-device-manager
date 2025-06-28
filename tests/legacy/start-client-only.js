#!/usr/bin/env node

/**
 * 仅启动客户端的脚本
 * 避免后端服务器的日志干扰
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 启动Augment设备管理器客户端...\n');

// 设置环境变量以减少日志输出
const env = {
    ...process.env,
    NODE_ENV: 'development',
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    // 减少Electron的调试输出
    ELECTRON_LOG_LEVEL: 'error'
};

// 启动客户端
const clientProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, 'desktop-client'),
    stdio: 'inherit',
    shell: true,
    env: env
});

// 处理进程事件
clientProcess.on('error', (error) => {
    console.error('❌ 客户端启动失败:', error);
    process.exit(1);
});

clientProcess.on('close', (code) => {
    if (code !== 0) {
        console.log(`\n⚠️ 客户端进程退出，代码: ${code}`);
    } else {
        console.log('\n✅ 客户端已正常关闭');
    }
    process.exit(code);
});

// 处理Ctrl+C
process.on('SIGINT', () => {
    console.log('\n🛑 正在关闭客户端...');
    clientProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('\n🛑 正在终止客户端...');
    clientProcess.kill('SIGTERM');
});

console.log('💡 提示: 按 Ctrl+C 关闭客户端');
console.log('📱 客户端窗口应该会在几秒钟内打开...\n');
