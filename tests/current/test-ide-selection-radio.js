/**
 * IDE选择单选模式测试
 * 测试将IDE选择改为单选模式并实现增强防护的动态IDE跟随功能
 */

const fs = require('fs-extra');
const path = require('path');

async function testIDESelectionRadioMode() {
  console.log('🧪 IDE选择单选模式测试');
  console.log('='.repeat(50));

  const results = {
    success: true,
    tests: [],
    errors: []
  };

  try {
    // 1. 测试前端界面更改
    console.log('\n📋 1. 测试前端界面更改...');
    await testFrontendChanges(results);

    // 2. 测试增强防护动态IDE跟随
    console.log('\n🛡️ 2. 测试增强防护动态IDE跟随...');
    await testEnhancedGuardianIDESelection(results);

    // 3. 测试设备ID管理
    console.log('\n🆔 3. 测试设备ID管理...');
    await testDeviceIDManagement(results);

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

// 测试前端界面更改
async function testFrontendChanges(results) {
  try {
    const indexHtmlPath = path.join(__dirname, '../../modules/desktop-client/public/index.html');
    const rendererJsPath = path.join(__dirname, '../../modules/desktop-client/public/renderer.js');

    // 检查HTML文件中的单选按钮
    const htmlContent = await fs.readFile(indexHtmlPath, 'utf8');
    
    const hasRadioButtons = htmlContent.includes('type="radio"') && 
                           htmlContent.includes('name="ide-selection"');
    const hasCursorRadio = htmlContent.includes('id="clean-cursor"') && 
                          htmlContent.includes('value="cursor"');
    const hasVSCodeRadio = htmlContent.includes('id="clean-vscode"') && 
                          htmlContent.includes('value="vscode"');

    results.tests.push({
      name: 'HTML单选按钮',
      description: '检查HTML中是否正确实现了单选按钮',
      passed: hasRadioButtons && hasCursorRadio && hasVSCodeRadio
    });

    // 检查JavaScript文件中的选择逻辑
    const jsContent = await fs.readFile(rendererJsPath, 'utf8');
    
    const hasSelectedIDELogic = jsContent.includes('selectedIDE') && 
                               jsContent.includes('querySelector(\'input[name="ide-selection"]:checked\')');
    const hasCleanCursorLogic = jsContent.includes('cleanCursor = selectedIDE === "cursor"');
    const hasCleanVSCodeLogic = jsContent.includes('cleanVSCode = selectedIDE === "vscode"');

    results.tests.push({
      name: 'JavaScript选择逻辑',
      description: '检查JavaScript中是否正确实现了IDE选择逻辑',
      passed: hasSelectedIDELogic && hasCleanCursorLogic && hasCleanVSCodeLogic
    });

    console.log(`   ✅ HTML单选按钮: ${hasRadioButtons && hasCursorRadio && hasVSCodeRadio ? '已实现' : '未实现'}`);
    console.log(`   ✅ JavaScript选择逻辑: ${hasSelectedIDELogic && hasCleanCursorLogic && hasCleanVSCodeLogic ? '已实现' : '未实现'}`);

  } catch (error) {
    results.errors.push(`前端界面测试失败: ${error.message}`);
    results.tests.push({
      name: '前端界面更改',
      description: '测试前端界面更改',
      passed: false
    });
  }
}

// 测试增强防护动态IDE跟随
async function testEnhancedGuardianIDESelection(results) {
  try {
    const { EnhancedDeviceGuardian } = require('../../modules/desktop-client/src/enhanced-device-guardian');
    const guardian = new EnhancedDeviceGuardian();

    // 测试默认选择
    const defaultSelected = guardian.selectedIDE === 'cursor';
    results.tests.push({
      name: '默认IDE选择',
      description: '检查默认选择是否为Cursor',
      passed: defaultSelected
    });

    // 测试设置IDE选择
    guardian.setSelectedIDE('vscode');
    const vsCodeSelected = guardian.selectedIDE === 'vscode' && 
                          guardian.monitorCursor === false && 
                          guardian.monitorVSCode === true;

    results.tests.push({
      name: 'IDE选择切换',
      description: '检查IDE选择切换是否正确',
      passed: vsCodeSelected
    });

    // 测试路径获取方法
    guardian.setSelectedIDE('cursor');
    const cursorPath = guardian.getCurrentIDEStoragePath();
    const expectedCursorPath = guardian.paths.storageJson;

    guardian.setSelectedIDE('vscode');
    const vscodePath = guardian.getCurrentIDEStoragePath();
    const expectedVSCodePath = guardian.paths.vscodeStorageJson;

    const pathsCorrect = cursorPath === expectedCursorPath && vscodePath === expectedVSCodePath;

    results.tests.push({
      name: '动态路径获取',
      description: '检查动态路径获取是否正确',
      passed: pathsCorrect
    });

    console.log(`   ✅ 默认IDE选择: ${defaultSelected ? 'Cursor' : '错误'}`);
    console.log(`   ✅ IDE选择切换: ${vsCodeSelected ? '正确' : '错误'}`);
    console.log(`   ✅ 动态路径获取: ${pathsCorrect ? '正确' : '错误'}`);

  } catch (error) {
    results.errors.push(`增强防护测试失败: ${error.message}`);
    results.tests.push({
      name: '增强防护动态跟随',
      description: '测试增强防护动态IDE跟随',
      passed: false
    });
  }
}

// 测试设备ID管理
async function testDeviceIDManagement(results) {
  try {
    const { EnhancedDeviceGuardian } = require('../../modules/desktop-client/src/enhanced-device-guardian');
    const guardian = new EnhancedDeviceGuardian();

    // 测试获取当前IDE的存储路径
    guardian.setSelectedIDE('cursor');
    const cursorStoragePath = guardian.getCurrentIDEStoragePath();
    const cursorStatePath = guardian.getCurrentIDEStatePath();
    const cursorGlobalPath = guardian.getCurrentIDEGlobalStoragePath();

    guardian.setSelectedIDE('vscode');
    const vscodeStoragePath = guardian.getCurrentIDEStoragePath();
    const vscodeStatePath = guardian.getCurrentIDEStatePath();
    const vscodeGlobalPath = guardian.getCurrentIDEGlobalStoragePath();

    const pathsValid = cursorStoragePath.includes('Cursor') && 
                      vscodeStoragePath.includes('Code') &&
                      cursorStatePath.includes('Cursor') && 
                      vscodeStatePath.includes('Code') &&
                      cursorGlobalPath.includes('Cursor') && 
                      vscodeGlobalPath.includes('Code');

    results.tests.push({
      name: '设备ID路径管理',
      description: '检查设备ID路径管理是否正确',
      passed: pathsValid
    });

    console.log(`   ✅ Cursor路径: ${cursorStoragePath.includes('Cursor') ? '正确' : '错误'}`);
    console.log(`   ✅ VSCode路径: ${vscodeStoragePath.includes('Code') ? '正确' : '错误'}`);
    console.log(`   ✅ 路径动态切换: ${pathsValid ? '正确' : '错误'}`);

  } catch (error) {
    results.errors.push(`设备ID管理测试失败: ${error.message}`);
    results.tests.push({
      name: '设备ID管理',
      description: '测试设备ID管理',
      passed: false
    });
  }
}

// 运行测试
if (require.main === module) {
  testIDESelectionRadioMode()
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

module.exports = { testIDESelectionRadioMode };
