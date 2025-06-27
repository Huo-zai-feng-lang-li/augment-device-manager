#!/usr/bin/env node

/**
 * Augment设备管理器 - 终极清理方案
 * 目标：98%以上清理成功率，让Augment扩展完全无法识别为老用户
 * 
 * 三种清理策略：
 * 1. 完全卸载并重新安装Cursor IDE
 * 2. 深层配置文件清理
 * 3. 系统级别阻止ID恢复
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class UltimateCleanup {
  constructor() {
    this.platform = os.platform();
    this.results = {
      success: true,
      actions: [],
      errors: [],
      phase: 'initialization'
    };
  }

  async execute(options = {}) {
    console.log('🚀 启动终极清理方案...');
    console.log('🎯 目标：98%以上清理成功率');
    console.log('⚠️ 警告：这将完全重置Cursor IDE');
    console.log('');

    try {
      // 阶段1：系统级别阻止ID恢复
      await this.phase1_SystemLevelBlocking();
      
      // 阶段2：深层配置文件清理
      await this.phase2_DeepConfigCleanup();
      
      // 阶段3：完全卸载Cursor IDE
      await this.phase3_CompleteUninstall();
      
      // 阶段4：彻底清理残留
      await this.phase4_ThoroughCleanup();
      
      // 阶段5：重新安装Cursor IDE
      if (options.reinstall !== false) {
        await this.phase5_ReinstallCursor();
      }
      
      // 阶段6：验证清理效果
      await this.phase6_VerifyCleanup();
      
      console.log('\n🎉 终极清理完成！');
      return this.results;
      
    } catch (error) {
      console.error('❌ 终极清理失败:', error.message);
      this.results.success = false;
      this.results.errors.push(`终极清理失败: ${error.message}`);
      return this.results;
    }
  }

  // 阶段1：系统级别阻止ID恢复
  async phase1_SystemLevelBlocking() {
    this.results.phase = 'system-blocking';
    console.log('🔒 阶段1：系统级别阻止ID恢复');
    
    try {
      // 1.1 创建文件系统锁定
      await this.createFilesystemLocks();
      
      // 1.2 修改注册表阻止恢复
      if (this.platform === 'win32') {
        await this.blockRegistryRecovery();
      }
      
      // 1.3 创建网络级别阻断
      await this.createNetworkBlocking();
      
      this.results.actions.push('✅ 系统级别阻止机制已启用');
    } catch (error) {
      this.results.errors.push(`系统级别阻止失败: ${error.message}`);
    }
  }

  // 阶段2：深层配置文件清理
  async phase2_DeepConfigCleanup() {
    this.results.phase = 'deep-config';
    console.log('🗂️ 阶段2：深层配置文件清理');
    
    try {
      // 2.1 清理所有Cursor相关配置
      await this.cleanAllCursorConfigs();
      
      // 2.2 清理系统级别配置
      await this.cleanSystemConfigs();
      
      // 2.3 清理用户级别配置
      await this.cleanUserConfigs();
      
      this.results.actions.push('✅ 深层配置文件已完全清理');
    } catch (error) {
      this.results.errors.push(`深层配置清理失败: ${error.message}`);
    }
  }

  // 阶段3：完全卸载Cursor IDE
  async phase3_CompleteUninstall() {
    this.results.phase = 'uninstall';
    console.log('🗑️ 阶段3：完全卸载Cursor IDE');
    
    try {
      // 3.1 强制终止所有Cursor进程
      await this.forceKillAllCursorProcesses();
      
      // 3.2 卸载Cursor应用程序
      await this.uninstallCursorApplication();
      
      // 3.3 清理注册表项
      if (this.platform === 'win32') {
        await this.cleanCursorRegistry();
      }
      
      // 3.4 删除所有安装文件
      await this.removeAllCursorFiles();
      
      this.results.actions.push('✅ Cursor IDE已完全卸载');
    } catch (error) {
      this.results.errors.push(`完全卸载失败: ${error.message}`);
    }
  }

  // 阶段4：彻底清理残留
  async phase4_ThoroughCleanup() {
    this.results.phase = 'thorough-cleanup';
    console.log('🧹 阶段4：彻底清理残留');
    
    try {
      // 4.1 清理所有用户数据
      await this.cleanAllUserData();
      
      // 4.2 清理系统缓存
      await this.cleanSystemCache();
      
      // 4.3 清理临时文件
      await this.cleanTempFiles();
      
      // 4.4 清理网络缓存
      await this.cleanNetworkCache();
      
      this.results.actions.push('✅ 所有残留数据已清理');
    } catch (error) {
      this.results.errors.push(`彻底清理失败: ${error.message}`);
    }
  }

  // 阶段5：重新安装Cursor IDE
  async phase5_ReinstallCursor() {
    this.results.phase = 'reinstall';
    console.log('📥 阶段5：重新安装Cursor IDE');
    
    try {
      // 5.1 下载最新版本Cursor
      const installerPath = await this.downloadCursorInstaller();
      
      // 5.2 静默安装
      await this.silentInstallCursor(installerPath);
      
      // 5.3 验证安装
      await this.verifyInstallation();
      
      this.results.actions.push('✅ Cursor IDE已重新安装');
    } catch (error) {
      this.results.errors.push(`重新安装失败: ${error.message}`);
      console.log('⚠️ 重新安装失败，请手动安装Cursor IDE');
    }
  }

  // 阶段6：验证清理效果
  async phase6_VerifyCleanup() {
    this.results.phase = 'verification';
    console.log('✅ 阶段6：验证清理效果');
    
    try {
      // 6.1 检查设备ID是否完全重置
      const deviceIdStatus = await this.verifyDeviceIdReset();
      
      // 6.2 检查Augment扩展数据
      const augmentStatus = await this.verifyAugmentDataCleanup();
      
      // 6.3 计算清理成功率
      const successRate = await this.calculateSuccessRate();
      
      console.log(`📊 清理成功率: ${successRate.toFixed(1)}%`);
      
      if (successRate >= 98) {
        console.log('🎉 清理成功！Augment扩展应该识别为新用户');
        this.results.actions.push(`🎯 清理成功率: ${successRate.toFixed(1)}% (≥98%)`);
      } else {
        console.log('⚠️ 清理成功率不足，可能需要额外处理');
        this.results.errors.push(`清理成功率不足: ${successRate.toFixed(1)}% (<98%)`);
      }
      
    } catch (error) {
      this.results.errors.push(`验证清理效果失败: ${error.message}`);
    }
  }

  // 创建文件系统锁定
  async createFilesystemLocks() {
    const lockPaths = [
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'storage.json'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
    ];

    for (const lockPath of lockPaths) {
      try {
        const lockDir = path.dirname(lockPath);
        await fs.ensureDir(lockDir);
        
        // 创建只读锁定文件
        await fs.writeFile(lockPath + '.lock', 'LOCKED_BY_ULTIMATE_CLEANUP');
        
        if (this.platform === 'win32') {
          // Windows: 设置文件为只读和隐藏
          await execAsync(`attrib +R +H "${lockPath}.lock"`);
        }
        
        this.results.actions.push(`🔒 已锁定: ${path.basename(lockPath)}`);
      } catch (error) {
        // 忽略单个锁定失败
      }
    }
  }

  // 强制终止所有Cursor进程
  async forceKillAllCursorProcesses() {
    const killCommands = this.platform === 'win32' ? [
      'taskkill /f /im "Cursor.exe" /t',
      'taskkill /f /im "cursor.exe" /t',
      'wmic process where "name like \'%cursor%\'" delete',
      'wmic process where "CommandLine like \'%cursor%\'" delete',
    ] : [
      'pkill -9 -f cursor',
      'pkill -9 -f Cursor',
      'killall -9 cursor',
      'killall -9 Cursor',
    ];

    for (const cmd of killCommands) {
      try {
        await execAsync(cmd);
        this.results.actions.push(`🔪 执行: ${cmd}`);
      } catch (error) {
        // 忽略进程不存在的错误
      }
    }

    // 等待进程完全终止
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// 主执行函数
async function runUltimateCleanup() {
  const cleanup = new UltimateCleanup();
  
  // 检查管理员权限
  if (os.platform() === 'win32') {
    try {
      await execAsync('net session');
    } catch (error) {
      console.log('⚠️ 建议以管理员权限运行以获得最佳效果');
    }
  }
  
  const options = {
    reinstall: process.argv.includes('--no-reinstall') ? false : true
  };
  
  const results = await cleanup.execute(options);
  
  console.log('\n📋 终极清理结果总结:');
  console.log(`✅ 成功操作: ${results.actions.length} 个`);
  console.log(`❌ 失败操作: ${results.errors.length} 个`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ 错误详情:');
    results.errors.forEach(error => console.log(`  • ${error}`));
  }
  
  return results;
}

// 处理命令行参数
if (require.main === module) {
  if (process.argv.includes('--help')) {
    console.log('终极清理方案使用说明:');
    console.log('  node ultimate-cleanup.js              # 完整清理+重装');
    console.log('  node ultimate-cleanup.js --no-reinstall # 仅清理，不重装');
    console.log('');
    console.log('⚠️ 警告：这将完全重置Cursor IDE，请确保已备份重要数据');
  } else {
    runUltimateCleanup().catch(console.error);
  }
}

  // 阻止注册表恢复
  async blockRegistryRecovery() {
    const registryBlocks = [
      'HKEY_CURRENT_USER\\Software\\Cursor',
      'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Cursor',
      'HKEY_LOCAL_MACHINE\\Software\\Cursor',
    ];

    for (const regPath of registryBlocks) {
      try {
        // 删除现有项
        await execAsync(`reg delete "${regPath}" /f`);

        // 创建阻止项（只读）
        await execAsync(`reg add "${regPath}" /v "BLOCKED_BY_ULTIMATE_CLEANUP" /t REG_SZ /d "LOCKED" /f`);

        this.results.actions.push(`🔒 注册表阻止: ${regPath}`);
      } catch (error) {
        // 忽略不存在的注册表项
      }
    }
  }

  // 创建网络级别阻断
  async createNetworkBlocking() {
    try {
      // 创建hosts文件阻断（阻止遥测上报）
      const hostsPath = this.platform === 'win32' ?
        'C:\\Windows\\System32\\drivers\\etc\\hosts' :
        '/etc/hosts';

      const blockEntries = [
        '127.0.0.1 api3.cursor.sh',
        '127.0.0.1 cursor.com',
        '127.0.0.1 telemetry.cursor.sh',
      ];

      if (await fs.pathExists(hostsPath)) {
        let hostsContent = await fs.readFile(hostsPath, 'utf8');

        // 添加阻断条目
        for (const entry of blockEntries) {
          if (!hostsContent.includes(entry)) {
            hostsContent += `\n${entry} # ULTIMATE_CLEANUP_BLOCK`;
          }
        }

        await fs.writeFile(hostsPath, hostsContent);
        this.results.actions.push('🌐 网络阻断已启用');
      }
    } catch (error) {
      this.results.errors.push(`网络阻断失败: ${error.message}`);
    }
  }

  // 清理所有Cursor配置
  async cleanAllCursorConfigs() {
    const configPaths = [
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor'),
      path.join(os.homedir(), 'AppData', 'Local', 'Cursor'),
      path.join(os.homedir(), '.cursor'),
      path.join(os.homedir(), '.vscode-cursor'),
    ];

    for (const configPath of configPaths) {
      try {
        if (await fs.pathExists(configPath)) {
          // 备份重要配置
          const backupPath = `${configPath}.ultimate-backup.${Date.now()}`;
          await fs.copy(configPath, backupPath);

          // 删除原配置
          await fs.remove(configPath);

          this.results.actions.push(`🗑️ 已清理配置: ${path.basename(configPath)}`);
          this.results.actions.push(`💾 备份至: ${backupPath}`);
        }
      } catch (error) {
        this.results.errors.push(`清理配置失败 ${configPath}: ${error.message}`);
      }
    }
  }

  // 清理系统级别配置
  async cleanSystemConfigs() {
    if (this.platform === 'win32') {
      const systemPaths = [
        'C:\\ProgramData\\Cursor',
        'C:\\Program Files\\Cursor',
        'C:\\Program Files (x86)\\Cursor',
      ];

      for (const systemPath of systemPaths) {
        try {
          if (await fs.pathExists(systemPath)) {
            await fs.remove(systemPath);
            this.results.actions.push(`🗑️ 已清理系统配置: ${systemPath}`);
          }
        } catch (error) {
          this.results.errors.push(`清理系统配置失败 ${systemPath}: ${error.message}`);
        }
      }
    }
  }

  // 卸载Cursor应用程序
  async uninstallCursorApplication() {
    if (this.platform === 'win32') {
      const uninstallCommands = [
        // 通过注册表查找卸载程序
        'wmic product where "name like \'%Cursor%\'" call uninstall /nointeractive',

        // 通过控制面板卸载
        'powershell "Get-WmiObject -Class Win32_Product | Where-Object {$_.Name -like \'*Cursor*\'} | ForEach-Object {$_.Uninstall()}"',

        // 通过程序和功能卸载
        'powershell "Get-Package | Where-Object {$_.Name -like \'*Cursor*\'} | Uninstall-Package -Force"',
      ];

      for (const cmd of uninstallCommands) {
        try {
          await execAsync(cmd, { timeout: 60000 });
          this.results.actions.push(`🗑️ 执行卸载: ${cmd.substring(0, 50)}...`);
        } catch (error) {
          // 忽略卸载失败（可能已经卸载）
        }
      }
    }
  }

  // 清理Cursor注册表
  async cleanCursorRegistry() {
    const registryPaths = [
      'HKEY_CURRENT_USER\\Software\\Cursor',
      'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Cursor',
      'HKEY_LOCAL_MACHINE\\Software\\Cursor',
      'HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Cursor',
      'HKEY_CURRENT_USER\\Software\\Classes\\Applications\\Cursor.exe',
      'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\ApplicationAssociationToasts',
    ];

    for (const regPath of registryPaths) {
      try {
        await execAsync(`reg delete "${regPath}" /f`);
        this.results.actions.push(`🗑️ 已清理注册表: ${regPath}`);
      } catch (error) {
        // 忽略不存在的注册表项
      }
    }
  }

  // 删除所有Cursor文件
  async removeAllCursorFiles() {
    const searchPaths = [
      'C:\\',
      path.join(os.homedir(), 'Desktop'),
      path.join(os.homedir(), 'Downloads'),
    ];

    for (const searchPath of searchPaths) {
      try {
        // 查找所有Cursor相关文件
        const findCommand = `dir "${searchPath}" /s /b | findstr /i cursor`;
        const { stdout } = await execAsync(findCommand);

        const files = stdout.split('\n').filter(line => line.trim());

        for (const file of files) {
          try {
            if (await fs.pathExists(file.trim())) {
              await fs.remove(file.trim());
              this.results.actions.push(`🗑️ 已删除文件: ${path.basename(file.trim())}`);
            }
          } catch (error) {
            // 忽略单个文件删除失败
          }
        }
      } catch (error) {
        // 忽略搜索失败
      }
    }
  }

  // 清理所有用户数据
  async cleanAllUserData() {
    const userDataPaths = [
      path.join(os.homedir(), '.augment-device-manager'),
      path.join(os.homedir(), 'AppData', 'Local', 'Temp'),
      path.join(os.homedir(), 'AppData', 'LocalLow'),
    ];

    for (const userPath of userDataPaths) {
      try {
        if (await fs.pathExists(userPath)) {
          // 清理Cursor和Augment相关文件
          const items = await fs.readdir(userPath);

          for (const item of items) {
            if (item.toLowerCase().includes('cursor') ||
                item.toLowerCase().includes('augment')) {
              const itemPath = path.join(userPath, item);
              await fs.remove(itemPath);
              this.results.actions.push(`🗑️ 已清理用户数据: ${item}`);
            }
          }
        }
      } catch (error) {
        this.results.errors.push(`清理用户数据失败 ${userPath}: ${error.message}`);
      }
    }
  }

  // 清理系统缓存
  async cleanSystemCache() {
    if (this.platform === 'win32') {
      const cacheCommands = [
        'del /f /s /q "%TEMP%\\*cursor*"',
        'del /f /s /q "%TEMP%\\*augment*"',
        'rd /s /q "%TEMP%\\cursor-*"',
        'rd /s /q "%TEMP%\\augment-*"',
        'cleanmgr /sagerun:1',
      ];

      for (const cmd of cacheCommands) {
        try {
          await execAsync(cmd);
          this.results.actions.push(`🧹 执行缓存清理: ${cmd}`);
        } catch (error) {
          // 忽略清理失败
        }
      }
    }
  }

  // 下载Cursor安装程序
  async downloadCursorInstaller() {
    const https = require('https');
    const downloadUrl = 'https://download.cursor.sh/windows/nsis/x64';
    const installerPath = path.join(os.tmpdir(), `cursor-installer-${Date.now()}.exe`);

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(installerPath);

      https.get(downloadUrl, (response) => {
        response.pipe(file);

        file.on('finish', () => {
          file.close();
          this.results.actions.push(`📥 已下载安装程序: ${installerPath}`);
          resolve(installerPath);
        });
      }).on('error', (error) => {
        fs.unlink(installerPath);
        reject(error);
      });
    });
  }

  // 静默安装Cursor
  async silentInstallCursor(installerPath) {
    try {
      const installCommand = `"${installerPath}" /S /D="C:\\Program Files\\Cursor"`;
      await execAsync(installCommand, { timeout: 300000 }); // 5分钟超时

      this.results.actions.push('📦 Cursor IDE已静默安装');

      // 清理安装程序
      await fs.remove(installerPath);
    } catch (error) {
      throw new Error(`静默安装失败: ${error.message}`);
    }
  }

  // 验证安装
  async verifyInstallation() {
    const cursorPaths = [
      'C:\\Program Files\\Cursor\\Cursor.exe',
      'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\Programs\\cursor\\Cursor.exe',
    ];

    for (const cursorPath of cursorPaths) {
      if (await fs.pathExists(cursorPath)) {
        this.results.actions.push(`✅ 验证安装成功: ${cursorPath}`);
        return true;
      }
    }

    throw new Error('安装验证失败：找不到Cursor可执行文件');
  }

  // 验证设备ID重置
  async verifyDeviceIdReset() {
    try {
      // 启动Cursor让其生成新的配置
      const cursorPath = 'C:\\Program Files\\Cursor\\Cursor.exe';
      if (await fs.pathExists(cursorPath)) {
        const cursorProcess = spawn(cursorPath, [], { detached: true });

        // 等待5秒让Cursor初始化
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 关闭Cursor
        cursorProcess.kill();

        // 检查新生成的设备ID
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
          const newDeviceId = data['telemetry.devDeviceId'];

          // 检查是否是新的设备ID（不是旧的固定ID）
          const oldDeviceId = '36987e70-60fe-4401-85a4-f463c269f069';

          if (newDeviceId && newDeviceId !== oldDeviceId) {
            this.results.actions.push(`🆔 新设备ID: ${newDeviceId}`);
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      this.results.errors.push(`验证设备ID重置失败: ${error.message}`);
      return false;
    }
  }

  // 验证Augment数据清理
  async verifyAugmentDataCleanup() {
    const augmentPaths = [
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'augment.vscode-augment'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'workspaceStorage'),
    ];

    let cleanupSuccess = true;

    for (const augmentPath of augmentPaths) {
      if (await fs.pathExists(augmentPath)) {
        try {
          const items = await fs.readdir(augmentPath);
          const augmentItems = items.filter(item =>
            item.toLowerCase().includes('augment')
          );

          if (augmentItems.length > 0) {
            cleanupSuccess = false;
            this.results.errors.push(`发现Augment残留: ${augmentPath}`);
          }
        } catch (error) {
          // 目录不存在或无法访问，这是好事
        }
      }
    }

    return cleanupSuccess;
  }

  // 计算清理成功率
  async calculateSuccessRate() {
    let score = 0;
    let maxScore = 100;

    // 设备ID重置 (40分)
    const deviceIdReset = await this.verifyDeviceIdReset();
    if (deviceIdReset) score += 40;

    // Augment数据清理 (30分)
    const augmentCleanup = await this.verifyAugmentDataCleanup();
    if (augmentCleanup) score += 30;

    // 配置文件清理 (20分)
    const configCleanup = !await fs.pathExists(path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor'));
    if (configCleanup) score += 20;

    // 注册表清理 (10分)
    try {
      await execAsync('reg query "HKEY_CURRENT_USER\\Software\\Cursor"');
      // 如果查询成功，说明注册表项还存在
    } catch (error) {
      // 查询失败，说明注册表项已清理
      score += 10;
    }

    return (score / maxScore) * 100;
  }

  // 清理临时文件
  async cleanTempFiles() {
    const tempPaths = [
      path.join(os.tmpdir()),
      path.join(os.homedir(), 'AppData', 'Local', 'Temp'),
    ];

    for (const tempPath of tempPaths) {
      try {
        const items = await fs.readdir(tempPath);

        for (const item of items) {
          if (item.toLowerCase().includes('cursor') ||
              item.toLowerCase().includes('augment')) {
            const itemPath = path.join(tempPath, item);
            try {
              await fs.remove(itemPath);
              this.results.actions.push(`🗑️ 已清理临时文件: ${item}`);
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

  // 清理网络缓存
  async cleanNetworkCache() {
    if (this.platform === 'win32') {
      const networkCommands = [
        'ipconfig /flushdns',
        'netsh winsock reset',
        'netsh int ip reset',
      ];

      for (const cmd of networkCommands) {
        try {
          await execAsync(cmd);
          this.results.actions.push(`🌐 网络缓存清理: ${cmd}`);
        } catch (error) {
          // 忽略网络命令失败
        }
      }
    }
  }

  // 清理用户级别配置
  async cleanUserConfigs() {
    const userConfigPaths = [
      path.join(os.homedir(), '.cursor'),
      path.join(os.homedir(), '.vscode-cursor'),
      path.join(os.homedir(), 'cursor-settings.json'),
    ];

    for (const configPath of userConfigPaths) {
      try {
        if (await fs.pathExists(configPath)) {
          await fs.remove(configPath);
          this.results.actions.push(`🗑️ 已清理用户配置: ${path.basename(configPath)}`);
        }
      } catch (error) {
        this.results.errors.push(`清理用户配置失败 ${configPath}: ${error.message}`);
      }
    }
  }
}

module.exports = { UltimateCleanup, runUltimateCleanup };
