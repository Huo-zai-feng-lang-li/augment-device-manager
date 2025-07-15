/**
 * 手动停止增强防护
 * 用于立即停止所有增强防护服务和进程
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class GuardianStopper {
  constructor() {
    this.results = {
      actions: [],
      errors: [],
      processes: []
    };
  }

  async stopAllGuardianServices() {
    console.log('🛑 手动停止所有增强防护服务...\n');
    
    try {
      // 1. 停止独立守护服务进程
      await this.stopStandaloneServices();
      
      // 2. 清理配置文件
      await this.cleanupConfigFiles();
      
      // 3. 终止相关Node.js进程
      await this.killGuardianProcesses();
      
      // 4. 显示结果
      this.displayResults();
      
    } catch (error) {
      console.error('❌ 停止增强防护失败:', error.message);
    }
  }

  async stopStandaloneServices() {
    console.log('1️⃣ 停止独立守护服务...');
    
    try {
      // 检查并删除PID文件
      const pidPath = path.join(os.tmpdir(), 'augment-guardian.pid');
      if (await fs.pathExists(pidPath)) {
        try {
          const pid = await fs.readFile(pidPath, 'utf8');
          console.log(`   发现PID文件: ${pid.trim()}`);
          
          // 尝试终止进程
          try {
            process.kill(parseInt(pid.trim()), 'SIGTERM');
            this.results.actions.push(`终止PID ${pid.trim()} 进程`);
            console.log(`   ✅ 已发送终止信号给进程 ${pid.trim()}`);
          } catch (killError) {
            console.log(`   ⚠️ 进程 ${pid.trim()} 可能已经停止`);
          }
          
          // 删除PID文件
          await fs.remove(pidPath);
          this.results.actions.push('删除PID文件');
          console.log('   ✅ 已删除PID文件');
        } catch (error) {
          this.results.errors.push(`处理PID文件失败: ${error.message}`);
        }
      } else {
        console.log('   ℹ️ 未发现PID文件');
      }
      
      // 检查并删除配置文件
      const configPath = path.join(os.tmpdir(), 'augment-guardian-config.json');
      if (await fs.pathExists(configPath)) {
        await fs.remove(configPath);
        this.results.actions.push('删除独立服务配置文件');
        console.log('   ✅ 已删除独立服务配置文件');
      }
      
      // 检查并删除日志文件
      const logPath = path.join(os.tmpdir(), 'augment-guardian.log');
      if (await fs.pathExists(logPath)) {
        await fs.remove(logPath);
        this.results.actions.push('删除独立服务日志文件');
        console.log('   ✅ 已删除独立服务日志文件');
      }
      
    } catch (error) {
      this.results.errors.push(`停止独立服务失败: ${error.message}`);
      console.error('   ❌ 停止独立服务失败:', error.message);
    }
  }

  async cleanupConfigFiles() {
    console.log('\n2️⃣ 清理配置文件...');
    
    try {
      // 不删除主配置文件，只是提示
      const configDir = path.join(os.homedir(), '.augment-device-manager');
      const configFile = path.join(configDir, 'config.json');
      
      if (await fs.pathExists(configFile)) {
        console.log('   ℹ️ 主配置文件存在，保持不变');
        console.log(`   📁 配置文件: ${configFile}`);
      }
      
    } catch (error) {
      this.results.errors.push(`清理配置文件失败: ${error.message}`);
    }
  }

  async killGuardianProcesses() {
    console.log('\n3️⃣ 查找并终止相关进程...');
    
    try {
      // Windows系统查找进程
      if (process.platform === 'win32') {
        const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV');
        const lines = stdout.split('\n');
        
        for (const line of lines) {
          if (line.includes('node.exe')) {
            const parts = line.split(',');
            if (parts.length >= 2) {
              const pid = parts[1].replace(/"/g, '');
              
              // 检查是否是守护进程
              try {
                const { stdout: cmdline } = await execAsync(`wmic process where processid=${pid} get commandline /value`);
                if (cmdline.includes('standalone-guardian') || cmdline.includes('enhanced-device-guardian')) {
                  console.log(`   🎯 发现守护进程: PID ${pid}`);
                  
                  try {
                    await execAsync(`taskkill /PID ${pid} /F`);
                    this.results.actions.push(`强制终止守护进程 PID ${pid}`);
                    console.log(`   ✅ 已终止守护进程 PID ${pid}`);
                  } catch (killError) {
                    this.results.errors.push(`终止进程 ${pid} 失败: ${killError.message}`);
                  }
                }
              } catch (cmdError) {
                // 忽略命令行查询错误
              }
            }
          }
        }
      } else {
        // Unix/Linux/macOS系统
        try {
          const { stdout } = await execAsync('ps aux | grep -E "(standalone-guardian|enhanced-device-guardian)" | grep -v grep');
          const lines = stdout.trim().split('\n');
          
          for (const line of lines) {
            if (line.trim()) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[1];
              console.log(`   🎯 发现守护进程: PID ${pid}`);
              
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
      
    } catch (error) {
      this.results.errors.push(`查找进程失败: ${error.message}`);
      console.error('   ❌ 查找进程失败:', error.message);
    }
  }

  displayResults() {
    console.log('\n📊 停止结果汇总:');
    
    if (this.results.actions.length > 0) {
      console.log('\n✅ 成功操作:');
      this.results.actions.forEach(action => {
        console.log(`   - ${action}`);
      });
    }
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ 错误信息:');
      this.results.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    }
    
    if (this.results.actions.length === 0 && this.results.errors.length === 0) {
      console.log('   ℹ️ 未发现运行中的增强防护服务');
    }
    
    console.log('\n💡 后续建议:');
    console.log('   1. 重启客户端应用以确保状态同步');
    console.log('   2. 检查客户端UI确认增强防护已停止');
    console.log('   3. 如需重新启动，请通过客户端界面操作');
    
    console.log('\n🔍 验证命令:');
    if (process.platform === 'win32') {
      console.log('   tasklist | findstr node');
    } else {
      console.log('   ps aux | grep node');
    }
  }
}

// 执行停止操作
async function main() {
  const stopper = new GuardianStopper();
  await stopper.stopAllGuardianServices();
}

// 运行脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = GuardianStopper;
