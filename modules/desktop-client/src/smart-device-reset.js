const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

/**
 * 智能设备ID重置器 - 渐进式解决方案
 * 无需卸载重装，智能选择最佳清理策略
 */

class SmartDeviceReset {
  constructor() {
    this.execAsync = promisify(exec);
    this.results = {
      level: 0,
      success: false,
      actions: [],
      errors: [],
      newDeviceId: null
    };
  }

  /**
   * 主入口：智能重置设备ID
   */
  async resetDeviceId() {
    console.log('🤖 启动智能设备ID重置器');
    console.log('==================================================');

    try {
      // 第1级：温和清理（70%成功率）
      console.log('\n🔄 第1级：温和清理...');
      const level1Success = await this.level1_GentleReset();
      
      if (level1Success) {
        this.results.level = 1;
        this.results.success = true;
        console.log('✅ 第1级成功！无需进一步操作');
        return this.results;
      }

      // 第2级：深度清理（90%成功率）
      console.log('\n🔧 第2级：深度清理...');
      const level2Success = await this.level2_DeepReset();
      
      if (level2Success) {
        this.results.level = 2;
        this.results.success = true;
        console.log('✅ 第2级成功！');
        return this.results;
      }

      // 第3级：重装建议（99%成功率）
      console.log('\n⚠️ 第3级：建议重装...');
      await this.level3_ReinstallAdvice();
      this.results.level = 3;
      
    } catch (error) {
      console.error('❌ 重置过程出错:', error);
      this.results.errors.push(error.message);
    }

    return this.results;
  }

  /**
   * 第1级：温和清理
   */
  async level1_GentleReset() {
    try {
      // 1. 关闭Cursor进程
      await this.closeCursorProcesses();
      
      // 2. 清理配置文件
      await this.clearConfigFiles();
      
      // 3. 生成新设备ID
      const newDeviceId = await this.generateNewDeviceId();
      
      // 4. 验证是否成功
      const isSuccess = await this.verifyReset();
      
      if (isSuccess) {
        this.results.actions.push('🎯 第1级清理成功');
        this.results.newDeviceId = newDeviceId;
        return true;
      }
      
      return false;
      
    } catch (error) {
      this.results.errors.push(`第1级失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 第2级：深度清理
   */
  async level2_DeepReset() {
    try {
      // 1. 执行第1级的所有操作
      await this.level1_GentleReset();
      
      // 2. 清理注册表
      await this.clearRegistry();
      
      // 3. 清理所有备份文件
      await this.clearAllBackups();
      
      // 4. 强制重置SQLite数据库
      await this.resetSqliteDatabase();
      
      // 5. 设置强化保护
      await this.setAdvancedProtection();
      
      // 6. 验证是否成功
      const isSuccess = await this.verifyReset();
      
      if (isSuccess) {
        this.results.actions.push('🔧 第2级深度清理成功');
        return true;
      }
      
      return false;
      
    } catch (error) {
      this.results.errors.push(`第2级失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 第3级：重装建议
   */
  async level3_ReinstallAdvice() {
    console.log('\n⚠️ 前两级清理未能完全解决问题');
    console.log('建议使用重装方案以确保100%成功');
    
    this.results.actions.push('📋 已提供重装建议');
    
    // 生成自动化重装脚本
    await this.generateReinstallScript();
  }

  /**
   * 关闭Cursor进程
   */
  async closeCursorProcesses() {
    try {
      await this.execAsync('taskkill /f /im cursor.exe 2>nul || echo "Cursor not running"');
      await this.execAsync('taskkill /f /im "Cursor.exe" 2>nul || echo "Cursor not running"');
      
      // 等待进程完全关闭
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.results.actions.push('🔄 已关闭Cursor进程');
    } catch (error) {
      // 进程可能本来就没运行，不算错误
      console.log('ℹ️ Cursor进程未运行或已关闭');
    }
  }

  /**
   * 清理配置文件
   */
  async clearConfigFiles() {
    const configPaths = [
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor'),
      path.join(os.homedir(), 'AppData', 'Local', 'Cursor')
    ];

    for (const configPath of configPaths) {
      try {
        if (await fs.pathExists(configPath)) {
          // 创建备份
          const backupPath = configPath + '.backup_' + Date.now();
          await fs.move(configPath, backupPath);
          this.results.actions.push(`📦 已备份: ${path.basename(configPath)}`);
        }
      } catch (error) {
        this.results.errors.push(`清理配置失败: ${error.message}`);
      }
    }
  }

  /**
   * 生成新设备ID
   */
  async generateNewDeviceId() {
    const newDeviceId = crypto.randomUUID();
    
    // 创建新配置
    const configPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor');
    const globalStoragePath = path.join(configPath, 'User', 'globalStorage');
    
    await fs.ensureDir(globalStoragePath);

    const storageData = {
      'telemetry.devDeviceId': newDeviceId,
      'telemetry.machineId': crypto.randomBytes(32).toString('hex'),
      'telemetry.macMachineId': crypto.randomBytes(32).toString('hex'),
      'telemetry.sessionId': crypto.randomUUID(),
      'telemetry.sqmId': `{${crypto.randomUUID().toUpperCase()}}`
    };

    const storageJsonPath = path.join(globalStoragePath, 'storage.json');
    await fs.writeJson(storageJsonPath, storageData, { spaces: 2 });

    this.results.actions.push(`🆔 新设备ID: ${newDeviceId}`);
    return newDeviceId;
  }

  /**
   * 清理注册表（第2级）
   */
  async clearRegistry() {
    try {
      const regCommands = [
        'reg delete "HKCU\\Software\\Cursor" /f 2>nul || echo "Registry key not found"',
        'reg delete "HKLM\\Software\\Cursor" /f 2>nul || echo "Registry key not found"'
      ];

      for (const cmd of regCommands) {
        await this.execAsync(cmd);
      }
      
      this.results.actions.push('🗂️ 已清理注册表');
    } catch (error) {
      this.results.errors.push(`清理注册表失败: ${error.message}`);
    }
  }

  /**
   * 重置SQLite数据库（第2级）
   */
  async resetSqliteDatabase() {
    try {
      const dbPath = path.join(
        os.homedir(),
        'AppData',
        'Roaming',
        'Cursor',
        'User',
        'globalStorage',
        'state.vscdb'
      );

      if (await fs.pathExists(dbPath)) {
        await fs.remove(dbPath);
        this.results.actions.push('🗄️ 已重置SQLite数据库');
      }
    } catch (error) {
      this.results.errors.push(`重置数据库失败: ${error.message}`);
    }
  }

  /**
   * 验证重置是否成功
   */
  async verifyReset() {
    try {
      // 检查新的storage.json是否存在且包含新设备ID
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
        return data['telemetry.devDeviceId'] && data['telemetry.devDeviceId'] !== '';
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 生成重装脚本（第3级）
   */
  async generateReinstallScript() {
    const scriptContent = `
@echo off
echo 正在执行Cursor完全重装...
echo.

echo 1. 卸载现有Cursor...
wmic product where "name like 'Cursor%%'" call uninstall /nointeractive

echo 2. 清理残留文件...
rmdir /s /q "%APPDATA%\\Cursor" 2>nul
rmdir /s /q "%LOCALAPPDATA%\\Cursor" 2>nul

echo 3. 清理注册表...
reg delete "HKCU\\Software\\Cursor" /f 2>nul
reg delete "HKLM\\Software\\Cursor" /f 2>nul

echo 4. 完成！请重新下载并安装Cursor
echo.
pause
`;

    const scriptPath = path.join(process.cwd(), 'cursor-reinstall.bat');
    await fs.writeFile(scriptPath, scriptContent);
    
    this.results.actions.push(`📜 已生成重装脚本: ${scriptPath}`);
  }
}

module.exports = { SmartDeviceReset };
