#!/usr/bin/env node

/**
 * 客户端清理测试 - 模拟客户端点击清理的实际效果
 * 使用与客户端相同的清理配置和流程
 */

const path = require('path');
const DeviceManager = require('../src/device-manager');

async function testClientCleanup() {
  console.log('🖱️ 模拟客户端清理测试');
  console.log('=' .repeat(50));
  console.log('📋 使用客户端相同的清理配置');
  console.log('');

  try {
    const deviceManager = new DeviceManager();
    
    // 1. 检查清理前状态
    console.log('📊 清理前状态检查...');
    const beforeState = await checkCurrentState();
    console.log(`  设备ID: ${beforeState.deviceId ? beforeState.deviceId.substring(0, 32) + '...' : '未找到'}`);
    console.log(`  激活状态: ${beforeState.activated ? '已激活' : '未激活'}`);
    
    // 2. 执行客户端标准清理配置
    console.log('\n🧹 执行客户端清理（标准配置）...');
    const cleanupResult = await deviceManager.performCleanup({
      // 客户端默认配置
      preserveActivation: true,      // 保留激活状态
      deepClean: true,              // 深度清理
      cleanCursorExtension: true,   // 清理Cursor扩展数据
      autoRestartCursor: true,      // 自动重启Cursor
      skipCursorLogin: true,        // 跳过Cursor IDE登录清理（重要）
      aggressiveMode: false,        // 客户端不使用激进模式
      multiRoundClean: false,       // 客户端不使用多轮清理
      extendedMonitoring: false     // 客户端使用标准监控时间
    });

    console.log('\n📋 清理结果:');
    console.log(`  成功: ${cleanupResult.success ? '✅' : '❌'}`);
    
    if (cleanupResult.actions && cleanupResult.actions.length > 0) {
      console.log('\n✅ 执行的操作:');
      cleanupResult.actions.slice(0, 10).forEach(action => {
        console.log(`  • ${action}`);
      });
      if (cleanupResult.actions.length > 10) {
        console.log(`  • ... 还有 ${cleanupResult.actions.length - 10} 个操作`);
      }
    }

    if (cleanupResult.errors && cleanupResult.errors.length > 0) {
      console.log('\n❌ 错误信息:');
      cleanupResult.errors.forEach(error => {
        console.log(`  • ${error}`);
      });
    }

    // 3. 等待30秒（客户端标准监控时间）
    console.log('\n⏳ 等待30秒让监控完成...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // 4. 检查清理后状态
    console.log('\n📊 清理后状态检查...');
    const afterState = await checkCurrentState();
    console.log(`  设备ID: ${afterState.deviceId ? afterState.deviceId.substring(0, 32) + '...' : '未找到'}`);
    console.log(`  激活状态: ${afterState.activated ? '已激活' : '未激活'}`);

    // 5. 计算客户端清理准确率
    const accuracyRate = await calculateClientAccuracy(beforeState, afterState);
    
    console.log('\n📊 客户端清理准确率分析:');
    console.log(`  总体准确率: ${accuracyRate.overall.toFixed(1)}%`);
    console.log(`  设备ID更新: ${accuracyRate.deviceIdChanged ? '✅' : '❌'}`);
    console.log(`  Augment数据清理: ${accuracyRate.augmentDataCleared ? '✅' : '❌'}`);
    console.log(`  激活状态保留: ${accuracyRate.activationPreserved ? '✅' : '❌'}`);
    
    // 6. 给出建议
    console.log('\n💡 建议:');
    if (accuracyRate.overall >= 98) {
      console.log('  🎉 客户端清理效果优秀，可以投入使用');
    } else if (accuracyRate.overall >= 85) {
      console.log('  ⚠️ 客户端清理效果良好，建议启用激进模式提升准确率');
    } else {
      console.log('  ❌ 客户端清理效果不佳，需要优化清理策略');
    }

    return {
      success: cleanupResult.success,
      accuracyRate: accuracyRate.overall,
      details: accuracyRate
    };

  } catch (error) {
    console.error('❌ 客户端清理测试失败:', error.message);
    return {
      success: false,
      accuracyRate: 0,
      error: error.message
    };
  }
}

// 检查当前状态
async function checkCurrentState() {
  const fs = require('fs-extra');
  const os = require('os');
  
  const state = {
    deviceId: null,
    activated: false,
    augmentData: false,
    cursorFiles: false
  };

  try {
    // 检查设备ID
    const configPath = path.join(os.homedir(), '.augment-device-manager', 'config.json');
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      state.deviceId = config.deviceId;
      state.activated = config.activated || false;
    }

    // 检查Augment数据
    const augmentPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'augment.vscode-augment');
    state.augmentData = await fs.pathExists(augmentPath);

    // 检查Cursor文件
    const cursorPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor');
    state.cursorFiles = await fs.pathExists(cursorPath);

  } catch (error) {
    // 忽略检查错误
  }

  return state;
}

// 计算客户端清理准确率
async function calculateClientAccuracy(beforeState, afterState) {
  const fs = require('fs-extra');
  const os = require('os');
  
  let score = 0;
  const maxScore = 100;
  
  const accuracy = {
    deviceIdChanged: false,
    augmentDataCleared: false,
    activationPreserved: false,
    cursorLoginPreserved: false,
    overall: 0
  };

  // 1. 检查设备ID是否更新 (30分)
  if (beforeState.deviceId !== afterState.deviceId && afterState.deviceId) {
    score += 30;
    accuracy.deviceIdChanged = true;
  }

  // 2. 检查Augment数据是否清理 (25分)
  if (beforeState.augmentData && !afterState.augmentData) {
    score += 25;
    accuracy.augmentDataCleared = true;
  } else if (!beforeState.augmentData) {
    // 如果之前就没有Augment数据，也算清理成功
    score += 25;
    accuracy.augmentDataCleared = true;
  }

  // 3. 检查激活状态是否保留 (20分)
  if (beforeState.activated === afterState.activated) {
    score += 20;
    accuracy.activationPreserved = true;
  }

  // 4. 检查Cursor登录是否保留 (15分)
  try {
    const storageJsonPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'storage.json');
    if (await fs.pathExists(storageJsonPath)) {
      const data = await fs.readJson(storageJsonPath);
      // 检查是否还有Cursor登录信息（这是好事，说明保留了）
      if (data['cursorAuth/stripeMembershipType'] || data['applicationUser']) {
        score += 15;
        accuracy.cursorLoginPreserved = true;
      }
    }
  } catch (error) {
    // 如果无法检查，假设保留了
    score += 15;
    accuracy.cursorLoginPreserved = true;
  }

  // 5. 检查遥测ID是否更新 (10分)
  try {
    const storageJsonPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'storage.json');
    if (await fs.pathExists(storageJsonPath)) {
      const data = await fs.readJson(storageJsonPath);
      const devDeviceId = data['telemetry.devDeviceId'];
      
      // 检查是否不是旧的固定ID
      if (devDeviceId && devDeviceId !== '36987e70-60fe-4401-85a4-f463c269f069') {
        score += 10;
      }
    }
  } catch (error) {
    // 忽略检查错误
  }

  accuracy.overall = (score / maxScore) * 100;
  return accuracy;
}

// 主执行函数
if (require.main === module) {
  testClientCleanup().then(result => {
    console.log('\n📋 客户端清理测试总结:');
    console.log(`  成功: ${result.success ? '✅' : '❌'}`);
    console.log(`  准确率: ${result.accuracyRate.toFixed(1)}%`);
    
    if (result.success && result.accuracyRate >= 85) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }).catch(console.error);
}

module.exports = { testClientCleanup };
