/**
 * 验证退出激活状态脚本
 * 确认激活状态已清除，守护进程已停止
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

async function verifyDeactivation() {
  console.log('🔍 验证退出激活状态...\n');
  
  const results = {
    activationCleared: false,
    guardianStopped: false,
    filesCleared: false,
    summary: []
  };
  
  try {
    // 1. 检查激活配置文件
    await checkActivationConfig(results);
    
    // 2. 检查守护进程
    await checkGuardianProcesses(results);
    
    // 3. 检查相关文件
    await checkRelatedFiles(results);
    
    // 4. 显示验证结果
    displayVerificationResults(results);
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  }
}

// 检查激活配置
async function checkActivationConfig(results) {
  console.log('1️⃣ 检查激活配置...');
  
  const configDir = path.join(os.homedir(), '.augment-device-manager');
  const configFile = path.join(configDir, 'config.json');
  
  try {
    if (await fs.pathExists(configFile)) {
      console.log('❌ 激活配置文件仍然存在');
      results.summary.push('❌ 激活配置未完全清除');
      
      // 尝试读取内容
      try {
        const config = await fs.readJson(configFile);
        if (config.activation) {
          console.log('⚠️ 配置文件中仍有激活信息');
          console.log('   激活码:', config.activation.code ? config.activation.code.substring(0, 8) + '...' : '未知');
        }
      } catch (e) {
        console.log('⚠️ 配置文件存在但无法读取');
      }
    } else {
      console.log('✅ 激活配置文件已清除');
      results.activationCleared = true;
      results.summary.push('✅ 激活配置已清除');
    }
  } catch (error) {
    console.log('⚠️ 检查激活配置失败:', error.message);
    results.summary.push('⚠️ 激活配置检查失败');
  }
}

// 检查守护进程
async function checkGuardianProcesses(results) {
  console.log('\n2️⃣ 检查守护进程...');
  
  return new Promise((resolve) => {
    if (os.platform() === 'win32') {
      // Windows检查
      const cmd = 'wmic process where "name=\'node.exe\' and commandline like \'%guardian%\'" get processid,commandline /format:csv';
      
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.log('✅ 未发现守护进程');
          results.guardianStopped = true;
          results.summary.push('✅ 守护进程已停止');
          resolve();
          return;
        }
        
        const lines = stdout.split('\n').filter(line => 
          line.trim() && 
          !line.startsWith('Node') && 
          !line.includes('verify-deactivation.js')
        );
        
        if (lines.length > 0) {
          console.log(`❌ 发现 ${lines.length} 个守护进程仍在运行`);
          results.summary.push('❌ 仍有守护进程运行');
          
          lines.forEach((line, index) => {
            const parts = line.split(',');
            if (parts.length >= 3) {
              console.log(`   ${index + 1}. PID: ${parts[2].trim()}`);
            }
          });
        } else {
          console.log('✅ 未发现守护进程');
          results.guardianStopped = true;
          results.summary.push('✅ 守护进程已停止');
        }
        resolve();
      });
    } else {
      // Unix/Linux/macOS检查
      exec('ps aux | grep node | grep guardian | grep -v grep | grep -v verify-deactivation', (error, stdout) => {
        if (error || !stdout.trim()) {
          console.log('✅ 未发现守护进程');
          results.guardianStopped = true;
          results.summary.push('✅ 守护进程已停止');
        } else {
          const lines = stdout.trim().split('\n');
          console.log(`❌ 发现 ${lines.length} 个守护进程仍在运行`);
          results.summary.push('❌ 仍有守护进程运行');
        }
        resolve();
      });
    }
  });
}

// 检查相关文件
async function checkRelatedFiles(results) {
  console.log('\n3️⃣ 检查相关文件...');
  
  const checkPaths = [
    path.join(os.homedir(), '.augment'),
    path.join(os.homedir(), '.cursor-augment'),
  ];
  
  // 添加平台特定路径
  if (os.platform() === 'win32') {
    checkPaths.push(path.join(os.homedir(), 'AppData', 'Local', 'augment-device-manager'));
  } else if (os.platform() === 'darwin') {
    checkPaths.push(path.join(os.homedir(), 'Library', 'Application Support', 'augment-device-manager'));
  }
  
  let filesFound = 0;
  
  for (const checkPath of checkPaths) {
    try {
      if (await fs.pathExists(checkPath)) {
        console.log(`⚠️ 发现残留文件: ${checkPath}`);
        filesFound++;
      }
    } catch (error) {
      // 忽略检查错误
    }
  }
  
  if (filesFound === 0) {
    console.log('✅ 未发现残留文件');
    results.filesCleared = true;
    results.summary.push('✅ 相关文件已清理');
  } else {
    console.log(`⚠️ 发现 ${filesFound} 个残留文件/目录`);
    results.summary.push('⚠️ 存在残留文件');
  }
}

// 显示验证结果
function displayVerificationResults(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 退出激活状态验证结果');
  console.log('='.repeat(60));
  
  // 总体状态
  const allCleared = results.activationCleared && results.guardianStopped && results.filesCleared;
  
  if (allCleared) {
    console.log('🎉 完美！激活状态已完全退出');
    console.log('✅ 所有检查项目都已通过');
  } else {
    console.log('⚠️ 退出激活状态基本完成，但存在一些残留');
    console.log('💡 这些残留通常不会影响系统正常运行');
  }
  
  console.log('\n📋 详细结果:');
  results.summary.forEach(item => {
    console.log(`   ${item}`);
  });
  
  console.log('\n🎯 当前状态:');
  console.log(`   激活配置: ${results.activationCleared ? '✅ 已清除' : '❌ 未清除'}`);
  console.log(`   守护进程: ${results.guardianStopped ? '✅ 已停止' : '❌ 仍运行'}`);
  console.log(`   相关文件: ${results.filesCleared ? '✅ 已清理' : '⚠️ 有残留'}`);
  
  console.log('\n💡 后续建议:');
  if (allCleared) {
    console.log('   1. ✅ 激活状态已完全退出，可以正常使用');
    console.log('   2. 🔄 如需重新激活，请获取新的有效激活码');
    console.log('   3. 🔍 可以运行 node check-activation-status.js 确认状态');
  } else {
    console.log('   1. 🔄 重启应用程序以确保所有更改生效');
    console.log('   2. 💻 如有疑虑，可以重启计算机完全清理');
    console.log('   3. 🔧 如需手动清理，可以删除残留的文件和进程');
  }
  
  console.log('\n🔍 验证命令:');
  console.log('   node check-activation-status.js  # 检查激活状态');
  console.log('   tasklist | findstr node          # 检查Node.js进程 (Windows)');
  console.log('   ps aux | grep node               # 检查Node.js进程 (Unix/Linux/macOS)');
}

// 运行验证
if (require.main === module) {
  verifyDeactivation().catch(console.error);
}

module.exports = verifyDeactivation;
