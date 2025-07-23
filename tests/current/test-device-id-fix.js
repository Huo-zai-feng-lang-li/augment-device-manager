const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

async function testDeviceIdFix() {
  console.log('🧪 测试设备ID修复...\n');
  
  try {
    const storageJsonPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );
    
    // 1. 读取当前设备ID
    console.log('📍 1. 读取当前设备ID');
    let currentData = {};
    if (await fs.pathExists(storageJsonPath)) {
      currentData = await fs.readJson(storageJsonPath);
      console.log(`当前设备ID: ${currentData['telemetry.devDeviceId']}`);
    } else {
      console.log('storage.json文件不存在');
      return;
    }
    
    // 2. 模拟清理过程：生成新的随机UUID
    console.log('\n📍 2. 模拟清理过程：生成新的随机UUID');
    const newDeviceId = crypto.randomUUID();
    console.log(`生成的新设备ID: ${newDeviceId}`);
    
    // 3. 写入新的设备ID到storage.json
    console.log('\n📍 3. 写入新的设备ID到storage.json');
    currentData['telemetry.devDeviceId'] = newDeviceId;
    await fs.writeJson(storageJsonPath, currentData, { spaces: 2 });
    console.log('✅ 新设备ID已写入storage.json');
    
    // 4. 验证写入是否成功
    console.log('\n📍 4. 验证写入是否成功');
    const verifyData = await fs.readJson(storageJsonPath);
    const writtenId = verifyData['telemetry.devDeviceId'];
    console.log(`验证读取的设备ID: ${writtenId}`);
    console.log(`写入是否成功: ${writtenId === newDeviceId ? '✅ 是' : '❌ 否'}`);
    
    // 5. 测试防护进程的getCurrentDeviceId方法
    console.log('\n📍 5. 测试防护进程的getCurrentDeviceId方法');
    const DeviceManager = require('./modules/desktop-client/src/device-manager');
    const deviceManager = new DeviceManager();
    const retrievedId = await deviceManager.getCurrentDeviceId();
    console.log(`getCurrentDeviceId返回: ${retrievedId}`);
    console.log(`是否与新ID一致: ${retrievedId === newDeviceId ? '✅ 是' : '❌ 否'}`);
    
    // 6. 测试防护进程启动参数
    console.log('\n📍 6. 测试防护进程启动参数');
    const { CleanupAndStartGuardian } = require('./cleanup-and-start-guardian');
    const cleanup = new CleanupAndStartGuardian();
    const targetDeviceId = await cleanup.getCurrentDeviceIdFromIDE('cursor');
    console.log(`getCurrentDeviceIdFromIDE返回: ${targetDeviceId}`);
    console.log(`是否与新ID一致: ${targetDeviceId === newDeviceId ? '✅ 是' : '❌ 否'}`);
    
    console.log('\n🎉 设备ID修复测试完成！');
    console.log(`\n📋 总结:`);
    console.log(`- 新生成的设备ID: ${newDeviceId}`);
    console.log(`- 写入storage.json: ${writtenId === newDeviceId ? '✅' : '❌'}`);
    console.log(`- getCurrentDeviceId: ${retrievedId === newDeviceId ? '✅' : '❌'}`);
    console.log(`- getCurrentDeviceIdFromIDE: ${targetDeviceId === newDeviceId ? '✅' : '❌'}`);
    
    if (writtenId === newDeviceId && retrievedId === newDeviceId && targetDeviceId === newDeviceId) {
      console.log('\n🎉 所有测试通过！设备ID流程已修复！');
    } else {
      console.log('\n❌ 仍有问题需要解决');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
if (require.main === module) {
  testDeviceIdFix().catch(console.error);
}

module.exports = { testDeviceIdFix };
