const DeviceManager = require('../src/device-manager');

// 测试混合清理模式
async function testMixedCleanup() {
  console.log('🔍 测试混合清理模式（Cursor + VS Code）');
  console.log('==================================================');

  const deviceManager = new DeviceManager();

  try {
    // 测试不同的清理选项组合
    const testCases = [
      {
        name: '仅清理Cursor IDE（保留登录）',
        options: {
          cleanCursor: true,
          cleanVSCode: false,
          resetCursorCompletely: false,
          resetVSCodeCompletely: false,
          cleanCursorExtension: true,
          autoRestartCursor: false
        }
      },
      {
        name: '仅清理VS Code（保留登录）',
        options: {
          cleanCursor: false,
          cleanVSCode: true,
          resetCursorCompletely: false,
          resetVSCodeCompletely: false,
          cleanCursorExtension: false,
          autoRestartCursor: false
        }
      },
      {
        name: '同时清理两个IDE（保留登录）',
        options: {
          cleanCursor: true,
          cleanVSCode: true,
          resetCursorCompletely: false,
          resetVSCodeCompletely: false,
          cleanCursorExtension: true,
          autoRestartCursor: false
        }
      },
      {
        name: '完全重置Cursor，选择性清理VS Code',
        options: {
          cleanCursor: true,
          cleanVSCode: true,
          resetCursorCompletely: true,
          resetVSCodeCompletely: false,
          cleanCursorExtension: true,
          autoRestartCursor: false
        }
      },
      {
        name: '完全重置两个IDE',
        options: {
          cleanCursor: true,
          cleanVSCode: true,
          resetCursorCompletely: true,
          resetVSCodeCompletely: true,
          cleanCursorExtension: true,
          autoRestartCursor: false
        }
      }
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\n📊 测试案例 ${i + 1}：${testCase.name}`);
      
      try {
        const result = await deviceManager.performCleanup(testCase.options);
        
        console.log(`  结果: ${result.success ? '✅ 成功' : '❌ 失败'}`);
        console.log(`  操作数: ${result.actions.length}`);
        console.log(`  错误数: ${result.errors.length}`);
        
        // 显示关键操作
        const keyActions = result.actions.filter(action => 
          action.includes('VS Code') || 
          action.includes('Cursor') || 
          action.includes('设备ID') ||
          action.includes('完全重置')
        );
        
        if (keyActions.length > 0) {
          console.log('  关键操作:');
          keyActions.slice(0, 3).forEach(action => {
            console.log(`    ✓ ${action}`);
          });
          if (keyActions.length > 3) {
            console.log(`    ... 还有 ${keyActions.length - 3} 个关键操作`);
          }
        }
        
        // 显示主要错误（排除预期的注册表错误）
        const significantErrors = result.errors.filter(error => 
          !error.includes('注册表项失败') && 
          !error.includes('EBUSY') &&
          !error.includes('ENOENT')
        );
        
        if (significantErrors.length > 0) {
          console.log('  重要错误:');
          significantErrors.slice(0, 2).forEach(error => {
            console.log(`    ❌ ${error}`);
          });
        }
        
      } catch (error) {
        console.log(`  ❌ 测试失败: ${error.message}`);
      }
      
      // 短暂延迟，避免操作冲突
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✅ 混合清理模式测试完成');

  } catch (error) {
    console.error('❌ 混合清理测试失败:', error.message);
  }
}

// 运行测试
if (require.main === module) {
  testMixedCleanup()
    .then(() => {
      console.log('\n🎉 测试完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 测试失败:', error);
      process.exit(1);
    });
}

module.exports = { testMixedCleanup };
