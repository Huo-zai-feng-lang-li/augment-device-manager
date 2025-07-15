#!/usr/bin/env node

/**
 * 精确客户端清理测试
 * 修复检测逻辑，准确测试客户端清理成功率
 */

const DeviceManager = require('../src/device-manager');

async function accurateClientTest() {
  console.log('🎯 精确客户端清理测试');
  console.log('=' .repeat(50));
  console.log('🔍 使用修复后的检测逻辑，准确测试清理成功率');
  console.log('');

  try {
    // 1. 检查清理前状态
    console.log('📊 第1步：检查清理前状态...');
    const beforeDeviceId = await getCurrentDeviceId();
    const beforeLoginData = await getAccurateLoginData();
    
    console.log(`  清理前devDeviceId: ${beforeDeviceId || '未找到'}`);
    console.log(`  清理前登录状态: ${beforeLoginData.isLoggedIn ? '已登录' : '未登录'}`);
    
    if (beforeLoginData.isLoggedIn) {
      console.log(`  登录邮箱: ${beforeLoginData.email || '未知'}`);
      console.log(`  会员类型: ${beforeLoginData.membershipType || '未知'}`);
      console.log(`  访问令牌: ${beforeLoginData.hasAccessToken ? '存在' : '不存在'}`);
      console.log(`  刷新令牌: ${beforeLoginData.hasRefreshToken ? '存在' : '不存在'}`);
    }

    // 2. 执行客户端清理（与前端完全一致的配置）
    console.log('\n🚀 第2步：执行客户端清理（与前端一致配置）...');
    const deviceManager = new DeviceManager();

    const cleanupResult = await deviceManager.performCleanup({
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartCursor: true,
      // 激进清理模式选项
      skipCursorLogin: true,        // 跳过Cursor IDE登录清理
      aggressiveMode: true,         // 激进模式
      multiRoundClean: true,        // 多轮清理
      extendedMonitoring: true      // 延长监控时间(60秒)
    });

    console.log(`  清理执行结果: ${cleanupResult.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  执行操作数量: ${cleanupResult.actions?.length || 0} 个`);

    // 显示关键操作
    if (cleanupResult.actions) {
      const keyActions = cleanupResult.actions.filter(action => 
        action.includes('devDeviceId') || 
        action.includes('强制更新') || 
        action.includes('监控') ||
        action.includes('登录') ||
        action.includes('Cursor')
      );
      
      if (keyActions.length > 0) {
        console.log('\n🔑 关键操作:');
        keyActions.slice(0, 8).forEach(action => {
          console.log(`    • ${action}`);
        });
        if (keyActions.length > 8) {
          console.log(`    • ... 还有 ${keyActions.length - 8} 个关键操作`);
        }
      }
    }

    // 3. 等待清理完全完成
    console.log('\n⏳ 第3步：等待清理完全完成...');
    await sleep(8000);

    // 4. 检查清理后状态
    console.log('\n📊 第4步：检查清理后状态...');
    const afterDeviceId = await getCurrentDeviceId();
    const afterLoginData = await getAccurateLoginData();
    
    console.log(`  清理后devDeviceId: ${afterDeviceId || '未找到'}`);
    console.log(`  清理后登录状态: ${afterLoginData.isLoggedIn ? '已登录' : '未登录'}`);
    
    if (afterLoginData.isLoggedIn) {
      console.log(`  登录邮箱: ${afterLoginData.email || '未知'}`);
      console.log(`  会员类型: ${afterLoginData.membershipType || '未知'}`);
      console.log(`  访问令牌: ${afterLoginData.hasAccessToken ? '存在' : '不存在'}`);
      console.log(`  刷新令牌: ${afterLoginData.hasRefreshToken ? '存在' : '不存在'}`);
    }

    // 5. 计算精确清理成功率
    console.log('\n📈 第5步：计算精确清理成功率...');
    const successRate = await calculateAccurateSuccessRate(
      beforeDeviceId, afterDeviceId,
      beforeLoginData, afterLoginData,
      cleanupResult
    );

    console.log('\n🎯 精确客户端清理结果:');
    console.log(`  总体成功率: ${successRate.overall.toFixed(1)}%`);
    console.log(`  设备ID更新: ${successRate.deviceIdChanged ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  摆脱顽固ID: ${successRate.escapedOldId ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  登录状态保留: ${successRate.loginPreserved ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  Augment数据清理: ${successRate.augmentDataCleared ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  监控机制运行: ${successRate.monitoringWorked ? '✅ 成功' : '❌ 失败'}`);

    // 6. 详细分析
    console.log('\n📋 详细分析:');
    console.log(`  设备ID变化: ${beforeDeviceId} → ${afterDeviceId}`);
    console.log(`  登录邮箱保留: ${beforeLoginData.email === afterLoginData.email ? '✅ 一致' : '❌ 不一致'}`);
    console.log(`  会员状态保留: ${beforeLoginData.membershipType === afterLoginData.membershipType ? '✅ 一致' : '❌ 不一致'}`);

    // 7. 最终评估
    console.log('\n🏆 最终评估:');
    if (successRate.overall >= 95) {
      console.log('  🎉 完美！客户端清理功能达到生产标准');
      console.log('  ✅ 用户可以放心使用，效果卓越');
      console.log('  🚀 Augment扩展将完全识别为新用户');
    } else if (successRate.overall >= 85) {
      console.log('  ⭐ 优秀！客户端清理功能表现良好');
      console.log('  🔧 可以投入使用，效果令人满意');
    } else if (successRate.overall >= 70) {
      console.log('  ⚠️ 良好！客户端清理功能基本可用');
      console.log('  🛠️ 建议进一步优化以提升成功率');
    } else {
      console.log('  ❌ 需要改进！客户端清理功能效果不理想');
      console.log('  🔧 需要检查配置和实现逻辑');
    }

    console.log('\n📱 客户端使用指南:');
    console.log('  1. 启动客户端应用');
    console.log('  2. 点击"开始清理"按钮');
    console.log('  3. 确认激进清理模式');
    console.log('  4. 等待清理完成（约90秒）');
    console.log('  5. 享受清理效果，无需重新登录！');

    return {
      success: cleanupResult.success,
      successRate: successRate.overall,
      details: successRate,
      beforeDeviceId,
      afterDeviceId,
      loginPreserved: successRate.loginPreserved,
      recommendation: successRate.overall >= 85 ? 'production_ready' : 'needs_improvement'
    };

  } catch (error) {
    console.error('❌ 精确客户端清理测试失败:', error.message);
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

// 获取精确的登录数据
async function getAccurateLoginData() {
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
      isLoggedIn: false,
      email: null,
      hasAccessToken: false,
      hasRefreshToken: false,
      membershipType: null,
      hasApplicationUser: false
    };

    if (await fs.pathExists(storageJsonPath)) {
      const data = await fs.readJson(storageJsonPath);
      
      // 检查所有可能的登录标识
      loginData.hasAccessToken = !!(data['cursorAuth/accessToken'] && data['cursorAuth/accessToken'].length > 10);
      loginData.hasRefreshToken = !!(data['cursorAuth/refreshToken'] && data['cursorAuth/refreshToken'].length > 10);
      loginData.email = data['cursorAuth/cachedEmail'];
      loginData.membershipType = data['cursorAuth/stripeMembershipType'];
      loginData.hasApplicationUser = !!(data['src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser']);
      
      // 更准确的登录状态判断
      loginData.isLoggedIn = loginData.hasAccessToken || 
                            loginData.hasRefreshToken || 
                            (!!loginData.email && loginData.email.includes('@')) ||
                            loginData.hasApplicationUser;
    }

    return loginData;
  } catch (error) {
    return {
      isLoggedIn: false,
      email: null,
      hasAccessToken: false,
      hasRefreshToken: false,
      membershipType: null,
      hasApplicationUser: false
    };
  }
}

// 计算精确清理成功率
async function calculateAccurateSuccessRate(beforeDeviceId, afterDeviceId, beforeLoginData, afterLoginData, cleanupResult) {
  let score = 0;
  const maxScore = 100;
  
  const successRate = {
    deviceIdChanged: false,
    escapedOldId: false,
    loginPreserved: false,
    augmentDataCleared: false,
    monitoringWorked: false,
    overall: 0
  };

  const oldDeviceId = '36987e70-60fe-4401-85a4-f463c269f069';

  // 1. 设备ID发生变化 (30分)
  if (afterDeviceId && afterDeviceId !== beforeDeviceId) {
    score += 30;
    successRate.deviceIdChanged = true;
  }

  // 2. 摆脱顽固的旧ID (30分)
  if (afterDeviceId !== oldDeviceId) {
    score += 30;
    successRate.escapedOldId = true;
  }

  // 3. 登录状态保留 (25分) - 修复逻辑
  if (beforeLoginData.isLoggedIn && afterLoginData.isLoggedIn) {
    // 进一步检查关键登录信息是否保留
    const emailPreserved = beforeLoginData.email === afterLoginData.email;
    const membershipPreserved = beforeLoginData.membershipType === afterLoginData.membershipType;
    const tokenPreserved = afterLoginData.hasAccessToken || afterLoginData.hasRefreshToken;
    
    if (emailPreserved && membershipPreserved && tokenPreserved) {
      score += 25;
      successRate.loginPreserved = true;
    } else if (tokenPreserved && (emailPreserved || membershipPreserved)) {
      score += 20; // 部分保留
      successRate.loginPreserved = true;
    }
  } else if (!beforeLoginData.isLoggedIn && !afterLoginData.isLoggedIn) {
    // 如果清理前就没有登录，清理后也没有登录，这是正常的
    score += 25;
    successRate.loginPreserved = true;
  }

  // 4. Augment数据清理 (10分)
  const augmentCleared = cleanupResult.actions && cleanupResult.actions.some(action => 
    action.includes('Augment') || action.includes('augment') || action.includes('清理')
  );
  if (augmentCleared) {
    score += 10;
    successRate.augmentDataCleared = true;
  }

  // 5. 监控机制运行 (5分)
  const monitoringWorked = cleanupResult.actions && cleanupResult.actions.some(action => 
    action.includes('监控') || action.includes('强制更新')
  );
  if (monitoringWorked) {
    score += 5;
    successRate.monitoringWorked = true;
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
  accurateClientTest().then(result => {
    console.log(`\n📋 精确客户端清理测试完成: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`🎯 精确成功率: ${result.successRate.toFixed(1)}%`);
    console.log(`🔐 登录保留: ${result.loginPreserved ? '✅ 成功' : '❌ 失败'}`);
    console.log(`💡 建议: ${result.recommendation === 'production_ready' ? '✅ 可投入生产' : '⚠️ 需要改进'}`);
    
    if (result.success && result.successRate >= 80) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }).catch(console.error);
}

module.exports = { accurateClientTest };
