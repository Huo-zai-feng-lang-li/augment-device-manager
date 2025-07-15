/**
 * 诊断计数问题
 * 检查为什么修改设备ID后客户端计数没有累计
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

async function diagnoseCountingIssue() {
  console.log('🔍 诊断计数问题');
  console.log('='.repeat(60));

  try {
    // 1. 检查防护状态
    console.log('\n📍 1. 检查防护状态');
    const DeviceManager = require('../src/device-manager');
    const deviceManager = new DeviceManager();
    
    const status = await deviceManager.getEnhancedGuardianStatus();
    
    console.log(`防护运行状态: ${status.isGuarding ? '✅ 运行中' : '❌ 已停止'}`);
    console.log(`防护模式: ${status.mode}`);
    
    if (status.standalone) {
      console.log(`独立服务状态: ${status.standalone.isRunning ? '✅ 运行中' : '❌ 已停止'}`);
      console.log(`独立服务PID: ${status.standalone.pid || '未知'}`);
      console.log(`目标设备ID: ${status.standalone.config?.deviceId || '未知'}`);
    }

    if (!status.isGuarding) {
      console.log('❌ 防护进程未运行，这是计数不累计的原因！');
      return;
    }

    // 2. 检查storage.json当前内容
    console.log('\n📍 2. 检查storage.json当前内容');
    if (await fs.pathExists(STORAGE_JSON_PATH)) {
      const content = await fs.readJson(STORAGE_JSON_PATH);
      const currentDeviceId = content['telemetry.devDeviceId'];
      const targetDeviceId = status.standalone?.config?.deviceId;
      
      console.log(`当前文件中的设备ID: ${currentDeviceId}`);
      console.log(`防护目标设备ID: ${targetDeviceId}`);
      console.log(`是否匹配: ${currentDeviceId === targetDeviceId ? '✅ 匹配' : '❌ 不匹配'}`);
      
      if (currentDeviceId === targetDeviceId) {
        console.log('ℹ️ 设备ID已匹配，防护不会触发拦截操作');
        console.log('💡 需要修改为不同的ID才能触发拦截');
      } else {
        console.log('⚠️ 设备ID不匹配，防护应该会恢复目标ID');
      }
      
      // 检查文件修改时间
      const stats = await fs.stat(STORAGE_JSON_PATH);
      const lastModified = stats.mtime;
      const timeSinceModified = Date.now() - lastModified.getTime();
      console.log(`文件最后修改时间: ${lastModified.toISOString()}`);
      console.log(`距离现在: ${Math.round(timeSinceModified / 1000)}秒前`);
      
    } else {
      console.log('❌ storage.json文件不存在');
    }

    // 3. 检查最近的日志
    console.log('\n📍 3. 检查最近的日志');
    if (status.standalone?.recentLogs) {
      console.log(`日志条目数: ${status.standalone.recentLogs.length}`);
      console.log('最近10条日志:');
      status.standalone.recentLogs.slice(-10).forEach((log, index) => {
        console.log(`  ${index + 1}. ${log}`);
      });
    } else {
      console.log('⚠️ 无法获取日志内容');
    }

    // 4. 解析当前统计数据
    console.log('\n📍 4. 解析当前统计数据');
    const stats = parseStatsFromLogs(status.standalone?.recentLogs || []);
    console.log(`解析结果: ${JSON.stringify(stats, null, 2)}`);

    // 5. 检查是否有新的拦截事件
    console.log('\n📍 5. 检查最近是否有拦截事件');
    const recentLogs = status.standalone?.recentLogs || [];
    const recentInterceptLogs = recentLogs.filter(log => {
      const logText = typeof log === 'string' ? log : JSON.stringify(log);
      return logText.includes('保护恢复事件') || 
             logText.includes('设备ID已恢复') || 
             logText.includes('拦截') ||
             logText.includes('检测到设备ID被修改');
    });

    if (recentInterceptLogs.length > 0) {
      console.log(`✅ 发现${recentInterceptLogs.length}条拦截相关日志:`);
      recentInterceptLogs.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log}`);
      });
    } else {
      console.log('❌ 没有发现拦截相关的日志');
      console.log('💡 这说明防护进程可能没有检测到文件变化');
    }

    // 6. 实时测试
    console.log('\n📍 6. 执行实时测试');
    await performRealTimeTest(deviceManager);

  } catch (error) {
    console.error('❌ 诊断失败:', error.message);
  }
}

async function performRealTimeTest(deviceManager) {
  try {
    console.log('🧪 执行实时拦截测试...');
    
    // 获取当前状态
    const beforeStatus = await deviceManager.getEnhancedGuardianStatus();
    const beforeStats = parseStatsFromLogs(beforeStatus.standalone?.recentLogs || []);
    console.log(`测试前统计: ${JSON.stringify(beforeStats)}`);

    // 备份原始文件
    let originalContent = {};
    if (await fs.pathExists(STORAGE_JSON_PATH)) {
      originalContent = await fs.readJson(STORAGE_JSON_PATH);
    }

    const originalDeviceId = originalContent['telemetry.devDeviceId'];
    const testDeviceId = 'realtime-test-' + Date.now();

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
      console.log('✅ 拦截成功！设备ID已被恢复');
    } else if (afterDeviceId === testDeviceId) {
      console.log('❌ 拦截失败！设备ID未被恢复');
      console.log('💡 可能的原因：');
      console.log('   - 防护进程没有检测到文件变化');
      console.log('   - 文件监听器没有正常工作');
      console.log('   - 防护进程崩溃或停止');
    } else {
      console.log(`⚠️ 设备ID被恢复为其他值: ${afterDeviceId}`);
    }

    // 再次获取状态和统计
    console.log('⏳ 等待3秒，获取最新统计...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const afterStatus = await deviceManager.getEnhancedGuardianStatus();
    const afterStats = parseStatsFromLogs(afterStatus.standalone?.recentLogs || []);
    console.log(`测试后统计: ${JSON.stringify(afterStats)}`);

    const interceptDiff = afterStats.interceptedAttempts - beforeStats.interceptedAttempts;
    console.log(`拦截次数变化: ${beforeStats.interceptedAttempts} → ${afterStats.interceptedAttempts} (${interceptDiff > 0 ? '+' : ''}${interceptDiff})`);

    if (interceptDiff > 0) {
      console.log('✅ 统计数据正确更新！');
    } else {
      console.log('❌ 统计数据未更新');
      console.log('💡 可能的原因：');
      console.log('   - 日志解析逻辑有问题');
      console.log('   - 防护事件没有记录到日志');
      console.log('   - 客户端缓存了旧的统计数据');
    }

  } catch (error) {
    console.error('实时测试失败:', error.message);
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

// 运行诊断
if (require.main === module) {
  diagnoseCountingIssue().catch(console.error);
}

module.exports = diagnoseCountingIssue;
