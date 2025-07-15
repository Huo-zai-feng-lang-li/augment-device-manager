#!/usr/bin/env node

/**
 * 激进清理测试 - 实时阻止ID恢复
 * 策略：在Cursor启动时持续监控和强制更新devDeviceId
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');

const execAsync = promisify(exec);

async function aggressiveCleanupTest() {
  console.log('💥 激进清理测试 - 实时阻止ID恢复');
  console.log('=' .repeat(50));
  console.log('🎯 策略：持续监控和强制更新devDeviceId');
  console.log('');

  try {
    // 1. 检查清理前状态
    console.log('📊 第1步：检查清理前状态...');
    const beforeDeviceId = await getDeviceId();
    console.log(`  清理前devDeviceId: ${beforeDeviceId || '未找到'}`);

    // 2. 生成新的设备ID
    console.log('\n🆔 第2步：生成新的设备ID...');
    const newDeviceId = generateNewDeviceId();
    console.log(`  新设备ID: ${newDeviceId}`);

    // 3. 强制关闭Cursor
    console.log('\n🔪 第3步：强制关闭Cursor IDE...');
    await forceCloseCursor();

    // 4. 执行彻底清理
    console.log('\n🧹 第4步：执行彻底清理...');
    await performThoroughCleanup();

    // 5. 预设新的设备ID
    console.log('\n🔧 第5步：预设新的设备ID...');
    await presetNewDeviceId(newDeviceId);

    // 6. 启动Cursor并开始实时监控
    console.log('\n🚀 第6步：启动Cursor并开始实时监控...');
    await startCursorWithMonitoring(newDeviceId);

    // 7. 验证最终结果
    console.log('\n📊 第7步：验证最终结果...');
    const finalDeviceId = await getDeviceId();
    console.log(`  最终devDeviceId: ${finalDeviceId || '未找到'}`);

    // 8. 分析结果
    const success = analyzeAggressiveResults(beforeDeviceId, finalDeviceId, newDeviceId);
    
    console.log('\n💥 激进清理测试完成！');
    return success;

  } catch (error) {
    console.error('❌ 激进清理测试失败:', error.message);
    return false;
  }
}

// 生成新的设备ID
function generateNewDeviceId() {
  // 生成类似Cursor格式的UUID
  const uuid = crypto.randomUUID();
  return uuid;
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

  await sleep(3000);
  console.log('  ✅ Cursor IDE已强制关闭');
}

// 执行彻底清理
async function performThoroughCleanup() {
  const cleanupTargets = [
    // 用户数据
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor'),
    path.join(os.homedir(), 'AppData', 'Local', 'Cursor'),
    
    // 临时文件
    path.join(os.tmpdir(), 'cursor-*'),
  ];

  for (const target of cleanupTargets) {
    try {
      if (await fs.pathExists(target)) {
        await fs.remove(target);
        console.log(`  🗑️ 已清理: ${path.basename(target)}`);
      }
    } catch (error) {
      console.log(`  ⚠️ 清理失败: ${path.basename(target)}`);
    }
  }

  // 清理注册表
  try {
    await execAsync('reg delete "HKEY_CURRENT_USER\\Software\\Cursor" /f');
    console.log('  🗑️ 已清理注册表');
  } catch (error) {
    // 忽略注册表清理失败
  }

  console.log('  ✅ 彻底清理完成');
}

// 预设新的设备ID
async function presetNewDeviceId(newDeviceId) {
  try {
    const storageDir = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage'
    );

    await fs.ensureDir(storageDir);

    // 创建预设的storage.json
    const presetData = {
      'telemetry.devDeviceId': newDeviceId,
      'telemetry.machineId': crypto.randomBytes(32).toString('hex'),
      'telemetry.macMachineId': crypto.randomBytes(32).toString('hex'),
      'telemetry.sqmId': `{${newDeviceId.toUpperCase()}}`,
      'telemetry.firstSessionDate': new Date().toUTCString(),
      'telemetry.currentSessionDate': new Date().toUTCString(),
    };

    const storageJsonPath = path.join(storageDir, 'storage.json');
    await fs.writeJson(storageJsonPath, presetData, { spaces: 2 });

    console.log(`  ✅ 已预设新设备ID: ${newDeviceId}`);
  } catch (error) {
    console.log(`  ⚠️ 预设设备ID失败: ${error.message}`);
  }
}

// 启动Cursor并开始实时监控
async function startCursorWithMonitoring(newDeviceId) {
  try {
    // 启动Cursor
    const cursorPath = 'E:\\cursor\\Cursor.exe';
    if (await fs.pathExists(cursorPath)) {
      const { spawn } = require('child_process');
      const cursorProcess = spawn(cursorPath, [], { 
        detached: true,
        stdio: 'ignore'
      });
      cursorProcess.unref();
      
      console.log(`  ✅ Cursor IDE已启动: ${cursorPath}`);
    }

    // 开始实时监控（60秒）
    console.log('  🔄 开始实时监控，强制维持新设备ID...');
    
    const monitoringDuration = 60000; // 60秒
    const checkInterval = 2000; // 每2秒检查一次
    const startTime = Date.now();
    
    let updateCount = 0;
    
    const monitoringTask = setInterval(async () => {
      try {
        const currentDeviceId = await getDeviceId();
        const oldDeviceId = '36987e70-60fe-4401-85a4-f463c269f069';
        
        // 如果检测到旧ID，立即强制更新
        if (currentDeviceId === oldDeviceId) {
          await forceUpdateDeviceId(newDeviceId);
          updateCount++;
          console.log(`    🔄 检测到旧ID恢复，已强制更新 (第${updateCount}次)`);
        }
        
        // 检查是否超时
        if (Date.now() - startTime > monitoringDuration) {
          clearInterval(monitoringTask);
          console.log(`  ✅ 监控完成，共执行 ${updateCount} 次强制更新`);
        }
      } catch (error) {
        // 忽略监控过程中的错误
      }
    }, checkInterval);

    // 等待监控完成
    await sleep(monitoringDuration + 1000);
    
  } catch (error) {
    console.log(`  ⚠️ 启动和监控失败: ${error.message}`);
  }
}

// 强制更新设备ID
async function forceUpdateDeviceId(newDeviceId) {
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
      
      // 强制更新所有相关ID
      data['telemetry.devDeviceId'] = newDeviceId;
      data['telemetry.machineId'] = crypto.randomBytes(32).toString('hex');
      data['telemetry.macMachineId'] = crypto.randomBytes(32).toString('hex');
      data['telemetry.sqmId'] = `{${newDeviceId.toUpperCase()}}`;
      data['telemetry.currentSessionDate'] = new Date().toUTCString();
      
      await fs.writeJson(storageJsonPath, data, { spaces: 2 });
    }
  } catch (error) {
    // 忽略强制更新失败
  }
}

// 分析激进清理结果
function analyzeAggressiveResults(beforeDeviceId, finalDeviceId, targetDeviceId) {
  console.log('\n📊 激进清理效果分析:');
  
  const oldDeviceId = '36987e70-60fe-4401-85a4-f463c269f069';
  
  // 检查是否成功更新为目标ID
  const achievedTarget = finalDeviceId === targetDeviceId;
  console.log(`  🎯 达到目标ID: ${achievedTarget ? '✅ 成功' : '❌ 失败'}`);
  
  // 检查是否摆脱了顽固的旧ID
  const escapedOldId = finalDeviceId !== oldDeviceId;
  console.log(`  🔓 摆脱顽固ID: ${escapedOldId ? '✅ 成功' : '❌ 失败'}`);
  
  // 检查ID是否发生了变化
  const idChanged = beforeDeviceId !== finalDeviceId;
  console.log(`  🔄 ID发生变化: ${idChanged ? '✅ 成功' : '❌ 失败'}`);
  
  if (finalDeviceId) {
    console.log(`    最终ID: ${finalDeviceId}`);
  }
  
  // 计算成功率
  let successRate = 0;
  if (achievedTarget) successRate += 50;
  if (escapedOldId) successRate += 30;
  if (idChanged) successRate += 20;
  
  console.log(`  📊 激进清理成功率: ${successRate}%`);
  
  // 给出结论
  if (successRate >= 80) {
    console.log('  🎉 激进清理成功！Augment扩展应该识别为新用户');
  } else if (successRate >= 50) {
    console.log('  ⚠️ 激进清理部分成功，可能需要核弹级清理');
  } else {
    console.log('  ❌ 激进清理失败，建议使用核弹级清理方案');
  }
  
  return successRate >= 50;
}

// 睡眠函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 主执行函数
if (require.main === module) {
  aggressiveCleanupTest().then(success => {
    console.log(`\n📋 激进清理测试结果: ${success ? '✅ 成功' : '❌ 失败'}`);
    process.exit(success ? 0 : 1);
  }).catch(console.error);
}

module.exports = { aggressiveCleanupTest };
