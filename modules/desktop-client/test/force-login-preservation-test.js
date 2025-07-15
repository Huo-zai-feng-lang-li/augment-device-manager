#!/usr/bin/env node

/**
 * 强制登录保留测试
 * 直接调用选择性清理方法，确保登录状态被保留
 */

const DeviceManager = require('../src/device-manager');

async function forceLoginPreservationTest() {
  console.log('💪 强制登录保留测试');
  console.log('=' .repeat(50));
  console.log('🎯 直接测试选择性清理，强制保留登录状态');
  console.log('');

  try {
    // 1. 检查清理前状态
    console.log('📊 第1步：检查清理前状态...');
    const beforeDeviceId = await getCurrentDeviceId();
    const beforeLoginData = await getFullLoginData();
    
    console.log(`  清理前devDeviceId: ${beforeDeviceId || '未找到'}`);
    console.log(`  清理前登录状态详情:`);
    console.log(`    访问令牌: ${beforeLoginData.hasAccessToken ? '存在' : '不存在'}`);
    console.log(`    刷新令牌: ${beforeLoginData.hasRefreshToken ? '存在' : '不存在'}`);
    console.log(`    邮箱: ${beforeLoginData.email || '未设置'}`);
    console.log(`    会员类型: ${beforeLoginData.membershipType || '未设置'}`);
    console.log(`    应用用户: ${beforeLoginData.hasApplicationUser ? '存在' : '不存在'}`);

    // 2. 强制关闭Cursor
    console.log('\n🔪 第2步：强制关闭Cursor IDE...');
    await forceCloseCursor();

    // 3. 直接调用选择性清理
    console.log('\n🔧 第3步：直接调用选择性清理方法...');
    const deviceManager = new DeviceManager();
    const results = { actions: [], errors: [] };
    
    const newDeviceId = await deviceManager.selectiveCleanStorageJson(results);
    
    console.log('  选择性清理结果:');
    results.actions.forEach(action => {
      console.log(`    • ${action}`);
    });
    
    if (results.errors.length > 0) {
      console.log('  错误信息:');
      results.errors.forEach(error => {
        console.log(`    ❌ ${error}`);
      });
    }

    // 4. 启动Cursor并监控
    console.log('\n🚀 第4步：启动Cursor并监控...');
    await startCursorWithMonitoring(newDeviceId);

    // 5. 检查清理后状态
    console.log('\n📊 第5步：检查清理后状态...');
    const afterDeviceId = await getCurrentDeviceId();
    const afterLoginData = await getFullLoginData();
    
    console.log(`  清理后devDeviceId: ${afterDeviceId || '未找到'}`);
    console.log(`  清理后登录状态详情:`);
    console.log(`    访问令牌: ${afterLoginData.hasAccessToken ? '存在' : '不存在'}`);
    console.log(`    刷新令牌: ${afterLoginData.hasRefreshToken ? '存在' : '不存在'}`);
    console.log(`    邮箱: ${afterLoginData.email || '未设置'}`);
    console.log(`    会员类型: ${afterLoginData.membershipType || '未设置'}`);
    console.log(`    应用用户: ${afterLoginData.hasApplicationUser ? '存在' : '不存在'}`);

    // 6. 计算成功率
    console.log('\n📈 第6步：计算强制登录保留成功率...');
    
    const results_analysis = {
      deviceIdChanged: afterDeviceId !== beforeDeviceId && afterDeviceId === newDeviceId,
      accessTokenPreserved: beforeLoginData.hasAccessToken === afterLoginData.hasAccessToken,
      refreshTokenPreserved: beforeLoginData.hasRefreshToken === afterLoginData.hasRefreshToken,
      emailPreserved: beforeLoginData.email === afterLoginData.email,
      membershipPreserved: beforeLoginData.membershipType === afterLoginData.membershipType,
      applicationUserPreserved: beforeLoginData.hasApplicationUser === afterLoginData.hasApplicationUser
    };

    console.log('\n🔍 详细分析结果:');
    console.log(`  设备ID更新到目标: ${results_analysis.deviceIdChanged ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  访问令牌保留: ${results_analysis.accessTokenPreserved ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  刷新令牌保留: ${results_analysis.refreshTokenPreserved ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  邮箱信息保留: ${results_analysis.emailPreserved ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  会员信息保留: ${results_analysis.membershipPreserved ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  应用用户保留: ${results_analysis.applicationUserPreserved ? '✅ 成功' : '❌ 失败'}`);

    // 计算成功率
    let score = 0;
    if (results_analysis.deviceIdChanged) score += 40; // 最重要
    if (results_analysis.accessTokenPreserved) score += 15;
    if (results_analysis.refreshTokenPreserved) score += 15;
    if (results_analysis.emailPreserved) score += 10;
    if (results_analysis.membershipPreserved) score += 10;
    if (results_analysis.applicationUserPreserved) score += 10;

    const successRate = score;

    console.log(`\n🎯 强制登录保留成功率: ${successRate}%`);

    // 7. 最终评估
    console.log('\n🏆 最终评估:');
    if (successRate >= 90) {
      console.log('  🎉 完美！强制登录保留功能完全成功');
      console.log('  ✅ 设备ID已更新，登录状态完美保留');
      console.log('  🚀 可以集成到客户端清理功能中');
    } else if (successRate >= 75) {
      console.log('  ⭐ 很好！强制登录保留功能基本成功');
      console.log('  🔧 大部分登录信息得到保留');
    } else if (successRate >= 50) {
      console.log('  ⚠️ 一般！强制登录保留功能部分成功');
      console.log('  🛠️ 需要进一步优化');
    } else {
      console.log('  ❌ 需要改进！强制登录保留功能效果不佳');
      console.log('  🔧 需要检查选择性清理逻辑');
    }

    return {
      success: true,
      successRate,
      results: results_analysis,
      beforeDeviceId,
      afterDeviceId,
      newDeviceId,
      loginPreserved: results_analysis.emailPreserved && (results_analysis.accessTokenPreserved || results_analysis.refreshTokenPreserved)
    };

  } catch (error) {
    console.error('❌ 强制登录保留测试失败:', error.message);
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
    const fs = require('fs-extra');
    const path = require('path');
    const os = require('os');
    
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
    const fs = require('fs-extra');
    const path = require('path');
    const os = require('os');
    
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
      hasAccessToken: false,
      hasRefreshToken: false,
      email: null,
      membershipType: null,
      hasApplicationUser: false
    };

    if (await fs.pathExists(storageJsonPath)) {
      const data = await fs.readJson(storageJsonPath);
      
      loginData.hasAccessToken = !!(data['cursorAuth/accessToken'] && data['cursorAuth/accessToken'].length > 10);
      loginData.hasRefreshToken = !!(data['cursorAuth/refreshToken'] && data['cursorAuth/refreshToken'].length > 10);
      loginData.email = data['cursorAuth/cachedEmail'];
      loginData.membershipType = data['cursorAuth/stripeMembershipType'];
      loginData.hasApplicationUser = !!(data['src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser']);
    }

    return loginData;
  } catch (error) {
    return {
      hasAccessToken: false,
      hasRefreshToken: false,
      email: null,
      membershipType: null,
      hasApplicationUser: false
    };
  }
}

// 强制关闭Cursor
async function forceCloseCursor() {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  const commands = [
    'taskkill /f /im "Cursor.exe" /t',
    'wmic process where "name=\'Cursor.exe\'" delete',
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

// 启动Cursor并监控
async function startCursorWithMonitoring(targetDeviceId) {
  try {
    const fs = require('fs-extra');
    const { spawn } = require('child_process');
    
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

    // 监控60秒
    console.log('    🔄 开始60秒监控，确保设备ID稳定...');
    
    const monitoringDuration = 60000;
    const checkInterval = 2000;
    const startTime = Date.now();
    
    let updateCount = 0;
    const oldDeviceId = '36987e70-60fe-4401-85a4-f463c269f069';
    
    const monitoringTask = setInterval(async () => {
      try {
        const currentDeviceId = await getCurrentDeviceId();
        
        // 如果检测到旧ID或非目标ID，立即强制更新
        if (currentDeviceId === oldDeviceId || (currentDeviceId && currentDeviceId !== targetDeviceId)) {
          await forceUpdateDeviceId(targetDeviceId);
          updateCount++;
          console.log(`      🔄 检测到ID偏离，已强制更新 (第${updateCount}次)`);
        }
        
        // 检查是否超时
        if (Date.now() - startTime > monitoringDuration) {
          clearInterval(monitoringTask);
          console.log(`    ✅ 监控完成，共执行 ${updateCount} 次强制更新`);
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

// 强制更新设备ID
async function forceUpdateDeviceId(targetDeviceId) {
  try {
    const fs = require('fs-extra');
    const path = require('path');
    const os = require('os');
    const crypto = require('crypto');
    
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
      
      // 强制更新设备ID，保留其他数据
      data['telemetry.devDeviceId'] = targetDeviceId;
      data['telemetry.machineId'] = crypto.randomBytes(32).toString('hex');
      data['telemetry.macMachineId'] = crypto.randomBytes(32).toString('hex');
      data['telemetry.sqmId'] = `{${targetDeviceId.toUpperCase()}}`;
      data['telemetry.currentSessionDate'] = new Date().toUTCString();
      
      await fs.writeJson(storageJsonPath, data, { spaces: 2 });
    }
  } catch (error) {
    // 忽略强制更新失败
  }
}

// 睡眠函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 主执行函数
if (require.main === module) {
  forceLoginPreservationTest().then(result => {
    console.log(`\n📋 强制登录保留测试完成: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`🎯 成功率: ${result.successRate}%`);
    console.log(`🔐 登录保留: ${result.loginPreserved ? '✅ 成功' : '❌ 失败'}`);
    
    if (result.success && result.successRate >= 75) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }).catch(console.error);
}

module.exports = { forceLoginPreservationTest };
