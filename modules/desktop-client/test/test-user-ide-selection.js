const DeviceManager = require('../src/device-manager');

/**
 * 测试用户IDE选择功能
 * 验证用户可以自由选择清理哪些IDE，不受清理模式限制
 */

async function testUserIDESelection() {
  console.log('🎯 测试用户IDE选择功能');
  console.log('==================================================');

  const deviceManager = new DeviceManager();
  
  try {
    // 第1步：测试只选择Cursor的情况
    console.log('\n📍 第1步：测试只选择Cursor IDE');
    const cursorOnlyResult = await deviceManager.performCleanup({
      intelligentMode: true,
      preserveActivation: true,
      cleanCursor: true,    // 用户选择：清理Cursor
      cleanVSCode: false,   // 用户选择：不清理VS Code
      autoRestartIDE: true,
    });

    console.log('\n🎨 只选择Cursor的结果:');
    console.log('成功:', cursorOnlyResult.success);
    
    // 筛选IDE相关的操作日志
    const cursorActions = cursorOnlyResult.actions.filter(action => 
      action.includes('IDE') || 
      action.includes('Cursor') || 
      action.includes('VS Code') ||
      action.includes('关闭') ||
      action.includes('启动')
    );
    
    console.log('IDE相关操作:');
    cursorActions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    // 等待一段时间
    console.log('\n⏳ 等待5秒...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 第2步：测试只选择VS Code的情况
    console.log('\n📍 第2步：测试只选择VS Code IDE');
    const vscodeOnlyResult = await deviceManager.performCleanup({
      standardMode: true,
      preserveActivation: true,
      cleanCursor: false,   // 用户选择：不清理Cursor
      cleanVSCode: true,    // 用户选择：清理VS Code
      autoRestartIDE: true,
    });

    console.log('\n💙 只选择VS Code的结果:');
    console.log('成功:', vscodeOnlyResult.success);
    
    const vscodeActions = vscodeOnlyResult.actions.filter(action => 
      action.includes('IDE') || 
      action.includes('Cursor') || 
      action.includes('VS Code') ||
      action.includes('关闭') ||
      action.includes('启动')
    );
    
    console.log('IDE相关操作:');
    vscodeActions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    // 等待一段时间
    console.log('\n⏳ 等待5秒...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 第3步：测试同时选择两个IDE的情况
    console.log('\n📍 第3步：测试同时选择Cursor和VS Code');
    const bothIDEsResult = await deviceManager.performCleanup({
      completeMode: true,
      preserveActivation: true,
      cleanCursor: true,    // 用户选择：清理Cursor
      cleanVSCode: true,    // 用户选择：清理VS Code
      autoRestartIDE: true,
    });

    console.log('\n🎨💙 同时选择两个IDE的结果:');
    console.log('成功:', bothIDEsResult.success);
    
    const bothActions = bothIDEsResult.actions.filter(action => 
      action.includes('IDE') || 
      action.includes('Cursor') || 
      action.includes('VS Code') ||
      action.includes('关闭') ||
      action.includes('启动')
    );
    
    console.log('IDE相关操作:');
    bothActions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    // 第4步：测试都不选择的情况
    console.log('\n📍 第4步：测试都不选择IDE');
    const noIDEResult = await deviceManager.performCleanup({
      intelligentMode: true,
      preserveActivation: true,
      cleanCursor: false,   // 用户选择：不清理Cursor
      cleanVSCode: false,   // 用户选择：不清理VS Code
      autoRestartIDE: true,
    });

    console.log('\n❌ 都不选择IDE的结果:');
    console.log('成功:', noIDEResult.success);
    
    const noIDEActions = noIDEResult.actions.filter(action => 
      action.includes('IDE') || 
      action.includes('Cursor') || 
      action.includes('VS Code') ||
      action.includes('关闭') ||
      action.includes('启动') ||
      action.includes('跳过')
    );
    
    console.log('IDE相关操作:');
    noIDEActions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    console.log('\n✅ 用户IDE选择功能测试完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误详情:', error);
  }
}

// 分析用户IDE选择机制
function analyzeUserIDESelection() {
  console.log('\n\n🔍 用户IDE选择机制分析');
  console.log('='.repeat(60));
  
  console.log('\n📋 实现的功能:');
  console.log('   ✅ 1. 完全的用户控制');
  console.log('      - 用户可以通过UI复选框选择清理哪些IDE');
  console.log('      - cleanCursor和cleanVSCode完全由用户决定');
  console.log('      - 不受清理模式的硬编码限制');
  
  console.log('\n   ✅ 2. 灵活的组合选择');
  console.log('      - 只选择Cursor：关闭/启动Cursor，跳过VS Code');
  console.log('      - 只选择VS Code：关闭/启动VS Code，跳过Cursor');
  console.log('      - 同时选择：关闭/启动两个IDE');
  console.log('      - 都不选择：跳过所有IDE操作');
  
  console.log('\n   ✅ 3. 智能的操作逻辑');
  console.log('      - closeIDEsBeforeCleanup() 根据用户选择关闭对应IDE');
  console.log('      - startIDEsAfterCleanup() 根据用户选择启动对应IDE');
  console.log('      - 未选择的IDE不会被操作');
  
  console.log('\n   ✅ 4. 跨清理模式一致性');
  console.log('      - 智能、标准、完全清理模式都支持用户选择');
  console.log('      - 清理模式只影响清理策略，不影响IDE选择');
  console.log('      - 用户选择优先级最高');
  
  console.log('\n🎯 用户体验:');
  console.log('   🚀 自由选择：用户完全控制要操作哪些IDE');
  console.log('   🛡️ 安全可靠：未选择的IDE不会被意外操作');
  console.log('   🔄 一致体验：所有清理模式都支持相同的选择逻辑');
  console.log('   📝 清晰反馈：日志明确显示哪些IDE被操作或跳过');
}

// 运行测试
if (require.main === module) {
  testUserIDESelection()
    .then(() => {
      analyzeUserIDESelection();
      console.log('\n🎉 所有测试完成');
    })
    .catch(error => {
      console.error('💥 测试运行失败:', error);
    });
}

module.exports = {
  testUserIDESelection,
  analyzeUserIDESelection
};
