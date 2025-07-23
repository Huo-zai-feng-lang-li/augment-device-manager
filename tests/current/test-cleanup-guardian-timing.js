const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * 测试清理操作和防护进程启动的时序问题
 * 模拟清理Cursor IDE并启动防护进程
 */
async function testCleanupGuardianTiming() {
  console.log('🧪 测试清理操作和防护进程启动的时序');
  
  const cursorStoragePath = 'C:\\Users\\Administrator\\AppData\\Roaming\\Cursor\\User\\globalStorage\\storage.json';
  const guardianConfigPath = path.join(os.tmpdir(), 'augment-guardian-config.json');
  
  try {
    // 1. 记录清理前的状态
    console.log('\n📊 第1步：记录清理前的状态...');
    
    let originalDeviceId = null;
    if (await fs.pathExists(cursorStoragePath)) {
      const cursorData = await fs.readJson(cursorStoragePath);
      originalDeviceId = cursorData['telemetry.devDeviceId'];
      console.log(`清理前Cursor设备ID: ${originalDeviceId}`);
    }
    
    // 2. 模拟清理操作（生成新的设备ID）
    console.log('\n🧹 第2步：模拟清理操作...');
    
    const crypto = require('crypto');
    const newDeviceId = crypto.randomUUID();
    console.log(`生成新设备ID: ${newDeviceId}`);
    
    // 模拟清理操作更新配置文件
    if (await fs.pathExists(cursorStoragePath)) {
      const cursorData = await fs.readJson(cursorStoragePath);
      cursorData['telemetry.devDeviceId'] = newDeviceId;
      cursorData['telemetry.machineId'] = crypto.randomUUID();
      cursorData['telemetry.sessionId'] = crypto.randomUUID();
      
      await fs.writeJson(cursorStoragePath, cursorData, { spaces: 2 });
      console.log('✅ Cursor配置文件已更新');
    }
    
    // 3. 验证清理后的设备ID
    console.log('\n🔍 第3步：验证清理后的设备ID...');
    
    const { CleanupAndStartGuardian } = require('./cleanup-and-start-guardian');
    const cleanup = new CleanupAndStartGuardian();
    
    const readDeviceId = await cleanup.getCurrentDeviceIdFromIDE('cursor');
    console.log(`从配置文件读取到的设备ID: ${readDeviceId}`);
    
    if (readDeviceId === newDeviceId) {
      console.log('✅ 设备ID读取正确');
    } else {
      console.log('❌ 设备ID读取错误');
      console.log(`  期望: ${newDeviceId}`);
      console.log(`  实际: ${readDeviceId}`);
    }
    
    // 4. 模拟启动防护进程
    console.log('\n🛡️ 第4步：模拟启动防护进程...');
    
    const DeviceManager = require('./modules/desktop-client/src/device-manager');
    const deviceManager = new DeviceManager();
    
    // 使用读取到的设备ID启动防护
    const guardianOptions = {
      selectedIDE: 'cursor',
      targetDeviceId: readDeviceId,
      enableBackupMonitoring: true,
      enableDatabaseMonitoring: true,
      enableEnhancedProtection: true
    };
    
    console.log(`🎯 启动防护，目标设备ID: ${readDeviceId}`);
    
    const startResult = await deviceManager.startEnhancedGuardianIndependently(guardianOptions);
    
    if (startResult.success) {
      console.log('✅ 防护进程启动成功');
      console.log(`防护模式: ${startResult.mode}`);
      console.log(`防护设备ID: ${startResult.deviceId}`);
      
      // 5. 验证防护进程配置
      console.log('\n🔍 第5步：验证防护进程配置...');
      
      if (await fs.pathExists(guardianConfigPath)) {
        const guardianConfig = await fs.readJson(guardianConfigPath);
        console.log(`防护进程配置设备ID: ${guardianConfig.deviceId}`);
        
        if (guardianConfig.deviceId === newDeviceId) {
          console.log('✅ 防护进程配置正确');
        } else {
          console.log('❌ 防护进程配置错误');
          console.log(`  期望: ${newDeviceId}`);
          console.log(`  实际: ${guardianConfig.deviceId}`);
        }
      } else {
        console.log('⚠️ 防护进程配置文件不存在');
      }
      
      // 6. 等待一段时间，然后检查设备ID是否被恢复
      console.log('\n⏱️ 第6步：等待防护进程工作（5秒）...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 检查设备ID是否被防护进程修改
      const finalCursorData = await fs.readJson(cursorStoragePath);
      const finalDeviceId = finalCursorData['telemetry.devDeviceId'];
      console.log(`最终Cursor设备ID: ${finalDeviceId}`);
      
      if (finalDeviceId === newDeviceId) {
        console.log('✅ 设备ID保持正确，防护进程工作正常');
      } else {
        console.log('❌ 设备ID被防护进程修改了');
        console.log(`  清理后: ${newDeviceId}`);
        console.log(`  最终: ${finalDeviceId}`);
        
        if (finalDeviceId === originalDeviceId) {
          console.log('🚨 设备ID被恢复为清理前的旧ID！');
          console.log('💡 这说明防护进程使用了错误的目标设备ID');
        }
      }
      
    } else {
      console.log('❌ 防护进程启动失败');
      console.log(`错误: ${startResult.error}`);
    }
    
    console.log('\n🎯 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

testCleanupGuardianTiming();
