/**
 * 干净启动客户端
 * 确保启动前所有防护进程都停止
 */

const { spawn, exec } = require('child_process');
const path = require('path');

async function stopAllGuardianProcesses() {
  console.log('🛑 停止所有防护进程...');
  
  try {
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    if (process.platform === "win32") {
      // Windows系统 - 查找并终止守护进程
      try {
        // 获取所有Node.js进程的详细信息
        const processOutput = await execAsync('wmic process where "name=\'node.exe\'" get processid,commandline /format:csv');
        const lines = processOutput.split('\n');
        const guardianProcesses = [];
        
        for (const line of lines) {
          if (line.includes('guardian-service-worker.js') || 
              line.includes('enhanced-device-guardian') ||
              line.includes('device-id-guardian') ||
              line.includes('standalone-guardian-service')) {
            
            // 提取PID
            const pidMatch = line.match(/(\d+)$/);
            if (pidMatch) {
              guardianProcesses.push(pidMatch[1]);
            }
          }
        }
        
        if (guardianProcesses.length > 0) {
          console.log(`🎯 发现 ${guardianProcesses.length} 个守护进程，正在终止...`);
          
          for (const pid of guardianProcesses) {
            try {
              await execAsync(`taskkill /F /PID ${pid}`);
              console.log(`✅ 已终止守护进程 PID: ${pid}`);
            } catch (error) {
              console.log(`⚠️ 终止进程 ${pid} 失败: ${error.message}`);
            }
          }
        } else {
          console.log("✅ 未发现运行中的守护进程");
        }
        
      } catch (error) {
        console.warn("扫描守护进程失败:", error.message);
      }
    } else {
      // Unix/Linux/macOS系统
      try {
        await execAsync("pkill -f 'guardian-service-worker\\|enhanced-device-guardian\\|device-id-guardian\\|standalone-guardian-service'");
        console.log("✅ 已终止所有守护进程");
      } catch (error) {
        if (error.code === 1) {
          console.log("✅ 未发现运行中的守护进程");
        } else {
          console.warn("终止守护进程失败:", error.message);
        }
      }
    }
    
  } catch (error) {
    console.error("停止守护进程失败:", error);
  }
}

async function startClientClean() {
  console.log('🚀 干净启动Augment设备管理器客户端');
  console.log('=' .repeat(50));
  
  try {
    // 1. 停止所有现有的防护进程
    console.log('\n📍 1. 停止所有现有的防护进程');
    await stopAllGuardianProcesses();
    
    // 2. 等待进程完全停止
    console.log('\n📍 2. 等待进程完全停止（3秒）');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 3. 启动客户端
    console.log('\n📍 3. 启动客户端');
    console.log('💡 客户端现在会在启动和关闭时自动管理防护进程');
    console.log('💡 防护只在客户端运行期间有效，不会独立运行');
    
    const clientPath = path.join(__dirname, 'modules', 'desktop-client');
    
    console.log(`启动路径: ${clientPath}`);
    console.log('正在启动...\n');
    
    // 使用spawn启动客户端，保持输出
    const clientProcess = spawn('npm', ['start'], {
      cwd: clientPath,
      stdio: 'inherit',
      shell: true
    });
    
    // 处理客户端进程事件
    clientProcess.on('error', (error) => {
      console.error('❌ 客户端启动失败:', error.message);
    });
    
    clientProcess.on('exit', (code, signal) => {
      console.log(`\n🔚 客户端已退出 (代码: ${code}, 信号: ${signal})`);
      console.log('🛑 客户端退出时会自动停止所有防护进程');
    });
    
    // 处理进程终止信号
    process.on('SIGINT', () => {
      console.log('\n🛑 收到终止信号，正在关闭客户端...');
      clientProcess.kill('SIGTERM');
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🛑 收到终止信号，正在关闭客户端...');
      clientProcess.kill('SIGTERM');
    });
    
  } catch (error) {
    console.error('❌ 启动失败:', error.message);
    process.exit(1);
  }
}

// 运行启动脚本
if (require.main === module) {
  startClientClean().catch(error => {
    console.error('❌ 启动异常:', error);
    process.exit(1);
  });
}

module.exports = { startClientClean, stopAllGuardianProcesses };
