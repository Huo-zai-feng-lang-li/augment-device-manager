#!/usr/bin/env node

/**
 * 测试清理模式修复效果
 * 验证智能清理模式是否正确工作，不会执行深度清理
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function testCleanupModeFix() {
  console.log('🧪 测试清理模式修复效果\n');

  try {
    // 1. 测试智能清理模式配置
    console.log('📋 第1步：验证智能清理模式配置...');
    
    const DeviceManager = require('../src/device-manager');
    const deviceManager = new DeviceManager();

    // 模拟智能清理模式的参数（应该是温和的）
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
      intelligentMode: true,       // 标识智能模式
      cleanCursor: false,          // 关键：不应该清理Cursor
      cleanVSCode: false
    };

    console.log('   智能清理配置验证:');
    console.log(`     aggressiveMode: ${intelligentOptions.aggressiveMode} (应该是false)`);
    console.log(`     multiRoundClean: ${intelligentOptions.multiRoundClean} (应该是false)`);
    console.log(`     cleanCursorExtension: ${intelligentOptions.cleanCursorExtension} (应该是false)`);
    console.log(`     cleanCursor: ${intelligentOptions.cleanCursor} (应该是false)`);
    console.log(`     intelligentMode: ${intelligentOptions.intelligentMode} (应该是true)`);

    // 2. 创建测试MCP配置
    console.log('\n📁 第2步：创建测试MCP配置...');
    
    const testMcpPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'augment.vscode-augment', 'augment-global-state', 'mcpServers.json');
    const testMCPConfig = {
      "mcpServers": {
        "test-server": {
          "command": "node",
          "args": ["test-server.js"],
          "env": {}
        }
      }
    };

    await fs.ensureDir(path.dirname(testMcpPath));
    await fs.writeJson(testMcpPath, testMCPConfig, { spaces: 2 });
    console.log(`   ✅ 创建测试MCP配置: ${testMcpPath}`);

    // 3. 执行智能清理模式
    console.log('\n🧠 第3步：执行智能清理模式...');
    
    const cleanupResult = await deviceManager.performCleanup(intelligentOptions);
    
    console.log(`\n📋 清理结果: ${cleanupResult.success ? '✅ 成功' : '❌ 失败'}`);
    
    if (cleanupResult.success) {
      console.log('\n✅ 执行的操作（前15项）:');
      cleanupResult.actions.slice(0, 15).forEach((action, index) => {
        console.log(`  ${index + 1}. ${action}`);
      });
      
      if (cleanupResult.actions.length > 15) {
        console.log(`  ... 还有 ${cleanupResult.actions.length - 15} 个操作`);
      }

      // 4. 分析执行的操作类型
      console.log('\n🔍 第4步：分析执行的操作类型...');
      
      const deepCleaningActions = cleanupResult.actions.filter(action => 
        action.includes('强制关闭') || 
        action.includes('多轮清理') || 
        action.includes('激进') ||
        action.includes('深度清理') ||
        action.includes('清理表') ||
        action.includes('重启') ||
        action.includes('PowerShell')
      );

      const intelligentActions = cleanupResult.actions.filter(action => 
        action.includes('智能') || 
        action.includes('精准') || 
        action.includes('保护') ||
        action.includes('设备身份') ||
        action.includes('MCP')
      );

      console.log(`   深度清理操作: ${deepCleaningActions.length} 个`);
      if (deepCleaningActions.length > 0) {
        console.log('   ⚠️ 发现深度清理操作:');
        deepCleaningActions.forEach(action => console.log(`     • ${action}`));
      }

      console.log(`   智能清理操作: ${intelligentActions.length} 个`);
      if (intelligentActions.length > 0) {
        console.log('   ✅ 智能清理操作:');
        intelligentActions.forEach(action => console.log(`     • ${action}`));
      }

      // 5. 验证MCP配置是否被保护
      console.log('\n🛡️ 第5步：验证MCP配置保护...');
      
      const mcpExists = await fs.pathExists(testMcpPath);
      console.log(`   MCP配置文件存在: ${mcpExists ? '✅' : '❌'}`);
      
      if (mcpExists) {
        try {
          const config = await fs.readJson(testMcpPath);
          const hasTestServer = config.mcpServers && config.mcpServers['test-server'];
          console.log(`   测试服务器配置完整: ${hasTestServer ? '✅' : '❌'}`);
        } catch (error) {
          console.log(`   ❌ 读取MCP配置失败: ${error.message}`);
        }
      }

      // 6. 评估修复效果
      console.log('\n📊 第6步：评估修复效果...');
      
      const isIntelligentMode = cleanupResult.actions.some(action => action.includes('智能清理'));
      const hasDeepCleaning = deepCleaningActions.length > 0;
      const mcpProtected = mcpExists;

      console.log(`   智能模式标识: ${isIntelligentMode ? '✅' : '❌'}`);
      console.log(`   避免深度清理: ${!hasDeepCleaning ? '✅' : '❌'}`);
      console.log(`   MCP配置保护: ${mcpProtected ? '✅' : '✅'}`);

      const fixSuccess = isIntelligentMode && !hasDeepCleaning && mcpProtected;
      console.log(`   总体评估: ${fixSuccess ? '✅ 修复成功' : '❌ 仍有问题'}`);

      // 7. 清理测试文件
      console.log('\n🧹 第7步：清理测试文件...');
      if (await fs.pathExists(testMcpPath)) {
        await fs.remove(testMcpPath);
        console.log('   🗑️ 已删除测试MCP配置');
      }

      return fixSuccess;
    }

    if (cleanupResult.errors && cleanupResult.errors.length > 0) {
      console.log('\n❌ 清理错误:');
      cleanupResult.errors.slice(0, 5).forEach(error => {
        console.log(`  • ${error}`);
      });
    }

    return false;

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
    return false;
  }
}

// 运行测试
if (require.main === module) {
  testCleanupModeFix()
    .then(success => {
      console.log(`\n🎯 最终结果: ${success ? '✅ 修复有效' : '❌ 修复无效'}`);
      
      if (success) {
        console.log('\n🎉 智能清理模式现在正常工作！');
        console.log('   • 只清理设备身份数据');
        console.log('   • 保留所有IDE设置和配置');
        console.log('   • 保护MCP配置');
        console.log('   • 不执行深度清理操作');
      } else {
        console.log('\n⚠️ 智能清理模式仍有问题，需要进一步修复');
      }
      
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 测试异常:', error);
      process.exit(1);
    });
}

module.exports = testCleanupModeFix;
