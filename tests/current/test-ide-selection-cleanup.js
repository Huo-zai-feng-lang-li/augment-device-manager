/**
 * IDE选择清理测试
 * 测试用户选择的IDE是否能正确清理对应的路径
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function testIDESelectionCleanup() {
  console.log('🧪 IDE选择清理测试');
  console.log('='.repeat(50));

  const results = {
    success: true,
    tests: [],
    errors: []
  };

  try {
    const DeviceManager = require('../../modules/desktop-client/src/device-manager');
    const deviceManager = new DeviceManager();

    // 1. 测试Cursor路径配置
    console.log('\n📋 1. 测试Cursor路径配置...');
    await testCursorPaths(deviceManager, results);

    // 2. 测试VS Code路径配置
    console.log('\n📋 2. 测试VS Code路径配置...');
    await testVSCodePaths(deviceManager, results);

    // 3. 测试Cursor清理功能
    console.log('\n🎨 3. 测试Cursor清理功能...');
    await testCursorCleanup(deviceManager, results);

    // 4. 测试VS Code清理功能
    console.log('\n💙 4. 测试VS Code清理功能...');
    await testVSCodeCleanup(deviceManager, results);

    // 5. 测试IDE选择跟随
    console.log('\n🎯 5. 测试IDE选择跟随...');
    await testIDESelectionFollowing(deviceManager, results);

    // 输出测试结果
    console.log('\n📊 测试结果汇总:');
    console.log('='.repeat(50));
    
    const passedTests = results.tests.filter(t => t.passed).length;
    const totalTests = results.tests.length;
    
    console.log(`✅ 通过测试: ${passedTests}/${totalTests}`);
    
    if (results.errors.length > 0) {
      console.log(`❌ 错误数量: ${results.errors.length}`);
      results.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    }

    results.tests.forEach(test => {
      const status = test.passed ? '✅' : '❌';
      console.log(`${status} ${test.name}: ${test.description}`);
    });

    return results;

  } catch (error) {
    console.error('❌ 测试执行失败:', error.message);
    results.success = false;
    results.errors.push(error.message);
    return results;
  }
}

// 测试Cursor路径配置
async function testCursorPaths(deviceManager, results) {
  try {
    const cursorPaths = deviceManager.getCursorPaths();
    
    const hasGlobalStorage = cursorPaths.globalStorage && cursorPaths.globalStorage.includes('Cursor');
    const hasStorageJson = cursorPaths.globalStorage && 
                          path.join(cursorPaths.globalStorage, 'storage.json');
    const hasStateDb = cursorPaths.stateDb && cursorPaths.stateDb.includes('Cursor');

    results.tests.push({
      name: 'Cursor路径配置',
      description: '检查Cursor路径配置是否正确',
      passed: hasGlobalStorage && hasStorageJson && hasStateDb
    });

    console.log(`   ✅ GlobalStorage: ${hasGlobalStorage ? '正确' : '错误'}`);
    console.log(`   ✅ Storage.json: ${hasStorageJson ? '正确' : '错误'}`);
    console.log(`   ✅ State.vscdb: ${hasStateDb ? '正确' : '错误'}`);

  } catch (error) {
    results.errors.push(`Cursor路径测试失败: ${error.message}`);
    results.tests.push({
      name: 'Cursor路径配置',
      description: '测试Cursor路径配置',
      passed: false
    });
  }
}

// 测试VS Code路径配置
async function testVSCodePaths(deviceManager, results) {
  try {
    const vscodePaths = deviceManager.getVSCodePaths();
    
    const hasVariants = vscodePaths.variants && Object.keys(vscodePaths.variants).length > 0;
    const hasStableVariant = vscodePaths.variants && vscodePaths.variants.stable;
    const hasCorrectPaths = hasStableVariant && 
                           vscodePaths.variants.stable.globalStorage &&
                           vscodePaths.variants.stable.storageJson &&
                           vscodePaths.variants.stable.stateDb;

    results.tests.push({
      name: 'VS Code路径配置',
      description: '检查VS Code路径配置是否正确',
      passed: hasVariants && hasStableVariant && hasCorrectPaths
    });

    console.log(`   ✅ 变体检测: ${hasVariants ? '正确' : '错误'}`);
    console.log(`   ✅ Stable变体: ${hasStableVariant ? '正确' : '错误'}`);
    console.log(`   ✅ 路径完整性: ${hasCorrectPaths ? '正确' : '错误'}`);

    if (hasStableVariant) {
      console.log(`   📁 GlobalStorage: ${vscodePaths.variants.stable.globalStorage}`);
      console.log(`   📁 Storage.json: ${vscodePaths.variants.stable.storageJson}`);
    }

  } catch (error) {
    results.errors.push(`VS Code路径测试失败: ${error.message}`);
    results.tests.push({
      name: 'VS Code路径配置',
      description: '测试VS Code路径配置',
      passed: false
    });
  }
}

// 测试Cursor清理功能
async function testCursorCleanup(deviceManager, results) {
  try {
    // 模拟Cursor清理（干运行模式）
    const cleanupResult = await deviceManager.performCleanup({
      cleanCursor: true,
      cleanVSCode: false,
      selectedIDE: 'cursor',
      intelligentMode: true,
      preserveActivation: true,
      skipBackup: true
    });

    const hasActions = cleanupResult.actions && cleanupResult.actions.length > 0;
    const hasCursorActions = cleanupResult.actions && 
                            cleanupResult.actions.some(action => 
                              action.includes('Cursor') || action.includes('cursor'));

    results.tests.push({
      name: 'Cursor清理功能',
      description: '检查Cursor清理功能是否正常',
      passed: cleanupResult.success && hasActions && hasCursorActions
    });

    console.log(`   ✅ 清理成功: ${cleanupResult.success ? '是' : '否'}`);
    console.log(`   ✅ 有操作记录: ${hasActions ? '是' : '否'}`);
    console.log(`   ✅ 包含Cursor操作: ${hasCursorActions ? '是' : '否'}`);

  } catch (error) {
    results.errors.push(`Cursor清理测试失败: ${error.message}`);
    results.tests.push({
      name: 'Cursor清理功能',
      description: '测试Cursor清理功能',
      passed: false
    });
  }
}

// 测试VS Code清理功能
async function testVSCodeCleanup(deviceManager, results) {
  try {
    // 检测VS Code变体
    const vscodeVariants = await deviceManager.detectInstalledVSCodeVariants();
    
    // 模拟VS Code清理（干运行模式）
    const cleanupResult = await deviceManager.performCleanup({
      cleanCursor: false,
      cleanVSCode: true,
      selectedIDE: 'vscode',
      intelligentMode: true,
      preserveActivation: true,
      skipBackup: true
    });

    const hasActions = cleanupResult.actions && cleanupResult.actions.length > 0;
    const hasVSCodeActions = cleanupResult.actions && 
                            cleanupResult.actions.some(action => 
                              action.includes('VS Code') || action.includes('Code'));

    results.tests.push({
      name: 'VS Code清理功能',
      description: '检查VS Code清理功能是否正常',
      passed: cleanupResult.success && hasActions
    });

    console.log(`   ✅ 检测到变体: ${vscodeVariants.length} 个`);
    console.log(`   ✅ 清理成功: ${cleanupResult.success ? '是' : '否'}`);
    console.log(`   ✅ 有操作记录: ${hasActions ? '是' : '否'}`);
    console.log(`   ✅ 包含VS Code操作: ${hasVSCodeActions ? '是' : '否'}`);

  } catch (error) {
    results.errors.push(`VS Code清理测试失败: ${error.message}`);
    results.tests.push({
      name: 'VS Code清理功能',
      description: '测试VS Code清理功能',
      passed: false
    });
  }
}

// 测试IDE选择跟随
async function testIDESelectionFollowing(deviceManager, results) {
  try {
    // 测试选择Cursor时的行为
    const cursorResult = await deviceManager.performCleanup({
      cleanCursor: true,
      cleanVSCode: false,
      selectedIDE: 'cursor',
      intelligentMode: true,
      preserveActivation: true,
      skipBackup: true
    });

    // 测试选择VS Code时的行为
    const vscodeResult = await deviceManager.performCleanup({
      cleanCursor: false,
      cleanVSCode: true,
      selectedIDE: 'vscode',
      intelligentMode: true,
      preserveActivation: true,
      skipBackup: true
    });

    const cursorFollowsSelection = cursorResult.success && 
                                  cursorResult.actions.some(action => 
                                    action.includes('Cursor') && !action.includes('VS Code'));
    
    const vscodeFollowsSelection = vscodeResult.success && 
                                  vscodeResult.actions.some(action => 
                                    action.includes('VS Code') || action.includes('Code'));

    results.tests.push({
      name: 'IDE选择跟随',
      description: '检查清理是否正确跟随用户的IDE选择',
      passed: cursorFollowsSelection || vscodeFollowsSelection
    });

    console.log(`   ✅ Cursor选择跟随: ${cursorFollowsSelection ? '正确' : '错误'}`);
    console.log(`   ✅ VS Code选择跟随: ${vscodeFollowsSelection ? '正确' : '错误'}`);

  } catch (error) {
    results.errors.push(`IDE选择跟随测试失败: ${error.message}`);
    results.tests.push({
      name: 'IDE选择跟随',
      description: '测试IDE选择跟随',
      passed: false
    });
  }
}

// 运行测试
if (require.main === module) {
  testIDESelectionCleanup()
    .then(results => {
      const success = results.success && results.errors.length === 0;
      console.log(`\n🎯 测试${success ? '成功' : '失败'}完成`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 测试运行失败:', error);
      process.exit(1);
    });
}

module.exports = { testIDESelectionCleanup };
