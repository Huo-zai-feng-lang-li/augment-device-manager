#!/usr/bin/env node

/**
 * 增强防护进程管理修复工具
 * 
 * 功能：
 * 1. 清理孤立的守护进程
 * 2. 重置配置文件和状态
 * 3. 修复状态不一致问题
 * 4. 安全重启防护服务
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ProcessManagementFixer {
  constructor() {
    this.results = {
      actions: [],
      errors: [],
      warnings: []
    };
    
    // 相关文件路径
    this.paths = {
      configDir: path.join(os.homedir(), '.augment-device-manager'),
      standaloneConfig: path.join(os.homedir(), '.augment-device-manager', 'standalone-guardian-config.json'),
      standalonePid: path.join(os.homedir(), '.augment-device-manager', 'standalone-guardian.pid'),
      standaloneLog: path.join(os.homedir(), '.augment-device-manager', 'standalone-guardian.log'),
      storageJson: path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'storage.json')
    };
  }

  /**
   * 执行完整修复
   */
  async runFix(options = {}) {
    console.log('🔧 开始增强防护进程管理修复...\n');
    
    try {
      // 1. 停止所有相关进程
      if (options.stopProcesses !== false) {
        await this.stopAllGuardianProcesses();
      }
      
      // 2. 清理配置文件
      if (options.cleanConfigs !== false) {
        await this.cleanConfigurationFiles();
      }
      
      // 3. 重置状态信息
      if (options.resetState !== false) {
        await this.resetStateInformation();
      }
      
      // 4. 验证清理结果
      await this.verifyCleanupResults();
      
      // 5. 生成修复报告
      this.generateFixReport();
      
      return {
        success: true,
        actions: this.results.actions,
        errors: this.results.errors,
        warnings: this.results.warnings
      };
      
    } catch (error) {
      console.error('❌ 修复过程中发生错误:', error.message);
      this.results.errors.push(`修复失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
        actions: this.results.actions,
        errors: this.results.errors
      };
    }
  }

  /**
   * 停止所有守护进程
   */
  async stopAllGuardianProcesses() {
    console.log('🛑 1. 停止所有守护进程...');
    
    try {
      const processNames = [
        'standalone-guardian-service',
        'guardian-service-worker', 
        'enhanced-device-guardian'
      ];
      
      if (os.platform() === 'win32') {
        // Windows系统
        const { stdout } = await execAsync('wmic process get processid,commandline /format:csv');
        const lines = stdout.split('\n').filter(line => line.trim());
        
        let killedCount = 0;
        for (const line of lines) {
          if (line.includes('node.exe')) {
            const parts = line.split(',');
            if (parts.length >= 2) {
              const pid = parts[1].replace(/"/g, '');
              const commandLine = parts[2] || '';
              
              // 检查是否是守护进程
              if (processNames.some(name => commandLine.includes(name))) {
                try {
                  await execAsync(`taskkill /PID ${pid} /F`);
                  this.results.actions.push(`强制终止守护进程 PID ${pid}`);
                  console.log(`   ✅ 已终止守护进程 PID ${pid}`);
                  killedCount++;
                } catch (killError) {
                  this.results.errors.push(`终止进程 ${pid} 失败: ${killError.message}`);
                  console.log(`   ❌ 终止进程 ${pid} 失败: ${killError.message}`);
                }
              }
            }
          }
        }
        
        // 额外尝试终止所有node进程（谨慎操作）
        if (killedCount === 0) {
          console.log('   🔄 尝试终止所有Node.js进程...');
          try {
            await execAsync('taskkill /F /IM node.exe 2>nul');
            this.results.actions.push('终止所有Node.js进程');
            this.results.warnings.push('已终止所有Node.js进程，可能影响其他Node应用');
          } catch (error) {
            // 忽略错误，可能没有node进程在运行
          }
        }
        
      } else {
        // Unix/Linux/macOS系统
        try {
          const { stdout } = await execAsync('ps aux | grep -E "(standalone-guardian|enhanced-device-guardian|guardian-service-worker)" | grep -v grep');
          const lines = stdout.trim().split('\n');
          
          for (const line of lines) {
            if (line.trim()) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[1];
              
              try {
                await execAsync(`kill -TERM ${pid}`);
                this.results.actions.push(`终止守护进程 PID ${pid}`);
                console.log(`   ✅ 已终止守护进程 PID ${pid}`);
              } catch (killError) {
                this.results.errors.push(`终止进程 ${pid} 失败: ${killError.message}`);
              }
            }
          }
        } catch (psError) {
          console.log('   ℹ️ 未发现相关守护进程');
        }
      }
      
      // 等待进程完全退出
      console.log('   ⏳ 等待进程完全退出...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      this.results.errors.push(`停止进程失败: ${error.message}`);
      console.error('   ❌ 停止进程失败:', error.message);
    }
  }

  /**
   * 清理配置文件
   */
  async cleanConfigurationFiles() {
    console.log('\n🧹 2. 清理配置文件...');
    
    const filesToClean = [
      { name: '独立服务配置', path: this.paths.standaloneConfig },
      { name: '独立服务PID', path: this.paths.standalonePid },
      { name: '独立服务日志', path: this.paths.standaloneLog }
    ];
    
    for (const file of filesToClean) {
      try {
        if (await fs.pathExists(file.path)) {
          await fs.remove(file.path);
          this.results.actions.push(`删除${file.name}文件`);
          console.log(`   ✅ 已删除: ${file.name}`);
        } else {
          console.log(`   ℹ️ 文件不存在: ${file.name}`);
        }
      } catch (error) {
        this.results.errors.push(`删除${file.name}失败: ${error.message}`);
        console.log(`   ❌ 删除${file.name}失败: ${error.message}`);
      }
    }
  }

  /**
   * 重置状态信息
   */
  async resetStateInformation() {
    console.log('\n🔄 3. 重置状态信息...');
    
    try {
      // 确保配置目录存在
      if (!(await fs.pathExists(this.paths.configDir))) {
        await fs.ensureDir(this.paths.configDir);
        this.results.actions.push('创建配置目录');
        console.log('   ✅ 已创建配置目录');
      }
      
      // 创建状态重置标记文件
      const resetMarkerPath = path.join(this.paths.configDir, 'process-reset.marker');
      await fs.writeFile(resetMarkerPath, JSON.stringify({
        resetTime: new Date().toISOString(),
        resetBy: 'process-management-fixer',
        reason: 'Fix process management issues'
      }, null, 2));
      
      this.results.actions.push('创建状态重置标记');
      console.log('   ✅ 已创建状态重置标记');
      
    } catch (error) {
      this.results.errors.push(`重置状态失败: ${error.message}`);
      console.log(`   ❌ 重置状态失败: ${error.message}`);
    }
  }

  /**
   * 验证清理结果
   */
  async verifyCleanupResults() {
    console.log('\n✅ 4. 验证清理结果...');
    
    try {
      // 检查是否还有运行中的进程
      let remainingProcesses = 0;
      
      if (os.platform() === 'win32') {
        try {
          const { stdout } = await execAsync('wmic process get commandline /format:csv');
          const lines = stdout.split('\n');
          
          for (const line of lines) {
            if (line.includes('node.exe') && 
                (line.includes('standalone-guardian') || 
                 line.includes('enhanced-device-guardian') ||
                 line.includes('guardian-service-worker'))) {
              remainingProcesses++;
            }
          }
        } catch (error) {
          // 忽略错误
        }
      } else {
        try {
          const { stdout } = await execAsync('ps aux | grep -E "(standalone-guardian|enhanced-device-guardian|guardian-service-worker)" | grep -v grep');
          remainingProcesses = stdout.trim().split('\n').filter(line => line.trim()).length;
        } catch (error) {
          // 没有找到进程，这是好事
          remainingProcesses = 0;
        }
      }
      
      if (remainingProcesses === 0) {
        console.log('   ✅ 所有守护进程已停止');
        this.results.actions.push('验证：所有守护进程已停止');
      } else {
        console.log(`   ⚠️ 仍有 ${remainingProcesses} 个进程在运行`);
        this.results.warnings.push(`仍有 ${remainingProcesses} 个守护进程在运行`);
      }
      
      // 检查配置文件是否已清理
      const configFiles = [this.paths.standaloneConfig, this.paths.standalonePid, this.paths.standaloneLog];
      let remainingFiles = 0;
      
      for (const filePath of configFiles) {
        if (await fs.pathExists(filePath)) {
          remainingFiles++;
        }
      }
      
      if (remainingFiles === 0) {
        console.log('   ✅ 所有配置文件已清理');
        this.results.actions.push('验证：所有配置文件已清理');
      } else {
        console.log(`   ⚠️ 仍有 ${remainingFiles} 个配置文件存在`);
        this.results.warnings.push(`仍有 ${remainingFiles} 个配置文件未清理`);
      }
      
    } catch (error) {
      this.results.errors.push(`验证清理结果失败: ${error.message}`);
      console.log(`   ❌ 验证失败: ${error.message}`);
    }
  }

  /**
   * 生成修复报告
   */
  generateFixReport() {
    console.log('\n📋 修复报告');
    console.log('='.repeat(50));
    
    // 执行的操作
    console.log('\n✅ 执行的操作:');
    if (this.results.actions.length === 0) {
      console.log('   无需执行操作');
    } else {
      this.results.actions.forEach(action => {
        console.log(`   • ${action}`);
      });
    }
    
    // 警告信息
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️ 警告信息:');
      this.results.warnings.forEach(warning => {
        console.log(`   • ${warning}`);
      });
    }
    
    // 错误信息
    if (this.results.errors.length > 0) {
      console.log('\n❌ 错误信息:');
      this.results.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
    }
    
    // 后续建议
    console.log('\n💡 后续建议:');
    console.log('   • 重启桌面客户端以确保状态同步');
    console.log('   • 重新启动增强防护功能');
    console.log('   • 验证防护功能是否正常工作');
    console.log('   • 定期运行诊断工具检查系统状态');
    
    console.log('\n' + '='.repeat(50));
    
    const successRate = this.results.errors.length === 0 ? 100 : 
                       Math.round((this.results.actions.length / (this.results.actions.length + this.results.errors.length)) * 100);
    
    console.log(`\n🎯 修复完成率: ${successRate}%`);
    
    if (successRate === 100) {
      console.log('🎉 修复成功！建议重启客户端以确保状态同步。');
    } else {
      console.log('⚠️ 修复部分完成，请检查错误信息并手动处理剩余问题。');
    }
  }

  /**
   * 快速修复（仅停止进程和清理文件）
   */
  async quickFix() {
    console.log('⚡ 执行快速修复...\n');
    
    return await this.runFix({
      stopProcesses: true,
      cleanConfigs: true,
      resetState: false
    });
  }

  /**
   * 完全重置（停止进程、清理文件、重置状态）
   */
  async fullReset() {
    console.log('🔄 执行完全重置...\n');
    
    return await this.runFix({
      stopProcesses: true,
      cleanConfigs: true,
      resetState: true
    });
  }
}

// 命令行接口
if (require.main === module) {
  const args = process.argv.slice(2);
  const fixer = new ProcessManagementFixer();
  
  if (args.includes('--quick')) {
    fixer.quickFix().catch(console.error);
  } else if (args.includes('--full')) {
    fixer.fullReset().catch(console.error);
  } else {
    console.log('增强防护进程管理修复工具');
    console.log('');
    console.log('用法:');
    console.log('  node fix-process-management.js --quick   # 快速修复');
    console.log('  node fix-process-management.js --full    # 完全重置');
    console.log('');
    
    // 默认执行快速修复
    fixer.quickFix().catch(console.error);
  }
}

module.exports = ProcessManagementFixer;
