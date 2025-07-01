const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const DeviceManager = require('../src/device-manager');

/**
 * 测试 skipBackup 功能
 * 验证清理时不创建备份文件
 */

async function testSkipBackup() {
  console.log('🧪 测试 skipBackup 功能');
  console.log('==================================================');

  const deviceManager = new DeviceManager();
  
  try {
    // 第1步：记录清理前的临时目录状态
    console.log('\n📊 第1步：记录清理前状态...');
    const tempDir = os.tmpdir();
    const beforeFiles = await fs.readdir(tempDir);
    const beforeBackupFiles = beforeFiles.filter(file => 
      file.includes('cursor-backup') || 
      file.includes('augment-backup') || 
      file.includes('workspace-augment-backup')
    );
    
    console.log(`  临时目录: ${tempDir}`);
    console.log(`  清理前备份文件数量: ${beforeBackupFiles.length}`);
    if (beforeBackupFiles.length > 0) {
      console.log('  现有备份文件:');
      beforeBackupFiles.forEach(file => console.log(`    - ${file}`));
    }

    // 第2步：执行带 skipBackup 的清理
    console.log('\n🚫 第2步：执行 skipBackup=true 的清理...');
    const cleanupResult = await deviceManager.performCleanup({
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartCursor: false,
      skipBackup: true, // 关键：跳过备份
      skipCursorLogin: true,
      aggressiveMode: false,
      multiRoundClean: false,
      extendedMonitoring: false
    });

    console.log('  清理结果:');
    console.log(`    成功: ${cleanupResult.success}`);
    console.log(`    操作数量: ${cleanupResult.actions?.length || 0}`);
    console.log(`    错误数量: ${cleanupResult.errors?.length || 0}`);

    // 显示清理操作
    if (cleanupResult.actions && cleanupResult.actions.length > 0) {
      console.log('  清理操作:');
      cleanupResult.actions.slice(0, 10).forEach(action => {
        console.log(`    • ${action}`);
      });
      if (cleanupResult.actions.length > 10) {
        console.log(`    ... 还有 ${cleanupResult.actions.length - 10} 个操作`);
      }
    }

    // 第3步：检查清理后的临时目录状态
    console.log('\n🔍 第3步：检查清理后状态...');
    const afterFiles = await fs.readdir(tempDir);
    const afterBackupFiles = afterFiles.filter(file => 
      file.includes('cursor-backup') || 
      file.includes('augment-backup') || 
      file.includes('workspace-augment-backup')
    );
    
    console.log(`  清理后备份文件数量: ${afterBackupFiles.length}`);
    if (afterBackupFiles.length > 0) {
      console.log('  新创建的备份文件:');
      afterBackupFiles.forEach(file => console.log(`    - ${file}`));
    }

    // 第4步：验证结果
    console.log('\n✅ 第4步：验证 skipBackup 功能...');
    const newBackupFiles = afterBackupFiles.filter(file => 
      !beforeBackupFiles.includes(file)
    );
    
    if (newBackupFiles.length === 0) {
      console.log('  🎉 skipBackup 功能正常！没有创建新的备份文件');
      
      // 检查清理操作中是否包含跳过备份的提示
      const skipBackupActions = cleanupResult.actions?.filter(action => 
        action.includes('跳过备份') || action.includes('防止IDE恢复')
      ) || [];
      
      if (skipBackupActions.length > 0) {
        console.log('  📝 找到跳过备份的操作记录:');
        skipBackupActions.forEach(action => console.log(`    • ${action}`));
      }
      
      return true;
    } else {
      console.log('  ❌ skipBackup 功能异常！仍然创建了备份文件:');
      newBackupFiles.forEach(file => console.log(`    - ${file}`));
      return false;
    }

  } catch (error) {
    console.error('❌ 测试过程出错:', error);
    return false;
  }
}

// 对比测试：不使用 skipBackup
async function testWithBackup() {
  console.log('\n\n🔄 对比测试：不使用 skipBackup');
  console.log('==================================================');

  const deviceManager = new DeviceManager();
  
  try {
    // 记录清理前状态
    const tempDir = os.tmpdir();
    const beforeFiles = await fs.readdir(tempDir);
    const beforeBackupFiles = beforeFiles.filter(file => 
      file.includes('cursor-backup') || 
      file.includes('augment-backup') || 
      file.includes('workspace-augment-backup')
    );
    
    console.log(`清理前备份文件数量: ${beforeBackupFiles.length}`);

    // 执行不跳过备份的清理
    const cleanupResult = await deviceManager.performCleanup({
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartCursor: false,
      skipBackup: false, // 关键：不跳过备份
      skipCursorLogin: true,
      aggressiveMode: false,
      multiRoundClean: false,
      extendedMonitoring: false
    });

    // 检查清理后状态
    const afterFiles = await fs.readdir(tempDir);
    const afterBackupFiles = afterFiles.filter(file => 
      file.includes('cursor-backup') || 
      file.includes('augment-backup') || 
      file.includes('workspace-augment-backup')
    );
    
    const newBackupFiles = afterBackupFiles.filter(file => 
      !beforeBackupFiles.includes(file)
    );
    
    console.log(`清理后新增备份文件数量: ${newBackupFiles.length}`);
    if (newBackupFiles.length > 0) {
      console.log('新创建的备份文件:');
      newBackupFiles.forEach(file => console.log(`  - ${file}`));
      console.log('✅ 正常模式确实会创建备份文件');
    } else {
      console.log('⚠️ 正常模式也没有创建备份文件（可能没有需要清理的内容）');
    }

  } catch (error) {
    console.error('❌ 对比测试出错:', error);
  }
}

// 主函数
async function main() {
  console.log('🎯 skipBackup 功能测试');
  console.log('测试目标：验证 skipBackup=true 时不创建备份文件');
  console.log('');

  // 测试 skipBackup 功能
  const skipBackupResult = await testSkipBackup();
  
  // 对比测试
  await testWithBackup();
  
  // 总结
  console.log('\n\n📋 测试总结');
  console.log('==================================================');
  if (skipBackupResult) {
    console.log('✅ skipBackup 功能测试通过');
    console.log('🎉 客户端清理时将不再创建备份文件，有效防止IDE恢复设备ID');
  } else {
    console.log('❌ skipBackup 功能测试失败');
    console.log('🔧 需要检查代码实现');
  }
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testSkipBackup, testWithBackup };
