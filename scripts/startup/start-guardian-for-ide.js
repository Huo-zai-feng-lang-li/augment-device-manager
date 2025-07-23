/**
 * 为指定IDE启动防护的便捷脚本
 * 使用方法：
 * - node start-guardian-for-ide.js cursor    # 为Cursor启动防护
 * - node start-guardian-for-ide.js vscode    # 为VS Code启动防护
 * - node start-guardian-for-ide.js           # 交互式选择IDE
 */

const { CleanupAndStartGuardian } = require('./cleanup-and-start-guardian');
const readline = require('readline');

class GuardianStarter {
  constructor() {
    this.ideOptions = {
      '1': { key: 'cursor', name: 'Cursor IDE', description: '清理并启动Cursor防护' },
      '2': { key: 'vscode', name: 'Visual Studio Code', description: '清理并启动VS Code防护' }
    };
  }

  /**
   * 交互式选择IDE
   */
  async selectIDE() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('🎯 请选择要启动防护的IDE:');
    console.log('');
    
    Object.entries(this.ideOptions).forEach(([key, option]) => {
      console.log(`  ${key}. ${option.name}`);
      console.log(`     ${option.description}`);
      console.log('');
    });

    return new Promise((resolve) => {
      rl.question('请输入选项编号 (1-2): ', (answer) => {
        rl.close();
        
        const option = this.ideOptions[answer.trim()];
        if (option) {
          resolve(option.key);
        } else {
          console.log('❌ 无效选项，默认选择VS Code');
          resolve('vscode');
        }
      });
    });
  }

  /**
   * 交互式选择清理模式
   */
  async selectCleanupMode() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n🧹 请选择清理模式:');
    console.log('');
    console.log('  1. 智能清理 (推荐)');
    console.log('     只清理设备身份，保留所有配置和扩展');
    console.log('');
    console.log('  2. 标准清理');
    console.log('     深度清理但保留核心配置');
    console.log('');
    console.log('  3. 完全清理');
    console.log('     彻底重置，仅保护MCP配置');
    console.log('');

    return new Promise((resolve) => {
      rl.question('请输入选项编号 (1-3, 默认1): ', (answer) => {
        rl.close();
        
        const mode = answer.trim() || '1';
        switch (mode) {
          case '1':
            resolve({ intelligentMode: true, preserveActivation: true });
          case '2':
            resolve({ standardMode: true, preserveActivation: true, deepClean: true });
          case '3':
            resolve({ completeMode: true, preserveActivation: false, deepClean: true });
          default:
            console.log('❌ 无效选项，使用智能清理模式');
            resolve({ intelligentMode: true, preserveActivation: true });
        }
      });
    });
  }

  /**
   * 显示当前IDE状态
   */
  async showCurrentStatus() {
    try {
      console.log('🔍 检查当前IDE状态...');
      
      const fs = require('fs-extra');
      const os = require('os');
      const path = require('path');
      
      // 检查Cursor状态
      const cursorStoragePath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'storage.json');
      const cursorExists = await fs.pathExists(cursorStoragePath);
      
      // 检查VS Code状态
      const vscodeStoragePath = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'storage.json');
      const vscodeExists = await fs.pathExists(vscodeStoragePath);
      
      console.log('\n📊 IDE状态:');
      console.log(`  Cursor:   ${cursorExists ? '🟢 已安装' : '🔴 未安装'}`);
      console.log(`  VS Code:  ${vscodeExists ? '🟢 已安装' : '🔴 未安装'}`);
      
      // 检查当前设备ID
      if (cursorExists) {
        try {
          const cursorData = await fs.readJson(cursorStoragePath);
          const cursorDeviceId = cursorData['telemetry.devDeviceId'];
          console.log(`  Cursor 设备ID: ${cursorDeviceId || '未设置'}`);
        } catch (error) {
          console.log(`  Cursor 设备ID: 读取失败`);
        }
      }
      
      if (vscodeExists) {
        try {
          const vscodeData = await fs.readJson(vscodeStoragePath);
          const vscodeDeviceId = vscodeData['telemetry.devDeviceId'];
          console.log(`  VS Code 设备ID: ${vscodeDeviceId || '未设置'}`);
        } catch (error) {
          console.log(`  VS Code 设备ID: 读取失败`);
        }
      }
      
      // 检查防护状态
      try {
        const DeviceManager = require('./modules/desktop-client/src/device-manager');
        const deviceManager = new DeviceManager();
        const status = await deviceManager.getEnhancedGuardianStatus();
        
        console.log('\n🛡️ 防护状态:');
        console.log(`  总体防护: ${status.isGuarding ? '🟢 运行中' : '🔴 未运行'}`);
        console.log(`  选择的IDE: ${status.selectedIDE || '未知'}`);
        console.log(`  运行模式: ${status.mode || '未知'}`);
        
      } catch (error) {
        console.log('\n🛡️ 防护状态: 检查失败');
      }
      
    } catch (error) {
      console.log('❌ 状态检查失败:', error.message);
    }
  }

  /**
   * 主要执行流程
   */
  async run() {
    console.log('🚀 IDE防护启动器');
    console.log('=' .repeat(50));
    
    try {
      // 显示当前状态
      await this.showCurrentStatus();
      
      // 获取IDE选择
      let selectedIDE = process.argv[2];
      
      if (!selectedIDE || !['cursor', 'vscode'].includes(selectedIDE)) {
        selectedIDE = await this.selectIDE();
      }
      
      console.log(`\n🎯 选择的IDE: ${this.ideOptions[selectedIDE === 'cursor' ? '1' : '2'].name}`);
      
      // 获取清理模式选择
      const cleanupOptions = await this.selectCleanupMode();
      
      console.log('\n🔄 开始执行清理后启动防护...');
      
      // 执行清理和启动防护
      const cleanup = new CleanupAndStartGuardian();
      const results = await cleanup.cleanupAndStartGuardian(selectedIDE, cleanupOptions);
      
      if (results.success) {
        console.log('\n🎉 清理后启动防护完成！');
        console.log('\n💡 使用说明:');
        console.log(`  - ${this.ideOptions[selectedIDE === 'cursor' ? '1' : '2'].name} 已清理并启动防护`);
        console.log('  - 防护将在后台运行，保护设备ID不被修改');
        console.log('  - 如需停止防护，请关闭客户端或运行停止脚本');
      } else {
        console.log('\n❌ 清理后启动防护失败！');
        console.log('请检查错误信息并重试');
      }
      
    } catch (error) {
      console.error('❌ 执行失败:', error.message);
      process.exit(1);
    }
  }
}

// 运行脚本
if (require.main === module) {
  const starter = new GuardianStarter();
  starter.run().catch(error => {
    console.error('❌ 脚本异常:', error);
    process.exit(1);
  });
}

module.exports = { GuardianStarter };
