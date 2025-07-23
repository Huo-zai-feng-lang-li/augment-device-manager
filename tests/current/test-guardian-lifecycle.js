#!/usr/bin/env node

/**
 * 测试防护进程生命周期管理
 * 验证客户端关闭时是否正确停止防护进程
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function findGuardianProcesses() {
  try {
    console.log('🔍 扫描防护进程...');
    
    if (process.platform === 'win32') {
      // Windows系统
      const { stdout } = await execAsync(
        'wmic process where "name=\'node.exe\'" get processid,commandline'
      );
      
      const lines = stdout.split('\n');
      const guardianProcesses = [];
      
      for (const line of lines) {
        if (line.includes('guardian-service-worker.js') ||
            line.includes('enhanced-device-guardian') ||
            line.includes('device-id-guardian') ||
            line.includes('standalone-guardian-service')) {
          
          const pidMatch = line.trim().match(/\s+(\d+)\s*$/);
          if (pidMatch) {
            guardianProcesses.push({
              pid: pidMatch[1],
              commandLine: line.trim()
            });
          }
        }
      }
      
      return guardianProcesses;
    } else {
      // Unix/Linux/macOS系统
      const { stdout } = await execAsync(
        'ps aux | grep -E "(guardian-service-worker|enhanced-device-guardian|device-id-guardian|standalone-guardian-service)" | grep -v grep'
      );
      
      const lines = stdout.split('\n').filter(line => line.trim());
      const guardianProcesses = [];
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          guardianProcesses.push({
            pid: parts[1],
            commandLine: line.trim()
          });
        }
      }
      
      return guardianProcesses;
    }
  } catch (error) {
    if (error.code === 1) {
      // 没有找到进程，这是正常的
      return [];
    }
    throw error;
  }
}

async function testGuardianLifecycle() {
  console.log('🧪 测试防护进程生命周期管理');
  console.log('=====================================');
  
  try {
    // 1. 检查当前防护进程状态
    console.log('\n📍 1. 检查当前防护进程状态');
    let processes = await findGuardianProcesses();
    
    if (processes.length > 0) {
      console.log(`发现 ${processes.length} 个防护进程:`);
      processes.forEach(proc => {
        console.log(`  - PID ${proc.pid}: ${proc.commandLine.substring(0, 100)}...`);
      });
    } else {
      console.log('✅ 当前没有运行中的防护进程');
    }
    
    // 2. 启动客户端并等待
    console.log('\n📍 2. 请手动启动客户端并启动防护服务');
    console.log('💡 启动防护后，按任意键继续...');
    
    // 等待用户输入
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    // 3. 检查防护进程是否启动
    console.log('\n📍 3. 检查防护进程是否已启动');
    processes = await findGuardianProcesses();
    
    if (processes.length > 0) {
      console.log(`✅ 发现 ${processes.length} 个防护进程:`);
      processes.forEach(proc => {
        console.log(`  - PID ${proc.pid}: ${proc.commandLine.substring(0, 100)}...`);
      });
    } else {
      console.log('❌ 没有发现防护进程，请检查是否正确启动');
      return;
    }
    
    // 4. 等待用户关闭客户端
    console.log('\n📍 4. 请关闭客户端，然后按任意键继续...');
    console.log('💡 可以通过以下方式关闭:');
    console.log('   - 点击窗口关闭按钮');
    console.log('   - 使用 Ctrl+C');
    console.log('   - 使用任务管理器');
    
    // 等待用户输入
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    // 5. 等待一段时间让清理逻辑执行
    console.log('\n📍 5. 等待清理逻辑执行...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 6. 检查防护进程是否已停止
    console.log('\n📍 6. 检查防护进程是否已停止');
    processes = await findGuardianProcesses();
    
    if (processes.length === 0) {
      console.log('✅ 所有防护进程已正确停止');
      console.log('🎉 生命周期管理测试通过！');
    } else {
      console.log(`❌ 仍有 ${processes.length} 个防护进程在运行:`);
      processes.forEach(proc => {
        console.log(`  - PID ${proc.pid}: ${proc.commandLine.substring(0, 100)}...`);
      });
      console.log('⚠️ 生命周期管理可能存在问题');
      
      // 7. 手动清理残留进程
      console.log('\n📍 7. 手动清理残留进程...');
      for (const proc of processes) {
        try {
          if (process.platform === 'win32') {
            await execAsync(`taskkill /F /PID ${proc.pid}`);
          } else {
            await execAsync(`kill -9 ${proc.pid}`);
          }
          console.log(`✅ 已终止进程 PID ${proc.pid}`);
        } catch (error) {
          console.log(`⚠️ 终止进程 ${proc.pid} 失败: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
if (require.main === module) {
  testGuardianLifecycle().then(() => {
    console.log('\n🏁 测试完成');
    process.exit(0);
  }).catch(error => {
    console.error('❌ 测试异常:', error);
    process.exit(1);
  });
}

module.exports = { findGuardianProcesses, testGuardianLifecycle };
