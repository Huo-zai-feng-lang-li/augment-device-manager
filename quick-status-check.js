/**
 * 快速检查防护状态
 */

async function quickStatusCheck() {
  console.log('🔍 快速检查防护状态');
  console.log('=' .repeat(40));
  
  try {
    const DeviceManager = require('./modules/desktop-client/src/device-manager');
    const deviceManager = new DeviceManager();
    
    // 检查防护状态
    const status = await deviceManager.getEnhancedGuardianStatus();
    
    console.log(`总体防护: ${status.isGuarding ? '🟢 运行中' : '🔴 未运行'}`);
    console.log(`运行模式: ${status.mode || '未知'}`);
    console.log(`选择的IDE: ${status.selectedIDE || '未知'}`);
    console.log(`目标设备ID: ${status.targetDeviceId || '未设置'}`);
    console.log(`独立服务: ${status.standalone?.isRunning ? '🟢 运行' : '🔴 未运行'}`);
    console.log(`内置进程: ${status.inProcess?.isGuarding ? '🟢 运行' : '🔴 未运行'}`);
    
    if (status.standalone?.pid) {
      console.log(`独立服务PID: ${status.standalone.pid}`);
    }
    
    // 检查实际进程
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      const { stdout } = await execAsync('wmic process where "name=\'node.exe\'" get processid,commandline');
      const lines = stdout.split('\n');
      const guardianProcesses = lines.filter(line => 
        line.includes('guardian-service-worker.js') || 
        line.includes('enhanced-device-guardian') ||
        line.includes('device-id-guardian') ||
        line.includes('standalone-guardian-service')
      );
      
      console.log(`\n实际守护进程数量: ${guardianProcesses.length}`);
      if (guardianProcesses.length > 0) {
        console.log('运行中的守护进程:');
        guardianProcesses.forEach(process => {
          const pidMatch = process.trim().match(/\s+(\d+)\s*$/);
          if (pidMatch) {
            console.log(`  - PID: ${pidMatch[1]}`);
          }
        });
      }
      
    } catch (error) {
      console.log(`检查实际进程失败: ${error.message}`);
    }
    
    // 总结
    console.log('\n📊 状态总结:');
    if (!status.isGuarding && !status.standalone?.isRunning && !status.inProcess?.isGuarding) {
      console.log('✅ 所有防护进程都已停止');
      console.log('✅ 警告信息中提到的问题已解决');
    } else {
      console.log('⚠️ 仍有防护进程在运行');
    }
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  }
}

// 运行检查
if (require.main === module) {
  quickStatusCheck()
    .then(() => {
      console.log('\n✅ 检查完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 检查异常:', error);
      process.exit(1);
    });
}

module.exports = { quickStatusCheck };
