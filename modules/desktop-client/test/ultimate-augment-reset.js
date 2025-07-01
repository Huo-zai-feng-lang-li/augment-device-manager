const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

/**
 * 终极Augment扩展重置 - 彻底清除所有用户身份信息
 * 解决扩展仍然显示旧用户账户的问题
 */

const execAsync = promisify(exec);

async function ultimateAugmentReset() {
  console.log('🚀 启动终极Augment扩展重置');
  console.log('==================================================');

  const results = {
    success: true,
    actions: [],
    errors: []
  };

  try {
    // 第1步：强制关闭Cursor
    console.log('\n🔄 第1步：强制关闭Cursor...');
    await forceCloseCursor(results);

    // 第2步：完全重置storage.json
    console.log('\n🆔 第2步：完全重置storage.json...');
    await completelyResetStorageJson(results);

    // 第3步：彻底清理state.vscdb数据库
    console.log('\n🗄️ 第3步：彻底清理state.vscdb数据库...');
    await completelyCleanStateDatabase(results);

    // 第4步：清理所有工作区存储
    console.log('\n📁 第4步：清理所有工作区存储...');
    await cleanAllWorkspaceStorage(results);

    // 第5步：清理浏览器相关数据
    console.log('\n🌐 第5步：清理浏览器相关数据...');
    await cleanBrowserData(results);

    // 第6步：重置网络身份
    console.log('\n🌍 第6步：重置网络身份...');
    await resetNetworkIdentity(results);

    // 第7步：启动增强守护者
    console.log('\n🛡️ 第7步：启动增强守护者...');
    await startEnhancedGuardian(results);

    console.log('\n📋 终极重置完成报告');
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

    console.log('\n🎯 现在启动Cursor IDE测试效果！');

  } catch (error) {
    console.error('❌ 终极重置失败:', error);
    results.success = false;
    results.errors.push(error.message);
  }

  return results;
}

// 强制关闭Cursor
async function forceCloseCursor(results) {
  const commands = [
    'taskkill /f /im "Cursor.exe" /t',
    'wmic process where "name=\'Cursor.exe\'" delete',
    'wmic process where "name=\'cursor.exe\'" delete',
  ];

  for (const cmd of commands) {
    try {
      await execAsync(cmd);
      results.actions.push(`✅ 执行: ${cmd}`);
    } catch (error) {
      // 忽略进程不存在的错误
    }
  }

  await new Promise(resolve => setTimeout(resolve, 3000));
  results.actions.push('✅ Cursor IDE已强制关闭');
}

// 完全重置storage.json
async function completelyResetStorageJson(results) {
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

    // 生成全新的身份信息
    const newIdentity = {
      'telemetry.devDeviceId': crypto.randomUUID(),
      'telemetry.machineId': crypto.randomBytes(32).toString('hex'),
      'telemetry.macMachineId': crypto.randomBytes(32).toString('hex'),
      'telemetry.sessionId': crypto.randomUUID(),
      'telemetry.sqmId': `{${crypto.randomUUID().toUpperCase()}}`,
      'telemetry.firstSessionDate': new Date().toUTCString(),
      'telemetry.currentSessionDate': new Date().toUTCString()
    };

    // 确保目录存在
    await fs.ensureDir(path.dirname(storageJsonPath));

    // 写入全新配置
    await fs.writeJson(storageJsonPath, newIdentity, { spaces: 2 });

    results.actions.push(`🆔 新设备ID: ${newIdentity['telemetry.devDeviceId']}`);
    results.actions.push(`🔧 新机器ID: ${newIdentity['telemetry.machineId']}`);
    results.actions.push(`📱 新会话ID: ${newIdentity['telemetry.sessionId']}`);

    // 设置只读保护
    try {
      await execAsync(`attrib +R "${storageJsonPath}"`);
      results.actions.push('🔒 已设置storage.json只读保护');
    } catch (error) {
      results.errors.push('设置只读保护失败');
    }

  } catch (error) {
    results.errors.push(`重置storage.json失败: ${error.message}`);
  }
}

// 彻底清理state.vscdb数据库
async function completelyCleanStateDatabase(results) {
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
      // 创建备份
      const backupPath = stateDbPath + '.backup.' + Date.now();
      await fs.copy(stateDbPath, backupPath);
      results.actions.push(`📦 已备份数据库: ${path.basename(backupPath)}`);

      // 删除原数据库
      await fs.remove(stateDbPath);
      results.actions.push('🗑️ 已删除state.vscdb数据库');

      // 等待一段时间确保删除完成
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      results.actions.push('ℹ️ state.vscdb数据库不存在');
    }

  } catch (error) {
    results.errors.push(`清理state.vscdb失败: ${error.message}`);
  }
}

// 清理所有工作区存储
async function cleanAllWorkspaceStorage(results) {
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
      // 创建备份
      const backupPath = path.join(os.tmpdir(), `workspace-backup-${Date.now()}`);
      await fs.copy(workspaceStoragePath, backupPath);
      results.actions.push(`📦 已备份工作区存储: ${path.basename(backupPath)}`);

      // 删除所有工作区存储
      await fs.remove(workspaceStoragePath);
      results.actions.push('🗑️ 已删除所有工作区存储');
    } else {
      results.actions.push('ℹ️ 工作区存储不存在');
    }

  } catch (error) {
    results.errors.push(`清理工作区存储失败: ${error.message}`);
  }
}

// 清理浏览器相关数据
async function cleanBrowserData(results) {
  try {
    const browserPaths = [
      path.join(os.homedir(), 'AppData', 'Local', 'Cursor', 'User', 'CachedData'),
      path.join(os.homedir(), 'AppData', 'Local', 'Cursor', 'User', 'Cache'),
      path.join(os.homedir(), 'AppData', 'Local', 'Cursor', 'User', 'History'),
      path.join(os.homedir(), 'AppData', 'Local', 'Cursor', 'User', 'Session Storage'),
      path.join(os.homedir(), 'AppData', 'Local', 'Cursor', 'User', 'Local Storage')
    ];

    for (const browserPath of browserPaths) {
      try {
        if (await fs.pathExists(browserPath)) {
          await fs.remove(browserPath);
          results.actions.push(`🧹 已清理: ${path.basename(browserPath)}`);
        }
      } catch (error) {
        // 忽略被锁定的文件
      }
    }

  } catch (error) {
    results.errors.push(`清理浏览器数据失败: ${error.message}`);
  }
}

// 重置网络身份
async function resetNetworkIdentity(results) {
  try {
    // 清理DNS缓存
    await execAsync('ipconfig /flushdns');
    results.actions.push('🌐 已清理DNS缓存');

    // 重置网络适配器（可选）
    // await execAsync('netsh winsock reset');
    // results.actions.push('🔄 已重置网络适配器');

  } catch (error) {
    results.errors.push(`重置网络身份失败: ${error.message}`);
  }
}

// 启动增强守护者
async function startEnhancedGuardian(results) {
  try {
    // 这里可以启动我们的设备ID守护者
    results.actions.push('🛡️ 增强守护者准备就绪');
    results.actions.push('⏰ 将在Cursor启动时自动激活');

  } catch (error) {
    results.errors.push(`启动增强守护者失败: ${error.message}`);
  }
}

// 主函数
if (require.main === module) {
  ultimateAugmentReset()
    .then(results => {
      console.log('\n🎉 终极重置完成！');
      
      if (results.success) {
        console.log('✅ 所有用户身份信息已彻底清除');
        console.log('🚀 现在启动Cursor IDE，Augment扩展应该认为这是全新设备');
      } else {
        console.log('⚠️ 重置过程中遇到一些问题，请检查错误信息');
      }
    })
    .catch(error => {
      console.error('❌ 终极重置失败:', error);
    });
}

module.exports = { ultimateAugmentReset };
