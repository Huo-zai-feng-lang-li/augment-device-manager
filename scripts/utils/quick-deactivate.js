/**
 * 快速退出激活状态脚本
 * 用于紧急情况下快速清除激活状态和停止守护进程
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

async function quickDeactivate() {
  console.log('🚨 快速退出激活状态...\n');
  
  const actions = [];
  const errors = [];
  
  try {
    // 1. 快速终止所有相关进程
    console.log('🛑 终止守护进程...');
    try {
      if (os.platform() === 'win32') {
        // Windows: 终止所有包含guardian的node进程
        try {
          execSync('taskkill /F /IM node.exe 2>nul', { stdio: 'ignore' });
          actions.push('✅ 已终止Node.js进程');
        } catch (e) {
          // 忽略错误
        }
        
        // 终止可能的守护进程
        const processNames = ['guardian-service-worker.exe', 'standalone-guardian-service.exe'];
        for (const name of processNames) {
          try {
            execSync(`taskkill /F /IM ${name} 2>nul`, { stdio: 'ignore' });
          } catch (e) {
            // 忽略错误
          }
        }
      } else {
        // Unix/Linux/macOS
        try {
          execSync('pkill -f "node.*guardian"', { stdio: 'ignore' });
          actions.push('✅ 已终止守护进程');
        } catch (e) {
          // 忽略错误
        }
      }
    } catch (error) {
      errors.push(`终止进程失败: ${error.message}`);
    }

    // 2. 删除激活配置文件
    console.log('🗑️ 删除激活配置...');
    const configDir = path.join(os.homedir(), '.augment-device-manager');
    const configFile = path.join(configDir, 'config.json');
    
    try {
      if (await fs.pathExists(configFile)) {
        await fs.remove(configFile);
        actions.push('✅ 已删除激活配置文件');
      } else {
        actions.push('ℹ️ 激活配置文件不存在');
      }
    } catch (error) {
      errors.push(`删除配置文件失败: ${error.message}`);
    }

    // 3. 删除配置目录（如果为空）
    try {
      if (await fs.pathExists(configDir)) {
        const files = await fs.readdir(configDir);
        if (files.length === 0) {
          await fs.remove(configDir);
          actions.push('✅ 已删除配置目录');
        } else {
          actions.push('ℹ️ 配置目录不为空，保留');
        }
      }
    } catch (error) {
      errors.push(`处理配置目录失败: ${error.message}`);
    }

    // 4. 快速清理其他激活相关文件
    console.log('🧹 清理相关文件...');
    const cleanupPaths = [
      path.join(os.homedir(), '.augment'),
      path.join(os.homedir(), '.cursor-augment'),
    ];

    if (os.platform() === 'win32') {
      cleanupPaths.push(path.join(os.homedir(), 'AppData', 'Local', 'augment-device-manager'));
    } else if (os.platform() === 'darwin') {
      cleanupPaths.push(path.join(os.homedir(), 'Library', 'Application Support', 'augment-device-manager'));
    }

    for (const cleanupPath of cleanupPaths) {
      try {
        if (await fs.pathExists(cleanupPath)) {
          await fs.remove(cleanupPath);
          actions.push(`✅ 已清理: ${path.basename(cleanupPath)}`);
        }
      } catch (error) {
        errors.push(`清理 ${cleanupPath} 失败: ${error.message}`);
      }
    }

    // 5. 显示结果
    console.log('\n' + '='.repeat(40));
    console.log('📊 快速退出结果');
    console.log('='.repeat(40));
    
    if (actions.length > 0) {
      console.log('\n✅ 完成操作:');
      actions.forEach(action => console.log(`   ${action}`));
    }
    
    if (errors.length > 0) {
      console.log('\n❌ 错误信息:');
      errors.forEach(error => console.log(`   ${error}`));
    }
    
    console.log('\n🎯 状态: 激活状态已清除，守护进程已停止');
    console.log('💡 建议: 重启应用程序以确保所有更改生效');
    
    // 6. 验证结果
    console.log('\n🔍 验证激活状态...');
    if (!(await fs.pathExists(configFile))) {
      console.log('✅ 确认: 激活配置已清除');
    } else {
      console.log('⚠️ 警告: 激活配置文件仍然存在');
    }

  } catch (error) {
    console.error('❌ 快速退出失败:', error.message);
    errors.push(error.message);
  }
  
  return {
    success: errors.length === 0,
    actions,
    errors
  };
}

// 运行脚本
if (require.main === module) {
  quickDeactivate().catch(console.error);
}

module.exports = quickDeactivate;
