/**
 * 验证VSCode和Cursor功能一致性修复
 * 快速验证修复后的效果
 */

const fs = require('fs-extra');
const path = require('path');

async function verifyFix() {
  console.log('🔍 验证VSCode和Cursor功能一致性修复');
  console.log('==========================================');

  const results = {
    htmlFix: false,
    jsFix: false,
    functionalityExists: false,
    protectionExists: false
  };

  try {
    // 1. 检查HTML修复
    console.log('\n📄 检查HTML界面修复...');
    const htmlPath = path.join(__dirname, '../../modules/desktop-client/public/index.html');
    const htmlContent = await fs.readFile(htmlPath, 'utf8');
    
    // 检查VSCode选项是否默认勾选
    const vscodeCheckboxMatch = htmlContent.match(/id="clean-vscode"[^>]*checked/);
    results.htmlFix = !!vscodeCheckboxMatch;
    console.log(`   VSCode选项默认勾选: ${results.htmlFix ? '✅ 已修复' : '❌ 未修复'}`);

    // 2. 检查JavaScript修复
    console.log('\n📜 检查JavaScript默认值修复...');
    const jsPath = path.join(__dirname, '../../modules/desktop-client/public/renderer.js');
    const jsContent = await fs.readFile(jsPath, 'utf8');
    
    // 检查VSCode默认值是否为true
    const vscodeDefaultMatch = jsContent.match(/cleanVSCode.*?checked.*?true/);
    results.jsFix = !!vscodeDefaultMatch;
    console.log(`   VSCode默认值修复: ${results.jsFix ? '✅ 已修复' : '❌ 未修复'}`);

    // 3. 检查VSCode功能完整性
    console.log('\n🔧 检查VSCode功能完整性...');
    const DeviceManager = require('../../modules/desktop-client/src/device-manager');
    const deviceManager = new DeviceManager();
    
    const requiredMethods = [
      'detectInstalledVSCodeVariants',
      'performVSCodeCleanup',
      'performVSCodeIntelligentCleanup'
    ];
    
    const methodsExist = requiredMethods.every(method => 
      typeof deviceManager[method] === 'function'
    );
    results.functionalityExists = methodsExist;
    console.log(`   VSCode清理功能: ${results.functionalityExists ? '✅ 完整' : '❌ 缺失'}`);

    // 4. 检查增强防护对VSCode的支持
    console.log('\n🛡️ 检查增强防护对VSCode的支持...');
    const { EnhancedDeviceGuardian } = require('../../modules/desktop-client/src/enhanced-device-guardian');
    const guardian = new EnhancedDeviceGuardian();
    
    const hasVSCodePaths = guardian.paths.vscodeGlobalStorage && 
                          guardian.paths.vscodeWorkspaceStorage;
    const hasVSCodeBackupMonitoring = guardian.paths.backupPaths.some(p => 
      p.includes('Code')
    );
    
    results.protectionExists = hasVSCodePaths && hasVSCodeBackupMonitoring;
    console.log(`   VSCode路径监控: ${hasVSCodePaths ? '✅ 支持' : '❌ 不支持'}`);
    console.log(`   VSCode备份监控: ${hasVSCodeBackupMonitoring ? '✅ 支持' : '❌ 不支持'}`);

    // 5. 总结
    console.log('\n📊 修复验证总结:');
    const allFixed = Object.values(results).every(result => result);
    
    Object.entries({
      'HTML界面修复': results.htmlFix,
      'JavaScript默认值修复': results.jsFix,
      'VSCode功能完整性': results.functionalityExists,
      'VSCode增强防护': results.protectionExists
    }).forEach(([item, status]) => {
      console.log(`   - ${item}: ${status ? '✅ 通过' : '❌ 失败'}`);
    });

    console.log('\n🎯 最终结果:');
    if (allFixed) {
      console.log('✅ 所有修复都已完成！');
      console.log('✅ VSCode和Cursor现在具有完全一致的功能');
      console.log('✅ 用户无需手动勾选，VSCode会自动启用智能清理和防护');
    } else {
      console.log('⚠️ 部分修复未完成，需要进一步检查');
    }

    return {
      success: allFixed,
      details: results,
      message: allFixed ? '修复完成' : '修复未完成'
    };

  } catch (error) {
    console.error('❌ 验证过程中出现错误:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  verifyFix()
    .then(result => {
      console.log('\n📋 验证结果:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('验证失败:', error);
      process.exit(1);
    });
}

module.exports = { verifyFix };
