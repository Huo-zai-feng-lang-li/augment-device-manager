/**
 * 触发监听测试 - 手动修改设备ID来触发防护响应
 */

const path = require('path');
const fs = require('fs-extra');
const os = require('os');

const STORAGE_JSON_PATH = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'Cursor',
  'User',
  'globalStorage',
  'storage.json'
);

async function triggerMonitoring() {
  console.log('🎯 触发防护监听测试');
  console.log('='.repeat(50));

  try {
    // 1. 检查当前状态
    console.log('\n📍 1. 检查当前状态:');
    const DeviceManager = require('../src/device-manager');
    const deviceManager = new DeviceManager();
    
    const status = await deviceManager.getEnhancedGuardianStatus();
    
    if (!status.isGuarding) {
      console.log('❌ 防护进程未运行，请先启动防护');
      return;
    }

    const targetDeviceId = status.standalone?.config?.deviceId;
    console.log(`防护目标ID: ${targetDeviceId}`);

    // 2. 读取当前文件内容
    console.log('\n📍 2. 读取当前文件:');
    const currentContent = await fs.readJson(STORAGE_JSON_PATH);
    const currentDeviceId = currentContent['telemetry.devDeviceId'];
    console.log(`当前设备ID: ${currentDeviceId}`);

    if (currentDeviceId === targetDeviceId) {
      console.log('ℹ️ 当前ID与目标ID相同，将修改为其他值来触发防护');
      
      // 3. 修改为其他设备ID
      console.log('\n📍 3. 修改设备ID:');
      const testDeviceId = 'test-modified-' + Date.now();
      currentContent['telemetry.devDeviceId'] = testDeviceId;
      await fs.writeJson(STORAGE_JSON_PATH, currentContent, { spaces: 2 });
      console.log(`✅ 已修改设备ID为: ${testDeviceId}`);

      // 4. 监控恢复过程
      console.log('\n📍 4. 监控恢复过程:');
      console.log('⏳ 等待防护进程检测并恢复...');
      
      for (let i = 1; i <= 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const checkContent = await fs.readJson(STORAGE_JSON_PATH);
        const checkDeviceId = checkContent['telemetry.devDeviceId'];
        
        console.log(`[${i}秒] 当前设备ID: ${checkDeviceId}`);
        
        if (checkDeviceId === targetDeviceId) {
          console.log(`✅ 防护进程在第${i}秒成功恢复了设备ID！`);
          console.log(`   从: ${testDeviceId}`);
          console.log(`   恢复为: ${targetDeviceId}`);
          break;
        } else if (checkDeviceId !== testDeviceId) {
          console.log(`⚠️ 设备ID被修改为其他值: ${checkDeviceId}`);
          break;
        }
        
        if (i === 10) {
          console.log('❌ 10秒内防护进程未响应，可能存在问题');
        }
      }
      
    } else {
      console.log('ℹ️ 当前ID与目标ID不同，防护应该会自动恢复');
      console.log(`   当前ID: ${currentDeviceId}`);
      console.log(`   目标ID: ${targetDeviceId}`);
      
      // 监控恢复过程
      console.log('\n📍 3. 监控恢复过程:');
      for (let i = 1; i <= 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const checkContent = await fs.readJson(STORAGE_JSON_PATH);
        const checkDeviceId = checkContent['telemetry.devDeviceId'];
        
        console.log(`[${i}秒] 当前设备ID: ${checkDeviceId}`);
        
        if (checkDeviceId === targetDeviceId) {
          console.log(`✅ 防护进程在第${i}秒成功恢复了设备ID！`);
          break;
        }
      }
    }

    // 5. 最终状态检查
    console.log('\n📍 5. 最终状态检查:');
    const finalContent = await fs.readJson(STORAGE_JSON_PATH);
    const finalDeviceId = finalContent['telemetry.devDeviceId'];
    console.log(`最终设备ID: ${finalDeviceId}`);
    console.log(`是否为目标ID: ${finalDeviceId === targetDeviceId ? '✅ 是' : '❌ 否'}`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
if (require.main === module) {
  triggerMonitoring().catch(console.error);
}

module.exports = triggerMonitoring;
