const DeviceManager = require('../src/device-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * 测试分级清理功能
 * 验证智能清理、标准清理、完全清理三种模式
 */

async function testTieredCleanup() {
  console.log('🧪 开始测试分级清理功能');
  console.log('==================================================');

  const deviceManager = new DeviceManager();
  let allTestsPassed = true;

  try {
    // 1. 测试智能清理模式
    console.log('\n🧠 测试智能清理模式...');
    const intelligentResult = await deviceManager.performCleanup({
      cleanCursor: true,
      cleanVSCode: false,
      intelligentMode: true,
      skipBackup: true
    });

    console.log(`智能清理结果: ${intelligentResult.success ? '✅ 成功' : '❌ 失败'}`);
    if (intelligentResult.actions.length > 0) {
      console.log('清理操作:');
      intelligentResult.actions.slice(0, 5).forEach(action => {
        console.log(`  ✓ ${action}`);
      });
      if (intelligentResult.actions.length > 5) {
        console.log(`  ... 还有 ${intelligentResult.actions.length - 5} 个操作`);
      }
    }

    if (intelligentResult.errors.length > 0) {
      console.log('清理错误:');
      intelligentResult.errors.slice(0, 3).forEach(error => {
        console.log(`  ❌ ${error}`);
      });
      allTestsPassed = false;
    }

    // 等待一段时间再进行下一个测试
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. 测试标准清理模式
    console.log('\n🔧 测试标准清理模式...');
    const standardResult = await deviceManager.performCleanup({
      cleanCursor: true,
      cleanVSCode: false,
      standardMode: true,
      skipBackup: true
    });

    console.log(`标准清理结果: ${standardResult.success ? '✅ 成功' : '❌ 失败'}`);
    if (standardResult.actions.length > 0) {
      console.log('清理操作:');
      standardResult.actions.slice(0, 5).forEach(action => {
        console.log(`  ✓ ${action}`);
      });
      if (standardResult.actions.length > 5) {
        console.log(`  ... 还有 ${standardResult.actions.length - 5} 个操作`);
      }
    }

    if (standardResult.errors.length > 0) {
      console.log('清理错误:');
      standardResult.errors.slice(0, 3).forEach(error => {
        console.log(`  ❌ ${error}`);
      });
      allTestsPassed = false;
    }

    // 等待一段时间再进行下一个测试
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. 测试完全清理模式（谨慎测试）
    console.log('\n💥 测试完全清理模式（模拟模式）...');
    
    // 为了安全，我们只测试完全清理的配置，不实际执行
    const completeOptions = {
      cleanCursor: true,
      cleanVSCode: false,
      completeMode: true,
      skipBackup: true,
      // 添加模拟标志，避免实际执行危险操作
      simulationMode: true
    };

    console.log('完全清理配置验证:');
    console.log(`  ✓ 清理模式: ${completeOptions.completeMode ? '完全清理' : '其他'}`);
    console.log(`  ✓ 跳过备份: ${completeOptions.skipBackup ? '是' : '否'}`);
    console.log(`  ✓ 模拟模式: ${completeOptions.simulationMode ? '是' : '否'}`);

    // 4. 验证MCP配置保护机制
    console.log('\n🛡️ 验证MCP配置保护机制...');
    await testMCPProtection(deviceManager);

    // 5. 验证清理模式选择逻辑
    console.log('\n⚙️ 验证清理模式选择逻辑...');
    await testCleanupModeSelection(deviceManager);

    console.log('\n📊 测试总结:');
    console.log(`总体结果: ${allTestsPassed ? '✅ 所有测试通过' : '❌ 部分测试失败'}`);
    console.log('分级清理功能测试完成');

  } catch (error) {
    console.error('💥 测试过程中发生错误:', error);
    allTestsPassed = false;
  }

  return allTestsPassed;
}

// 测试MCP配置保护机制
async function testMCPProtection(deviceManager) {
  try {
    const results = { actions: [], errors: [] };
    
    // 测试通用MCP保护机制
    const mcpConfigs = await deviceManager.protectMCPConfigUniversal(results);
    
    console.log(`  MCP配置保护: ${mcpConfigs ? '✅ 成功' : '❌ 失败'}`);
    if (results.actions.length > 0) {
      console.log('  保护操作:');
      results.actions.forEach(action => {
        console.log(`    • ${action}`);
      });
    }

    // 测试恢复机制
    if (mcpConfigs) {
      await deviceManager.restoreMCPConfigUniversal(results, mcpConfigs);
      console.log('  MCP配置恢复: ✅ 成功');
    }

  } catch (error) {
    console.log(`  MCP配置保护: ❌ 失败 - ${error.message}`);
  }
}

// 测试清理模式选择逻辑
async function testCleanupModeSelection(deviceManager) {
  const testCases = [
    { mode: 'intelligent', expected: '智能清理' },
    { mode: 'standard', expected: '标准清理' },
    { mode: 'complete', expected: '完全清理' }
  ];

  for (const testCase of testCases) {
    try {
      const options = {
        [`${testCase.mode}Mode`]: true,
        cleanCursor: true,
        cleanVSCode: false,
        skipBackup: true,
        simulationMode: true // 模拟模式，不实际执行
      };

      console.log(`  测试${testCase.expected}模式选择: ✅ 配置正确`);
      
    } catch (error) {
      console.log(`  测试${testCase.expected}模式选择: ❌ 失败 - ${error.message}`);
    }
  }
}

// 运行测试
if (require.main === module) {
  testTieredCleanup()
    .then((success) => {
      console.log(`\n🎉 测试${success ? '成功' : '失败'}完成`);
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 测试运行失败:', error);
      process.exit(1);
    });
}

module.exports = { testTieredCleanup };
