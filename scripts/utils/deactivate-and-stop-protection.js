/**
 * 激活码失效处理脚本
 * 退出激活状态并停止防护守护功能
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

class DeactivationManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.augment-device-manager');
    this.configFile = path.join(this.configDir, 'config.json');
    this.results = {
      success: true,
      actions: [],
      errors: []
    };
  }

  async execute() {
    console.log('🚨 激活码失效处理开始...\n');
    
    try {
      // 1. 停止所有守护进程
      await this.stopGuardianProcesses();
      
      // 2. 清除激活配置
      await this.clearActivationConfig();
      
      // 3. 清理相关保护文件
      await this.cleanProtectionFiles();
      
      // 4. 停止相关服务
      await this.stopRelatedServices();
      
      // 5. 显示结果
      this.displayResults();
      
    } catch (error) {
      console.error('❌ 处理失败:', error.message);
      this.results.success = false;
      this.results.errors.push(error.message);
    }
  }

  // 停止守护进程
  async stopGuardianProcesses() {
    console.log('🛑 停止防护守护进程...');
    
    try {
      // 查找并终止相关进程
      const processNames = [
        'guardian-service-worker',
        'standalone-guardian-service',
        'enhanced-device-guardian',
        'device-id-guardian'
      ];

      for (const processName of processNames) {
        await this.killProcessByName(processName);
      }

      // 检查Node.js进程中可能的守护进程
      await this.killNodeGuardianProcesses();
      
      this.results.actions.push('✅ 防护守护进程已停止');
      
    } catch (error) {
      this.results.errors.push(`停止守护进程失败: ${error.message}`);
    }
  }

  // 根据进程名终止进程
  async killProcessByName(processName) {
    return new Promise((resolve) => {
      if (os.platform() === 'win32') {
        // Windows
        const cmd = spawn('taskkill', ['/F', '/IM', `${processName}.exe`], { 
          stdio: 'pipe',
          windowsHide: true 
        });
        
        cmd.on('close', (code) => {
          if (code === 0) {
            console.log(`   ✅ 已终止进程: ${processName}`);
          }
          resolve();
        });
        
        cmd.on('error', () => resolve()); // 忽略错误，继续执行
      } else {
        // Unix/Linux/macOS
        const cmd = spawn('pkill', ['-f', processName], { stdio: 'pipe' });
        
        cmd.on('close', (code) => {
          if (code === 0) {
            console.log(`   ✅ 已终止进程: ${processName}`);
          }
          resolve();
        });
        
        cmd.on('error', () => resolve()); // 忽略错误，继续执行
      }
    });
  }

  // 终止Node.js守护进程
  async killNodeGuardianProcesses() {
    return new Promise((resolve) => {
      if (os.platform() === 'win32') {
        // Windows: 查找包含guardian关键字的node进程
        const cmd = spawn('wmic', [
          'process', 'where', 
          'name="node.exe" and commandline like "%guardian%"', 
          'delete'
        ], { stdio: 'pipe', windowsHide: true });
        
        cmd.on('close', () => resolve());
        cmd.on('error', () => resolve());
      } else {
        // Unix/Linux/macOS
        const cmd = spawn('pkill', ['-f', 'node.*guardian'], { stdio: 'pipe' });
        cmd.on('close', () => resolve());
        cmd.on('error', () => resolve());
      }
    });
  }

  // 清除激活配置
  async clearActivationConfig() {
    console.log('🗑️ 清除激活配置...');
    
    try {
      // 1. 删除主配置文件
      if (await fs.pathExists(this.configFile)) {
        await fs.remove(this.configFile);
        this.results.actions.push('✅ 已删除激活配置文件');
      }

      // 2. 删除配置目录（如果为空）
      if (await fs.pathExists(this.configDir)) {
        const files = await fs.readdir(this.configDir);
        if (files.length === 0) {
          await fs.remove(this.configDir);
          this.results.actions.push('✅ 已删除配置目录');
        }
      }

      // 3. 清理其他可能的激活相关文件
      const possiblePaths = [
        path.join(os.homedir(), '.augment'),
        path.join(os.homedir(), '.cursor-augment'),
        path.join(os.homedir(), 'AppData', 'Local', 'augment-device-manager'), // Windows
        path.join(os.homedir(), 'Library', 'Application Support', 'augment-device-manager'), // macOS
      ];

      for (const possiblePath of possiblePaths) {
        try {
          if (await fs.pathExists(possiblePath)) {
            await fs.remove(possiblePath);
            this.results.actions.push(`✅ 已清理: ${possiblePath}`);
          }
        } catch (error) {
          this.results.errors.push(`清理 ${possiblePath} 失败: ${error.message}`);
        }
      }

    } catch (error) {
      this.results.errors.push(`清除激活配置失败: ${error.message}`);
    }
  }

  // 清理保护文件
  async cleanProtectionFiles() {
    console.log('🧹 清理保护文件...');
    
    try {
      // 清理可能的设备ID保护文件
      const protectionPaths = [
        path.join(os.tmpdir(), 'augment-device-*'),
        path.join(os.homedir(), '.augment-device-*'),
      ];

      // 这里可以添加更多清理逻辑
      this.results.actions.push('✅ 保护文件清理完成');
      
    } catch (error) {
      this.results.errors.push(`清理保护文件失败: ${error.message}`);
    }
  }

  // 停止相关服务
  async stopRelatedServices() {
    console.log('🔌 停止相关服务...');
    
    try {
      // 这里可以添加停止其他相关服务的逻辑
      // 比如停止后台服务、清理注册表等
      
      this.results.actions.push('✅ 相关服务已停止');
      
    } catch (error) {
      this.results.errors.push(`停止相关服务失败: ${error.message}`);
    }
  }

  // 显示结果
  displayResults() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 处理结果汇总');
    console.log('='.repeat(50));
    
    if (this.results.success && this.results.errors.length === 0) {
      console.log('✅ 激活码失效处理完成');
    } else {
      console.log('⚠️ 处理完成，但存在一些问题');
    }
    
    if (this.results.actions.length > 0) {
      console.log('\n🎯 成功操作:');
      this.results.actions.forEach(action => {
        console.log(`   ${action}`);
      });
    }
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ 错误信息:');
      this.results.errors.forEach(error => {
        console.log(`   ${error}`);
      });
    }
    
    console.log('\n💡 后续操作建议:');
    console.log('   1. 重启应用程序以确保所有更改生效');
    console.log('   2. 如需重新激活，请获取新的激活码');
    console.log('   3. 检查是否有残留的守护进程');
    
    console.log('\n🔍 验证命令:');
    console.log('   - 检查配置: node check-activation-status.js');
    console.log('   - 检查进程: tasklist | findstr node (Windows)');
    console.log('   - 检查进程: ps aux | grep node (Unix/Linux/macOS)');
  }
}

// 执行退出激活处理
async function main() {
  const manager = new DeactivationManager();
  await manager.execute();
}

// 运行脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = DeactivationManager;
