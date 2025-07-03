/**
 * 测试UI刷新功能
 * 验证刷新按钮和自动刷新是否正常工作
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

async function testUIRefresh() {
  console.log('🚀 UI刷新功能测试');
  console.log('='.repeat(50));

  try {
    // 1. 检查防护状态
    console.log('\n📍 1. 检查防护状态');
    const DeviceManager = require('../src/device-manager');
    const deviceManager = new DeviceManager();
    
    let status = await deviceManager.getEnhancedGuardianStatus();
    
    if (!status.isGuarding) {
      console.log('⚠️ 防护进程未运行，启动防护进程...');
      const startResult = await deviceManager.startEnhancedGuardianIndependently({
        enableBackupMonitoring: true,
        enableDatabaseMonitoring: true,
        enableEnhancedProtection: true
      });
      
      if (!startResult.success) {
        throw new Error(`防护进程启动失败: ${startResult.message}`);
      }
      
      console.log('✅ 防护进程已启动');
      
      // 等待防护进程稳定
      await new Promise(resolve => setTimeout(resolve, 3000));
      status = await deviceManager.getEnhancedGuardianStatus();
    }

    console.log(`✅ 防护进程运行中，模式: ${status.mode}`);

    // 2. 获取初始统计
    console.log('\n📍 2. 获取初始统计');
    const initialStats = parseStatsFromLogs(status.standalone?.recentLogs || []);
    console.log(`初始统计: ${JSON.stringify(initialStats)}`);

    // 3. 执行拦截测试
    console.log('\n📍 3. 执行拦截测试');
    await performInterceptionTest();

    // 4. 测试自动刷新（等待10秒）
    console.log('\n📍 4. 测试自动刷新机制');
    console.log('等待10秒，观察自动刷新...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 5. 获取自动刷新后的统计
    console.log('\n📍 5. 检查自动刷新结果');
    const autoRefreshStatus = await deviceManager.getEnhancedGuardianStatus();
    const autoRefreshStats = parseStatsFromLogs(autoRefreshStatus.standalone?.recentLogs || []);
    console.log(`自动刷新后统计: ${JSON.stringify(autoRefreshStats)}`);

    // 6. 测试手动刷新
    console.log('\n📍 6. 测试手动刷新');
    console.log('模拟手动刷新...');
    const manualRefreshStatus = await deviceManager.getEnhancedGuardianStatus();
    const manualRefreshStats = parseStatsFromLogs(manualRefreshStatus.standalone?.recentLogs || []);
    console.log(`手动刷新后统计: ${JSON.stringify(manualRefreshStats)}`);

    // 7. 比较统计变化
    console.log('\n📍 7. 统计变化分析');
    const interceptDiff = manualRefreshStats.interceptedAttempts - initialStats.interceptedAttempts;
    console.log(`拦截次数变化: ${initialStats.interceptedAttempts} → ${manualRefreshStats.interceptedAttempts} (${interceptDiff > 0 ? '+' : ''}${interceptDiff})`);

    if (interceptDiff > 0) {
      console.log('✅ 统计数据正确更新！');
    } else {
      console.log('❌ 统计数据未更新');
    }

    // 8. 显示最近日志
    console.log('\n📍 8. 最近日志内容');
    if (manualRefreshStatus.standalone?.recentLogs) {
      console.log(`日志条目数: ${manualRefreshStatus.standalone.recentLogs.length}`);
      console.log('最近的日志:');
      manualRefreshStatus.standalone.recentLogs.slice(-5).forEach((log, index) => {
        console.log(`  ${index + 1}. ${log}`);
      });
    }

    console.log('\n🎉 UI刷新功能测试完成');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

async function performInterceptionTest() {
  // 备份原始文件
  let originalContent = {};
  if (await fs.pathExists(STORAGE_JSON_PATH)) {
    originalContent = await fs.readJson(STORAGE_JSON_PATH);
  }

  const originalDeviceId = originalContent['telemetry.devDeviceId'];
  console.log(`当前设备ID: ${originalDeviceId}`);

  // 执行拦截测试
  const testDeviceId = 'ui-refresh-test-' + Date.now();
  originalContent['telemetry.devDeviceId'] = testDeviceId;
  await fs.writeJson(STORAGE_JSON_PATH, originalContent, { spaces: 2 });
  console.log(`已修改设备ID为: ${testDeviceId}`);

  // 等待防护响应
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 检查恢复结果
  const afterContent = await fs.readJson(STORAGE_JSON_PATH);
  const afterDeviceId = afterContent['telemetry.devDeviceId'];
  console.log(`恢复后设备ID: ${afterDeviceId}`);

  if (afterDeviceId === originalDeviceId) {
    console.log('✅ 拦截测试成功，设备ID已恢复');
  } else {
    console.log('❌ 拦截测试失败，设备ID未恢复');
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

    // 拦截相关关键词（包括保护恢复事件）
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
      logText.includes('清理备份') ||
      logText.includes('实时删除备份')
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
  testUIRefresh().catch(console.error);
}

module.exports = testUIRefresh;
