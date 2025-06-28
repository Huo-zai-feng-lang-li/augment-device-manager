// 测试IPC通信
const { spawn } = require('child_process');
const path = require('path');

async function testIPCCommunication() {
  console.log('🧪 测试IPC通信...\n');
  
  try {
    // 1. 检查Electron进程是否运行
    console.log('📊 检查Electron进程状态:');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq electron.exe"');
      const lines = stdout.split('\n').filter(line => line.includes('electron.exe'));
      console.log(`  发现 ${lines.length} 个Electron进程`);
      
      if (lines.length === 0) {
        console.log('  ❌ 没有发现Electron进程，客户端可能未启动');
        return;
      }
    } catch (error) {
      console.log('  ⚠️ 无法检查进程状态');
    }
    
    // 2. 测试基本的Node.js模块加载
    console.log('\n🔧 测试模块加载:');
    try {
      const { generateStableDeviceId } = require('./shared/utils/stable-device-id');
      const deviceId = await generateStableDeviceId();
      console.log('  ✅ 设备ID模块正常工作');
      console.log(`  设备ID: ${deviceId.substring(0, 16)}...`);
    } catch (error) {
      console.log('  ❌ 设备ID模块加载失败:', error.message);
    }
    
    // 3. 检查配置文件
    console.log('\n📁 检查配置文件:');
    const fs = require('fs-extra');
    const configPath = path.join(__dirname, 'desktop-client/src/config.js');
    
    if (await fs.pathExists(configPath)) {
      console.log('  ✅ 配置文件存在');
      try {
        const config = require('./desktop-client/src/config');
        console.log('  ✅ 配置模块加载成功');
        console.log(`  服务器地址: ${config.getHttpUrl()}`);
      } catch (error) {
        console.log('  ❌ 配置模块加载失败:', error.message);
      }
    } else {
      console.log('  ❌ 配置文件不存在');
    }
    
    // 4. 检查HTML文件
    console.log('\n🌐 检查HTML文件:');
    const htmlPath = path.join(__dirname, 'desktop-client/public/index.html');
    
    if (await fs.pathExists(htmlPath)) {
      console.log('  ✅ HTML文件存在');
      const htmlContent = await fs.readFile(htmlPath, 'utf8');
      
      // 检查是否包含设备ID相关元素
      const hasDeviceIdElements = htmlContent.includes('stable-device-id') && 
                                  htmlContent.includes('device-fingerprint') &&
                                  htmlContent.includes('cursor-dev-device-id');
      
      console.log('  设备ID元素:', hasDeviceIdElements ? '✅ 已添加' : '❌ 缺失');
    } else {
      console.log('  ❌ HTML文件不存在');
    }
    
    // 5. 检查renderer.js文件
    console.log('\n📜 检查renderer.js文件:');
    const rendererPath = path.join(__dirname, 'desktop-client/public/renderer.js');
    
    if (await fs.pathExists(rendererPath)) {
      console.log('  ✅ renderer.js文件存在');
      const rendererContent = await fs.readFile(rendererPath, 'utf8');
      
      // 检查是否包含设备ID相关函数
      const hasDeviceIdFunctions = rendererContent.includes('loadDeviceIdDetails') && 
                                   rendererContent.includes('updateDeviceIdDisplay') &&
                                   rendererContent.includes('get-device-id-details');
      
      console.log('  设备ID函数:', hasDeviceIdFunctions ? '✅ 已添加' : '❌ 缺失');
    } else {
      console.log('  ❌ renderer.js文件不存在');
    }
    
    // 6. 提供故障排除建议
    console.log('\n🔧 故障排除建议:');
    console.log('  1. 确保客户端窗口已打开（检查任务栏）');
    console.log('  2. 按F12打开开发者工具查看控制台错误');
    console.log('  3. 检查是否有JavaScript错误阻止了事件处理');
    console.log('  4. 尝试刷新页面（Ctrl+R）');
    console.log('  5. 如果仍无响应，重启客户端');
    
    console.log('\n🎯 重启客户端命令:');
    console.log('  cd desktop-client');
    console.log('  taskkill /F /IM electron.exe');
    console.log('  npm start');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testIPCCommunication();
