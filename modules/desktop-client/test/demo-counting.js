/**
 * 演示计数功能
 * 修改设备ID为不同值来触发拦截计数
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

async function demoCounting() {
  console.log('🎯 演示计数功能');
  console.log('='.repeat(50));

  try {
    const DeviceManager = require('../src/device-manager');
    const deviceManager = new DeviceManager();
    
    // 1. 检查防护状态
    console.log('\n📍 1. 检查防护状态');
    const status = await deviceManager.getEnhancedGuardianStatus();
    
    if (!status.isGuarding) {
      console.log('❌ 防护进程未运行，请先启动防护');
      return;
    }

    console.log('✅ 防护进程运行中');
    const targetDeviceId = status.standalone?.config?.deviceId;
    console.log(`目标设备ID: ${targetDeviceId}`);

    // 2. 获取初始统计
    console.log('\n📍 2. 获取初始统计');
    const initialStats = parseStatsFromLogs(status.standalone?.recentLogs || []);
    console.log(`初始拦截次数: ${initialStats.interceptedAttempts}`);

    // 3. 执行3次拦截测试
    console.log('\n📍 3. 执行3次拦截测试');
    
    for (let i = 1; i <= 3; i++) {
      console.log(`\n🧪 第${i}次测试:`);
      
      // 读取当前内容
      const content = await fs.readJson(STORAGE_JSON_PATH);
      const currentDeviceId = content['telemetry.devDeviceId'];
      console.log(`  当前设备ID: ${currentDeviceId}`);
      
      // 修改为不同的测试ID
      const testDeviceId = `demo-test-${i}-${Date.now()}`;
      content['telemetry.devDeviceId'] = testDeviceId;
      await fs.writeJson(STORAGE_JSON_PATH, content, { spaces: 2 });
      console.log(`  ✅ 已修改为: ${testDeviceId}`);
      
      // 等待防护响应
      console.log(`  ⏳ 等待3秒...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 检查恢复结果
      const afterContent = await fs.readJson(STORAGE_JSON_PATH);
      const afterDeviceId = afterContent['telemetry.devDeviceId'];
      console.log(`  恢复后设备ID: ${afterDeviceId}`);
      
      if (afterDeviceId === targetDeviceId) {
        console.log(`  ✅ 第${i}次拦截成功！`);
      } else {
        console.log(`  ❌ 第${i}次拦截失败`);
      }
      
      // 间隔一下
      if (i < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 4. 等待统计更新
    console.log('\n📍 4. 等待统计更新');
    console.log('⏳ 等待15秒让统计数据更新...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // 5. 获取最终统计
    console.log('\n📍 5. 获取最终统计');
    const finalStatus = await deviceManager.getEnhancedGuardianStatus();
    const finalStats = parseStatsFromLogs(finalStatus.standalone?.recentLogs || []);
    
    const interceptDiff = finalStats.interceptedAttempts - initialStats.interceptedAttempts;
    console.log(`最终拦截次数: ${finalStats.interceptedAttempts}`);
    console.log(`拦截次数增加: ${interceptDiff > 0 ? '+' : ''}${interceptDiff}`);

    if (interceptDiff >= 3) {
      console.log('🎉 计数功能正常！3次拦截都被记录');
    } else if (interceptDiff > 0) {
      console.log(`⚠️ 部分拦截被记录 (${interceptDiff}/3)`);
    } else {
      console.log('❌ 拦截未被记录到统计中');
    }

    // 6. 显示最新日志
    console.log('\n📍 6. 最新日志');
    if (finalStatus.standalone?.recentLogs) {
      console.log('最近5条日志:');
      finalStatus.standalone.recentLogs.slice(-5).forEach((log, index) => {
        console.log(`  ${index + 1}. ${log}`);
      });
    }

    console.log('\n💡 现在你可以：');
    console.log('1. 在客户端界面中看到更新的拦截计数');
    console.log('2. 点击刷新按钮查看最新统计');
    console.log('3. 继续手动修改storage.json测试');

  } catch (error) {
    console.error('❌ 演示失败:', error.message);
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

// 运行演示
if (require.main === module) {
  demoCounting().catch(console.error);
}

module.exports = demoCounting;
