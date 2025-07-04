#!/usr/bin/env node

/**
 * 增强防护进程管理诊断工具
 * 
 * 功能：
 * 1. 检查所有相关守护进程状态
 * 2. 验证进程与配置文件的一致性
 * 3. 测试实际防护功能
 * 4. 清理孤立进程
 * 5. 修复状态不一致问题
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ProcessManagementDiagnostic {
  constructor() {
    this.results = {
      processes: [],
      configs: [],
      issues: [],
      recommendations: []
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
   * 执行完整诊断
   */
  async runDiagnosis() {
    console.log('🔍 开始增强防护进程管理诊断...\n');
    
    try {
      // 1. 检查运行中的进程
      await this.checkRunningProcesses();
      
      // 2. 检查配置文件状态
      await this.checkConfigurationFiles();
      
      // 3. 验证进程与配置的一致性
      await this.validateProcessConfigConsistency();
      
      // 4. 测试实际防护功能
      await this.testActualProtection();
      
      // 5. 分析问题并提供建议
      await this.analyzeIssuesAndRecommendations();
      
      // 6. 生成诊断报告
      this.generateDiagnosticReport();
      
    } catch (error) {
      console.error('❌ 诊断过程中发生错误:', error.message);
    }
  }

  /**
   * 检查运行中的进程
   */
  async checkRunningProcesses() {
    console.log('📋 1. 检查运行中的守护进程...');
    
    try {
      if (os.platform() === 'win32') {
        // Windows系统
        const { stdout } = await execAsync('wmic process get processid,commandline /format:csv');
        const lines = stdout.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.includes('node.exe') && 
              (line.includes('standalone-guardian') || 
               line.includes('enhanced-device-guardian') ||
               line.includes('guardian-service-worker'))) {
            
            const parts = line.split(',');
            if (parts.length >= 2) {
              const pid = parts[1].replace(/"/g, '');
              const commandLine = parts[2] || '';
              
              this.results.processes.push({
                pid: pid,
                type: this.identifyProcessType(commandLine),
                commandLine: commandLine,
                platform: 'win32'
              });
              
              console.log(`   🎯 发现守护进程: PID ${pid}`);
              console.log(`      类型: ${this.identifyProcessType(commandLine)}`);
              console.log(`      命令: ${commandLine.substring(0, 100)}...`);
            }
          }
        }
      } else {
        // Unix/Linux/macOS系统
        const { stdout } = await execAsync('ps aux | grep -E "(standalone-guardian|enhanced-device-guardian|guardian-service-worker)" | grep -v grep');
        const lines = stdout.trim().split('\n');
        
        for (const line of lines) {
          if (line.trim()) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[1];
            const command = parts.slice(10).join(' ');
            
            this.results.processes.push({
              pid: pid,
              type: this.identifyProcessType(command),
              commandLine: command,
              platform: 'unix'
            });
            
            console.log(`   🎯 发现守护进程: PID ${pid}`);
            console.log(`      类型: ${this.identifyProcessType(command)}`);
          }
        }
      }
      
      if (this.results.processes.length === 0) {
        console.log('   ℹ️ 未发现运行中的守护进程');
      } else {
        console.log(`   ✅ 发现 ${this.results.processes.length} 个守护进程`);
      }
      
    } catch (error) {
      console.log('   ❌ 检查进程失败:', error.message);
      this.results.issues.push(`进程检查失败: ${error.message}`);
    }
  }

  /**
   * 识别进程类型
   */
  identifyProcessType(commandLine) {
    if (commandLine.includes('standalone-guardian-service')) {
      return 'standalone-service';
    } else if (commandLine.includes('guardian-service-worker')) {
      return 'service-worker';
    } else if (commandLine.includes('enhanced-device-guardian')) {
      return 'enhanced-guardian';
    } else {
      return 'unknown';
    }
  }

  /**
   * 检查配置文件状态
   */
  async checkConfigurationFiles() {
    console.log('\n📁 2. 检查配置文件状态...');
    
    // 检查独立服务配置
    await this.checkFile('独立服务配置', this.paths.standaloneConfig);
    await this.checkFile('独立服务PID', this.paths.standalonePid);
    await this.checkFile('独立服务日志', this.paths.standaloneLog);
    await this.checkFile('Cursor存储配置', this.paths.storageJson);
  }

  /**
   * 检查单个文件
   */
  async checkFile(name, filePath) {
    try {
      if (await fs.pathExists(filePath)) {
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf8');
        
        this.results.configs.push({
          name: name,
          path: filePath,
          exists: true,
          size: stats.size,
          modified: stats.mtime,
          content: content.length > 1000 ? content.substring(0, 1000) + '...' : content
        });
        
        console.log(`   ✅ ${name}: 存在 (${stats.size} bytes, 修改时间: ${stats.mtime.toLocaleString()})`);
        
        // 特殊处理PID文件
        if (name.includes('PID')) {
          const pid = content.trim();
          console.log(`      PID: ${pid}`);
          
          // 验证PID是否有效
          const isValidPid = await this.validatePid(pid);
          console.log(`      PID有效性: ${isValidPid ? '✅ 有效' : '❌ 无效'}`);
          
          if (!isValidPid) {
            this.results.issues.push(`PID文件包含无效PID: ${pid}`);
          }
        }
        
      } else {
        this.results.configs.push({
          name: name,
          path: filePath,
          exists: false
        });
        console.log(`   ❌ ${name}: 不存在`);
      }
    } catch (error) {
      console.log(`   ⚠️ ${name}: 检查失败 - ${error.message}`);
      this.results.issues.push(`${name}检查失败: ${error.message}`);
    }
  }

  /**
   * 验证PID是否有效
   */
  async validatePid(pid) {
    try {
      if (os.platform() === 'win32') {
        const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV`);
        return stdout.includes(pid);
      } else {
        const { stdout } = await execAsync(`ps -p ${pid}`);
        return stdout.includes(pid);
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证进程与配置的一致性
   */
  async validateProcessConfigConsistency() {
    console.log('\n🔄 3. 验证进程与配置的一致性...');
    
    // 检查PID文件与实际进程的一致性
    const pidConfig = this.results.configs.find(c => c.name.includes('PID') && c.exists);
    const runningProcesses = this.results.processes;
    
    if (pidConfig && runningProcesses.length > 0) {
      const configPid = pidConfig.content.trim();
      const actualPids = runningProcesses.map(p => p.pid);
      
      if (actualPids.includes(configPid)) {
        console.log('   ✅ PID文件与运行进程一致');
      } else {
        console.log('   ❌ PID文件与运行进程不一致');
        console.log(`      配置PID: ${configPid}`);
        console.log(`      实际PID: ${actualPids.join(', ')}`);
        this.results.issues.push('PID文件与实际运行进程不一致');
      }
    } else if (pidConfig && runningProcesses.length === 0) {
      console.log('   ⚠️ 存在PID文件但无运行进程（孤立PID文件）');
      this.results.issues.push('存在孤立的PID文件');
    } else if (!pidConfig && runningProcesses.length > 0) {
      console.log('   ⚠️ 存在运行进程但无PID文件（孤立进程）');
      this.results.issues.push('存在孤立的运行进程');
    } else {
      console.log('   ℹ️ 无PID文件且无运行进程');
    }
  }

  /**
   * 测试实际防护功能
   */
  async testActualProtection() {
    console.log('\n🧪 4. 测试实际防护功能...');
    
    try {
      if (!(await fs.pathExists(this.paths.storageJson))) {
        console.log('   ⚠️ storage.json文件不存在，跳过防护测试');
        return;
      }
      
      // 读取当前设备ID
      const originalContent = await fs.readJson(this.paths.storageJson);
      const originalDeviceId = originalContent['telemetry.devDeviceId'];
      
      console.log(`   📋 当前设备ID: ${originalDeviceId}`);
      
      // 尝试修改设备ID
      const testDeviceId = `test-protection-${Date.now()}`;
      console.log(`   🔧 尝试修改为: ${testDeviceId}`);
      
      originalContent['telemetry.devDeviceId'] = testDeviceId;
      await fs.writeJson(this.paths.storageJson, originalContent, { spaces: 2 });
      
      // 等待防护系统响应
      console.log('   ⏳ 等待防护系统响应...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 检查是否被恢复
      const modifiedContent = await fs.readJson(this.paths.storageJson);
      const currentDeviceId = modifiedContent['telemetry.devDeviceId'];
      
      if (currentDeviceId === testDeviceId) {
        console.log('   ❌ 防护功能未生效（设备ID未被恢复）');
        this.results.issues.push('防护功能未生效');
        
        // 手动恢复原始ID
        originalContent['telemetry.devDeviceId'] = originalDeviceId;
        await fs.writeJson(this.paths.storageJson, originalContent, { spaces: 2 });
      } else {
        console.log('   ✅ 防护功能正常（设备ID已被恢复）');
        console.log(`   📋 恢复后设备ID: ${currentDeviceId}`);
      }
      
    } catch (error) {
      console.log('   ❌ 防护测试失败:', error.message);
      this.results.issues.push(`防护测试失败: ${error.message}`);
    }
  }

  /**
   * 分析问题并提供建议
   */
  async analyzeIssuesAndRecommendations() {
    console.log('\n💡 5. 分析问题并提供建议...');
    
    const issues = this.results.issues;
    const processes = this.results.processes;
    const configs = this.results.configs;
    
    // 分析多进程问题
    if (processes.length > 1) {
      this.results.recommendations.push('检测到多个守护进程，建议清理重复进程');
    }
    
    // 分析孤立文件问题
    const pidFile = configs.find(c => c.name.includes('PID') && c.exists);
    if (pidFile && processes.length === 0) {
      this.results.recommendations.push('清理孤立的PID文件');
    }
    
    // 分析孤立进程问题
    if (processes.length > 0 && (!pidFile || !pidFile.exists)) {
      this.results.recommendations.push('重新创建PID文件或清理孤立进程');
    }
    
    // 分析防护功能问题
    if (issues.some(issue => issue.includes('防护功能未生效'))) {
      this.results.recommendations.push('重启防护服务');
    }
    
    // 通用建议
    if (issues.length > 0) {
      this.results.recommendations.push('执行完整的进程清理和重启');
    }
    
    console.log(`   📊 发现 ${issues.length} 个问题`);
    console.log(`   💡 提供 ${this.results.recommendations.length} 个建议`);
  }

  /**
   * 生成诊断报告
   */
  generateDiagnosticReport() {
    console.log('\n📋 诊断报告');
    console.log('='.repeat(50));
    
    // 进程状态
    console.log('\n🔍 运行中的进程:');
    if (this.results.processes.length === 0) {
      console.log('   无运行中的守护进程');
    } else {
      this.results.processes.forEach(proc => {
        console.log(`   • PID ${proc.pid} - ${proc.type}`);
      });
    }
    
    // 配置文件状态
    console.log('\n📁 配置文件状态:');
    this.results.configs.forEach(config => {
      const status = config.exists ? '✅ 存在' : '❌ 缺失';
      console.log(`   • ${config.name}: ${status}`);
    });
    
    // 发现的问题
    console.log('\n⚠️ 发现的问题:');
    if (this.results.issues.length === 0) {
      console.log('   无发现问题');
    } else {
      this.results.issues.forEach(issue => {
        console.log(`   • ${issue}`);
      });
    }
    
    // 建议措施
    console.log('\n💡 建议措施:');
    if (this.results.recommendations.length === 0) {
      console.log('   系统状态正常，无需特殊操作');
    } else {
      this.results.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }
    
    console.log('\n' + '='.repeat(50));
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const diagnostic = new ProcessManagementDiagnostic();
  diagnostic.runDiagnosis().catch(console.error);
}

module.exports = ProcessManagementDiagnostic;
