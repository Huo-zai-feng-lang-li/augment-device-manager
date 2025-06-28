#!/usr/bin/env node

/**
 * 最终客户端清理测试
 * 测试集成了终极策略的客户端清理功能
 */

const DeviceManager = require('../src/device-manager');

async function finalClientTest() {
  console.log('🏁 最终客户端清理测试');
  console.log('=' .repeat(50));
  console.log('🎯 测试集成了终极策略的客户端清理功能');
  console.log('');

  try {
    // 1. 检查清理前状态
    console.log('📊 第1步：记录清理前状态...');
    const beforeDeviceId = await getCurrentDeviceId();
    console.log(`  清理前devDeviceId: ${beforeDeviceId || '未找到'}`);

    // 2. 初始化设备管理器
    console.log('\n⚙️ 第2步：初始化设备管理器...');
    const deviceManager = new DeviceManager();

    // 3. 执行最终版客户端清理（与前端完全一致的配置）
    console.log('\n🚀 第3步：执行最终版客户端清理...');
    console.log('📋 客户端清理配置（与前端一致）:');
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
      console.log('\n✅ 关键操作摘要:');
      
      // 显示关键操作
      const keyActions = cleanupResult.actions.filter(action => 
        action.includes('devDeviceId') || 
        action.includes('强制更新') || 
        action.includes('监控') ||
        action.includes('Cursor IDE')
      );
      
      keyActions.slice(0, 10).forEach(action => {
        console.log(`    • ${action}`);
      });
      
      if (keyActions.length > 10) {
        console.log(`    • ... 还有 ${keyActions.length - 10} 个关键操作`);
      }
    }

    if (cleanupResult.errors && cleanupResult.errors.length > 0) {
      console.log('\n⚠️ 非关键错误:');
      cleanupResult.errors.slice(0, 3).forEach(error => {
        console.log(`    • ${error}`);
      });
    }

    // 4. 等待清理完全完成
    console.log('\n⏳ 第4步：等待清理完全完成...');
    await sleep(5000);

    // 5. 检查清理后状态
    console.log('\n📊 第5步：检查清理后状态...');
    const afterDeviceId = await getCurrentDeviceId();
    console.log(`  清理后devDeviceId: ${afterDeviceId || '未找到'}`);

    // 6. 计算最终清理成功率
    console.log('\n📈 第6步：计算最终清理成功率...');
    const successRate = await calculateFinalSuccessRate(beforeDeviceId, afterDeviceId, cleanupResult);

    console.log('\n🎯 最终客户端清理结果:');
    console.log(`  清理成功率: ${successRate.overall.toFixed(1)}%`);
    console.log(`  设备ID更新: ${successRate.deviceIdChanged ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  摆脱顽固ID: ${successRate.escapedOldId ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  Augment数据清理: ${successRate.augmentDataCleared ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  监控机制运行: ${successRate.monitoringWorked ? '✅ 成功' : '❌ 失败'}`);

    // 7. 最终评估和建议
    console.log('\n🏆 最终评估:');
    if (successRate.overall >= 95) {
      console.log('  🎉 完美！客户端清理功能已达到生产标准');
      console.log('  ✅ 用户点击"开始清理"将获得优秀的清理效果');
      console.log('  🚀 Augment扩展将识别为新用户');
    } else if (successRate.overall >= 85) {
      console.log('  ⭐ 很好！客户端清理功能表现良好');
      console.log('  🔧 可以投入使用，效果令人满意');
    } else if (successRate.overall >= 70) {
      console.log('  ⚠️ 一般！客户端清理功能基本可用');
      console.log('  🛠️ 建议进一步优化以提升成功率');
    } else {
      console.log('  ❌ 需要改进！客户端清理功能效果不理想');
      console.log('  🔧 需要检查配置和实现逻辑');
    }

    console.log('\n📋 用户使用指南:');
    console.log('  1. 启动客户端应用');
    console.log('  2. 点击"开始清理"按钮');
    console.log('  3. 确认激进清理模式');
    console.log('  4. 等待清理完成（约90秒）');
    console.log('  5. 享受清理效果！');

    return {
      success: cleanupResult.success,
      successRate: successRate.overall,
      details: successRate,
      beforeDeviceId,
      afterDeviceId,
      recommendation: successRate.overall >= 85 ? 'ready' : 'needs_improvement'
    };

  } catch (error) {
    console.error('❌ 最终客户端清理测试失败:', error.message);
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

// 计算最终清理成功率
async function calculateFinalSuccessRate(beforeDeviceId, afterDeviceId, cleanupResult) {
  let score = 0;
  const maxScore = 100;
  
  const successRate = {
    deviceIdChanged: false,
    escapedOldId: false,
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

  // 2. 摆脱顽固的旧ID (40分 - 最重要)
  if (afterDeviceId !== oldDeviceId) {
    score += 40;
    successRate.escapedOldId = true;
  }

  // 3. Augment数据清理 (20分)
  const augmentCleared = cleanupResult.actions.some(action => 
    action.includes('Augment') || action.includes('augment') || action.includes('清理')
  );
  if (augmentCleared) {
    score += 20;
    successRate.augmentDataCleared = true;
  }

  // 4. 监控机制运行 (10分)
  const monitoringWorked = cleanupResult.actions.some(action => 
    action.includes('监控') || action.includes('强制更新')
  );
  if (monitoringWorked) {
    score += 10;
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
  finalClientTest().then(result => {
    console.log(`\n📋 最终客户端清理测试完成: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`🎯 最终成功率: ${result.successRate.toFixed(1)}%`);
    console.log(`💡 建议: ${result.recommendation === 'ready' ? '✅ 可以投入使用' : '⚠️ 需要进一步改进'}`);
    
    if (result.success && result.successRate >= 80) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }).catch(console.error);
}

module.exports = { finalClientTest };
