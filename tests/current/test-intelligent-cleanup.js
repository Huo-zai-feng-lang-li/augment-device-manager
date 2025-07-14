
// 智能清理模式测试
const testIntelligentCleanup = async () => {
  console.log("🧠 测试智能清理模式参数...");
  
  // 模拟智能清理模式的参数
  const intelligentOptions = {
    preserveActivation: true,
    deepClean: false,
    cleanCursorExtension: false, // 关键：不应该清理扩展
    autoRestartCursor: false,    // 关键：不应该重启
    skipBackup: true,
    enableEnhancedGuardian: true,
    skipCursorLogin: true,
    resetCursorCompletely: false,
    resetVSCodeCompletely: false,
    aggressiveMode: false,       // 关键：不应该激进
    multiRoundClean: false,      // 关键：不应该多轮
    extendedMonitoring: false,
    usePowerShellAssist: false,  // 关键：不应该用PS
    intelligentMode: true,
    cleanCursor: false,          // 关键：不应该清理Cursor
    cleanVSCode: false
  };
  
  console.log("📊 智能清理参数验证：");
  Object.entries(intelligentOptions).forEach(([key, value]) => {
    const shouldBeFalse = [
      'deepClean', 'cleanCursorExtension', 'autoRestartCursor', 
      'resetCursorCompletely', 'resetVSCodeCompletely', 'aggressiveMode',
      'multiRoundClean', 'extendedMonitoring', 'usePowerShellAssist',
      'cleanCursor', 'cleanVSCode'
    ];
    
    if (shouldBeFalse.includes(key) && value === true) {
      console.log(`❌ ${key}: ${value} - 智能模式中应该为false`);
    } else if (key === 'intelligentMode' && value !== true) {
      console.log(`❌ ${key}: ${value} - 应该为true`);
    } else {
      console.log(`✅ ${key}: ${value}`);
    }
  });
};

testIntelligentCleanup();
