const DeviceManager = require('./modules/desktop-client/src/device-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

async function checkRealStatus() {
  console.log('🔍 检查实际增强防护状态...');
  
  try {
    const deviceManager = new DeviceManager();
    
    // 1. 检查增强防护状态
    console.log('\n1️⃣ 检查增强防护状态...');
    const status = await deviceManager.getEnhancedGuardianStatus();
    
    console.log(`总体防护: ${status.isGuarding ? '🟢 运行中' : '🔴 未运行'}`);
    console.log(`运行模式: ${status.mode || '未知'}`);
    console.log(`选择的IDE: ${status.selectedIDE || '未知'}`);
    console.log(`目标设备ID: ${status.targetDeviceId || '未设置'}`);
    console.log(`独立服务: ${status.standalone?.isRunning ? '🟢 运行' : '🔴 未运行'}`);
    console.log(`内置进程: ${status.inProcess?.isGuarding ? '🟢 运行' : '🔴 未运行'}`);
    
    // 2. 检查当前VS Code设备ID
    const vscodeStoragePath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Code',
      'User',
      'globalStorage',
      'storage.json'
    );
    
    console.log('\n2️⃣ 检查当前VS Code设备ID...');
    const currentData = await fs.readJson(vscodeStoragePath);
    const currentId = currentData["telemetry.devDeviceId"];
    console.log(`当前设备ID: ${currentId}`);
    console.log(`目标设备ID: ${status.targetDeviceId}`);
    
    const needsRecovery = currentId !== status.targetDeviceId;
    console.log(`需要恢复: ${needsRecovery ? '✅ 是' : '❌ 否'}`);
    
    // 3. 检查独立服务配置
    console.log('\n3️⃣ 检查独立服务配置...');
    const configPath = path.join(os.tmpdir(), 'augment-guardian-config.json');
    
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      console.log(`配置文件存在: ✅ 是`);
      console.log(`配置设备ID: ${config.deviceId}`);
      console.log(`配置IDE: ${config.options?.selectedIDE}`);
      console.log(`启动时间: ${config.startTime ? new Date(config.startTime).toLocaleString() : '未知'}`);
      
      // 检查配置是否匹配
      const configMatches = config.deviceId === status.targetDeviceId && 
                           config.options?.selectedIDE === status.selectedIDE;
      console.log(`配置匹配: ${configMatches ? '✅ 是' : '❌ 否'}`);
    } else {
      console.log(`配置文件存在: ❌ 否`);
    }
    
    // 4. 检查进程是否真的在运行
    console.log('\n4️⃣ 检查进程是否真的在运行...');
    if (status.standalone?.pid) {
      try {
        const result = execSync(`tasklist /FI "PID eq ${status.standalone.pid}" /FO CSV`, { encoding: 'utf8' });
        const processExists = result.includes(status.standalone.pid.toString());
        console.log(`进程${status.standalone.pid}存在: ${processExists ? '✅ 是' : '❌ 否'}`);
        
        if (!processExists) {
          console.log('⚠️ 独立服务PID存在但进程不存在，可能已崩溃');
        }
      } catch (error) {
        console.log(`检查进程失败: ${error.message}`);
      }
    }
    
    // 5. 检查文件监控
    console.log('\n5️⃣ 检查文件监控...');
    const logPath = path.join(os.tmpdir(), 'augment-guardian.log');
    
    if (await fs.pathExists(logPath)) {
      try {
        const logContent = await fs.readFile(logPath, 'utf8');
        const lastLines = logContent.split('\n').slice(-20).join('\n');
        console.log('最近的日志内容:');
        console.log(lastLines);
        
        // 检查是否有文件监控相关的日志
        const hasWatcherLogs = logContent.includes('文件监控') || 
                              logContent.includes('watcher') || 
                              logContent.includes('storage.json');
        console.log(`文件监控日志: ${hasWatcherLogs ? '✅ 有' : '❌ 无'}`);
      } catch (error) {
        console.log(`读取日志失败: ${error.message}`);
      }
    } else {
      console.log(`日志文件存在: ❌ 否`);
    }
    
    // 6. 手动触发恢复
    console.log('\n6️⃣ 手动触发恢复...');
    if (status.isGuarding && needsRecovery) {
      try {
        if (deviceManager.enhancedGuardian) {
          console.log('尝试通过内置守护进程恢复...');
          await deviceManager.enhancedGuardian.verifyAndRestoreDeviceId("vscode-global");
          
          // 检查是否恢复
          await new Promise(resolve => setTimeout(resolve, 2000));
          const afterData = await fs.readJson(vscodeStoragePath);
          const afterId = afterData["telemetry.devDeviceId"];
          console.log(`手动恢复后设备ID: ${afterId}`);
          
          const recovered = afterId === status.targetDeviceId;
          console.log(`手动恢复成功: ${recovered ? '✅ 是' : '❌ 否'}`);
          
          if (recovered) {
            console.log('\n🎉 手动恢复成功！问题可能是自动监控没有触发');
            return { success: true, reason: 'manual-recovery-worked' };
          }
        } else {
          console.log('❌ 内置守护进程不可用');
        }
      } catch (error) {
        console.log(`手动恢复失败: ${error.message}`);
      }
    } else {
      console.log('不需要手动恢复');
    }
    
    // 7. 分析可能的原因
    console.log('\n7️⃣ 分析可能的原因...');
    const reasons = [];
    
    if (!status.isGuarding) {
      reasons.push('增强防护未运行');
    }
    
    if (!status.targetDeviceId) {
      reasons.push('目标设备ID未设置');
    }
    
    if (status.selectedIDE !== 'vscode') {
      reasons.push('选择的IDE不是VS Code');
    }
    
    if (status.standalone?.isRunning && !status.standalone?.config) {
      reasons.push('独立服务运行但配置缺失');
    }
    
    if (reasons.length === 0) {
      reasons.push('文件监控可能没有检测到修改');
      reasons.push('定期验证可能没有触发');
      reasons.push('独立服务可能已崩溃但PID文件仍存在');
      reasons.push('storage.json文件可能被锁定或无法写入');
    }
    
    console.log('可能的原因:');
    reasons.forEach((reason, index) => {
      console.log(`${index + 1}. ${reason}`);
    });
    
    console.log('\n💡 建议解决方案:');
    console.log('1. 运行 node fix-config-issue.js 重新启动增强防护');
    console.log('2. 确保选择了VS Code作为目标IDE');
    console.log('3. 检查VS Code是否锁定了storage.json文件');
    
    return { success: false, reasons, currentId, targetId: status.targetDeviceId };
    
  } catch (error) {
    console.error('❌ 检查失败:', error);
    return { success: false, error: error.message };
  }
}

// 运行检查
checkRealStatus().then(result => {
  console.log('\n📊 检查完成:', result);
});
