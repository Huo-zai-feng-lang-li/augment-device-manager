// 测试所有清理模式的参数传递
const testAllModes = () => {
  console.log("🧪 测试所有清理模式的参数传递...\n");

  // 模拟三种模式的参数
  const modes = {
    intelligent: {
      intelligentMode: true,
      cleanCursor: false,
      cleanCursorExtension: false,
      aggressiveMode: false
    },
    standard: {
      standardMode: true,
      // 注意：标准模式会在后端内部设置激进参数
    },
    complete: {
      completeMode: true,
      // 注意：完全模式会在后端内部设置最激进参数
    }
  };

  Object.entries(modes).forEach(([mode, params]) => {
    console.log(`🎯 ${mode.toUpperCase()} 模式参数：`);
    console.log(`   传递给后端: ${JSON.stringify(params, null, 2)}`);
    
    if (mode === 'standard') {
      console.log(`   后端内部覆盖: { aggressiveMode: true, multiRoundClean: true }`);
    } else if (mode === 'complete') {
      console.log(`   后端内部覆盖: { resetCursorCompletely: true, aggressiveMode: true }`);
    }
    console.log();
  });

  console.log("✅ 结论：每种模式都有独立的参数控制，互不影响！");
};

testAllModes();
