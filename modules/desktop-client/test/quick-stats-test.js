/**
 * 快速统计测试 - 验证修复后的统计解析
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

async function quickStatsTest() {
  console.log('🚀 快速统计测试');
  console.log('='.repeat(50));

  try {
    // 1. 检查防护状态
    console.log('\n📍 1. 检查防护状态');
    const DeviceManager = require('../src/device-manager');
    const deviceManager = new DeviceManager();
    
    const status = await deviceManager.getEnhancedGuardianStatus();
    
    if (!status.isGuarding) {
      console.log('❌ 防护进程未运行，请先启动防护');
      return;
    }

    console.log(`✅ 防护进程运行中，模式: ${status.mode}`);

    // 2. 获取当前统计
    console.log('\n📍 2. 获取当前统计');
    const initialStats = parseStatsFromLogs(status.standalone?.recentLogs || []);
    console.log(`当前统计: ${JSON.stringify(initialStats)}`);

    // 3. 备份原始文件
    console.log('\n📍 3. 备份原始文件');
    let originalContent = {};
    if (await fs.pathExists(STORAGE_JSON_PATH)) {
      originalContent = await fs.readJson(STORAGE_JSON_PATH);
      console.log(`当前设备ID: ${originalContent['telemetry.devDeviceId']}`);
    }

    // 4. 执行一次拦截测试
    console.log('\n📍 4. 执行拦截测试');
    const testDeviceId = 'quick-test-' + Date.now();
    originalContent['telemetry.devDeviceId'] = testDeviceId;
    await fs.writeJson(STORAGE_JSON_PATH, originalContent, { spaces: 2 });
    console.log(`已修改设备ID为: ${testDeviceId}`);

    // 5. 等待防护响应
    console.log('\n📍 5. 等待防护响应');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 6. 检查恢复结果
    console.log('\n📍 6. 检查恢复结果');
    const afterContent = await fs.readJson(STORAGE_JSON_PATH);
    const afterDeviceId = afterContent['telemetry.devDeviceId'];
    console.log(`恢复后设备ID: ${afterDeviceId}`);

    if (afterDeviceId !== testDeviceId) {
      console.log('✅ 拦截成功，设备ID已恢复');
    } else {
      console.log('❌ 拦截失败，设备ID未恢复');
    }

    // 7. 等待统计更新
    console.log('\n📍 7. 等待统计更新');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 8. 获取更新后的统计
    console.log('\n📍 8. 获取更新后的统计');
    const updatedStatus = await deviceManager.getEnhancedGuardianStatus();
    const finalStats = parseStatsFromLogs(updatedStatus.standalone?.recentLogs || []);
    console.log(`更新后统计: ${JSON.stringify(finalStats)}`);

    // 9. 比较统计变化
    console.log('\n📍 9. 统计变化分析');
    const interceptDiff = finalStats.interceptedAttempts - initialStats.interceptedAttempts;
    console.log(`拦截次数变化: ${initialStats.interceptedAttempts} → ${finalStats.interceptedAttempts} (${interceptDiff > 0 ? '+' : ''}${interceptDiff})`);

    if (interceptDiff > 0) {
      console.log('✅ 统计数据正确更新！');
    } else {
      console.log('❌ 统计数据未更新');
    }

    // 10. 显示最近日志
    console.log('\n📍 10. 最近日志内容');
    if (updatedStatus.standalone?.recentLogs) {
      console.log(`日志条目数: ${updatedStatus.standalone.recentLogs.length}`);
      updatedStatus.standalone.recentLogs.slice(-5).forEach((log, index) => {
        console.log(`  ${index + 1}. ${log}`);
      });
    }

    console.log('\n🎉 快速统计测试完成');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 解析统计数据的函数（与客户端保持一致）
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
  quickStatsTest().catch(console.error);
}

module.exports = quickStatsTest;
