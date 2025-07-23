const fs = require('fs-extra');
const { exec } = require('child_process');

/**
 * 临时停止守护进程，测试手动修改设备ID
 */
async function testManualIdChange() {
  console.log('🧪 测试手动修改设备ID（临时停止守护进程）');
  
  const vscodeStoragePath = 'C:\\Users\\Administrator\\AppData\\Roaming\\Code\\User\\globalStorage\\storage.json';
  const cursorStoragePath = 'C:\\Users\\Administrator\\AppData\\Roaming\\Cursor\\User\\globalStorage\\storage.json';
  
  try {
    // 1. 记录当前状态
    console.log('\n📊 第1步：记录当前状态...');
    
    const vscodeData = await fs.readJson(vscodeStoragePath);
    const cursorData = await fs.readJson(cursorStoragePath);
    
    console.log(`VSCode当前设备ID: ${vscodeData['telemetry.devDeviceId']}`);
    console.log(`Cursor当前设备ID: ${cursorData['telemetry.devDeviceId']}`);
    
    // 2. 查找并停止守护进程
    console.log('\n🛑 第2步：临时停止守护进程...');
    
    const findAndKillGuardian = () => {
      return new Promise((resolve, reject) => {
        exec('wmic process where "name=\'node.exe\'" get processid,commandline', (error, stdout, stderr) => {
          if (error) {
            reject(error);
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
            console.log(`发现 ${guardianProcesses.length} 个守护进程`);
            
            // 终止所有守护进程
            const killPromises = guardianProcesses.map(pid => {
              return new Promise((killResolve) => {
                exec(`taskkill //F //PID ${pid}`, (killError) => {
                  if (killError) {
                    console.log(`⚠️ 终止进程 ${pid} 失败: ${killError.message}`);
                  } else {
                    console.log(`✅ 成功终止守护进程 PID ${pid}`);
                  }
                  killResolve();
                });
              });
            });
            
            Promise.all(killPromises).then(() => resolve());
          } else {
            console.log('✅ 未发现运行中的守护进程');
            resolve();
          }
        });
      });
    };
    
    await findAndKillGuardian();
    
    // 等待进程完全终止
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. 手动修改VSCode设备ID为与Cursor相同
    console.log('\n✏️ 第3步：手动修改VSCode设备ID...');
    
    const targetDeviceId = cursorData['telemetry.devDeviceId'];
    console.log(`目标设备ID: ${targetDeviceId}`);
    
    // 修改VSCode的设备ID
    vscodeData['telemetry.devDeviceId'] = targetDeviceId;
    vscodeData['telemetry.machineId'] = cursorData['telemetry.machineId'];
    vscodeData['telemetry.sessionId'] = cursorData['telemetry.sessionId'];
    
    await fs.writeJson(vscodeStoragePath, vscodeData, { spaces: 2 });
    console.log('✅ VSCode设备ID已修改');
    
    // 4. 验证修改结果
    console.log('\n🔍 第4步：验证修改结果...');
    
    const verifyData = await fs.readJson(vscodeStoragePath);
    console.log(`修改后VSCode设备ID: ${verifyData['telemetry.devDeviceId']}`);
    
    if (verifyData['telemetry.devDeviceId'] === targetDeviceId) {
      console.log('✅ 设备ID修改成功！');
    } else {
      console.log('❌ 设备ID修改失败！');
    }
    
    // 5. 等待一段时间观察是否自动恢复
    console.log('\n⏱️ 第5步：等待30秒观察是否自动恢复...');
    
    for (let i = 30; i > 0; i--) {
      process.stdout.write(`\r等待 ${i} 秒...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 每5秒检查一次
      if (i % 5 === 0) {
        const checkData = await fs.readJson(vscodeStoragePath);
        const currentId = checkData['telemetry.devDeviceId'];
        
        if (currentId !== targetDeviceId) {
          console.log(`\n⚠️ 设备ID在 ${30-i} 秒后被自动恢复为: ${currentId}`);
          break;
        }
      }
    }
    
    console.log('\n');
    
    // 6. 最终验证
    console.log('🎯 第6步：最终验证...');
    
    const finalData = await fs.readJson(vscodeStoragePath);
    const finalId = finalData['telemetry.devDeviceId'];
    
    console.log(`最终VSCode设备ID: ${finalId}`);
    
    if (finalId === targetDeviceId) {
      console.log('✅ 设备ID保持不变，手动修改成功！');
      console.log('💡 现在可以测试VSCode中的Augment扩展是否与Cursor共享登录状态');
    } else {
      console.log('⚠️ 设备ID被自动恢复，可能有其他守护进程或IDE自身的恢复机制');
      console.log('💡 建议检查是否有其他监控进程在运行');
    }
    
    console.log('\n🎉 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testManualIdChange();
