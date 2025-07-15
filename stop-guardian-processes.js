const { spawn, exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * 停止所有Augment守护进程
 */
async function stopAllGuardianProcesses() {
  console.log('🛑 正在停止所有Augment守护进程...');
  
  try {
    // 1. 查找所有相关的Node.js进程
    console.log('\n🔍 第1步：查找相关进程...');
    
    const findProcesses = () => {
      return new Promise((resolve, reject) => {
        exec('wmic process where "name=\'node.exe\'" get processid,commandline', (error, stdout, stderr) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(stdout);
        });
      });
    };
    
    const processOutput = await findProcesses();
    const lines = processOutput.split('\n');
    const guardianProcesses = [];
    
    for (const line of lines) {
      if (line.includes('guardian-service-worker.js') || 
          line.includes('enhanced-device-guardian') ||
          line.includes('device-id-guardian') ||
          line.includes('standalone-guardian-service')) {
        
        // 提取PID
        const pidMatch = line.match(/(\d+)\s*$/);
        if (pidMatch) {
          const pid = pidMatch[1].trim();
          guardianProcesses.push({
            pid: pid,
            commandLine: line.trim()
          });
        }
      }
    }
    
    console.log(`发现 ${guardianProcesses.length} 个守护进程`);
    
    // 2. 终止所有守护进程
    if (guardianProcesses.length > 0) {
      console.log('\n🔪 第2步：终止守护进程...');
      
      for (const process of guardianProcesses) {
        try {
          console.log(`  终止进程 PID ${process.pid}...`);
          
          const killProcess = () => {
            return new Promise((resolve, reject) => {
              exec(`taskkill //F //PID ${process.pid}`, (error, stdout, stderr) => {
                if (error) {
                  // 进程可能已经不存在了，不算错误
                  console.log(`    ⚠️ 进程 ${process.pid} 可能已经退出`);
                  resolve();
                } else {
                  console.log(`    ✅ 成功终止进程 ${process.pid}`);
                  resolve();
                }
              });
            });
          };
          
          await killProcess();
          
        } catch (error) {
          console.log(`    ❌ 终止进程 ${process.pid} 失败: ${error.message}`);
        }
      }
    } else {
      console.log('  ✅ 未发现运行中的守护进程');
    }
    
    // 3. 清理配置文件
    console.log('\n🧹 第3步：清理临时配置文件...');
    
    const tempDir = os.tmpdir();
    const configPatterns = [
      'augment-guardian-config.json',
      'augment-guardian-*.json',
      'device-guardian-*.json',
      'enhanced-guardian-*.json'
    ];
    
    let cleanedFiles = 0;
    
    try {
      const files = await fs.readdir(tempDir);
      
      for (const file of files) {
        const shouldClean = configPatterns.some(pattern => {
          if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace('*', '.*'));
            return regex.test(file);
          }
          return file === pattern;
        });
        
        if (shouldClean) {
          const filePath = path.join(tempDir, file);
          try {
            await fs.remove(filePath);
            console.log(`  🗑️ 已删除配置文件: ${file}`);
            cleanedFiles++;
          } catch (error) {
            console.log(`  ⚠️ 删除配置文件失败 ${file}: ${error.message}`);
          }
        }
      }
      
      if (cleanedFiles === 0) {
        console.log('  ✅ 未发现需要清理的配置文件');
      } else {
        console.log(`  ✅ 共清理 ${cleanedFiles} 个配置文件`);
      }
      
    } catch (error) {
      console.log(`  ⚠️ 清理配置文件时出错: ${error.message}`);
    }
    
    // 4. 清理PID文件
    console.log('\n📄 第4步：清理PID文件...');
    
    const pidPatterns = [
      'augment-guardian.pid',
      'device-guardian.pid',
      'enhanced-guardian.pid'
    ];
    
    let cleanedPids = 0;
    
    for (const pidFile of pidPatterns) {
      const pidPath = path.join(tempDir, pidFile);
      if (await fs.pathExists(pidPath)) {
        try {
          await fs.remove(pidPath);
          console.log(`  🗑️ 已删除PID文件: ${pidFile}`);
          cleanedPids++;
        } catch (error) {
          console.log(`  ⚠️ 删除PID文件失败 ${pidFile}: ${error.message}`);
        }
      }
    }
    
    if (cleanedPids === 0) {
      console.log('  ✅ 未发现需要清理的PID文件');
    } else {
      console.log(`  ✅ 共清理 ${cleanedPids} 个PID文件`);
    }
    
    // 5. 验证清理结果
    console.log('\n🔍 第5步：验证清理结果...');
    
    const finalProcessOutput = await findProcesses();
    const finalLines = finalProcessOutput.split('\n');
    const remainingProcesses = finalLines.filter(line => 
      line.includes('guardian-service-worker.js') || 
      line.includes('enhanced-device-guardian') ||
      line.includes('device-id-guardian') ||
      line.includes('standalone-guardian-service')
    );
    
    if (remainingProcesses.length === 0) {
      console.log('  ✅ 所有守护进程已成功停止');
    } else {
      console.log(`  ⚠️ 仍有 ${remainingProcesses.length} 个进程在运行`);
      remainingProcesses.forEach(process => {
        console.log(`    - ${process.trim()}`);
      });
    }
    
    console.log('\n🎯 守护进程清理完成！');
    console.log('💡 现在您可以手动修改设备ID，不会被自动恢复了');
    
  } catch (error) {
    console.error('❌ 停止守护进程失败:', error.message);
  }
}

// 运行清理
stopAllGuardianProcesses();
