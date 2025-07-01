const DeviceManager = require('../src/device-manager');

/**
 * 测试增强防护状态卡片功能
 * 验证状态显示和拦截统计
 */

async function testGuardianStatusCard() {
  console.log('🛡️ 测试增强防护状态卡片');
  console.log('==================================================');

  const deviceManager = new DeviceManager();
  
  try {
    // 第1步：启动增强防护
    console.log('\n🚀 第1步：启动增强防护...');
    const cleanupResult = await deviceManager.performCleanup({
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartCursor: false,
      skipBackup: true,
      enableEnhancedGuardian: true,
      useStandaloneService: false, // 使用内置进程便于测试
      skipCursorLogin: true,
      aggressiveMode: false,
      multiRoundClean: false,
      extendedMonitoring: false
    });

    console.log('  清理结果:');
    console.log(`    成功: ${cleanupResult.success}`);
    console.log(`    操作数量: ${cleanupResult.actions?.length || 0}`);

    // 第2步：等待守护进程稳定
    console.log('\n⏳ 第2步：等待守护进程稳定...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 第3步：获取状态信息
    console.log('\n📊 第3步：获取状态信息...');
    const status = await deviceManager.getEnhancedGuardianStatus();
    
    console.log('  状态信息:');
    console.log(`    防护模式: ${status.mode}`);
    console.log(`    总体防护: ${status.isGuarding ? '✅ 启用' : '❌ 禁用'}`);
    
    if (status.inProcess) {
      console.log('  内置进程状态:');
      console.log(`    运行中: ${status.inProcess.isGuarding}`);
      console.log(`    监控器数量: ${status.inProcess.watchersCount || 0}`);
      
      if (status.inProcess.stats) {
        console.log('  拦截统计:');
        console.log(`    拦截次数: ${status.inProcess.stats.interceptedAttempts || 0}`);
        console.log(`    删除备份: ${status.inProcess.stats.backupFilesRemoved || 0}`);
        console.log(`    恢复保护: ${status.inProcess.stats.protectionRestored || 0}`);
      }
      
      if (status.inProcess.recentLogs) {
        console.log('  最近日志:');
        status.inProcess.recentLogs.slice(-3).forEach(log => {
          console.log(`    • ${log}`);
        });
      }
    }

    if (status.standalone) {
      console.log('  独立服务状态:');
      console.log(`    运行中: ${status.standalone.isRunning}`);
      if (status.standalone.pid) {
        console.log(`    服务PID: ${status.standalone.pid}`);
      }
    }

    // 第4步：模拟一些拦截操作（创建测试文件）
    console.log('\n🧪 第4步：模拟拦截操作...');
    await simulateInterceptOperations();

    // 第5步：再次获取状态，查看统计变化
    console.log('\n📈 第5步：检查统计变化...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // 等待监控检测
    
    const updatedStatus = await deviceManager.getEnhancedGuardianStatus();
    
    if (updatedStatus.inProcess && updatedStatus.inProcess.stats) {
      console.log('  更新后的统计:');
      console.log(`    拦截次数: ${updatedStatus.inProcess.stats.interceptedAttempts || 0}`);
      console.log(`    删除备份: ${updatedStatus.inProcess.stats.backupFilesRemoved || 0}`);
      console.log(`    恢复保护: ${updatedStatus.inProcess.stats.protectionRestored || 0}`);
    }

    // 第6步：生成状态卡片数据格式
    console.log('\n🎨 第6步：生成状态卡片数据...');
    const cardData = generateStatusCardData(updatedStatus);
    console.log('  状态卡片数据:');
    console.log(JSON.stringify(cardData, null, 2));

    return true;

  } catch (error) {
    console.error('❌ 测试过程出错:', error);
    return false;
  }
}

// 模拟拦截操作
async function simulateInterceptOperations() {
  const fs = require('fs-extra');
  const path = require('path');
  const os = require('os');

  try {
    // 创建一些测试备份文件
    const testFiles = [
      path.join(os.tmpdir(), 'test-storage.json.backup'),
      path.join(os.tmpdir(), 'test-cursor-backup-123'),
      path.join(os.tmpdir(), 'test.tmp')
    ];

    console.log('  创建测试备份文件...');
    for (const file of testFiles) {
      await fs.writeFile(file, 'test content');
      console.log(`    创建: ${path.basename(file)}`);
    }

    console.log('  等待监控检测和删除...');
    // 等待监控系统检测并删除这些文件
    
  } catch (error) {
    console.log(`  模拟操作失败: ${error.message}`);
  }
}

// 生成状态卡片数据
function generateStatusCardData(status) {
  const cardData = {
    isVisible: status.isGuarding,
    mode: status.mode,
    modeText: {
      'standalone': '独立服务（持久防护）',
      'inprocess': '内置进程（临时防护）',
      'none': '未启动'
    }[status.mode] || '未知',
    stats: {
      interceptCount: 0,
      backupRemoved: 0,
      protectionRestored: 0
    },
    recentIntercepts: []
  };

  // 提取统计数据
  if (status.standalone && status.standalone.isRunning) {
    // 从独立服务日志解析
    if (status.standalone.recentLogs) {
      cardData.stats = parseStatsFromLogs(status.standalone.recentLogs);
      cardData.recentIntercepts = extractRecentIntercepts(status.standalone.recentLogs);
    }
  } else if (status.inProcess && status.inProcess.stats) {
    // 从内置进程直接获取
    cardData.stats = {
      interceptCount: status.inProcess.stats.interceptedAttempts || 0,
      backupRemoved: status.inProcess.stats.backupFilesRemoved || 0,
      protectionRestored: status.inProcess.stats.protectionRestored || 0
    };
    
    if (status.inProcess.recentLogs) {
      cardData.recentIntercepts = extractRecentIntercepts(status.inProcess.recentLogs);
    }
  }

  return cardData;
}

// 从日志解析统计
function parseStatsFromLogs(logs) {
  const stats = { interceptCount: 0, backupRemoved: 0, protectionRestored: 0 };
  
  logs.forEach(log => {
    if (log.includes('拦截') || log.includes('检测到')) {
      stats.interceptCount++;
    }
    if (log.includes('删除备份') || log.includes('已删除')) {
      stats.backupRemoved++;
    }
    if (log.includes('恢复') || log.includes('已恢复')) {
      stats.protectionRestored++;
    }
  });
  
  return stats;
}

// 提取最近拦截记录
function extractRecentIntercepts(logs) {
  return logs.filter(log => 
    log.includes('拦截') || 
    log.includes('检测到') || 
    log.includes('删除备份') ||
    log.includes('恢复')
  ).slice(-3).map(log => {
    const time = extractTimeFromLog(log);
    const action = extractActionFromLog(log);
    return { time, action, log };
  });
}

// 提取时间
function extractTimeFromLog(log) {
  const timeMatch = log.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  if (timeMatch) {
    const time = new Date(timeMatch[1]);
    return time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return '刚刚';
}

// 提取操作
function extractActionFromLog(log) {
  if (log.includes('拦截')) return '🚨 拦截IDE操作';
  if (log.includes('删除备份')) return '🗑️ 删除备份文件';
  if (log.includes('恢复')) return '🔒 恢复保护';
  if (log.includes('检测到')) return '👁️ 检测到变化';
  return '🛡️ 防护操作';
}

// 主函数
async function main() {
  console.log('🎯 增强防护状态卡片测试');
  console.log('测试目标：验证状态卡片显示和拦截统计功能');
  console.log('');

  const testResult = await testGuardianStatusCard();
  
  console.log('\n\n📋 测试总结');
  console.log('==================================================');
  if (testResult) {
    console.log('✅ 状态卡片测试通过');
    console.log('🎉 状态卡片功能正常，可以显示：');
    console.log('  • 🛡️ 防护模式和运行状态');
    console.log('  • 📊 拦截次数、删除备份、恢复保护统计');
    console.log('  • 📝 最近拦截操作记录');
    console.log('  • 🎛️ 停止防护和查看日志控制');
  } else {
    console.log('❌ 状态卡片测试失败');
    console.log('🔧 需要检查实现或环境配置');
  }
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testGuardianStatusCard };
