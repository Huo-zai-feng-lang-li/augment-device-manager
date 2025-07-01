const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * 清理Cursor备份文件
 * 彻底解决设备ID恢复问题
 */

async function cleanBackupFiles() {
  console.log('🧹 清理Cursor备份文件');
  console.log('==================================================');

  const results = {
    success: true,
    actions: [],
    errors: []
  };

  try {
    // 第1步：清理备份目录
    console.log('\n📦 第1步：清理备份目录...');
    const backupDir = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'backups'
    );

    if (await fs.pathExists(backupDir)) {
      const backupFiles = await fs.readdir(backupDir);
      console.log(`  发现 ${backupFiles.length} 个备份文件`);

      for (const file of backupFiles) {
        const filePath = path.join(backupDir, file);
        try {
          await fs.remove(filePath);
          results.actions.push(`🗑️ 已删除备份: ${file}`);
          console.log(`  ✅ 已删除: ${file}`);
        } catch (error) {
          results.errors.push(`删除备份失败 ${file}: ${error.message}`);
        }
      }

      // 删除整个备份目录
      try {
        await fs.remove(backupDir);
        results.actions.push('🗑️ 已删除备份目录');
        console.log('  ✅ 备份目录已完全删除');
      } catch (error) {
        results.errors.push(`删除备份目录失败: ${error.message}`);
      }
    } else {
      console.log('  ℹ️ 备份目录不存在');
    }

    // 第2步：清理其他可能的备份位置
    console.log('\n🔍 第2步：清理其他备份位置...');
    const otherBackupPaths = [
      path.join(os.homedir(), 'AppData', 'Local', 'Cursor', 'User', 'backups'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'backups'),
      path.join(os.homedir(), 'AppData', 'Local', 'Cursor', 'backups')
    ];

    for (const backupPath of otherBackupPaths) {
      try {
        if (await fs.pathExists(backupPath)) {
          await fs.remove(backupPath);
          results.actions.push(`🗑️ 已删除: ${path.basename(backupPath)}`);
          console.log(`  ✅ 已删除: ${backupPath}`);
        }
      } catch (error) {
        results.errors.push(`清理失败 ${path.basename(backupPath)}: ${error.message}`);
      }
    }

    // 第3步：重新生成storage.json
    console.log('\n🆔 第3步：重新生成storage.json...');
    const storageJsonPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );

    const newIdentifiers = {
      devDeviceId: crypto.randomUUID(),
      machineId: crypto.randomBytes(32).toString('hex'),
      macMachineId: crypto.randomBytes(32).toString('hex'),
      sessionId: crypto.randomUUID(),
      sqmId: `{${crypto.randomUUID().toUpperCase()}}`
    };

    const storageData = {
      'telemetry.devDeviceId': newIdentifiers.devDeviceId,
      'telemetry.machineId': newIdentifiers.machineId,
      'telemetry.macMachineId': newIdentifiers.macMachineId,
      'telemetry.sessionId': newIdentifiers.sessionId,
      'telemetry.sqmId': newIdentifiers.sqmId,
      'telemetry.firstSessionDate': new Date().toUTCString(),
      'telemetry.currentSessionDate': new Date().toUTCString()
    };

    await fs.ensureDir(path.dirname(storageJsonPath));
    await fs.writeJson(storageJsonPath, storageData, { spaces: 2 });
    
    results.actions.push(`🆔 新设备ID: ${newIdentifiers.devDeviceId}`);
    console.log(`  ✅ 新设备ID: ${newIdentifiers.devDeviceId}`);

    // 第4步：清理SQLite数据库（再次确认）
    console.log('\n🗑️ 第4步：再次清理SQLite数据库...');
    const stateDbPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'state.vscdb'
    );

    if (await fs.pathExists(stateDbPath)) {
      await fs.remove(stateDbPath);
      results.actions.push('🗑️ SQLite数据库已删除');
      console.log('  ✅ SQLite数据库已删除');
    }

    // 第5步：清理工作区存储（再次确认）
    console.log('\n📁 第5步：再次清理工作区存储...');
    const workspaceStoragePath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'workspaceStorage'
    );

    if (await fs.pathExists(workspaceStoragePath)) {
      await fs.remove(workspaceStoragePath);
      results.actions.push('🗑️ 工作区存储已删除');
      console.log('  ✅ 工作区存储已删除');
    }

  } catch (error) {
    console.error('❌ 清理过程出错:', error);
    results.success = false;
    results.errors.push(error.message);
  }

  // 输出清理报告
  console.log('\n📋 清理报告');
  console.log('==================================================');
  console.log(`状态: ${results.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`执行操作: ${results.actions.length} 项`);
  console.log(`错误数量: ${results.errors.length} 项`);

  if (results.actions.length > 0) {
    console.log('\n✅ 成功操作:');
    results.actions.forEach(action => console.log(`  • ${action}`));
  }

  if (results.errors.length > 0) {
    console.log('\n❌ 错误信息:');
    results.errors.forEach(error => console.log(`  • ${error}`));
  }

  console.log('\n🎯 现在请测试:');
  console.log('1. 关闭Cursor IDE');
  console.log('2. 重新启动Cursor IDE');
  console.log('3. 检查设备ID是否保持稳定');
  console.log('4. 测试Augment扩展的行为');

  return results;
}

// 主函数
if (require.main === module) {
  cleanBackupFiles()
    .then(results => {
      console.log('\n🎉 备份清理完成！');
      
      if (results.success) {
        console.log('✅ 所有备份文件已清理，设备ID应该不再恢复');
      } else {
        console.log('⚠️ 清理过程中遇到一些问题，请检查错误信息');
      }
    })
    .catch(error => {
      console.error('❌ 清理失败:', error);
    });
}

module.exports = { cleanBackupFiles };
