const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * 更新守护进程的目标设备ID，让它保护Cursor的设备ID
 */
async function updateGuardianTarget() {
  console.log('🔄 更新守护进程目标设备ID');
  
  const vscodeStoragePath = 'C:\\Users\\Administrator\\AppData\\Roaming\\Code\\User\\globalStorage\\storage.json';
  const cursorStoragePath = 'C:\\Users\\Administrator\\AppData\\Roaming\\Cursor\\User\\globalStorage\\storage.json';
  const guardianConfigPath = 'C:\\Users\\Administrator\\AppData\\Local\\Temp\\augment-guardian-config.json';
  
  try {
    // 1. 读取当前状态
    console.log('\n📊 第1步：读取当前状态...');
    
    const vscodeData = await fs.readJson(vscodeStoragePath);
    const cursorData = await fs.readJson(cursorStoragePath);
    
    console.log(`VSCode当前设备ID: ${vscodeData['telemetry.devDeviceId']}`);
    console.log(`Cursor当前设备ID: ${cursorData['telemetry.devDeviceId']}`);
    
    // 2. 检查守护进程配置
    if (await fs.pathExists(guardianConfigPath)) {
      const guardianConfig = await fs.readJson(guardianConfigPath);
      console.log(`守护进程保护的设备ID: ${guardianConfig.deviceId}`);
      
      // 3. 更新守护进程配置
      console.log('\n🔧 第2步：更新守护进程配置...');
      
      const targetDeviceId = cursorData['telemetry.devDeviceId'];
      guardianConfig.deviceId = targetDeviceId;
      
      await fs.writeJson(guardianConfigPath, guardianConfig, { spaces: 2 });
      console.log(`✅ 守护进程目标设备ID已更新为: ${targetDeviceId}`);
      
      // 4. 手动同步VSCode设备ID
      console.log('\n✏️ 第3步：同步VSCode设备ID...');
      
      vscodeData['telemetry.devDeviceId'] = targetDeviceId;
      vscodeData['telemetry.machineId'] = cursorData['telemetry.machineId'];
      vscodeData['telemetry.sessionId'] = cursorData['telemetry.sessionId'];
      vscodeData['telemetry.macMachineId'] = cursorData['telemetry.macMachineId'];
      
      await fs.writeJson(vscodeStoragePath, vscodeData, { spaces: 2 });
      console.log('✅ VSCode设备ID已同步');
      
      // 5. 等待守护进程重新加载配置
      console.log('\n⏱️ 第4步：等待守护进程重新加载配置...');
      
      // 守护进程通常会定期检查配置文件，等待一下
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 6. 验证结果
      console.log('\n🔍 第5步：验证同步结果...');
      
      const finalVscodeData = await fs.readJson(vscodeStoragePath);
      const finalCursorData = await fs.readJson(cursorStoragePath);
      
      console.log(`最终VSCode设备ID: ${finalVscodeData['telemetry.devDeviceId']}`);
      console.log(`最终Cursor设备ID: ${finalCursorData['telemetry.devDeviceId']}`);
      
      if (finalVscodeData['telemetry.devDeviceId'] === finalCursorData['telemetry.devDeviceId']) {
        console.log('✅ 设备ID同步成功！VSCode和Cursor现在使用相同的设备ID');
        console.log('🛡️ 守护进程将保护这个共同的设备ID');
        
        // 7. 测试稳定性
        console.log('\n🧪 第6步：测试设备ID稳定性...');
        
        // 尝试修改VSCode的设备ID，看守护进程是否会恢复为正确的值
        const testId = 'test-device-id-12345';
        finalVscodeData['telemetry.devDeviceId'] = testId;
        await fs.writeJson(vscodeStoragePath, finalVscodeData, { spaces: 2 });
        
        console.log(`临时修改VSCode设备ID为: ${testId}`);
        console.log('等待守护进程恢复...');
        
        // 等待守护进程检测并恢复
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const restoredData = await fs.readJson(vscodeStoragePath);
        const restoredId = restoredData['telemetry.devDeviceId'];
        
        console.log(`恢复后的设备ID: ${restoredId}`);
        
        if (restoredId === targetDeviceId) {
          console.log('✅ 守护进程工作正常，设备ID已恢复为目标值');
        } else if (restoredId === testId) {
          console.log('⚠️ 守护进程可能需要更长时间来检测变化');
        } else {
          console.log('❓ 设备ID被恢复为意外的值');
        }
        
      } else {
        console.log('⚠️ 设备ID同步可能失败，两个IDE的设备ID不一致');
      }
      
    } else {
      console.log('❌ 未找到守护进程配置文件');
      console.log('💡 守护进程可能没有运行，或配置文件位置不同');
    }
    
    console.log('\n🎯 操作完成！');
    console.log('💡 现在VSCode和Cursor应该使用相同的设备ID，并受到守护进程保护');
    
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
  }
}

updateGuardianTarget();
