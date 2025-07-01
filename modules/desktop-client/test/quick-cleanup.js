const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

console.log('🔧 快速Cursor清理 - 断网测试版');
console.log('==================================================');

async function quickCleanup() {
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

    console.log('\n📊 第1步：检查当前状态...');
    let beforeDeviceId = null;
    if (await fs.pathExists(storageJsonPath)) {
      const data = await fs.readJson(storageJsonPath);
      beforeDeviceId = data['telemetry.devDeviceId'];
      console.log(`  当前设备ID: ${beforeDeviceId}`);
    } else {
      console.log('  storage.json不存在');
    }

    console.log('\n🗑️ 第2步：清理SQLite数据库...');
    const stateDbPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'state.vscdb'
    );

    if (await fs.pathExists(stateDbPath)) {
      await fs.remove(stateDbPath);
      console.log('  ✅ SQLite数据库已删除');
    } else {
      console.log('  ℹ️ SQLite数据库不存在');
    }

    console.log('\n📁 第3步：清理工作区存储...');
    const workspaceStoragePath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'workspaceStorage'
    );

    if (await fs.pathExists(workspaceStoragePath)) {
      await fs.remove(workspaceStoragePath);
      console.log('  ✅ 工作区存储已删除');
    } else {
      console.log('  ℹ️ 工作区存储不存在');
    }

    console.log('\n🆔 第4步：生成全新设备ID...');
    const newIdentifiers = {
      devDeviceId: crypto.randomUUID(),
      machineId: crypto.randomBytes(32).toString('hex'),
      macMachineId: crypto.randomBytes(32).toString('hex'),
      sessionId: crypto.randomUUID(),
      sqmId: `{${crypto.randomUUID().toUpperCase()}}`
    };

    const storageData = {
      'telemetry.devDeviceId': newIdentifiers.devDeviceId,
      'telemetry.machineId': newIdentifiers.machineId,
      'telemetry.macMachineId': newIdentifiers.macMachineId,
      'telemetry.sessionId': newIdentifiers.sessionId,
      'telemetry.sqmId': newIdentifiers.sqmId,
      'telemetry.firstSessionDate': new Date().toUTCString(),
      'telemetry.currentSessionDate': new Date().toUTCString()
    };

    await fs.ensureDir(path.dirname(storageJsonPath));
    await fs.writeJson(storageJsonPath, storageData, { spaces: 2 });
    
    console.log(`  ✅ 新设备ID: ${newIdentifiers.devDeviceId}`);

    console.log('\n✅ 第5步：验证清理效果...');
    const afterData = await fs.readJson(storageJsonPath);
    const afterDeviceId = afterData['telemetry.devDeviceId'];
    console.log(`  清理后设备ID: ${afterDeviceId}`);

    if (beforeDeviceId !== afterDeviceId) {
      console.log('  🎉 设备ID已成功更新！');
    }

    console.log('\n📋 清理完成！');
    console.log('==================================================');
    console.log('✅ SQLite数据库已清理');
    console.log('✅ 工作区存储已清理');
    console.log('✅ 设备ID已更新');
    console.log('');
    console.log('🎯 现在请：');
    console.log('1. 在断网状态下启动Cursor IDE');
    console.log('2. 检查设备ID是否保持不变');
    console.log('3. 测试Augment扩展的行为');

  } catch (error) {
    console.error('❌ 清理失败:', error);
  }
}

// 立即执行
quickCleanup();
