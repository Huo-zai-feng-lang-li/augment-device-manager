// 测试客户端响应
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function testClientResponse() {
  console.log('🧪 测试客户端响应状态...\n');
  
  try {
    // 1. 检查Electron进程
    console.log('📊 检查Electron进程状态:');
    try {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq electron.exe"');
      const lines = stdout.split('\n').filter(line => line.includes('electron.exe'));
      console.log(`  发现 ${lines.length} 个Electron进程`);
      lines.forEach((line, index) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          console.log(`    进程 ${index + 1}: PID ${parts[1]}, 内存 ${parts[4] || 'N/A'}`);
        }
      });
    } catch (error) {
      console.log('  ❌ 无法获取进程信息');
    }
    
    // 2. 检查端口占用
    console.log('\n🌐 检查端口占用状态:');
    try {
      const { stdout } = await execAsync('netstat -an | findstr ":8080"');
      if (stdout.trim()) {
        console.log('  ✅ 端口8080已被占用');
        console.log('  ' + stdout.trim());
      } else {
        console.log('  ⚠️ 端口8080未被占用');
      }
    } catch (error) {
      console.log('  ⚠️ 无法检查端口状态');
    }
    
    // 3. 测试HTTP连接
    console.log('\n🔗 测试HTTP连接:');
    try {
      const response = await fetch('http://localhost:8080');
      if (response.ok) {
        console.log('  ✅ HTTP服务器响应正常');
        console.log(`  状态码: ${response.status}`);
      } else {
        console.log(`  ⚠️ HTTP服务器响应异常: ${response.status}`);
      }
    } catch (error) {
      console.log('  ❌ HTTP连接失败:', error.message);
    }
    
    // 4. 检查窗口状态
    console.log('\n🪟 检查窗口状态:');
    try {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq electron.exe" /FO CSV');
      const lines = stdout.split('\n').filter(line => line.includes('electron.exe'));
      console.log(`  发现 ${lines.length} 个Electron窗口进程`);
      
      if (lines.length > 0) {
        console.log('  ✅ 客户端窗口应该已经打开');
        console.log('  💡 请检查任务栏或Alt+Tab查看Augment设备管理器窗口');
      } else {
        console.log('  ❌ 未发现Electron窗口进程');
      }
    } catch (error) {
      console.log('  ⚠️ 无法检查窗口状态');
    }
    
    // 5. 提供解决方案
    console.log('\n🔧 故障排除建议:');
    console.log('  1. 检查任务栏是否有Augment设备管理器图标');
    console.log('  2. 尝试Alt+Tab切换到应用窗口');
    console.log('  3. 如果窗口最小化，请点击任务栏图标恢复');
    console.log('  4. 如果仍无响应，请重启应用');
    
    console.log('\n🎯 重启应用命令:');
    console.log('  cd desktop-client');
    console.log('  taskkill /F /IM electron.exe');
    console.log('  npm start');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testClientResponse();
