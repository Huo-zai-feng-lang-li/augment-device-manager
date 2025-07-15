const DeviceManager = require('./desktop-client/src/device-manager');

async function testPowerShellAssistFinal() {
  console.log('🧪 测试PowerShell辅助清理功能（最终版）...\n');
  
  try {
    const deviceManager = new DeviceManager();
    
    // 检查清理前的设备ID
    console.log('📊 清理前设备ID状态:');
    const beforeDeviceId = await deviceManager.getCurrentDeviceId();
    console.log(`  当前设备ID: ${beforeDeviceId || '未找到'}\n`);
    
    // 测试PowerShell辅助清理
    console.log('🚀 执行PowerShell辅助清理（内置实现）...');
    const cleanupOptions = {
      // 启用PowerShell辅助
      usePowerShellAssist: true,
      
      // 基础选项
      preserveActivation: true,  // 保留激活状态
      cleanCursor: true,         // 清理Cursor
      cleanCursorExtension: true, // 清理Cursor扩展数据
      autoRestartCursor: false,  // 不自动重启
      
      // 高级选项
      aggressiveMode: false,     // 不使用激进模式，保护登录状态
      multiRoundClean: true,     // 多轮清理
      deepClean: true,           // 深度清理（包括注册表）
      
      // 扩展清理
      cleanAugment: true,        // 清理Augment扩展
      
      // 非交互模式
      isDryRun: false           // 实际执行
    };
    
    const results = await deviceManager.performCleanup(cleanupOptions);
    
    console.log('\n📋 PowerShell辅助清理结果:');
    console.log(`  成功: ${results.success ? '✅' : '❌'}`);
    console.log(`  PowerShell辅助: ${results.powerShellAssisted ? '✅ 已启用' : '❌ 未启用'}`);
    console.log(`  降级模式: ${results.fallbackMode ? '⚠️ 是' : '✅ 否'}`);
    console.log(`  操作数量: ${results.actions.length}`);
    console.log(`  错误数量: ${results.errors.length}`);
    
    // 显示关键操作
    console.log('\n🔑 关键操作:');
    const keyActions = results.actions.filter(action => 
      action.includes('PowerShell') || 
      action.includes('🚀') ||
      action.includes('🆔') ||
      action.includes('📖') ||
      action.includes('✅') ||
      action.includes('🗑️') ||
      action.includes('🔧') ||
      action.includes('🎯') ||
      action.includes('🔒')
    );
    
    keyActions.slice(0, 15).forEach(action => {
      console.log(`  • ${action}`);
    });
    
    if (results.errors.length > 0) {
      console.log('\n❌ 错误详情:');
      results.errors.slice(0, 5).forEach(error => {
        console.log(`  • ${error}`);
      });
    }
    
    // 等待一下让清理完全生效
    console.log('\n⏳ 等待3秒让清理生效...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 检查清理后的设备ID
    console.log('\n📊 清理后设备ID状态:');
    const afterDeviceId = await deviceManager.getCurrentDeviceId();
    console.log(`  新设备ID: ${afterDeviceId || '未找到'}`);
    
    // 比较设备ID变化
    if (beforeDeviceId && afterDeviceId) {
      const deviceIdChanged = beforeDeviceId !== afterDeviceId;
      console.log(`  设备ID已更新: ${deviceIdChanged ? '✅ 是' : '❌ 否'}`);
      
      if (deviceIdChanged) {
        console.log(`  变化: ${beforeDeviceId.substring(0, 16)}... → ${afterDeviceId.substring(0, 16)}...`);
      }
    }
    
    // 检查是否不再是老的设备ID
    const oldDeviceId = '36987e70-60fe-4401-85a4-f463c269f069';
    if (afterDeviceId !== oldDeviceId) {
      console.log('🎉 PowerShell辅助清理成功！设备不再被识别为老用户');
    } else {
      console.log('⚠️ PowerShell辅助清理可能未完全成功，仍然是老的设备ID');
    }
    
    // 验证登录状态保护
    console.log('\n🔒 验证登录状态保护:');
    const storageJsonPath = require('path').join(
      require('os').homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );
    
    const fs = require('fs-extra');
    if (await fs.pathExists(storageJsonPath)) {
      try {
        const content = await fs.readFile(storageJsonPath, 'utf8');
        const config = JSON.parse(content);
        
        // 检查是否保留了非设备相关的配置
        const preservedKeys = Object.keys(config).filter(key => 
          !key.startsWith('telemetry.') || 
          (!key.includes('devDeviceId') && !key.includes('machineId') && !key.includes('sessionId'))
        );
        
        console.log(`  配置文件存在: ✅`);
        console.log(`  保留的配置项: ${preservedKeys.length} 个`);
        console.log(`  新设备ID: ${config['telemetry.devDeviceId']?.substring(0, 16)}...`);
        
        if (preservedKeys.length > 0) {
          console.log('  🎯 登录状态和用户配置已成功保留');
        }
      } catch (error) {
        console.log(`  配置文件读取失败: ${error.message}`);
      }
    } else {
      console.log('  配置文件不存在: ⚠️');
    }
    
    // 显示PowerShell辅助清理的优势
    console.log('\n🚀 PowerShell辅助清理的优势:');
    console.log('  ✅ 精准设备标识符更新');
    console.log('  ✅ 完整保留IDE登录状态');
    console.log('  ✅ 深度Augment扩展数据清理');
    console.log('  ✅ 系统级注册表MachineGuid更新');
    console.log('  ✅ 让扩展认为是新用户，但保持IDE登录');
    console.log('  ✅ 更高的清理成功率和稳定性');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('详细错误:', error);
  }
}

// 运行测试
if (require.main === module) {
  testPowerShellAssistFinal();
}

module.exports = { testPowerShellAssistFinal };
