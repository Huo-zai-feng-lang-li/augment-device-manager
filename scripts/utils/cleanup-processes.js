#!/usr/bin/env node

/**
 * 进程清理工具
 * 彻底清理所有相关的node和ngrok进程
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧹 开始清理进程...');

async function cleanupProcesses() {
  try {
    // 1. 清理所有node.exe进程
    console.log('🔄 清理node.exe进程...');
    try {
      const result = execSync('taskkill /F /IM node.exe', { encoding: 'utf8' });
      console.log('✅ node.exe进程已清理');
      console.log(result);
    } catch (error) {
      if (error.message.includes('没有找到进程')) {
        console.log('✅ 没有node.exe进程需要清理');
      } else {
        console.log('⚠️ 部分node.exe进程清理失败:', error.message);
      }
    }

    // 2. 清理所有ngrok.exe进程
    console.log('🔄 清理ngrok.exe进程...');
    try {
      const result = execSync('taskkill /F /IM ngrok.exe', { encoding: 'utf8' });
      console.log('✅ ngrok.exe进程已清理');
      console.log(result);
    } catch (error) {
      if (error.message.includes('没有找到进程')) {
        console.log('✅ 没有ngrok.exe进程需要清理');
      } else {
        console.log('⚠️ 部分ngrok.exe进程清理失败:', error.message);
      }
    }

    // 3. 等待进程完全退出
    console.log('⏳ 等待进程完全退出...');
    await sleep(2000);

    // 4. 验证端口状态
    console.log('🔍 验证端口状态...');
    try {
      const portCheck = execSync('netstat -ano | findstr :3002', { encoding: 'utf8' });
      if (portCheck.trim()) {
        console.log('⚠️ 端口3002仍被占用:');
        console.log(portCheck);
      } else {
        console.log('✅ 端口3002已释放');
      }
    } catch (error) {
      console.log('✅ 端口3002已释放');
    }

    // 5. 清理临时文件
    console.log('🗑️ 清理临时文件...');
    const fs = require('fs-extra');
    const tempFiles = [
      path.join(__dirname, '../../server-info.json'),
      path.join(__dirname, '../../temp-config-repo')
    ];

    for (const file of tempFiles) {
      try {
        if (await fs.pathExists(file)) {
          await fs.remove(file);
          console.log(`✅ 已删除: ${file}`);
        }
      } catch (error) {
        console.log(`⚠️ 删除失败: ${file} - ${error.message}`);
      }
    }

    console.log('');
    console.log('🎉 进程清理完成！');
    console.log('💡 现在可以安全地重新启动服务');
    console.log('');
    console.log('📋 下一步操作:');
    console.log('   npm run server:start  # 启动服务');
    console.log('   npm run server:status # 检查状态');

  } catch (error) {
    console.error('❌ 清理过程出错:', error.message);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行清理
cleanupProcesses().catch(console.error);
