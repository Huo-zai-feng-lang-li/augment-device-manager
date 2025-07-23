#!/usr/bin/env node

/**
 * 测试打包后的应用程序是否能正常启动
 */

const { spawn } = require('child_process');
const path = require('path');

async function testApp() {
  try {
    console.log('🧪 测试打包后的应用程序...');
    
    const appPath = path.join(__dirname, '../dist-final/win-unpacked/Augment设备管理器.exe');
    
    console.log(`📱 启动应用程序: ${appPath}`);
    
    // 启动应用程序，设置超时
    const app = spawn(appPath, ['--no-sandbox', '--disable-dev-shm-usage'], {
      stdio: 'pipe',
      detached: false
    });
    
    let hasError = false;
    let output = '';
    
    // 监听输出
    app.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    app.stderr.on('data', (data) => {
      const errorText = data.toString();
      output += errorText;
      
      // 检查是否有ffmpeg相关错误
      if (errorText.includes('ffmpeg.dll') || errorText.includes('找不到')) {
        hasError = true;
        console.log('❌ 检测到ffmpeg.dll相关错误');
      }
    });
    
    // 等待3秒后关闭应用程序
    setTimeout(() => {
      if (!app.killed) {
        app.kill('SIGTERM');
        
        setTimeout(() => {
          if (!app.killed) {
            app.kill('SIGKILL');
          }
        }, 2000);
      }
    }, 3000);
    
    // 等待进程结束
    await new Promise((resolve) => {
      app.on('close', (code) => {
        resolve(code);
      });
    });
    
    if (hasError) {
      console.log('❌ 应用程序启动时遇到错误');
      console.log('输出信息:');
      console.log(output);
    } else {
      console.log('✅ 应用程序启动成功，未检测到ffmpeg相关错误');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
testApp().catch(console.error);
