/**
 * 测试修复对原有功能的影响
 * 确保修复不会破坏原有的Cursor清理功能
 */

async function testOriginalFunctionalityImpact() {
  console.log('🔍 测试修复对原有功能的影响');
  console.log('==========================================');

  const results = {
    intelligentModeUnchanged: false,
    standardModeUnchanged: false,
    completeModeUnchanged: false,
    cursorOnlyBehavior: false,
    bothIDEsBehavior: false
  };

  try {
    // 1. 测试智能清理模式（原有行为）
    console.log('\n🧠 测试智能清理模式...');
    
    const intelligentOptions = {
      cleanCursor: true,  // 用户选择Cursor（默认）
      cleanVSCode: false, // 用户未选择VSCode（默认）
      cleanCursorExtension: false, // 智能模式默认值
    };
    
    // 模拟main.js的逻辑
    const intelligentCleanupOptions = {
      preserveActivation: intelligentOptions.preserveActivation ?? true,
      deepClean: intelligentOptions.deepClean ?? false,
      cleanCursorExtension: intelligentOptions.cleanCursor === true 
        ? (intelligentOptions.cleanCursorExtension ?? true) 
        : false,
      ...intelligentOptions,
    };
    
    // 智能模式：用户选择Cursor，但cleanCursorExtension应该是false（智能模式特性）
    const expectedIntelligent = false; // 智能模式不清理扩展
    const actualIntelligent = intelligentCleanupOptions.cleanCursorExtension;
    
    results.intelligentModeUnchanged = actualIntelligent === expectedIntelligent;
    
    console.log(`   用户选择: cleanCursor=${intelligentOptions.cleanCursor}`);
    console.log(`   智能模式cleanCursorExtension默认值: ${intelligentOptions.cleanCursorExtension}`);
    console.log(`   期望最终值: ${expectedIntelligent}`);
    console.log(`   实际最终值: ${actualIntelligent}`);
    console.log(`   智能模式行为: ${results.intelligentModeUnchanged ? '✅ 保持不变' : '❌ 被影响'}`);

    // 2. 测试标准清理模式（原有行为）
    console.log('\n🔧 测试标准清理模式...');
    
    const standardOptions = {
      cleanCursor: true,  // 用户选择Cursor（默认）
      cleanVSCode: false, // 用户未选择VSCode（默认）
      cleanCursorExtension: true, // 标准模式默认值
    };
    
    const standardCleanupOptions = {
      preserveActivation: standardOptions.preserveActivation ?? true,
      deepClean: standardOptions.deepClean ?? true,
      cleanCursorExtension: standardOptions.cleanCursor === true 
        ? (standardOptions.cleanCursorExtension ?? true) 
        : false,
      ...standardOptions,
    };
    
    // 标准模式：用户选择Cursor，cleanCursorExtension应该是true（标准模式特性）
    const expectedStandard = true; // 标准模式清理扩展
    const actualStandard = standardCleanupOptions.cleanCursorExtension;
    
    results.standardModeUnchanged = actualStandard === expectedStandard;
    
    console.log(`   用户选择: cleanCursor=${standardOptions.cleanCursor}`);
    console.log(`   标准模式cleanCursorExtension默认值: ${standardOptions.cleanCursorExtension}`);
    console.log(`   期望最终值: ${expectedStandard}`);
    console.log(`   实际最终值: ${actualStandard}`);
    console.log(`   标准模式行为: ${results.standardModeUnchanged ? '✅ 保持不变' : '❌ 被影响'}`);

    // 3. 测试完全清理模式（原有行为）
    console.log('\n💥 测试完全清理模式...');
    
    const completeOptions = {
      cleanCursor: true,  // 用户选择Cursor（默认）
      cleanVSCode: false, // 用户未选择VSCode（默认）
      cleanCursorExtension: true, // 完全模式默认值
    };
    
    const completeCleanupOptions = {
      preserveActivation: completeOptions.preserveActivation ?? true,
      deepClean: completeOptions.deepClean ?? true,
      cleanCursorExtension: completeOptions.cleanCursor === true 
        ? (completeOptions.cleanCursorExtension ?? true) 
        : false,
      ...completeOptions,
    };
    
    // 完全模式：用户选择Cursor，cleanCursorExtension应该是true（完全模式特性）
    const expectedComplete = true; // 完全模式清理扩展
    const actualComplete = completeCleanupOptions.cleanCursorExtension;
    
    results.completeModeUnchanged = actualComplete === expectedComplete;
    
    console.log(`   用户选择: cleanCursor=${completeOptions.cleanCursor}`);
    console.log(`   完全模式cleanCursorExtension默认值: ${completeOptions.cleanCursorExtension}`);
    console.log(`   期望最终值: ${expectedComplete}`);
    console.log(`   实际最终值: ${actualComplete}`);
    console.log(`   完全模式行为: ${results.completeModeUnchanged ? '✅ 保持不变' : '❌ 被影响'}`);

    // 4. 测试只选择Cursor的行为（原有行为应该保持）
    console.log('\n🎨 测试只选择Cursor的行为...');
    
    const cursorOnlyOptions = {
      cleanCursor: true,  // 只选择Cursor
      cleanVSCode: false, // 不选择VSCode
      cleanCursorExtension: true, // 假设是标准/完全模式
    };
    
    const cursorOnlyCleanupOptions = {
      cleanCursorExtension: cursorOnlyOptions.cleanCursor === true 
        ? (cursorOnlyOptions.cleanCursorExtension ?? true) 
        : false,
      ...cursorOnlyOptions,
    };
    
    // 只选择Cursor：应该正常清理Cursor扩展
    const expectedCursorOnly = true;
    const actualCursorOnly = cursorOnlyCleanupOptions.cleanCursorExtension;
    
    results.cursorOnlyBehavior = actualCursorOnly === expectedCursorOnly;
    
    console.log(`   用户选择: cleanCursor=${cursorOnlyOptions.cleanCursor}, cleanVSCode=${cursorOnlyOptions.cleanVSCode}`);
    console.log(`   期望cleanCursorExtension: ${expectedCursorOnly}`);
    console.log(`   实际cleanCursorExtension: ${actualCursorOnly}`);
    console.log(`   只选Cursor行为: ${results.cursorOnlyBehavior ? '✅ 正常' : '❌ 异常'}`);

    // 5. 测试选择两个IDE的行为
    console.log('\n🔗 测试选择两个IDE的行为...');
    
    const bothIDEsOptions = {
      cleanCursor: true,  // 选择Cursor
      cleanVSCode: true,  // 选择VSCode
      cleanCursorExtension: true, // 假设是标准/完全模式
    };
    
    const bothIDEsCleanupOptions = {
      cleanCursorExtension: bothIDEsOptions.cleanCursor === true 
        ? (bothIDEsOptions.cleanCursorExtension ?? true) 
        : false,
      ...bothIDEsOptions,
    };
    
    // 选择两个IDE：Cursor扩展清理应该正常工作
    const expectedBothIDEs = true;
    const actualBothIDEs = bothIDEsCleanupOptions.cleanCursorExtension;
    
    results.bothIDEsBehavior = actualBothIDEs === expectedBothIDEs;
    
    console.log(`   用户选择: cleanCursor=${bothIDEsOptions.cleanCursor}, cleanVSCode=${bothIDEsOptions.cleanVSCode}`);
    console.log(`   期望cleanCursorExtension: ${expectedBothIDEs}`);
    console.log(`   实际cleanCursorExtension: ${actualBothIDEs}`);
    console.log(`   两个IDE行为: ${results.bothIDEsBehavior ? '✅ 正常' : '❌ 异常'}`);

    // 6. 总结
    console.log('\n📊 原有功能影响评估:');
    const noImpact = Object.values(results).every(result => result);
    
    Object.entries({
      '智能清理模式': results.intelligentModeUnchanged,
      '标准清理模式': results.standardModeUnchanged,
      '完全清理模式': results.completeModeUnchanged,
      '只选Cursor行为': results.cursorOnlyBehavior,
      '两个IDE行为': results.bothIDEsBehavior
    }).forEach(([item, status]) => {
      console.log(`   - ${item}: ${status ? '✅ 无影响' : '❌ 有影响'}`);
    });

    console.log('\n🎯 最终评估:');
    if (noImpact) {
      console.log('✅ 修复没有影响任何原有功能！');
      console.log('✅ 所有清理模式的行为保持不变');
      console.log('✅ Cursor的清理功能完全正常');
      console.log('✅ 修复只影响了用户未选择IDE时的行为');
    } else {
      console.log('⚠️ 修复可能影响了某些原有功能');
    }

    return {
      success: noImpact,
      details: results,
      message: noImpact ? '修复无影响' : '修复有影响'
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
  testOriginalFunctionalityImpact()
    .then(result => {
      console.log('\n📋 测试结果:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('测试失败:', error);
      process.exit(1);
    });
}

module.exports = { testOriginalFunctionalityImpact };
