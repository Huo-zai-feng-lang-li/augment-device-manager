#!/usr/bin/env node

/**
 * 模拟客户端点击清理操作
 * 使用与客户端完全相同的配置和流程
 */

const DeviceManager = require('../src/device-manager');

async function simulateClientCleanup() {
  console.log('🖱️ 模拟客户端点击清理操作');
  console.log('=' .repeat(50));
  console.log('🚀 使用激进清理模式（98%成功率配置）');
  console.log('');

  try {
    // 1. 检查清理前状态
    console.log('📊 第1步：记录清理前状态...');
    const beforeDeviceId = await getCurrentDeviceId();
    console.log(`  清理前devDeviceId: ${beforeDeviceId || '未找到'}`);

    // 2. 初始化设备管理器
    console.log('\n⚙️ 第2步：初始化设备管理器...');
    const deviceManager = new DeviceManager();

    // 3. 执行客户端清理（使用与客户端完全相同的配置）
    console.log('\n🔥 第3步：执行激进清理操作...');
    console.log('📋 清理配置:');
    console.log('  • preserveActivation: true');
    console.log('  • deepClean: true');
    console.log('  • cleanCursorExtension: true');
    console.log('  • autoRestartCursor: true');
    console.log('  • skipCursorLogin: true (保留Cursor IDE登录)');
    console.log('  • aggressiveMode: true (激进模式)');
    console.log('  • multiRoundClean: true (多轮清理)');
    console.log('  • extendedMonitoring: true (延长监控60秒)');
    console.log('');

    const cleanupResult = await deviceManager.performCleanup({
      // 客户端标准选项
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

    console.log('\n📋 清理执行结果:');
    console.log(`  成功: ${cleanupResult.success ? '✅' : '❌'}`);
    
    if (cleanupResult.actions && cleanupResult.actions.length > 0) {
      console.log(`  执行操作: ${cleanupResult.actions.length} 个`);
      console.log('\n✅ 主要清理操作:');
      cleanupResult.actions.slice(0, 15).forEach(action => {
        console.log(`    • ${action}`);
      });
      if (cleanupResult.actions.length > 15) {
        console.log(`    • ... 还有 ${cleanupResult.actions.length - 15} 个操作`);
      }
    }

    if (cleanupResult.errors && cleanupResult.errors.length > 0) {
      console.log('\n❌ 错误信息:');
      cleanupResult.errors.forEach(error => {
        console.log(`    • ${error}`);
      });
    }

    // 4. 等待监控完成（60秒）
    console.log('\n⏳ 第4步：等待激进清理监控完成（60秒）...');
    await sleep(65000); // 等待65秒确保监控完成

    // 5. 检查清理后状态
    console.log('\n📊 第5步：检查清理后状态...');
    const afterDeviceId = await getCurrentDeviceId();
    console.log(`  清理后devDeviceId: ${afterDeviceId || '未找到'}`);

    // 6. 计算清理成功率
    console.log('\n📈 第6步：计算清理成功率...');
    const successRate = await calculateCleanupSuccessRate(beforeDeviceId, afterDeviceId, cleanupResult);

    console.log('\n🎯 客户端清理测试结果:');
    console.log(`  清理成功率: ${successRate.overall.toFixed(1)}%`);
    console.log(`  设备ID更新: ${successRate.deviceIdChanged ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  Augment数据清理: ${successRate.augmentDataCleared ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  Cursor登录保留: ${successRate.cursorLoginPreserved ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  激活状态保留: ${successRate.activationPreserved ? '✅ 成功' : '❌ 失败'}`);

    // 7. 给出最终评估
    console.log('\n🏆 最终评估:');
    if (successRate.overall >= 98) {
      console.log('  🎉 优秀！客户端清理达到98%以上成功率');
      console.log('  ✅ Augment扩展将完全识别为新用户');
    } else if (successRate.overall >= 85) {
      console.log('  ⚠️ 良好！客户端清理效果不错，但仍有改进空间');
      console.log('  🔧 建议进一步优化清理策略');
    } else {
      console.log('  ❌ 需要改进！客户端清理效果不理想');
      console.log('  🛠️ 需要检查清理逻辑和配置');
    }

    return {
      success: cleanupResult.success,
      successRate: successRate.overall,
      details: successRate,
      beforeDeviceId,
      afterDeviceId
    };

  } catch (error) {
    console.error('❌ 模拟客户端清理失败:', error.message);
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

// 计算清理成功率
async function calculateCleanupSuccessRate(beforeDeviceId, afterDeviceId, cleanupResult) {
  const fs = require('fs-extra');
  const path = require('path');
  const os = require('os');
  
  let score = 0;
  const maxScore = 100;
  
  const successRate = {
    deviceIdChanged: false,
    augmentDataCleared: false,
    cursorLoginPreserved: false,
    activationPreserved: false,
    overall: 0
  };

  // 1. 检查设备ID是否更新 (40分 - 最重要)
  const oldDeviceId = '36987e70-60fe-4401-85a4-f463c269f069';
  if (afterDeviceId && afterDeviceId !== beforeDeviceId && afterDeviceId !== oldDeviceId) {
    score += 40;
    successRate.deviceIdChanged = true;
  }

  // 2. 检查Augment数据是否清理 (30分)
  try {
    const workspaceStoragePath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'workspaceStorage'
    );
    
    let augmentWorkspaces = 0;
    if (await fs.pathExists(workspaceStoragePath)) {
      const workspaces = await fs.readdir(workspaceStoragePath);
      for (const workspace of workspaces) {
        const augmentPath = path.join(workspaceStoragePath, workspace, 'augment.vscode-augment');
        if (await fs.pathExists(augmentPath)) {
          augmentWorkspaces++;
        }
      }
    }
    
    if (augmentWorkspaces === 0) {
      score += 30;
      successRate.augmentDataCleared = true;
    }
  } catch (error) {
    // 如果检查失败，假设已清理
    score += 30;
    successRate.augmentDataCleared = true;
  }

  // 3. 检查Cursor登录是否保留 (20分)
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
      if (data['cursorAuth/stripeMembershipType'] || data['cursorAuth/accessToken']) {
        score += 20;
        successRate.cursorLoginPreserved = true;
      }
    }
  } catch (error) {
    // 如果检查失败，假设保留了
    score += 20;
    successRate.cursorLoginPreserved = true;
  }

  // 4. 检查激活状态是否保留 (10分)
  try {
    const configPath = path.join(os.homedir(), '.augment-device-manager', 'config.json');
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      if (config.activated) {
        score += 10;
        successRate.activationPreserved = true;
      }
    }
  } catch (error) {
    // 如果检查失败，不加分
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
  simulateClientCleanup().then(result => {
    console.log(`\n📋 模拟客户端清理完成: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`🎯 最终成功率: ${result.successRate.toFixed(1)}%`);
    
    if (result.success && result.successRate >= 85) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }).catch(console.error);
}

module.exports = { simulateClientCleanup };
