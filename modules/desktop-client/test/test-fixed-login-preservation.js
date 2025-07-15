#!/usr/bin/env node

/**
 * 测试修复后的登录保留功能
 * 验证选择性清理是否能真正保留Cursor IDE登录状态
 */

const DeviceManager = require('../src/device-manager');

async function testFixedLoginPreservation() {
  console.log('🔧 测试修复后的登录保留功能');
  console.log('=' .repeat(50));
  console.log('🎯 验证选择性清理是否能真正保留登录状态');
  console.log('');

  try {
    // 1. 检查清理前状态
    console.log('📊 第1步：检查清理前状态...');
    const beforeDeviceId = await getCurrentDeviceId();
    const beforeLoginData = await getDetailedLoginData();
    
    console.log(`  清理前devDeviceId: ${beforeDeviceId || '未找到'}`);
    console.log(`  清理前登录状态: ${beforeLoginData.isLoggedIn ? '已登录' : '未登录'}`);
    
    if (beforeLoginData.isLoggedIn) {
      console.log(`  登录邮箱: ${beforeLoginData.email || '未知'}`);
      console.log(`  会员类型: ${beforeLoginData.membershipType || '未知'}`);
      console.log(`  访问令牌: ${beforeLoginData.hasAccessToken ? '存在' : '不存在'}`);
      console.log(`  刷新令牌: ${beforeLoginData.hasRefreshToken ? '存在' : '不存在'}`);
      console.log(`  应用用户: ${beforeLoginData.hasApplicationUser ? '存在' : '不存在'}`);
    }

    // 2. 执行修复后的清理（启用登录保留）
    console.log('\n🔧 第2步：执行修复后的清理（启用登录保留）...');
    const deviceManager = new DeviceManager();

    const cleanupResult = await deviceManager.performCleanup({
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartCursor: true,
      // 关键：启用登录保留
      skipCursorLogin: true,        // 跳过Cursor IDE登录清理
      aggressiveMode: true,         // 激进模式
      multiRoundClean: true,        // 多轮清理
      extendedMonitoring: true      // 延长监控时间(60秒)
    });

    console.log(`  清理执行结果: ${cleanupResult.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  执行操作数量: ${cleanupResult.actions?.length || 0} 个`);

    // 显示登录保留相关操作
    if (cleanupResult.actions) {
      const loginActions = cleanupResult.actions.filter(action => 
        action.includes('登录') || 
        action.includes('保留') || 
        action.includes('选择性') ||
        action.includes('🔐') ||
        action.includes('🛡️')
      );
      
      if (loginActions.length > 0) {
        console.log('\n🔐 登录保留相关操作:');
        loginActions.forEach(action => {
          console.log(`    • ${action}`);
        });
      }
    }

    // 3. 等待清理完成
    console.log('\n⏳ 第3步：等待清理完成...');
    await sleep(8000);

    // 4. 检查清理后状态
    console.log('\n📊 第4步：检查清理后状态...');
    const afterDeviceId = await getCurrentDeviceId();
    const afterLoginData = await getDetailedLoginData();
    
    console.log(`  清理后devDeviceId: ${afterDeviceId || '未找到'}`);
    console.log(`  清理后登录状态: ${afterLoginData.isLoggedIn ? '已登录' : '未登录'}`);
    
    if (afterLoginData.isLoggedIn) {
      console.log(`  登录邮箱: ${afterLoginData.email || '未知'}`);
      console.log(`  会员类型: ${afterLoginData.membershipType || '未知'}`);
      console.log(`  访问令牌: ${afterLoginData.hasAccessToken ? '存在' : '不存在'}`);
      console.log(`  刷新令牌: ${afterLoginData.hasRefreshToken ? '存在' : '不存在'}`);
      console.log(`  应用用户: ${afterLoginData.hasApplicationUser ? '存在' : '不存在'}`);
    }

    // 5. 详细对比分析
    console.log('\n📈 第5步：详细对比分析...');
    
    const comparison = {
      deviceIdChanged: afterDeviceId !== beforeDeviceId,
      loginStatusPreserved: beforeLoginData.isLoggedIn === afterLoginData.isLoggedIn,
      emailPreserved: beforeLoginData.email === afterLoginData.email,
      membershipPreserved: beforeLoginData.membershipType === afterLoginData.membershipType,
      accessTokenPreserved: beforeLoginData.hasAccessToken === afterLoginData.hasAccessToken,
      refreshTokenPreserved: beforeLoginData.hasRefreshToken === afterLoginData.hasRefreshToken,
      applicationUserPreserved: beforeLoginData.hasApplicationUser === afterLoginData.hasApplicationUser
    };

    console.log('\n🔍 详细对比结果:');
    console.log(`  设备ID更新: ${comparison.deviceIdChanged ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  登录状态保留: ${comparison.loginStatusPreserved ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  邮箱信息保留: ${comparison.emailPreserved ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  会员信息保留: ${comparison.membershipPreserved ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  访问令牌保留: ${comparison.accessTokenPreserved ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  刷新令牌保留: ${comparison.refreshTokenPreserved ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  应用用户保留: ${comparison.applicationUserPreserved ? '✅ 成功' : '❌ 失败'}`);

    // 6. 计算修复后的成功率
    console.log('\n📊 第6步：计算修复后的成功率...');
    
    let score = 0;
    const maxScore = 100;
    
    // 设备ID更新 (30分)
    if (comparison.deviceIdChanged) score += 30;
    
    // 登录状态完整保留 (50分)
    if (comparison.loginStatusPreserved && comparison.emailPreserved && 
        comparison.membershipPreserved && (comparison.accessTokenPreserved || comparison.refreshTokenPreserved)) {
      score += 50;
    } else if (comparison.loginStatusPreserved && (comparison.emailPreserved || comparison.membershipPreserved)) {
      score += 30; // 部分保留
    }
    
    // Augment数据清理 (15分)
    const augmentCleared = cleanupResult.actions && cleanupResult.actions.some(action => 
      action.includes('Augment') || action.includes('augment') || action.includes('清理')
    );
    if (augmentCleared) score += 15;
    
    // 监控机制运行 (5分)
    const monitoringWorked = cleanupResult.actions && cleanupResult.actions.some(action => 
      action.includes('监控') || action.includes('强制更新')
    );
    if (monitoringWorked) score += 5;

    const successRate = (score / maxScore) * 100;

    console.log(`\n🎯 修复后清理成功率: ${successRate.toFixed(1)}%`);

    // 7. 最终评估
    console.log('\n🏆 最终评估:');
    if (successRate >= 95) {
      console.log('  🎉 完美！修复后的登录保留功能达到理想效果');
      console.log('  ✅ 用户可以放心使用，无需重新登录');
      console.log('  🚀 Augment扩展将识别为新用户');
    } else if (successRate >= 85) {
      console.log('  ⭐ 优秀！修复后的登录保留功能表现良好');
      console.log('  🔧 大部分功能正常，可以投入使用');
    } else if (successRate >= 70) {
      console.log('  ⚠️ 良好！修复后的登录保留功能基本可用');
      console.log('  🛠️ 仍有改进空间');
    } else {
      console.log('  ❌ 需要进一步改进！登录保留功能效果不理想');
      console.log('  🔧 需要检查选择性清理逻辑');
    }

    return {
      success: cleanupResult.success,
      successRate,
      comparison,
      beforeDeviceId,
      afterDeviceId,
      loginPreserved: comparison.loginStatusPreserved && comparison.emailPreserved,
      recommendation: successRate >= 85 ? 'production_ready' : 'needs_improvement'
    };

  } catch (error) {
    console.error('❌ 修复后登录保留测试失败:', error.message);
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

// 获取详细的登录数据
async function getDetailedLoginData() {
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
      
      // 检查所有登录相关字段
      loginData.hasAccessToken = !!(data['cursorAuth/accessToken'] && data['cursorAuth/accessToken'].length > 10);
      loginData.hasRefreshToken = !!(data['cursorAuth/refreshToken'] && data['cursorAuth/refreshToken'].length > 10);
      loginData.email = data['cursorAuth/cachedEmail'];
      loginData.membershipType = data['cursorAuth/stripeMembershipType'];
      loginData.hasApplicationUser = !!(data['src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser']);
      
      // 综合判断登录状态
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

// 睡眠函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 主执行函数
if (require.main === module) {
  testFixedLoginPreservation().then(result => {
    console.log(`\n📋 修复后登录保留测试完成: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`🎯 成功率: ${result.successRate.toFixed(1)}%`);
    console.log(`🔐 登录保留: ${result.loginPreserved ? '✅ 成功' : '❌ 失败'}`);
    console.log(`💡 建议: ${result.recommendation === 'production_ready' ? '✅ 可投入生产' : '⚠️ 需要改进'}`);
    
    if (result.success && result.successRate >= 85) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }).catch(console.error);
}

module.exports = { testFixedLoginPreservation };
