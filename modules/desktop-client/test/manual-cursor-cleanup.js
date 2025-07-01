const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * 手动Cursor清理脚本
 * 专门解决SQLite数据库和工作区存储问题
 */

async function manualCursorCleanup() {
  console.log('🔧 手动Cursor清理 - 针对性解决问题');
  console.log('==================================================');

  const results = {
    success: true,
    actions: [],
    errors: []
  };

  try {
    // 第1步：检查当前状态
    console.log('\n📊 第1步：检查当前状态...');
    const beforeDeviceId = await getCurrentDeviceId();
    console.log(`  当前devDeviceId: ${beforeDeviceId || '未找到'}`);

    // 第2步：清理SQLite数据库
    console.log('\n🗑️ 第2步：清理SQLite数据库...');
    await cleanSQLiteDatabase(results);

    // 第3步：清理工作区存储
    console.log('\n📁 第3步：清理工作区存储...');
    await cleanWorkspaceStorage(results);

    // 第4步：清理缓存和日志
    console.log('\n🧹 第4步：清理缓存和日志...');
    await cleanCacheAndLogs(results);

    // 第5步：强制更新设备ID（确保是全新的）
    console.log('\n🆔 第5步：强制更新设备ID...');
    await forceUpdateDeviceId(results);

    // 第6步：验证清理效果
    console.log('\n✅ 第6步：验证清理效果...');
    const afterDeviceId = await getCurrentDeviceId();
    console.log(`  清理后devDeviceId: ${afterDeviceId || '未找到'}`);

    if (beforeDeviceId !== afterDeviceId) {
      console.log('🎉 设备ID已更新！');
      results.actions.push('✅ 设备ID成功更新');
    }

  } catch (error) {
    console.error('❌ 清理过程出错:', error);
    results.success = false;
    results.errors.push(error.message);
  }

  // 输出清理报告
  console.log('\n📋 清理报告:');
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

  return results;
}

// 获取当前设备ID
async function getCurrentDeviceId() {
  try {
    const storageJsonPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );

    if (await fs.pathExists(storageJsonPath)) {
      const data = await fs.readJson(storageJsonPath);
      return data['telemetry.devDeviceId'];
    }
    return null;
  } catch (error) {
    return null;
  }
}

// 清理SQLite数据库
async function cleanSQLiteDatabase(results) {
  try {
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
      // 备份数据库
      const backupPath = stateDbPath + '.backup.' + Date.now();
      await fs.copy(stateDbPath, backupPath);
      results.actions.push(`📦 已备份数据库: ${path.basename(backupPath)}`);

      // 删除数据库文件
      await fs.remove(stateDbPath);
      results.actions.push('🗑️ 已删除SQLite数据库文件');
      console.log('  ✅ SQLite数据库已清理');
    } else {
      console.log('  ℹ️ SQLite数据库文件不存在');
    }

    // 同时清理备份文件
    const backupDbPath = stateDbPath + '.backup';
    if (await fs.pathExists(backupDbPath)) {
      await fs.remove(backupDbPath);
      results.actions.push('🗑️ 已删除数据库备份文件');
    }

  } catch (error) {
    results.errors.push(`清理SQLite数据库失败: ${error.message}`);
    console.log(`  ❌ 清理失败: ${error.message}`);
  }
}

// 清理工作区存储
async function cleanWorkspaceStorage(results) {
  try {
    const workspaceStoragePath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'workspaceStorage'
    );

    if (await fs.pathExists(workspaceStoragePath)) {
      const workspaces = await fs.readdir(workspaceStoragePath);
      console.log(`  发现 ${workspaces.length} 个工作区`);

      let cleanedCount = 0;
      for (const workspace of workspaces) {
        const workspacePath = path.join(workspaceStoragePath, workspace);
        try {
          await fs.remove(workspacePath);
          cleanedCount++;
        } catch (error) {
          results.errors.push(`清理工作区失败 ${workspace}: ${error.message}`);
        }
      }

      results.actions.push(`🗑️ 已清理 ${cleanedCount} 个工作区存储`);
      console.log(`  ✅ 已清理 ${cleanedCount} 个工作区`);
    } else {
      console.log('  ℹ️ 工作区存储目录不存在');
    }

  } catch (error) {
    results.errors.push(`清理工作区存储失败: ${error.message}`);
    console.log(`  ❌ 清理失败: ${error.message}`);
  }
}

// 清理缓存和日志
async function cleanCacheAndLogs(results) {
  const pathsToClean = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'logs'),
    path.join(os.homedir(), 'AppData', 'Local', 'Cursor', 'User', 'CachedData'),
    path.join(os.homedir(), 'AppData', 'Local', 'Cursor', 'User', 'logs'),
  ];

  let cleanedCount = 0;
  for (const pathToClean of pathsToClean) {
    try {
      if (await fs.pathExists(pathToClean)) {
        await fs.remove(pathToClean);
        cleanedCount++;
        results.actions.push(`🗑️ 已清理: ${path.basename(pathToClean)}`);
      }
    } catch (error) {
      results.errors.push(`清理失败 ${path.basename(pathToClean)}: ${error.message}`);
    }
  }

  console.log(`  ✅ 已清理 ${cleanedCount} 个缓存/日志目录`);
}

// 强制更新设备ID
async function forceUpdateDeviceId(results) {
  try {
    const storageJsonPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );

    // 生成全新的设备标识
    const newIdentifiers = {
      devDeviceId: crypto.randomUUID(),
      machineId: crypto.randomBytes(32).toString('hex'),
      macMachineId: crypto.randomBytes(32).toString('hex'),
      sessionId: crypto.randomUUID(),
      sqmId: `{${crypto.randomUUID().toUpperCase()}}`
    };

    // 创建新的storage.json
    await fs.ensureDir(path.dirname(storageJsonPath));
    
    const storageData = {
      'telemetry.devDeviceId': newIdentifiers.devDeviceId,
      'telemetry.machineId': newIdentifiers.machineId,
      'telemetry.macMachineId': newIdentifiers.macMachineId,
      'telemetry.sessionId': newIdentifiers.sessionId,
      'telemetry.sqmId': newIdentifiers.sqmId,
      'telemetry.firstSessionDate': new Date().toUTCString(),
      'telemetry.currentSessionDate': new Date().toUTCString()
    };

    await fs.writeJson(storageJsonPath, storageData, { spaces: 2 });
    results.actions.push(`🆔 已生成新设备ID: ${newIdentifiers.devDeviceId.substring(0, 16)}...`);
    console.log(`  ✅ 新设备ID: ${newIdentifiers.devDeviceId.substring(0, 16)}...`);

  } catch (error) {
    results.errors.push(`更新设备ID失败: ${error.message}`);
    console.log(`  ❌ 更新失败: ${error.message}`);
  }
}

// 主函数
if (require.main === module) {
  manualCursorCleanup()
    .then(results => {
      console.log('\n🎯 手动清理完成！');
      console.log('\n📝 下一步建议:');
      console.log('1. 现在可以启动Cursor IDE');
      console.log('2. 测试Augment扩展是否识别为新用户');
      console.log('3. 如果仍有问题，可能需要考虑网络环境因素');
    })
    .catch(error => {
      console.error('❌ 清理失败:', error);
    });
}

module.exports = { manualCursorCleanup };
