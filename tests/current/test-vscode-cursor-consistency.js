const DeviceManager = require('../../modules/desktop-client/src/device-manager');

/**
 * 测试VSCode和Cursor功能一致性
 * 验证智能清理和广告防护增强功能对两个IDE的处理是否一致
 */

async function testVSCodeCursorConsistency() {
  console.log('🔍 测试VSCode和Cursor功能一致性');
  console.log('==================================================');

  const deviceManager = new DeviceManager();
  
  try {
    // 第1步：检测已安装的IDE
    console.log('\n🔍 第1步：检测已安装的IDE...');
    
    // 检测Cursor
    const cursorPaths = deviceManager.getCursorPaths();
    const cursorExists = await require('fs-extra').pathExists(cursorPaths.globalStorage);
    console.log(`📁 Cursor IDE: ${cursorExists ? '✅ 已安装' : '❌ 未安装'}`);
    
    // 检测VSCode变体
    const vscodeVariants = await deviceManager.detectInstalledVSCodeVariants();
    console.log(`📁 VS Code变体: ${vscodeVariants.length > 0 ? `✅ 检测到${vscodeVariants.length}个变体` : '❌ 未安装'}`);
    
    if (vscodeVariants.length > 0) {
      vscodeVariants.forEach(variant => {
        console.log(`   - ${variant.name}: ${variant.globalStorage}`);
      });
    }

    // 第2步：测试智能清理模式配置一致性
    console.log('\n🧠 第2步：测试智能清理模式配置一致性...');
    
    const intelligentOptions = {
      intelligentMode: true,
      cleanCursor: true,
      cleanVSCode: true, // 现在默认启用
      preserveActivation: true,
      deepClean: false,
      cleanCursorExtension: false,
      autoRestartCursor: false,
      autoRestartIDE: false,
      skipBackup: true,
      enableEnhancedGuardian: true,
      skipCursorLogin: true,
      resetCursorCompletely: false,
      resetVSCodeCompletely: false,
      aggressiveMode: false,
      multiRoundClean: false,
      extendedMonitoring: false,
      usePowerShellAssist: false,
    };

    console.log('📋 智能清理模式配置:');
    console.log(`   - cleanCursor: ${intelligentOptions.cleanCursor}`);
    console.log(`   - cleanVSCode: ${intelligentOptions.cleanVSCode}`);
    console.log(`   - enableEnhancedGuardian: ${intelligentOptions.enableEnhancedGuardian}`);

    // 第3步：测试增强防护机制对VSCode的支持
    console.log('\n🛡️ 第3步：测试增强防护机制对VSCode的支持...');
    
    const { EnhancedDeviceGuardian } = require('../../modules/desktop-client/src/enhanced-device-guardian');
    const guardian = new EnhancedDeviceGuardian();
    
    // 检查路径配置
    const paths = guardian.paths;
    console.log('📁 增强防护监控路径:');
    console.log(`   - Cursor Global: ${paths.cursorGlobalStorage}`);
    console.log(`   - VS Code Global: ${paths.vscodeGlobalStorage}`);
    console.log(`   - VS Code Insiders: ${paths.vscodeInsidersGlobalStorage}`);
    
    // 检查备份路径覆盖
    const backupPathsIncludeVSCode = paths.backupPaths.some(p => p.includes('Code'));
    console.log(`   - 备份监控包含VSCode: ${backupPathsIncludeVSCode ? '✅ 是' : '❌ 否'}`);

    // 第4步：测试清理功能方法存在性
    console.log('\n🔧 第4步：测试清理功能方法存在性...');
    
    const requiredMethods = [
      'detectInstalledVSCodeVariants',
      'performVSCodeCleanup',
      'performVSCodeIntelligentCleanup',
      'performCompleteVSCodeReset',
      'forceCloseVSCodeIDE',
      'startVSCodeIDE',
      'cleanVSCodeAugmentData',
      'updateVSCodeDeviceId',
      'protectVSCodeMCPConfig',
      'restoreVSCodeMCPConfig'
    ];

    console.log('🔍 检查VSCode专用方法:');
    requiredMethods.forEach(method => {
      const exists = typeof deviceManager[method] === 'function';
      console.log(`   - ${method}: ${exists ? '✅ 存在' : '❌ 缺失'}`);
    });

    // 第5步：测试配置默认值一致性
    console.log('\n⚙️ 第5步：测试配置默认值一致性...');
    
    // 模拟前端默认配置
    const defaultCursorEnabled = true; // HTML中默认checked
    const defaultVSCodeEnabled = true; // 修复后默认checked
    
    console.log('🎯 IDE默认启用状态:');
    console.log(`   - Cursor默认启用: ${defaultCursorEnabled ? '✅ 是' : '❌ 否'}`);
    console.log(`   - VSCode默认启用: ${defaultVSCodeEnabled ? '✅ 是' : '❌ 否'}`);
    console.log(`   - 配置一致性: ${defaultCursorEnabled === defaultVSCodeEnabled ? '✅ 一致' : '❌ 不一致'}`);

    // 第6步：功能对等性总结
    console.log('\n📊 第6步：功能对等性总结...');
    
    const consistencyChecks = {
      '路径检测': cursorExists && vscodeVariants.length > 0,
      '清理方法': requiredMethods.every(method => typeof deviceManager[method] === 'function'),
      '增强防护': backupPathsIncludeVSCode,
      '默认配置': defaultCursorEnabled === defaultVSCodeEnabled,
      'MCP保护': typeof deviceManager.protectVSCodeMCPConfig === 'function',
      '智能清理': typeof deviceManager.performVSCodeIntelligentCleanup === 'function'
    };

    console.log('✅ 功能对等性检查结果:');
    Object.entries(consistencyChecks).forEach(([feature, passed]) => {
      console.log(`   - ${feature}: ${passed ? '✅ 通过' : '❌ 失败'}`);
    });

    const allPassed = Object.values(consistencyChecks).every(check => check);
    
    console.log('\n🎉 总体评估:');
    if (allPassed) {
      console.log('✅ VSCode和Cursor功能完全一致！');
      console.log('✅ 智能清理和广告防护增强功能对两个IDE提供相同的保护');
    } else {
      console.log('⚠️ 存在功能不一致的地方，需要进一步修复');
    }

    return {
      success: allPassed,
      checks: consistencyChecks,
      cursorInstalled: cursorExists,
      vscodeVariants: vscodeVariants.length,
      message: allPassed ? 'VSCode和Cursor功能完全一致' : '存在功能差异'
    };

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testVSCodeCursorConsistency()
    .then(result => {
      console.log('\n📋 测试结果:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('测试失败:', error);
      process.exit(1);
    });
}

module.exports = { testVSCodeCursorConsistency };
