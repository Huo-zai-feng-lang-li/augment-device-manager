#!/usr/bin/env node

/**
 * 简化清理测试 - 专注于关键指标
 * 目标：验证telemetry.devDeviceId是否能成功更新
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function simpleCleanupTest() {
  console.log('🧪 简化清理测试 - 专注于关键指标');
  console.log('=' .repeat(50));
  console.log('🎯 目标：验证telemetry.devDeviceId更新');
  console.log('');

  try {
    // 1. 检查清理前的devDeviceId
    console.log('📊 第1步：检查清理前状态...');
    const beforeDeviceId = await getDeviceId();
    console.log(`  清理前devDeviceId: ${beforeDeviceId || '未找到'}`);

    // 2. 强制关闭Cursor
    console.log('\n🔪 第2步：强制关闭Cursor IDE...');
    await forceCloseCursor();

    // 3. 执行关键清理操作
    console.log('\n🧹 第3步：执行关键清理操作...');
    await performKeyCleanup();

    // 4. 重新启动Cursor
    console.log('\n🚀 第4步：重新启动Cursor IDE...');
    await startCursor();

    // 5. 等待Cursor初始化
    console.log('\n⏳ 第5步：等待Cursor初始化（30秒）...');
    await sleep(30000);

    // 6. 检查清理后的devDeviceId
    console.log('\n📊 第6步：检查清理后状态...');
    const afterDeviceId = await getDeviceId();
    console.log(`  清理后devDeviceId: ${afterDeviceId || '未找到'}`);

    // 7. 分析结果
    console.log('\n📋 第7步：分析清理效果...');
    const success = analyzeResults(beforeDeviceId, afterDeviceId);

    console.log('\n🎯 简化清理测试完成！');
    return success;

  } catch (error) {
    console.error('❌ 简化清理测试失败:', error.message);
    return false;
  }
}

// 获取当前的devDeviceId
async function getDeviceId() {
  try {
    const storageJsonPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );

    if (await fs.pathExists(storageJsonPath)) {
      const data = await fs.readJson(storageJsonPath);
      return data['telemetry.devDeviceId'];
    }
    return null;
  } catch (error) {
    return null;
  }
}

// 强制关闭Cursor
async function forceCloseCursor() {
  const commands = [
    'taskkill /f /im "Cursor.exe" /t',
    'wmic process where "name=\'Cursor.exe\'" delete',
    'wmic process where "name=\'cursor.exe\'" delete',
  ];

  for (const cmd of commands) {
    try {
      await execAsync(cmd);
      console.log(`  ✅ 执行: ${cmd}`);
    } catch (error) {
      // 忽略进程不存在的错误
    }
  }

  // 等待进程完全终止
  await sleep(3000);
  console.log('  ✅ Cursor IDE已强制关闭');
}

// 执行关键清理操作
async function performKeyCleanup() {
  const cleanupTargets = [
    // 关键文件
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'storage.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
    
    // 工作区数据
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'workspaceStorage'),
    
    // 缓存目录
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'Cache'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'CachedData'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'logs'),
  ];

  for (const target of cleanupTargets) {
    try {
      if (await fs.pathExists(target)) {
        await fs.remove(target);
        console.log(`  🗑️ 已清理: ${path.basename(target)}`);
      }
    } catch (error) {
      console.log(`  ⚠️ 清理失败: ${path.basename(target)} - ${error.message}`);
    }
  }

  console.log('  ✅ 关键清理操作完成');
}

// 启动Cursor
async function startCursor() {
  try {
    // 尝试多个可能的Cursor路径
    const cursorPaths = [
      'E:\\cursor\\Cursor.exe',
      'C:\\Program Files\\Cursor\\Cursor.exe',
      'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\Programs\\cursor\\Cursor.exe',
    ];

    let cursorPath = null;
    for (const path of cursorPaths) {
      if (await fs.pathExists(path)) {
        cursorPath = path;
        break;
      }
    }

    if (cursorPath) {
      // 启动Cursor（分离进程）
      const { spawn } = require('child_process');
      const cursorProcess = spawn(cursorPath, [], { 
        detached: true,
        stdio: 'ignore'
      });
      cursorProcess.unref();
      
      console.log(`  ✅ Cursor IDE已启动: ${cursorPath}`);
    } else {
      console.log('  ⚠️ 未找到Cursor IDE，请手动启动');
    }
  } catch (error) {
    console.log(`  ⚠️ 启动Cursor失败: ${error.message}`);
  }
}

// 分析清理结果
function analyzeResults(beforeDeviceId, afterDeviceId) {
  console.log('\n📊 清理效果分析:');
  
  const oldDeviceId = '36987e70-60fe-4401-85a4-f463c269f069';
  
  // 检查设备ID是否更新
  const deviceIdUpdated = beforeDeviceId !== afterDeviceId && 
                         afterDeviceId && 
                         afterDeviceId !== oldDeviceId;
  
  console.log(`  🆔 设备ID更新: ${deviceIdUpdated ? '✅ 成功' : '❌ 失败'}`);
  
  if (deviceIdUpdated) {
    console.log(`    旧ID: ${beforeDeviceId}`);
    console.log(`    新ID: ${afterDeviceId}`);
  }
  
  // 检查是否摆脱了顽固的旧ID
  const escapedOldId = afterDeviceId !== oldDeviceId;
  console.log(`  🔓 摆脱顽固ID: ${escapedOldId ? '✅ 成功' : '❌ 失败'}`);
  
  // 计算成功率
  let successRate = 0;
  if (deviceIdUpdated) successRate += 70; // 设备ID更新最重要
  if (escapedOldId) successRate += 30;     // 摆脱旧ID
  
  console.log(`  📊 关键指标成功率: ${successRate}%`);
  
  // 给出结论
  if (successRate >= 90) {
    console.log('  🎉 清理效果优秀！Augment扩展应该识别为新用户');
  } else if (successRate >= 70) {
    console.log('  ⚠️ 清理效果良好，但可能需要进一步优化');
  } else {
    console.log('  ❌ 清理效果不佳，需要使用更激进的清理方案');
  }
  
  return successRate >= 70;
}

// 睡眠函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 主执行函数
if (require.main === module) {
  simpleCleanupTest().then(success => {
    console.log(`\n📋 测试结果: ${success ? '✅ 成功' : '❌ 失败'}`);
    process.exit(success ? 0 : 1);
  }).catch(console.error);
}

module.exports = { simpleCleanupTest };
