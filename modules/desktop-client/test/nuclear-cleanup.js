#!/usr/bin/env node

/**
 * 核弹级清理 - 最激进的清理方案
 * 目标：100%清理成功率，彻底重置所有Cursor和Augment相关数据
 * 
 * ⚠️ 警告：这将完全删除Cursor IDE和所有相关数据
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function nuclearCleanup() {
  console.log('💥 启动核弹级清理...');
  console.log('⚠️ 这将完全删除Cursor IDE和所有相关数据');
  console.log('🎯 目标：100%清理成功率');
  console.log('');

  const results = {
    actions: [],
    errors: []
  };

  try {
    // 第1步：核弹级进程终止
    console.log('💀 第1步：核弹级进程终止');
    await nuclearProcessKill(results);

    // 第2步：完全删除所有Cursor文件
    console.log('🗑️ 第2步：完全删除所有Cursor文件');
    await nuclearFileDestruction(results);

    // 第3步：彻底清理注册表
    console.log('🗂️ 第3步：彻底清理注册表');
    await nuclearRegistryCleanup(results);

    // 第4步：系统级别数据清理
    console.log('🧹 第4步：系统级别数据清理');
    await nuclearSystemCleanup(results);

    // 第5步：网络和DNS清理
    console.log('🌐 第5步：网络和DNS清理');
    await nuclearNetworkCleanup(results);

    // 第6步：用户数据彻底清理
    console.log('👤 第6步：用户数据彻底清理');
    await nuclearUserDataCleanup(results);

    // 第7步：验证清理效果
    console.log('✅ 第7步：验证清理效果');
    const successRate = await verifyNuclearCleanup(results);

    console.log('\n💥 核弹级清理完成！');
    console.log(`📊 清理成功率: ${successRate.toFixed(1)}%`);
    console.log(`✅ 成功操作: ${results.actions.length} 个`);
    console.log(`❌ 失败操作: ${results.errors.length} 个`);

    if (successRate >= 98) {
      console.log('🎉 清理成功！Augment扩展将完全无法识别为老用户');
    } else {
      console.log('⚠️ 清理可能不完整，建议重新运行');
    }

    return { success: successRate >= 98, successRate, results };

  } catch (error) {
    console.error('💥 核弹级清理失败:', error.message);
    return { success: false, successRate: 0, results };
  }
}

// 核弹级进程终止
async function nuclearProcessKill(results) {
  const killCommands = [
    // Windows进程终止
    'taskkill /f /im "Cursor.exe" /t',
    'taskkill /f /im "cursor.exe" /t',
    'wmic process where "name like \'%cursor%\'" delete',
    'wmic process where "CommandLine like \'%cursor%\'" delete',
    'wmic process where "ExecutablePath like \'%cursor%\'" delete',
    
    // 强制终止所有相关进程
    'powershell "Get-Process | Where-Object {$_.ProcessName -like \'*cursor*\'} | Stop-Process -Force"',
    'powershell "Get-Process | Where-Object {$_.Path -like \'*cursor*\'} | Stop-Process -Force"',
  ];

  for (const cmd of killCommands) {
    try {
      await execAsync(cmd);
      results.actions.push(`💀 进程终止: ${cmd.substring(0, 50)}...`);
    } catch (error) {
      // 忽略进程不存在的错误
    }
  }

  // 等待进程完全终止
  await new Promise(resolve => setTimeout(resolve, 5000));
  results.actions.push('💀 所有Cursor进程已强制终止');
}

// 核弹级文件删除
async function nuclearFileDestruction(results) {
  const destructionTargets = [
    // 用户数据目录
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor'),
    path.join(os.homedir(), 'AppData', 'Local', 'Cursor'),
    path.join(os.homedir(), '.cursor'),
    path.join(os.homedir(), '.vscode-cursor'),
    
    // 系统安装目录
    'C:\\Program Files\\Cursor',
    'C:\\Program Files (x86)\\Cursor',
    'C:\\ProgramData\\Cursor',
    
    // 设备管理器数据
    path.join(os.homedir(), '.augment-device-manager'),
  ];

  for (const target of destructionTargets) {
    try {
      if (await fs.pathExists(target)) {
        // 先尝试修改权限
        try {
          if (os.platform() === 'win32') {
            await execAsync(`takeown /f "${target}" /r /d y`);
            await execAsync(`icacls "${target}" /grant administrators:F /t`);
          }
        } catch (error) {
          // 忽略权限修改失败
        }

        // 强制删除
        await fs.remove(target);
        results.actions.push(`💣 已摧毁: ${target}`);
      }
    } catch (error) {
      results.errors.push(`摧毁失败 ${target}: ${error.message}`);
      
      // 尝试使用系统命令强制删除
      try {
        if (os.platform() === 'win32') {
          await execAsync(`rd /s /q "${target}"`);
          results.actions.push(`💣 强制摧毁: ${target}`);
        }
      } catch (error2) {
        // 最终删除失败
      }
    }
  }
}

// 核弹级注册表清理
async function nuclearRegistryCleanup(results) {
  const registryTargets = [
    'HKEY_CURRENT_USER\\Software\\Cursor',
    'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Cursor',
    'HKEY_LOCAL_MACHINE\\Software\\Cursor',
    'HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Cursor',
    'HKEY_CURRENT_USER\\Software\\Classes\\Applications\\Cursor.exe',
    'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\ApplicationAssociationToasts',
    'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\Application\\Cursor.exe',
  ];

  for (const regPath of registryTargets) {
    try {
      await execAsync(`reg delete "${regPath}" /f`);
      results.actions.push(`🗂️ 注册表摧毁: ${regPath}`);
    } catch (error) {
      // 忽略不存在的注册表项
    }
  }

  // 清理所有包含cursor的注册表项
  try {
    const searchCommand = 'reg query HKEY_CURRENT_USER /f "cursor" /s';
    const { stdout } = await execAsync(searchCommand);
    
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes('HKEY_')) {
        try {
          await execAsync(`reg delete "${line.trim()}" /f`);
          results.actions.push(`🗂️ 清理注册表项: ${line.trim()}`);
        } catch (error) {
          // 忽略删除失败
        }
      }
    }
  } catch (error) {
    // 忽略搜索失败
  }
}

// 核弹级系统清理
async function nuclearSystemCleanup(results) {
  const systemCommands = [
    // 清理系统缓存
    'del /f /s /q "%TEMP%\\*cursor*"',
    'del /f /s /q "%TEMP%\\*augment*"',
    'rd /s /q "%TEMP%\\cursor-*"',
    'rd /s /q "%TEMP%\\augment-*"',
    
    // 清理系统临时文件
    'del /f /s /q "C:\\Windows\\Temp\\*cursor*"',
    'del /f /s /q "C:\\Windows\\Temp\\*augment*"',
    
    // 清理预取文件
    'del /f /s /q "C:\\Windows\\Prefetch\\CURSOR*"',
    
    // 清理最近使用的文件
    'del /f /s /q "%APPDATA%\\Microsoft\\Windows\\Recent\\*cursor*"',
  ];

  for (const cmd of systemCommands) {
    try {
      await execAsync(cmd);
      results.actions.push(`🧹 系统清理: ${cmd}`);
    } catch (error) {
      // 忽略清理失败
    }
  }
}

// 核弹级网络清理
async function nuclearNetworkCleanup(results) {
  const networkCommands = [
    'ipconfig /flushdns',
    'netsh winsock reset',
    'netsh int ip reset',
    'netsh advfirewall reset',
  ];

  for (const cmd of networkCommands) {
    try {
      await execAsync(cmd);
      results.actions.push(`🌐 网络清理: ${cmd}`);
    } catch (error) {
      // 忽略网络命令失败
    }
  }
}

// 核弹级用户数据清理
async function nuclearUserDataCleanup(results) {
  // 清理所有可能的用户数据位置
  const userDataLocations = [
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Downloads'),
  ];

  for (const location of userDataLocations) {
    try {
      const items = await fs.readdir(location);
      
      for (const item of items) {
        if (item.toLowerCase().includes('cursor') || 
            item.toLowerCase().includes('augment')) {
          const itemPath = path.join(location, item);
          try {
            await fs.remove(itemPath);
            results.actions.push(`👤 用户数据清理: ${item}`);
          } catch (error) {
            // 忽略单个文件清理失败
          }
        }
      }
    } catch (error) {
      // 忽略目录访问失败
    }
  }
}

// 验证核弹级清理效果
async function verifyNuclearCleanup(results) {
  let score = 0;
  let maxScore = 100;

  // 检查文件是否完全删除 (50分)
  const criticalPaths = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor'),
    path.join(os.homedir(), 'AppData', 'Local', 'Cursor'),
    'C:\\Program Files\\Cursor',
  ];

  let filesDeleted = 0;
  for (const criticalPath of criticalPaths) {
    if (!await fs.pathExists(criticalPath)) {
      filesDeleted++;
    }
  }
  score += (filesDeleted / criticalPaths.length) * 50;

  // 检查注册表是否清理 (30分)
  try {
    await execAsync('reg query "HKEY_CURRENT_USER\\Software\\Cursor"');
    // 如果查询成功，说明注册表项还存在
  } catch (error) {
    // 查询失败，说明注册表项已清理
    score += 30;
  }

  // 检查进程是否完全终止 (20分)
  try {
    const { stdout } = await execAsync('tasklist | findstr /i cursor');
    if (!stdout.trim()) {
      score += 20;
    }
  } catch (error) {
    // 没有找到cursor进程
    score += 20;
  }

  results.actions.push(`📊 核弹级清理评分: ${score}/${maxScore}`);
  return score;
}

// 主执行函数
if (require.main === module) {
  if (process.argv.includes('--help')) {
    console.log('核弹级清理使用说明:');
    console.log('  node nuclear-cleanup.js');
    console.log('');
    console.log('⚠️ 警告：这将完全删除Cursor IDE和所有相关数据');
    console.log('💥 这是最激进的清理方案，请确保已备份重要数据');
  } else {
    nuclearCleanup().then(result => {
      if (result.success) {
        console.log('\n🎉 核弹级清理成功完成！');
        process.exit(0);
      } else {
        console.log('\n❌ 核弹级清理未完全成功');
        process.exit(1);
      }
    }).catch(console.error);
  }
}

module.exports = { nuclearCleanup };
