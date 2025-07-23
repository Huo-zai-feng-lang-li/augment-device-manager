const DeviceManager = require('./modules/desktop-client/src/device-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

async function checkProcessStatus() {
  console.log('🔍 检测增强防护进程状态...');
  
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
    
    if (status.standalone?.pid) {
      console.log(`独立服务PID: ${status.standalone.pid}`);
    }
    
    // 2. 检查实际进程
    console.log('\n2️⃣ 检查实际进程...');
    
    try {
      // 检查Node.js进程中是否有guardian相关的
      const nodeProcesses = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', { encoding: 'utf8' });
      console.log('Node.js进程:');
      console.log(nodeProcesses);
      
      // 检查是否有guardian相关的进程
      const allProcesses = execSync('tasklist /FI "WINDOWTITLE eq *guardian*" /FO CSV', { encoding: 'utf8' });
      console.log('\nGuardian相关进程:');
      console.log(allProcesses);
      
      // 如果有PID，检查特定进程
      if (status.standalone?.pid) {
        const specificProcess = execSync(`tasklist /FI "PID eq ${status.standalone.pid}" /FO CSV`, { encoding: 'utf8' });
        const processExists = specificProcess.includes(status.standalone.pid.toString());
        console.log(`\n进程${status.standalone.pid}存在: ${processExists ? '✅ 是' : '❌ 否'}`);
        
        if (processExists) {
          console.log('进程详情:');
          console.log(specificProcess);
        }
      }
      
    } catch (error) {
      console.log(`检查进程失败: ${error.message}`);
    }
    
    // 3. 检查配置文件
    console.log('\n3️⃣ 检查配置文件...');
    const configPath = path.join(os.tmpdir(), 'augment-guardian-config.json');
    const pidPath = path.join(os.tmpdir(), 'augment-guardian.pid');
    const logPath = path.join(os.tmpdir(), 'augment-guardian.log');
    
    console.log(`配置文件存在: ${await fs.pathExists(configPath) ? '✅ 是' : '❌ 否'}`);
    console.log(`PID文件存在: ${await fs.pathExists(pidPath) ? '✅ 是' : '❌ 否'}`);
    console.log(`日志文件存在: ${await fs.pathExists(logPath) ? '✅ 是' : '❌ 否'}`);
    
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      console.log(`配置设备ID: ${config.deviceId}`);
      console.log(`配置IDE: ${config.options?.selectedIDE}`);
      console.log(`启动时间: ${config.startTime ? new Date(config.startTime).toLocaleString() : '未知'}`);
    }
    
    if (await fs.pathExists(pidPath)) {
      const pidContent = await fs.readFile(pidPath, 'utf8');
      console.log(`PID文件内容: ${pidContent.trim()}`);
    }
    
    // 4. 检查最新日志
    console.log('\n4️⃣ 检查最新日志...');
    if (await fs.pathExists(logPath)) {
      const logContent = await fs.readFile(logPath, 'utf8');
      const lastLines = logContent.split('\n').slice(-10).join('\n');
      console.log('最近10行日志:');
      console.log(lastLines);
      
      // 检查日志时间戳
      const lines = logContent.split('\n');
      const lastLogLine = lines.filter(line => line.trim()).pop();
      if (lastLogLine) {
        console.log(`最后一条日志: ${lastLogLine}`);
      }
    }
    
    // 5. 检查当前VS Code设备ID
    const vscodeStoragePath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Code',
      'User',
      'globalStorage',
      'storage.json'
    );
    
    console.log('\n5️⃣ 检查当前VS Code设备ID...');
    const currentData = await fs.readJson(vscodeStoragePath);
    const currentId = currentData["telemetry.devDeviceId"];
    console.log(`当前设备ID: ${currentId}`);
    console.log(`目标设备ID: ${status.targetDeviceId}`);
    
    const needsRecovery = currentId !== status.targetDeviceId;
    console.log(`需要恢复: ${needsRecovery ? '✅ 是' : '❌ 否'}`);
    
    // 6. 分析问题
    console.log('\n6️⃣ 问题分析...');
    const issues = [];
    
    if (!status.isGuarding) {
      issues.push('增强防护未运行');
    }
    
    if (status.selectedIDE !== 'vscode') {
      issues.push(`选择的IDE不是VS Code (当前: ${status.selectedIDE})`);
    }
    
    if (!status.targetDeviceId) {
      issues.push('目标设备ID未设置');
    }
    
    if (status.standalone?.isRunning && status.standalone?.pid) {
      try {
        const processCheck = execSync(`tasklist /FI "PID eq ${status.standalone.pid}" /FO CSV`, { encoding: 'utf8' });
        if (!processCheck.includes(status.standalone.pid.toString())) {
          issues.push('独立服务PID存在但进程已死亡');
        }
      } catch (error) {
        issues.push('无法检查独立服务进程状态');
      }
    }
    
    if (issues.length > 0) {
      console.log('发现的问题:');
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    } else {
      console.log('✅ 配置看起来正常，但可能存在其他问题');
    }
    
    // 7. 建议解决方案
    console.log('\n7️⃣ 建议解决方案...');
    if (issues.length > 0) {
      console.log('1. 运行 node fix-config-issue.js 重新启动增强防护');
      console.log('2. 确保选择VS Code作为目标IDE');
      console.log('3. 检查是否有其他程序干扰');
    } else {
      console.log('1. 尝试手动修改VS Code设备ID并等待5-10秒');
      console.log('2. 检查VS Code是否锁定了storage.json文件');
      console.log('3. 重启VS Code后再次测试');
    }
    
    return { 
      success: status.isGuarding && status.selectedIDE === 'vscode' && status.targetDeviceId,
      issues,
      status
    };
    
  } catch (error) {
    console.error('❌ 检测失败:', error);
    return { success: false, error: error.message };
  }
}

// 运行检测
checkProcessStatus().then(result => {
  console.log('\n📊 检测完成:', result.success ? '✅ 正常' : '❌ 有问题');
});
