const fs = require('fs-extra');
const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');

/**
 * 重启守护进程，使用Cursor的设备ID作为目标
 */
async function restartGuardianWithCursorId() {
  console.log('🔄 重启守护进程并设置Cursor设备ID为目标');
  
  const vscodeStoragePath = 'C:\\Users\\Administrator\\AppData\\Roaming\\Code\\User\\globalStorage\\storage.json';
  const cursorStoragePath = 'C:\\Users\\Administrator\\AppData\\Roaming\\Cursor\\User\\globalStorage\\storage.json';
  const guardianConfigPath = 'C:\\Users\\Administrator\\AppData\\Local\\Temp\\augment-guardian-config.json';
  
  try {
    // 1. 读取Cursor的设备ID
    console.log('\n📊 第1步：读取Cursor设备ID...');
    
    const cursorData = await fs.readJson(cursorStoragePath);
    const targetDeviceId = cursorData['telemetry.devDeviceId'];
    
    console.log(`目标设备ID (Cursor): ${targetDeviceId}`);
    
    // 2. 停止当前守护进程
    console.log('\n🛑 第2步：停止当前守护进程...');
    
    const stopGuardian = () => {
      return new Promise((resolve) => {
        exec('wmic process where "name=\'node.exe\'" get processid,commandline', (error, stdout) => {
          if (error) {
            console.log('⚠️ 查找进程失败，继续执行...');
            resolve();
            return;
          }
          
          const lines = stdout.split('\n');
          const guardianProcesses = [];
          
          for (const line of lines) {
            if (line.includes('guardian-service-worker.js')) {
              const pidMatch = line.match(/(\d+)\s*$/);
              if (pidMatch) {
                guardianProcesses.push(pidMatch[1].trim());
              }
            }
          }
          
          if (guardianProcesses.length > 0) {
            console.log(`发现 ${guardianProcesses.length} 个守护进程，正在终止...`);
            
            // 使用Node.js的process.kill来终止进程
            guardianProcesses.forEach(pid => {
              try {
                process.kill(parseInt(pid), 'SIGTERM');
                console.log(`✅ 成功终止守护进程 PID ${pid}`);
              } catch (killError) {
                console.log(`⚠️ 终止进程 ${pid} 失败: ${killError.message}`);
              }
            });
          } else {
            console.log('✅ 未发现运行中的守护进程');
          }
          
          resolve();
        });
      });
    };
    
    await stopGuardian();
    
    // 等待进程完全终止
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 3. 更新VSCode设备ID为Cursor的设备ID
    console.log('\n✏️ 第3步：同步VSCode设备ID...');
    
    const vscodeData = await fs.readJson(vscodeStoragePath);
    vscodeData['telemetry.devDeviceId'] = targetDeviceId;
    vscodeData['telemetry.machineId'] = cursorData['telemetry.machineId'];
    vscodeData['telemetry.sessionId'] = cursorData['telemetry.sessionId'];
    vscodeData['telemetry.macMachineId'] = cursorData['telemetry.macMachineId'];
    
    await fs.writeJson(vscodeStoragePath, vscodeData, { spaces: 2 });
    console.log('✅ VSCode设备ID已同步为Cursor的设备ID');
    
    // 4. 创建新的守护进程配置
    console.log('\n🔧 第4步：创建新的守护进程配置...');
    
    const newGuardianConfig = {
      deviceId: targetDeviceId,
      startTime: new Date().toISOString(),
      options: {
        enableBackupMonitoring: true,
        enableDatabaseMonitoring: true,
        enableEnhancedProtection: true,
        cleanCursor: false,
        cleanVSCode: true,
        selectedIDE: "vscode"
      }
    };
    
    await fs.writeJson(guardianConfigPath, newGuardianConfig, { spaces: 2 });
    console.log(`✅ 守护进程配置已更新，目标设备ID: ${targetDeviceId}`);
    
    // 5. 启动新的守护进程
    console.log('\n🚀 第5步：启动新的守护进程...');
    
    const guardianScript = path.join(__dirname, 'modules', 'desktop-client', 'src', 'guardian-service-worker.js');
    
    if (await fs.pathExists(guardianScript)) {
      const child = spawn('node', [guardianScript, guardianConfigPath], {
        detached: true,
        stdio: ['ignore', 'ignore', 'ignore'],
        windowsHide: true
      });
      
      child.unref();
      
      console.log(`✅ 新的守护进程已启动，PID: ${child.pid}`);
      
      // 等待守护进程启动
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 6. 验证守护进程状态
      console.log('\n🔍 第6步：验证守护进程状态...');
      
      const verifyGuardian = () => {
        return new Promise((resolve) => {
          exec('wmic process where "name=\'node.exe\'" get processid,commandline', (error, stdout) => {
            if (error) {
              resolve(false);
              return;
            }
            
            const isRunning = stdout.includes('guardian-service-worker.js');
            resolve(isRunning);
          });
        });
      };
      
      const isRunning = await verifyGuardian();
      
      if (isRunning) {
        console.log('✅ 守护进程运行正常');
        
        // 7. 测试保护功能
        console.log('\n🧪 第7步：测试设备ID保护功能...');
        
        // 读取当前状态
        const currentVscodeData = await fs.readJson(vscodeStoragePath);
        const currentCursorData = await fs.readJson(cursorStoragePath);
        
        console.log(`当前VSCode设备ID: ${currentVscodeData['telemetry.devDeviceId']}`);
        console.log(`当前Cursor设备ID: ${currentCursorData['telemetry.devDeviceId']}`);
        
        if (currentVscodeData['telemetry.devDeviceId'] === currentCursorData['telemetry.devDeviceId']) {
          console.log('✅ 设备ID同步成功！');
          console.log('🛡️ 守护进程现在将保护这个共同的设备ID');
          
          console.log('\n🎯 操作完成！');
          console.log('💡 现在VSCode和Cursor使用相同的设备ID');
          console.log('💡 守护进程将防止设备ID被意外修改');
          console.log('💡 您可以测试Augment扩展是否在两个IDE中共享登录状态');
          
        } else {
          console.log('⚠️ 设备ID可能还未完全同步，请稍等片刻');
        }
        
      } else {
        console.log('❌ 守护进程启动失败');
      }
      
    } else {
      console.log('❌ 找不到守护进程脚本文件');
      console.log(`预期路径: ${guardianScript}`);
    }
    
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    console.error(error.stack);
  }
}

restartGuardianWithCursorId();
