const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * 增强版Cursor清理脚本
 * 专门解决"清理后仍被识别为老用户"的问题
 */

async function enhancedCursorCleanup() {
  console.log('🚀 增强版Cursor清理 - 解决老用户识别问题');
  console.log('==================================================');

  const results = {
    success: true,
    actions: [],
    errors: [],
    beforeDeviceId: null,
    afterDeviceId: null
  };

  try {
    // 第1步：记录清理前状态
    console.log('\n📊 第1步：记录清理前状态...');
    results.beforeDeviceId = await getCurrentDeviceId();
    console.log(`  清理前devDeviceId: ${results.beforeDeviceId || '未找到'}`);

    // 第2步：强制关闭所有Cursor进程
    console.log('\n🔪 第2步：强制关闭所有Cursor进程...');
    await forceCloseCursor(results);

    // 第3步：清理所有可能的存储位置
    console.log('\n🧹 第3步：清理所有存储位置...');
    await cleanAllStorageLocations(results);

    // 第4步：清理系统级别标识（需要管理员权限）
    console.log('\n🔧 第4步：清理系统级别标识...');
    await cleanSystemLevelIdentifiers(results);

    // 第5步：生成全新的设备标识
    console.log('\n🆔 第5步：生成全新设备标识...');
    await generateFreshIdentifiers(results);

    // 第6步：验证清理效果
    console.log('\n✅ 第6步：验证清理效果...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
    
    // 启动Cursor并检查
    await startCursorAndVerify(results);

    // 第7步：最终验证
    console.log('\n🎯 第7步：最终验证...');
    results.afterDeviceId = await getCurrentDeviceId();
    console.log(`  清理后devDeviceId: ${results.afterDeviceId || '未找到'}`);

    if (results.beforeDeviceId && results.afterDeviceId && 
        results.beforeDeviceId !== results.afterDeviceId) {
      console.log('🎉 清理成功！设备ID已更新，Cursor扩展应该识别为新用户');
      results.actions.push('✅ 设备ID成功更新');
    } else {
      console.log('⚠️ 警告：设备ID未发生变化，可能需要额外处理');
      results.errors.push('设备ID未更新');
    }

  } catch (error) {
    console.error('❌ 清理过程出错:', error);
    results.success = false;
    results.errors.push(error.message);
  }

  // 输出详细报告
  console.log('\n📋 清理报告:');
  console.log('==================================================');
  console.log(`状态: ${results.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`清理前ID: ${results.beforeDeviceId || '未知'}`);
  console.log(`清理后ID: ${results.afterDeviceId || '未知'}`);
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

// 强制关闭Cursor进程
async function forceCloseCursor(results) {
  const commands = [
    'taskkill /f /im "Cursor.exe" /t',
    'wmic process where "name=\'Cursor.exe\'" delete',
    'wmic process where "name=\'cursor.exe\'" delete',
    'wmic process where "CommandLine like \'%Cursor%\'" delete'
  ];

  for (const cmd of commands) {
    try {
      await execAsync(cmd);
      results.actions.push(`🔄 执行: ${cmd}`);
    } catch (error) {
      // 忽略进程不存在的错误
    }
  }

  // 等待进程完全终止
  await new Promise(resolve => setTimeout(resolve, 5000));
  results.actions.push('✅ Cursor进程已强制关闭');
}

// 清理所有存储位置
async function cleanAllStorageLocations(results) {
  const locationsToClean = [
    // 主要存储位置
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'storage.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'state.vscdb.backup'),
    
    // 工作区存储
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'workspaceStorage'),
    
    // 缓存和日志
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'logs'),
    path.join(os.homedir(), 'AppData', 'Local', 'Cursor', 'User', 'CachedData'),
    path.join(os.homedir(), 'AppData', 'Local', 'Cursor', 'User', 'logs'),
    
    // 扩展存储
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'augmentcode.augment'),
    
    // 临时文件
    path.join(os.tmpdir(), 'cursor-*'),
  ];

  for (const location of locationsToClean) {
    try {
      if (await fs.pathExists(location)) {
        const stats = await fs.stat(location);
        if (stats.isDirectory()) {
          await fs.remove(location);
          results.actions.push(`🗑️ 已删除目录: ${path.basename(location)}`);
        } else {
          await fs.remove(location);
          results.actions.push(`🗑️ 已删除文件: ${path.basename(location)}`);
        }
      }
    } catch (error) {
      if (!error.message.includes('ENOENT')) {
        results.errors.push(`清理失败 ${path.basename(location)}: ${error.message}`);
      }
    }
  }
}

// 清理系统级别标识
async function cleanSystemLevelIdentifiers(results) {
  try {
    // 生成新的MachineGuid
    const newMachineGuid = crypto.randomUUID();
    
    const regCommand = `reg add "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid /t REG_SZ /d "${newMachineGuid}" /f`;
    
    try {
      await execAsync(regCommand);
      results.actions.push('🔧 已更新系统MachineGuid');
    } catch (error) {
      results.errors.push('⚠️ 更新MachineGuid失败（需要管理员权限）');
    }
  } catch (error) {
    results.errors.push(`系统级别清理失败: ${error.message}`);
  }
}

// 生成全新设备标识
async function generateFreshIdentifiers(results) {
  try {
    const newIdentifiers = {
      devDeviceId: crypto.randomUUID(),
      machineId: crypto.randomBytes(32).toString('hex'),
      macMachineId: crypto.randomBytes(32).toString('hex'),
      sessionId: crypto.randomUUID(),
      sqmId: `{${crypto.randomUUID().toUpperCase()}}`
    };

    // 创建新的storage.json
    const storageJsonPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );

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

  } catch (error) {
    results.errors.push(`生成新标识失败: ${error.message}`);
  }
}

// 启动Cursor并验证
async function startCursorAndVerify(results) {
  try {
    // 尝试启动Cursor
    const cursorPaths = [
      'C:\\Users\\Administrator\\AppData\\Local\\Programs\\cursor\\Cursor.exe',
      'C:\\Program Files\\Cursor\\Cursor.exe',
      'cursor'
    ];

    let cursorStarted = false;
    for (const cursorPath of cursorPaths) {
      try {
        execAsync(`"${cursorPath}"`, { timeout: 5000 });
        cursorStarted = true;
        results.actions.push('🚀 Cursor已启动');
        break;
      } catch (error) {
        // 尝试下一个路径
      }
    }

    if (!cursorStarted) {
      results.actions.push('⚠️ 无法自动启动Cursor，请手动启动');
    }

    // 等待Cursor初始化
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    results.errors.push(`启动验证失败: ${error.message}`);
  }
}

// 主函数
if (require.main === module) {
  enhancedCursorCleanup()
    .then(results => {
      console.log('\n🎯 清理完成！');
      if (results.success && results.beforeDeviceId !== results.afterDeviceId) {
        console.log('✅ 建议现在测试Cursor扩展是否识别为新用户');
      } else {
        console.log('⚠️ 可能需要额外的手动处理');
      }
    })
    .catch(error => {
      console.error('❌ 清理失败:', error);
    });
}

module.exports = { enhancedCursorCleanup };
