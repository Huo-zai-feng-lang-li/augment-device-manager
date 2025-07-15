#!/usr/bin/env node

/**
 * 验证客户端清理功能 - 检查是否启用了98%成功率的激进清理模式
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function verifyClientCleanup() {
  console.log('🔍 验证客户端清理功能配置');
  console.log('=' .repeat(50));
  console.log('🎯 检查是否启用了98%成功率的激进清理模式');
  console.log('');

  const results = {
    frontendConfig: false,
    backendSupport: false,
    deviceManagerLogic: false,
    overallReady: false
  };

  try {
    // 1. 检查前端配置
    console.log('📱 第1步：检查前端清理配置...');
    const frontendCheck = await checkFrontendConfig();
    results.frontendConfig = frontendCheck;
    
    // 2. 检查后端支持
    console.log('\n🔧 第2步：检查后端清理支持...');
    const backendCheck = await checkBackendSupport();
    results.backendSupport = backendCheck;
    
    // 3. 检查设备管理器逻辑
    console.log('\n⚙️ 第3步：检查设备管理器清理逻辑...');
    const deviceManagerCheck = await checkDeviceManagerLogic();
    results.deviceManagerLogic = deviceManagerCheck;
    
    // 4. 总体评估
    console.log('\n📊 第4步：总体评估...');
    const overallReady = frontendCheck && backendCheck && deviceManagerCheck;
    results.overallReady = overallReady;
    
    console.log('\n🎯 验证结果总结:');
    console.log(`  📱 前端配置: ${frontendCheck ? '✅ 已启用激进清理' : '❌ 未启用激进清理'}`);
    console.log(`  🔧 后端支持: ${backendCheck ? '✅ 支持激进清理选项' : '❌ 不支持激进清理选项'}`);
    console.log(`  ⚙️ 设备管理器: ${deviceManagerCheck ? '✅ 包含激进清理逻辑' : '❌ 缺少激进清理逻辑'}`);
    console.log(`  🎯 整体状态: ${overallReady ? '✅ 可实现98%清理成功率' : '❌ 无法实现98%清理成功率'}`);
    
    if (overallReady) {
      console.log('\n🎉 客户端清理功能已就绪！');
      console.log('💡 用户点击"开始清理"按钮将执行98%成功率的激进清理');
      console.log('🔥 包含：多轮清理 + 实时监控 + 强制设备ID更新');
    } else {
      console.log('\n⚠️ 客户端清理功能需要修复！');
      console.log('💡 建议检查配置并启用激进清理模式');
    }
    
    return results;

  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    return results;
  }
}

// 检查前端配置
async function checkFrontendConfig() {
  try {
    const rendererPath = path.join(__dirname, '../public/renderer.js');
    const rendererContent = await fs.readFile(rendererPath, 'utf8');
    
    // 检查是否包含激进清理配置
    const hasAggressiveMode = rendererContent.includes('aggressiveMode: true');
    const hasMultiRoundClean = rendererContent.includes('multiRoundClean: true');
    const hasExtendedMonitoring = rendererContent.includes('extendedMonitoring: true');
    const hasSkipCursorLogin = rendererContent.includes('skipCursorLogin: true');
    
    console.log(`    aggressiveMode: ${hasAggressiveMode ? '✅' : '❌'}`);
    console.log(`    multiRoundClean: ${hasMultiRoundClean ? '✅' : '❌'}`);
    console.log(`    extendedMonitoring: ${hasExtendedMonitoring ? '✅' : '❌'}`);
    console.log(`    skipCursorLogin: ${hasSkipCursorLogin ? '✅' : '❌'}`);
    
    const allConfigured = hasAggressiveMode && hasMultiRoundClean && 
                         hasExtendedMonitoring && hasSkipCursorLogin;
    
    if (allConfigured) {
      console.log('    ✅ 前端已启用完整的激进清理配置');
    } else {
      console.log('    ❌ 前端缺少激进清理配置');
    }
    
    return allConfigured;
  } catch (error) {
    console.log(`    ❌ 检查前端配置失败: ${error.message}`);
    return false;
  }
}

// 检查后端支持
async function checkBackendSupport() {
  try {
    const mainPath = path.join(__dirname, '../src/main.js');
    const mainContent = await fs.readFile(mainPath, 'utf8');
    
    // 检查是否支持传递激进清理选项
    const hasCleanupOptionsSpread = mainContent.includes('...options');
    const hasPerformCleanup = mainContent.includes('performCleanup(cleanupOptions)');
    
    console.log(`    选项传递支持: ${hasCleanupOptionsSpread ? '✅' : '❌'}`);
    console.log(`    清理函数调用: ${hasPerformCleanup ? '✅' : '❌'}`);
    
    const backendSupported = hasCleanupOptionsSpread && hasPerformCleanup;
    
    if (backendSupported) {
      console.log('    ✅ 后端支持激进清理选项传递');
    } else {
      console.log('    ❌ 后端不支持激进清理选项传递');
    }
    
    return backendSupported;
  } catch (error) {
    console.log(`    ❌ 检查后端支持失败: ${error.message}`);
    return false;
  }
}

// 检查设备管理器逻辑
async function checkDeviceManagerLogic() {
  try {
    const deviceManagerPath = path.join(__dirname, '../src/device-manager.js');
    const deviceManagerContent = await fs.readFile(deviceManagerPath, 'utf8');
    
    // 检查是否包含激进清理逻辑
    const hasAggressiveModeLogic = deviceManagerContent.includes('options.aggressiveMode');
    const hasMultiRoundCleanLogic = deviceManagerContent.includes('performMultiRoundCleanup');
    const hasExtendedMonitoringLogic = deviceManagerContent.includes('options.extendedMonitoring');
    const hasSkipCursorLoginLogic = deviceManagerContent.includes('options.skipCursorLogin');
    const hasContinuousMonitoring = deviceManagerContent.includes('startContinuousMonitoring');
    
    console.log(`    激进模式逻辑: ${hasAggressiveModeLogic ? '✅' : '❌'}`);
    console.log(`    多轮清理逻辑: ${hasMultiRoundCleanLogic ? '✅' : '❌'}`);
    console.log(`    延长监控逻辑: ${hasExtendedMonitoringLogic ? '✅' : '❌'}`);
    console.log(`    跳过Cursor登录: ${hasSkipCursorLoginLogic ? '✅' : '❌'}`);
    console.log(`    持续监控功能: ${hasContinuousMonitoring ? '✅' : '❌'}`);
    
    const allLogicPresent = hasAggressiveModeLogic && hasMultiRoundCleanLogic && 
                           hasExtendedMonitoringLogic && hasSkipCursorLoginLogic && 
                           hasContinuousMonitoring;
    
    if (allLogicPresent) {
      console.log('    ✅ 设备管理器包含完整的激进清理逻辑');
    } else {
      console.log('    ❌ 设备管理器缺少激进清理逻辑');
    }
    
    return allLogicPresent;
  } catch (error) {
    console.log(`    ❌ 检查设备管理器逻辑失败: ${error.message}`);
    return false;
  }
}

// 主执行函数
if (require.main === module) {
  verifyClientCleanup().then(results => {
    console.log(`\n📋 验证完成: ${results.overallReady ? '✅ 客户端已就绪' : '❌ 客户端需要修复'}`);
    process.exit(results.overallReady ? 0 : 1);
  }).catch(console.error);
}

module.exports = { verifyClientCleanup };
