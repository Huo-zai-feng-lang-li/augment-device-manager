#!/usr/bin/env node

/**
 * 超级激进清理测试
 * 使用最强力的策略确保设备ID更新且登录状态保留
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');

const execAsync = promisify(exec);

async function superAggressiveCleanup() {
  console.log('💥 超级激进清理测试');
  console.log('=' .repeat(50));
  console.log('🎯 策略：最强力监控 + 完整登录保留');
  console.log('');

  try {
    // 1. 检查清理前状态
    console.log('📊 第1步：检查清理前状态...');
    const beforeDeviceId = await getCurrentDeviceId();
    const beforeLoginData = await getFullLoginData();
    
    console.log(`  清理前devDeviceId: ${beforeDeviceId || '未找到'}`);
    console.log(`  清理前登录状态: ${beforeLoginData.hasLogin ? '已登录' : '未登录'}`);
    
    if (beforeLoginData.hasLogin) {
      console.log(`  登录邮箱: ${beforeLoginData.email || '未知'}`);
      console.log(`  访问令牌: ${beforeLoginData.hasAccessToken ? '存在' : '不存在'}`);
    }

    // 2. 生成新的目标设备ID
    console.log('\n🆔 第2步：生成新的目标设备ID...');
    const targetDeviceId = crypto.randomUUID();
    console.log(`  目标设备ID: ${targetDeviceId}`);

    // 3. 强制关闭Cursor
    console.log('\n🔪 第3步：强制关闭Cursor IDE...');
    await forceCloseCursor();

    // 4. 备份完整登录数据
    console.log('\n💾 第4步：备份完整登录数据...');
    const loginBackup = await backupLoginData();
    console.log(`  备份登录数据: ${loginBackup ? '✅ 成功' : '❌ 失败'}`);

    // 5. 执行选择性清理
    console.log('\n🧹 第5步：执行选择性清理...');
    await performSelectiveCleanup();

    // 6. 重建storage.json（包含登录数据）
    console.log('\n🔧 第6步：重建storage.json（包含登录数据）...');
    await rebuildStorageWithLogin(targetDeviceId, loginBackup);

    // 7. 启动Cursor并开始超强监控
    console.log('\n🚀 第7步：启动Cursor并开始超强监控...');
    await startCursorWithSuperMonitoring(targetDeviceId, loginBackup);

    // 8. 验证最终结果
    console.log('\n📊 第8步：验证最终结果...');
    const finalDeviceId = await getCurrentDeviceId();
    const finalLoginData = await getFullLoginData();
    
    console.log(`  最终devDeviceId: ${finalDeviceId || '未找到'}`);
    console.log(`  最终登录状态: ${finalLoginData.hasLogin ? '已登录' : '未登录'}`);

    // 9. 计算超级清理成功率
    console.log('\n📈 第9步：计算超级清理成功率...');
    const successRate = await calculateSuperSuccessRate(
      beforeDeviceId, finalDeviceId, targetDeviceId,
      beforeLoginData, finalLoginData
    );

    console.log('\n🎯 超级激进清理结果:');
    console.log(`  清理成功率: ${successRate.overall.toFixed(1)}%`);
    console.log(`  设备ID更新: ${successRate.deviceIdChanged ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  达到目标ID: ${successRate.achievedTarget ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  登录状态保留: ${successRate.loginPreserved ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  摆脱顽固ID: ${successRate.escapedOldId ? '✅ 成功' : '❌ 失败'}`);

    // 10. 最终评估
    console.log('\n🏆 最终评估:');
    if (successRate.overall >= 95) {
      console.log('  🎉 完美！超级清理达到理想效果');
      console.log('  ✅ 设备ID更新且登录状态完美保留');
    } else if (successRate.overall >= 80) {
      console.log('  ⭐ 很好！超级清理效果显著');
      console.log('  🔧 基本达到预期目标');
    } else {
      console.log('  ⚠️ 仍需改进！超级清理效果有限');
      console.log('  🛠️ Cursor的恢复机制非常强大');
    }

    return {
      success: true,
      successRate: successRate.overall,
      details: successRate,
      beforeDeviceId,
      finalDeviceId,
      targetDeviceId,
      loginPreserved: successRate.loginPreserved
    };

  } catch (error) {
    console.error('❌ 超级激进清理失败:', error.message);
    return {
      success: false,
      successRate: 0,
      error: error.message
    };
  }
}

// 获取当前设备ID
async function getCurrentDeviceId() {
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

// 获取完整登录数据
async function getFullLoginData() {
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

    const loginData = {
      hasLogin: false,
      email: null,
      hasAccessToken: false,
      hasRefreshToken: false,
      membershipType: null,
      applicationUser: null
    };

    if (await fs.pathExists(storageJsonPath)) {
      const data = await fs.readJson(storageJsonPath);
      
      loginData.hasAccessToken = !!data['cursorAuth/accessToken'];
      loginData.hasRefreshToken = !!data['cursorAuth/refreshToken'];
      loginData.email = data['cursorAuth/cachedEmail'];
      loginData.membershipType = data['cursorAuth/stripeMembershipType'];
      loginData.applicationUser = data['src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser'];
      
      loginData.hasLogin = loginData.hasAccessToken || loginData.hasRefreshToken || !!loginData.email || !!loginData.applicationUser;
    }

    return loginData;
  } catch (error) {
    return {
      hasLogin: false,
      email: null,
      hasAccessToken: false,
      hasRefreshToken: false,
      membershipType: null,
      applicationUser: null
    };
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
      console.log(`    ✅ 执行: ${cmd}`);
    } catch (error) {
      // 忽略进程不存在的错误
    }
  }

  await sleep(3000);
  console.log('    ✅ Cursor IDE已强制关闭');
}

// 备份登录数据
async function backupLoginData() {
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
      
      // 提取所有登录相关数据
      const loginBackup = {};
      const loginKeys = [
        'cursorAuth/accessToken',
        'cursorAuth/refreshToken',
        'cursorAuth/cachedEmail',
        'cursorAuth/cachedSignUpType',
        'cursorAuth/stripeMembershipType',
        'cursorAuth/onboardingDate',
        'src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser'
      ];
      
      loginKeys.forEach(key => {
        if (data[key]) {
          loginBackup[key] = data[key];
        }
      });
      
      return Object.keys(loginBackup).length > 0 ? loginBackup : null;
    }
    return null;
  } catch (error) {
    return null;
  }
}

// 执行选择性清理
async function performSelectiveCleanup() {
  const cleanupTargets = [
    // 只清理特定文件，保留登录相关
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'workspaceStorage'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'Cache'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'CachedData'),
  ];

  for (const target of cleanupTargets) {
    try {
      if (await fs.pathExists(target)) {
        await fs.remove(target);
        console.log(`    🗑️ 已清理: ${path.basename(target)}`);
      }
    } catch (error) {
      console.log(`    ⚠️ 清理失败: ${path.basename(target)}`);
    }
  }

  console.log('    ✅ 选择性清理完成');
}

// 重建storage.json（包含登录数据）
async function rebuildStorageWithLogin(targetDeviceId, loginBackup) {
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

    // 创建新的storage.json
    const newStorageData = {
      // 新的遥测ID
      'telemetry.devDeviceId': targetDeviceId,
      'telemetry.machineId': crypto.randomBytes(32).toString('hex'),
      'telemetry.macMachineId': crypto.randomBytes(32).toString('hex'),
      'telemetry.sqmId': `{${targetDeviceId.toUpperCase()}}`,
      'telemetry.firstSessionDate': new Date().toUTCString(),
      'telemetry.currentSessionDate': new Date().toUTCString(),
      
      // 基础系统ID
      'storage.serviceMachineId': crypto.randomUUID(),
    };

    // 合并登录数据
    if (loginBackup) {
      Object.assign(newStorageData, loginBackup);
      console.log(`    ✅ 已合并 ${Object.keys(loginBackup).length} 项登录数据`);
    }

    const storageJsonPath = path.join(storageDir, 'storage.json');
    await fs.writeJson(storageJsonPath, newStorageData, { spaces: 2 });

    console.log(`    ✅ 已重建storage.json: ${targetDeviceId}`);
  } catch (error) {
    console.log(`    ⚠️ 重建storage.json失败: ${error.message}`);
  }
}

// 启动Cursor并开始超强监控
async function startCursorWithSuperMonitoring(targetDeviceId, loginBackup) {
  try {
    // 启动Cursor
    const cursorPath = 'E:\\cursor\\Cursor.exe';
    if (await fs.pathExists(cursorPath)) {
      const cursorProcess = spawn(cursorPath, [], { 
        detached: true,
        stdio: 'ignore'
      });
      cursorProcess.unref();
      
      console.log(`    ✅ Cursor IDE已启动: ${cursorPath}`);
    }

    // 开始超强监控（120秒）
    console.log('    🔄 开始超强监控，强制维持新设备ID和登录状态...');
    
    const monitoringDuration = 120000; // 120秒
    const checkInterval = 1000; // 每1秒检查一次
    const startTime = Date.now();
    
    let updateCount = 0;
    const oldDeviceId = '36987e70-60fe-4401-85a4-f463c269f069';
    
    const monitoringTask = setInterval(async () => {
      try {
        const currentDeviceId = await getCurrentDeviceId();
        
        // 如果检测到旧ID或非目标ID，立即强制更新
        if (currentDeviceId === oldDeviceId || (currentDeviceId && currentDeviceId !== targetDeviceId)) {
          await forceUpdateDeviceIdAndLogin(targetDeviceId, loginBackup);
          updateCount++;
          console.log(`      🔄 检测到ID偏离，已强制更新 (第${updateCount}次)`);
        }
        
        // 检查是否超时
        if (Date.now() - startTime > monitoringDuration) {
          clearInterval(monitoringTask);
          console.log(`    ✅ 超强监控完成，共执行 ${updateCount} 次强制更新`);
        }
      } catch (error) {
        // 忽略监控过程中的错误
      }
    }, checkInterval);

    // 等待监控完成
    await sleep(monitoringDuration + 1000);
    
  } catch (error) {
    console.log(`    ⚠️ 启动和监控失败: ${error.message}`);
  }
}

// 强制更新设备ID和登录状态
async function forceUpdateDeviceIdAndLogin(targetDeviceId, loginBackup) {
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
      
      // 强制更新设备ID
      data['telemetry.devDeviceId'] = targetDeviceId;
      data['telemetry.machineId'] = crypto.randomBytes(32).toString('hex');
      data['telemetry.macMachineId'] = crypto.randomBytes(32).toString('hex');
      data['telemetry.sqmId'] = `{${targetDeviceId.toUpperCase()}}`;
      data['telemetry.currentSessionDate'] = new Date().toUTCString();
      
      // 确保登录数据存在
      if (loginBackup) {
        Object.assign(data, loginBackup);
      }
      
      await fs.writeJson(storageJsonPath, data, { spaces: 2 });
    }
  } catch (error) {
    // 忽略强制更新失败
  }
}

// 计算超级清理成功率
async function calculateSuperSuccessRate(beforeDeviceId, finalDeviceId, targetDeviceId, beforeLoginData, finalLoginData) {
  let score = 0;
  const maxScore = 100;
  
  const successRate = {
    deviceIdChanged: false,
    achievedTarget: false,
    loginPreserved: false,
    escapedOldId: false,
    overall: 0
  };

  const oldDeviceId = '36987e70-60fe-4401-85a4-f463c269f069';

  // 1. 设备ID发生变化 (20分)
  if (finalDeviceId && finalDeviceId !== beforeDeviceId) {
    score += 20;
    successRate.deviceIdChanged = true;
  }

  // 2. 达到目标ID (40分 - 最重要)
  if (finalDeviceId === targetDeviceId) {
    score += 40;
    successRate.achievedTarget = true;
  }

  // 3. 登录状态保留 (25分)
  if (beforeLoginData.hasLogin && finalLoginData.hasLogin) {
    score += 25;
    successRate.loginPreserved = true;
  }

  // 4. 摆脱顽固的旧ID (15分)
  if (finalDeviceId !== oldDeviceId) {
    score += 15;
    successRate.escapedOldId = true;
  }

  successRate.overall = (score / maxScore) * 100;
  return successRate;
}

// 睡眠函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 主执行函数
if (require.main === module) {
  superAggressiveCleanup().then(result => {
    console.log(`\n📋 超级激进清理完成: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`🎯 最终成功率: ${result.successRate.toFixed(1)}%`);
    console.log(`🔐 登录保留: ${result.loginPreserved ? '✅ 成功' : '❌ 失败'}`);
    
    if (result.success && result.successRate >= 80) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }).catch(console.error);
}

module.exports = { superAggressiveCleanup };
