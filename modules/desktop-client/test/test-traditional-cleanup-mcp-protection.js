#!/usr/bin/env node

/**
 * 测试传统清理模式的MCP配置保护机制
 * 验证激进清理和多轮清理是否正确保护MCP配置
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function testTraditionalCleanupMCPProtection() {
  console.log('🧪 测试传统清理模式的MCP配置保护机制\n');

  try {
    // 1. 创建测试MCP配置
    console.log('📁 第1步：创建测试MCP配置...');
    
    const testMCPPaths = [
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'augment.vscode-augment', 'augment-global-state', 'mcpServers.json'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'augment.vscode-augment', 'augment-global-state', 'mcpServers.json')
    ];

    const testMCPConfig = {
      "mcpServers": {
        "test-server": {
          "command": "node",
          "args": ["test-server.js"],
          "env": {}
        }
      }
    };

    // 创建测试MCP配置文件
    for (const mcpPath of testMCPPaths) {
      await fs.ensureDir(path.dirname(mcpPath));
      await fs.writeJson(mcpPath, testMCPConfig, { spaces: 2 });
      console.log(`   ✅ 创建测试MCP配置: ${mcpPath}`);
    }

    // 2. 导入DeviceManager并测试传统清理
    console.log('\n🔧 第2步：测试传统清理模式...');
    
    const DeviceManager = require('../src/device-manager');
    const deviceManager = new DeviceManager();

    // 模拟传统激进清理的选项
    const traditionalCleanupOptions = {
      // IDE选择选项
      cleanCursor: true,
      cleanVSCode: false,

      // 传统清理选项
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartCursor: false,
      skipBackup: true,

      // 重置选项
      skipCursorLogin: true,
      resetCursorCompletely: false,
      resetVSCodeCompletely: false,

      // 激进模式选项（这是关键）
      aggressiveMode: true,
      multiRoundClean: true,
      extendedMonitoring: true,
    };

    console.log('   配置选项:');
    console.log(`     aggressiveMode: ${traditionalCleanupOptions.aggressiveMode}`);
    console.log(`     multiRoundClean: ${traditionalCleanupOptions.multiRoundClean}`);
    console.log(`     cleanCursorExtension: ${traditionalCleanupOptions.cleanCursorExtension}`);

    // 3. 执行传统清理
    console.log('\n⚡ 第3步：执行传统激进清理...');
    
    const cleanupResult = await deviceManager.performCleanup(traditionalCleanupOptions);
    
    console.log(`\n📋 清理结果: ${cleanupResult.success ? '✅ 成功' : '❌ 失败'}`);
    
    if (cleanupResult.success) {
      console.log('\n✅ 成功操作（前10项）:');
      cleanupResult.actions.slice(0, 10).forEach((action, index) => {
        console.log(`  ${index + 1}. ${action}`);
      });
      
      if (cleanupResult.actions.length > 10) {
        console.log(`  ... 还有 ${cleanupResult.actions.length - 10} 个操作`);
      }

      // 检查MCP保护相关的日志
      const mcpProtectionLogs = cleanupResult.actions.filter(action => 
        action.includes('MCP') || action.includes('mcp') || action.includes('保护') || action.includes('恢复')
      );
      
      if (mcpProtectionLogs.length > 0) {
        console.log('\n🛡️ MCP保护相关日志:');
        mcpProtectionLogs.forEach(log => console.log(`     • ${log}`));
      }
    }

    if (cleanupResult.errors && cleanupResult.errors.length > 0) {
      console.log('\n❌ 清理错误:');
      cleanupResult.errors.slice(0, 5).forEach(error => {
        console.log(`  • ${error}`);
      });
    }

    // 4. 验证MCP配置是否被保护
    console.log('\n🔍 第4步：验证MCP配置保护效果...');
    
    let protectionSuccess = true;
    for (const mcpPath of testMCPPaths) {
      const exists = await fs.pathExists(mcpPath);
      console.log(`   ${exists ? '✅' : '❌'} MCP配置存在: ${path.basename(path.dirname(mcpPath))}`);
      
      if (exists) {
        try {
          const config = await fs.readJson(mcpPath);
          const hasTestServer = config.mcpServers && config.mcpServers['test-server'];
          console.log(`   ${hasTestServer ? '✅' : '❌'} 测试服务器配置完整`);
          if (!hasTestServer) protectionSuccess = false;
        } catch (error) {
          console.log(`   ❌ 读取MCP配置失败: ${error.message}`);
          protectionSuccess = false;
        }
      } else {
        protectionSuccess = false;
      }
    }

    // 5. 清理测试文件
    console.log('\n🧹 第5步：清理测试文件...');
    for (const mcpPath of testMCPPaths) {
      if (await fs.pathExists(mcpPath)) {
        await fs.remove(mcpPath);
        console.log(`   🗑️ 已删除测试文件: ${path.basename(path.dirname(mcpPath))}`);
      }
    }

    // 6. 总结测试结果
    console.log('\n📊 测试总结:');
    console.log(`   传统清理执行: ${cleanupResult.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`   MCP配置保护: ${protectionSuccess ? '✅ 成功' : '❌ 失败'}`);
    console.log(`   总体评估: ${cleanupResult.success && protectionSuccess ? '✅ 通过' : '❌ 失败'}`);

    if (!protectionSuccess) {
      console.log('\n⚠️ MCP配置保护失败，需要检查保护机制！');
    }

    return cleanupResult.success && protectionSuccess;

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
    return false;
  }
}

// 运行测试
if (require.main === module) {
  testTraditionalCleanupMCPProtection()
    .then(success => {
      console.log(`\n🎯 最终结果: ${success ? '✅ 测试通过' : '❌ 测试失败'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 测试异常:', error);
      process.exit(1);
    });
}

module.exports = testTraditionalCleanupMCPProtection;
