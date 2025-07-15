const DeviceManager = require('./desktop-client/src/device-manager');

async function testPowerShellAssist() {
  console.log('🧪 测试PowerShell辅助清理功能...\n');
  
  try {
    const deviceManager = new DeviceManager();
    
    // 检查清理前的设备ID
    console.log('📊 清理前设备ID状态:');
    const beforeDeviceId = await deviceManager.getCurrentDeviceId();
    console.log(`  当前设备ID: ${beforeDeviceId || '未找到'}\n`);
    
    // 测试PowerShell辅助清理
    console.log('🚀 执行PowerShell辅助清理...');
    const cleanupOptions = {
      // 启用PowerShell辅助
      usePowerShellAssist: true,
      
      // 基础选项
      preserveActivation: true,
      cleanCursor: true,
      cleanCursorExtension: true,
      autoRestartCursor: false,
      
      // 高级选项
      aggressiveMode: true,
      multiRoundClean: true,
      deepClean: true,
      
      // 扩展清理
      cleanAugment: true,
      
      // 非交互模式
      isDryRun: false
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
      action.includes('PS:') ||
      action.includes('注册表') ||
      action.includes('深度风控') ||
      action.includes('设备标识符')
    );
    
    keyActions.slice(0, 10).forEach(action => {
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
    
    // 显示PowerShell特有的优势
    console.log('\n🚀 PowerShell辅助清理的优势:');
    console.log('  ✅ 系统级注册表MachineGuid修改');
    console.log('  ✅ 深度Augment扩展风控数据清理');
    console.log('  ✅ 更强的进程管理能力');
    console.log('  ✅ 原生Windows API调用');
    console.log('  ✅ 更高的清理成功率');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('详细错误:', error);
  }
}

// 测试降级功能
async function testFallbackMode() {
  console.log('\n🔄 测试降级模式...');
  
  try {
    const deviceManager = new DeviceManager();
    
    // 模拟PowerShell不可用的情况
    const cleanupOptions = {
      usePowerShellAssist: true,
      preserveActivation: true,
      cleanCursor: true,
      cleanCursorExtension: true
    };
    
    // 临时重命名PowerShell脚本来模拟不可用
    const fs = require('fs-extra');
    const path = require('path');
    const scriptPath = path.join(__dirname, 'ide-reset-ultimate.ps1');
    const backupPath = path.join(__dirname, 'ide-reset-ultimate.ps1.backup');
    
    let scriptRenamed = false;
    if (await fs.pathExists(scriptPath)) {
      await fs.move(scriptPath, backupPath);
      scriptRenamed = true;
      console.log('  📝 临时重命名PowerShell脚本以模拟不可用');
    }
    
    const results = await deviceManager.performCleanup(cleanupOptions);
    
    console.log('\n📋 降级模式测试结果:');
    console.log(`  成功: ${results.success ? '✅' : '❌'}`);
    console.log(`  降级模式: ${results.fallbackMode ? '✅ 已启用' : '❌ 未启用'}`);
    console.log(`  操作数量: ${results.actions.length}`);
    
    // 恢复PowerShell脚本
    if (scriptRenamed) {
      await fs.move(backupPath, scriptPath);
      console.log('  📝 已恢复PowerShell脚本');
    }
    
    console.log('🎯 降级模式测试完成');
    
  } catch (error) {
    console.error('❌ 降级模式测试失败:', error.message);
  }
}

// 运行测试
if (require.main === module) {
  (async () => {
    await testPowerShellAssist();
    await testFallbackMode();
  })();
}

module.exports = { testPowerShellAssist, testFallbackMode };
