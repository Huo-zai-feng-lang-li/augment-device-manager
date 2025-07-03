/**
 * 启动防护并测试计数功能
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

async function startGuardianAndTest() {
  console.log('🚀 启动防护并测试计数功能');
  console.log('='.repeat(50));

  try {
    // 1. 启动防护进程
    console.log('\n📍 1. 启动防护进程');
    const DeviceManager = require('../src/device-manager');
    const deviceManager = new DeviceManager();
    
    const startResult = await deviceManager.startEnhancedGuardianIndependently({
      enableBackupMonitoring: true,
      enableDatabaseMonitoring: true,
      enableEnhancedProtection: true
    });

    console.log(`启动结果: ${startResult.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`启动消息: ${startResult.message}`);
    console.log(`防护模式: ${startResult.mode}`);

    if (!startResult.success) {
      throw new Error(`防护启动失败: ${startResult.message}`);
    }

    // 2. 等待防护进程稳定
    console.log('\n📍 2. 等待防护进程稳定');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 3. 验证防护状态
    console.log('\n📍 3. 验证防护状态');
    const status = await deviceManager.getEnhancedGuardianStatus();
    
    console.log(`防护运行状态: ${status.isGuarding ? '✅ 运行中' : '❌ 已停止'}`);
    console.log(`防护模式: ${status.mode}`);
    
    if (status.standalone) {
      console.log(`独立服务状态: ${status.standalone.isRunning ? '✅ 运行中' : '❌ 已停止'}`);
      console.log(`独立服务PID: ${status.standalone.pid || '未知'}`);
      console.log(`目标设备ID: ${status.standalone.config?.deviceId || '未知'}`);
    }

    if (!status.isGuarding) {
      throw new Error('防护进程启动后状态异常');
    }

    // 4. 获取初始统计
    console.log('\n📍 4. 获取初始统计');
    const initialStats = parseStatsFromLogs(status.standalone?.recentLogs || []);
    console.log(`初始统计: ${JSON.stringify(initialStats)}`);

    // 5. 检查当前storage.json
    console.log('\n📍 5. 检查当前storage.json');
    if (await fs.pathExists(STORAGE_JSON_PATH)) {
      const content = await fs.readJson(STORAGE_JSON_PATH);
      const currentDeviceId = content['telemetry.devDeviceId'];
      const targetDeviceId = status.standalone?.config?.deviceId;
      
      console.log(`当前文件中的设备ID: ${currentDeviceId}`);
      console.log(`防护目标设备ID: ${targetDeviceId}`);
      console.log(`是否匹配: ${currentDeviceId === targetDeviceId ? '✅ 匹配' : '❌ 不匹配'}`);
    }

    // 6. 执行拦截测试
    console.log('\n📍 6. 执行拦截测试');
    await performInterceptionTest(deviceManager);

    console.log('\n🎉 防护启动和测试完成！');
    console.log('\n💡 现在你可以：');
    console.log('1. 在客户端界面中看到防护状态为"运行中"');
    console.log('2. 手动修改storage.json中的设备ID');
    console.log('3. 观察客户端界面的拦截计数增加');
    console.log('4. 点击刷新按钮查看最新统计');

  } catch (error) {
    console.error('❌ 操作失败:', error.message);
  }
}

async function performInterceptionTest(deviceManager) {
  try {
    console.log('🧪 执行拦截测试验证功能...');
    
    // 获取测试前统计
    const beforeStatus = await deviceManager.getEnhancedGuardianStatus();
    const beforeStats = parseStatsFromLogs(beforeStatus.standalone?.recentLogs || []);
    console.log(`测试前统计: ${JSON.stringify(beforeStats)}`);

    // 备份原始文件
    let originalContent = {};
    if (await fs.pathExists(STORAGE_JSON_PATH)) {
      originalContent = await fs.readJson(STORAGE_JSON_PATH);
    }

    const originalDeviceId = originalContent['telemetry.devDeviceId'];
    const testDeviceId = 'test-counting-' + Date.now();

    console.log(`原始设备ID: ${originalDeviceId}`);
    console.log(`测试设备ID: ${testDeviceId}`);

    // 修改设备ID
    originalContent['telemetry.devDeviceId'] = testDeviceId;
    await fs.writeJson(STORAGE_JSON_PATH, originalContent, { spaces: 2 });
    console.log('✅ 已修改设备ID');

    // 等待防护响应
    console.log('⏳ 等待5秒，观察防护响应...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 检查文件是否被恢复
    const afterContent = await fs.readJson(STORAGE_JSON_PATH);
    const afterDeviceId = afterContent['telemetry.devDeviceId'];
    console.log(`恢复后设备ID: ${afterDeviceId}`);

    if (afterDeviceId === originalDeviceId) {
      console.log('✅ 拦截测试成功！设备ID已被恢复');
    } else {
      console.log('❌ 拦截测试失败！设备ID未被恢复');
    }

    // 等待统计更新
    console.log('⏳ 等待10秒，让统计数据更新...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 获取测试后统计
    const afterStatus = await deviceManager.getEnhancedGuardianStatus();
    const afterStats = parseStatsFromLogs(afterStatus.standalone?.recentLogs || []);
    console.log(`测试后统计: ${JSON.stringify(afterStats)}`);

    const interceptDiff = afterStats.interceptedAttempts - beforeStats.interceptedAttempts;
    console.log(`拦截次数变化: ${beforeStats.interceptedAttempts} → ${afterStats.interceptedAttempts} (${interceptDiff > 0 ? '+' : ''}${interceptDiff})`);

    if (interceptDiff > 0) {
      console.log('✅ 统计数据正确更新！');
    } else {
      console.log('❌ 统计数据未更新，但防护功能正常');
    }

  } catch (error) {
    console.error('拦截测试失败:', error.message);
  }
}

// 解析统计数据的函数
function parseStatsFromLogs(logs) {
  const stats = {
    interceptedAttempts: 0,
    backupFilesRemoved: 0,
    protectionRestored: 0
  };

  if (!logs || !Array.isArray(logs)) {
    return stats;
  }

  logs.forEach(logEntry => {
    let logText = '';
    if (typeof logEntry === 'string') {
      logText = logEntry;
    } else if (logEntry && typeof logEntry === 'object') {
      logText = logEntry.message || logEntry.text || logEntry.content || JSON.stringify(logEntry);
    }

    // 拦截相关关键词
    if (
      logText.includes('拦截') ||
      logText.includes('检测到') ||
      logText.includes('阻止') ||
      logText.includes('修改被拦截') ||
      logText.includes('IDE尝试') ||
      logText.includes('已拦截') ||
      logText.includes('保护恢复事件') ||
      logText.includes('设备ID已恢复') ||
      logText.includes('设备ID被篡改')
    ) {
      stats.interceptedAttempts++;
    }

    // 删除备份相关关键词
    if (
      logText.includes('删除备份') ||
      logText.includes('已删除') ||
      logText.includes('备份文件') ||
      logText.includes('清理备份')
    ) {
      stats.backupFilesRemoved++;
    }

    // 恢复保护相关关键词
    if (
      logText.includes('恢复') ||
      logText.includes('已恢复') ||
      logText.includes('保护恢复') ||
      logText.includes('重新保护')
    ) {
      stats.protectionRestored++;
    }
  });

  return stats;
}

// 运行测试
if (require.main === module) {
  startGuardianAndTest().catch(console.error);
}

module.exports = startGuardianAndTest;
