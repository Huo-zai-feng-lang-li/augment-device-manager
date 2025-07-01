const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const execAsync = promisify(exec);

/**
 * 清理Windows系统级别的Cursor备份
 * 解决Windows AppListBackup自动恢复问题
 */

async function cleanWindowsBackup() {
  console.log('🔧 清理Windows系统级别的Cursor备份');
  console.log('==================================================');

  const results = {
    success: true,
    actions: [],
    errors: []
  };

  try {
    // 第1步：清理Windows AppListBackup
    console.log('\n🗑️ 第1步：清理Windows AppListBackup...');
    await cleanAppListBackup(results);

    // 第2步：清理Windows事件驱动备份
    console.log('\n📋 第2步：清理事件驱动备份...');
    await cleanEventDriverBackup(results);

    // 第3步：清理Windows应用数据备份
    console.log('\n💾 第3步：清理应用数据备份...');
    await cleanAppDataBackup(results);

    // 第4步：禁用Cursor的自动备份
    console.log('\n🚫 第4步：禁用Cursor自动备份...');
    await disableCursorBackup(results);

    // 第5步：重新生成全新的设备ID
    console.log('\n🆔 第5步：生成全新设备ID...');
    await generateFreshDeviceId(results);

    // 第6步：清理所有Cursor相关文件
    console.log('\n🧹 第6步：彻底清理Cursor文件...');
    await thoroughCleanup(results);

  } catch (error) {
    console.error('❌ 清理过程出错:', error);
    results.success = false;
    results.errors.push(error.message);
  }

  // 输出清理报告
  outputResults(results);
  return results;
}

// 清理Windows AppListBackup
async function cleanAppListBackup(results) {
  try {
    const regPaths = [
      'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\AppListBackup',
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppListBackup'
    ];

    for (const regPath of regPaths) {
      try {
        // 查询是否存在Cursor相关的备份
        const { stdout } = await execAsync(`reg query "${regPath}" /s | findstr /i cursor`);
        
        if (stdout && stdout.trim()) {
          console.log(`  🎯 发现Cursor备份: ${regPath}`);
          
          // 删除Cursor相关的备份项
          try {
            await execAsync(`reg delete "${regPath}" /f`);
            results.actions.push(`🗑️ 已删除AppListBackup: ${regPath}`);
            console.log(`  ✅ 已删除: ${regPath}`);
          } catch (deleteError) {
            results.errors.push(`删除AppListBackup失败: ${deleteError.message}`);
          }
        }
      } catch (queryError) {
        // 注册表项不存在或无权限
        console.log(`  ℹ️ ${regPath} - 未找到Cursor备份`);
      }
    }
  } catch (error) {
    results.errors.push(`清理AppListBackup失败: ${error.message}`);
  }
}

// 清理事件驱动备份
async function cleanEventDriverBackup(results) {
  try {
    const regPath = 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\AppListBackup\\ListOfEventDriverBackedUpFiles';
    
    try {
      // 查询事件驱动备份
      const { stdout } = await execAsync(`reg query "${regPath}"`);
      
      if (stdout && stdout.includes('Cursor')) {
        console.log('  🎯 发现Cursor事件驱动备份');
        
        // 删除事件驱动备份
        await execAsync(`reg delete "${regPath}" /f`);
        results.actions.push('🗑️ 已删除事件驱动备份');
        console.log('  ✅ 事件驱动备份已删除');
      }
    } catch (error) {
      console.log('  ℹ️ 未找到事件驱动备份');
    }
  } catch (error) {
    results.errors.push(`清理事件驱动备份失败: ${error.message}`);
  }
}

// 清理应用数据备份
async function cleanAppDataBackup(results) {
  try {
    // Windows可能的备份位置
    const backupPaths = [
      'C:\\ProgramData\\Microsoft\\Windows\\AppRepository\\Packages',
      path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Windows', 'AppRepository'),
      path.join(os.homedir(), 'AppData', 'Local', 'Packages'),
      'C:\\Windows\\System32\\config\\systemprofile\\AppData\\Local\\Packages'
    ];

    for (const backupPath of backupPaths) {
      try {
        if (await fs.pathExists(backupPath)) {
          const items = await fs.readdir(backupPath);
          const cursorItems = items.filter(item => 
            item.toLowerCase().includes('cursor') || 
            item.toLowerCase().includes('vscode')
          );

          for (const item of cursorItems) {
            const itemPath = path.join(backupPath, item);
            try {
              await fs.remove(itemPath);
              results.actions.push(`🗑️ 已删除应用备份: ${item}`);
              console.log(`  ✅ 已删除: ${item}`);
            } catch (error) {
              results.errors.push(`删除应用备份失败 ${item}: ${error.message}`);
            }
          }
        }
      } catch (error) {
        // 无权限访问，跳过
      }
    }
  } catch (error) {
    results.errors.push(`清理应用数据备份失败: ${error.message}`);
  }
}

// 禁用Cursor自动备份
async function disableCursorBackup(results) {
  try {
    // 创建注册表项禁用Cursor的自动备份
    const regCommands = [
      'reg add "HKEY_CURRENT_USER\\Software\\Cursor" /v "DisableBackup" /t REG_DWORD /d 1 /f',
      'reg add "HKEY_CURRENT_USER\\Software\\Microsoft\\VSCode" /v "DisableBackup" /t REG_DWORD /d 1 /f'
    ];

    for (const cmd of regCommands) {
      try {
        await execAsync(cmd);
        results.actions.push('🚫 已禁用自动备份');
      } catch (error) {
        // 忽略错误，继续执行
      }
    }

    console.log('  ✅ 自动备份已禁用');
  } catch (error) {
    results.errors.push(`禁用自动备份失败: ${error.message}`);
  }
}

// 生成全新设备ID
async function generateFreshDeviceId(results) {
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

  } catch (error) {
    results.errors.push(`生成设备ID失败: ${error.message}`);
  }
}

// 彻底清理
async function thoroughCleanup(results) {
  try {
    const pathsToClean = [
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'workspaceStorage'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'logs'),
      path.join(os.homedir(), 'AppData', 'Local', 'Cursor', 'User', 'CachedData')
    ];

    for (const pathToClean of pathsToClean) {
      try {
        if (await fs.pathExists(pathToClean)) {
          await fs.remove(pathToClean);
          results.actions.push(`🗑️ 已清理: ${path.basename(pathToClean)}`);
        }
      } catch (error) {
        // 文件可能被锁定，忽略错误
      }
    }

    console.log('  ✅ 彻底清理完成');
  } catch (error) {
    results.errors.push(`彻底清理失败: ${error.message}`);
  }
}

// 输出结果
function outputResults(results) {
  console.log('\n📋 Windows备份清理报告');
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

  console.log('\n🎯 下一步测试:');
  console.log('1. 重启计算机（清除内存缓存）');
  console.log('2. 启动Cursor IDE');
  console.log('3. 检查设备ID是否保持稳定');
  console.log('4. 测试Augment扩展行为');
}

// 主函数
if (require.main === module) {
  console.log('⚠️ 注意：此脚本需要管理员权限才能清理系统级备份');
  console.log('请以管理员身份运行命令提示符，然后执行此脚本');
  console.log('');

  cleanWindowsBackup()
    .then(results => {
      console.log('\n🎉 Windows备份清理完成！');
      
      if (results.success) {
        console.log('✅ 系统级备份已清理，建议重启计算机');
      } else {
        console.log('⚠️ 部分清理失败，可能需要管理员权限');
      }
    })
    .catch(error => {
      console.error('❌ 清理失败:', error);
    });
}

module.exports = { cleanWindowsBackup };
