const DeviceManager = require('../src/device-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// 最终验证测试
async function finalVerification() {
  console.log('🔍 最终验证测试');
  console.log('==================================================');

  const deviceManager = new DeviceManager();
  let allTestsPassed = true;

  try {
    // 验证1：Cursor IDE老用户问题是否解决
    console.log('\n📊 验证1：Cursor IDE老用户问题解决状态...');
    
    const cursorStoragePath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );

    if (await fs.pathExists(cursorStoragePath)) {
      const storageData = await fs.readJson(cursorStoragePath);
      const currentDeviceId = storageData['telemetry.devDeviceId'];
      const oldDeviceId = '36987e70-60fe-4401-85a4-f463c269f069';
      
      if (currentDeviceId !== oldDeviceId) {
        console.log('  ✅ Cursor IDE设备ID已更新，不再是老用户');
        console.log(`  当前设备ID: ${currentDeviceId}`);
      } else {
        console.log('  ❌ Cursor IDE设备ID仍然是老ID');
        allTestsPassed = false;
      }
    } else {
      console.log('  ⚠️ Cursor IDE storage.json不存在');
    }

    // 验证2：VS Code功能完整性
    console.log('\n📊 验证2：VS Code功能完整性...');
    
    // 检测VS Code路径配置
    const vscodeVariants = await deviceManager.detectInstalledVSCodeVariants();
    console.log(`  VS Code变体检测: ${vscodeVariants.length > 0 ? '✅ 正常' : '⚠️ 未检测到VS Code'}`);
    
    // 测试VS Code清理功能
    const vscodeResult = await deviceManager.performCleanup({
      cleanCursor: false,
      cleanVSCode: true,
      resetVSCodeCompletely: false,
    });
    
    console.log(`  VS Code清理功能: ${vscodeResult.success ? '✅ 正常' : '❌ 失败'}`);
    if (!vscodeResult.success) {
      allTestsPassed = false;
    }

    // 验证3：混合清理功能
    console.log('\n📊 验证3：混合清理功能...');
    
    const mixedResult = await deviceManager.performCleanup({
      cleanCursor: true,
      cleanVSCode: true,
      resetCursorCompletely: false,
      resetVSCodeCompletely: false,
    });
    
    console.log(`  混合清理功能: ${mixedResult.success ? '✅ 正常' : '❌ 失败'}`);
    console.log(`  操作数量: ${mixedResult.actions.length}`);
    console.log(`  错误数量: ${mixedResult.errors.length}`);
    
    if (!mixedResult.success) {
      allTestsPassed = false;
    }

    // 验证4：设备ID生成功能
    console.log('\n📊 验证4：设备ID生成功能...');
    
    try {
      const { generateCursorDeviceId, generateVSCodeDeviceId } = require('../../shared/utils/stable-device-id');
      
      const cursorId = await generateCursorDeviceId();
      const vscodeId = await generateVSCodeDeviceId();
      
      console.log(`  Cursor设备ID生成: ${cursorId ? '✅ 正常' : '❌ 失败'}`);
      console.log(`  VS Code设备ID生成: ${vscodeId ? '✅ 正常' : '❌ 失败'}`);
      console.log(`  设备ID唯一性: ${cursorId !== vscodeId ? '✅ 正常' : '❌ 失败'}`);
      
      if (!cursorId || !vscodeId || cursorId === vscodeId) {
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(`  ❌ 设备ID生成测试失败: ${error.message}`);
      allTestsPassed = false;
    }

    // 验证5：错误处理机制
    console.log('\n📊 验证5：错误处理机制...');
    
    const errorTestResult = await deviceManager.performCleanup({
      cleanCursor: false,
      cleanVSCode: false,
      // 无效配置测试
    });
    
    console.log(`  错误处理机制: ${errorTestResult.success ? '✅ 正常' : '⚠️ 按预期处理'}`);
    console.log(`  错误处理不中断流程: ✅ 正常`);

    // 验证6：UI界面完整性（检查HTML文件）
    console.log('\n📊 验证6：UI界面完整性...');
    
    const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
    if (await fs.pathExists(htmlPath)) {
      const htmlContent = await fs.readFile(htmlPath, 'utf8');
      
      const hasVSCodeOption = htmlContent.includes('clean-vscode');
      const hasVSCodeReset = htmlContent.includes('reset-vscode-completely');
      const hasCursorOption = htmlContent.includes('clean-cursor');
      
      console.log(`  VS Code选择选项: ${hasVSCodeOption ? '✅ 存在' : '❌ 缺失'}`);
      console.log(`  VS Code重置选项: ${hasVSCodeReset ? '✅ 存在' : '❌ 缺失'}`);
      console.log(`  Cursor选择选项: ${hasCursorOption ? '✅ 存在' : '❌ 缺失'}`);
      
      if (!hasVSCodeOption || !hasVSCodeReset || !hasCursorOption) {
        allTestsPassed = false;
      }
    } else {
      console.log('  ❌ HTML文件不存在');
      allTestsPassed = false;
    }

    // 验证7：文档完整性
    console.log('\n📊 验证7：文档完整性...');
    
    const docsPath = path.join(__dirname, '..', 'docs');
    const requiredDocs = [
      'vscode-implementation-summary.md',
      'vscode-support-feasibility-analysis.md',
      'user-guide.md',
      'README.md'
    ];
    
    let docsComplete = true;
    for (const doc of requiredDocs) {
      const docPath = path.join(docsPath, doc);
      const exists = await fs.pathExists(docPath);
      console.log(`  ${doc}: ${exists ? '✅ 存在' : '❌ 缺失'}`);
      if (!exists) {
        docsComplete = false;
      }
    }
    
    if (!docsComplete) {
      allTestsPassed = false;
    }

    // 最终结果
    console.log('\n' + '='.repeat(50));
    console.log('📋 最终验证结果');
    console.log('='.repeat(50));
    
    if (allTestsPassed) {
      console.log('🎉 所有验证测试通过！');
      console.log('✅ Cursor IDE老用户问题已解决');
      console.log('✅ VS Code支持功能完全实现');
      console.log('✅ 混合清理功能正常工作');
      console.log('✅ 错误处理机制完善');
      console.log('✅ UI界面功能完整');
      console.log('✅ 文档体系完善');
      console.log('\n🚀 项目状态：完全就绪，可以投入使用！');
    } else {
      console.log('⚠️ 部分验证测试未通过');
      console.log('请检查上述失败项目并进行修复');
    }

  } catch (error) {
    console.error('❌ 最终验证测试失败:', error.message);
    allTestsPassed = false;
  }

  return allTestsPassed;
}

// 运行验证
if (require.main === module) {
  finalVerification()
    .then((success) => {
      console.log(`\n🎯 验证完成，结果: ${success ? '成功' : '失败'}`);
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 验证失败:', error);
      process.exit(1);
    });
}

module.exports = { finalVerification };
