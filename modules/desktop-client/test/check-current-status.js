/**
 * 检查当前防护状态和storage.json内容
 */

const path = require('path');
const fs = require('fs-extra');
const os = require('os');

const STORAGE_JSON_PATH = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'Cursor',
  'User',
  'globalStorage',
  'storage.json'
);

async function checkCurrentStatus() {
  console.log('🔍 检查当前状态');
  console.log('='.repeat(50));

  try {
    // 1. 检查防护状态
    console.log('\n📍 1. 防护进程状态:');
    const DeviceManager = require('../src/device-manager');
    const deviceManager = new DeviceManager();
    
    const status = await deviceManager.getEnhancedGuardianStatus();
    console.log(JSON.stringify({
      isGuarding: status.isGuarding,
      mode: status.mode,
      standalone: {
        isRunning: status.standalone?.isRunning,
        pid: status.standalone?.pid,
        deviceId: status.standalone?.config?.deviceId
      },
      inProcess: {
        isGuarding: status.inProcess?.isGuarding
      }
    }, null, 2));

    // 2. 检查storage.json文件
    console.log('\n📍 2. storage.json文件状态:');
    if (await fs.pathExists(STORAGE_JSON_PATH)) {
      const content = await fs.readJson(STORAGE_JSON_PATH);
      console.log(`文件路径: ${STORAGE_JSON_PATH}`);
      console.log(`当前设备ID: ${content['telemetry.devDeviceId']}`);
      console.log(`文件大小: ${JSON.stringify(content).length} 字符`);
      
      // 显示文件的修改时间
      const stats = await fs.stat(STORAGE_JSON_PATH);
      console.log(`最后修改时间: ${stats.mtime.toISOString()}`);
    } else {
      console.log('❌ storage.json文件不存在');
    }

    // 3. 检查目标设备ID匹配情况
    console.log('\n📍 3. 设备ID匹配情况:');
    if (status.isGuarding && status.standalone?.config?.deviceId) {
      const targetDeviceId = status.standalone.config.deviceId;
      const currentContent = await fs.readJson(STORAGE_JSON_PATH);
      const currentDeviceId = currentContent['telemetry.devDeviceId'];
      
      console.log(`防护目标ID: ${targetDeviceId}`);
      console.log(`当前文件ID: ${currentDeviceId}`);
      console.log(`是否匹配: ${targetDeviceId === currentDeviceId ? '✅ 是' : '❌ 否'}`);
      
      if (targetDeviceId !== currentDeviceId) {
        console.log('⚠️ 设备ID不匹配，防护应该会恢复目标ID');
      } else {
        console.log('ℹ️ 设备ID已匹配，防护不会触发恢复');
      }
    } else {
      console.log('⚠️ 无法获取防护目标设备ID');
    }

    // 4. 检查日志文件
    console.log('\n📍 4. 防护日志:');
    const logPath = path.join(os.tmpdir(), 'guardian-service.log');
    if (await fs.pathExists(logPath)) {
      const logContent = await fs.readFile(logPath, 'utf8');
      const lines = logContent.split('\n').slice(-10); // 最后10行
      console.log('最近的日志（最后10行）:');
      lines.forEach(line => {
        if (line.trim()) {
          console.log(`  ${line}`);
        }
      });
    } else {
      console.log('⚠️ 未找到防护日志文件');
    }

  } catch (error) {
    console.error('❌ 检查状态失败:', error.message);
  }
}

// 运行检查
if (require.main === module) {
  checkCurrentStatus().catch(console.error);
}

module.exports = checkCurrentStatus;
