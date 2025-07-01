const DeviceManager = require('../src/device-manager');

/**
 * 测试集成后的设备ID守护者
 */

async function testIntegratedGuardian() {
  console.log('🧪 测试集成后的设备ID守护者');
  console.log('==================================================');

  const deviceManager = new DeviceManager();

  try {
    console.log('\n🔄 执行清理操作（包含守护者）...');
    
    const result = await deviceManager.performCleanup({
      cleanCursor: true,
      cleanCursorExtension: true,
      preserveActivation: true,
      deepClean: true,
      autoRestartCursor: false, // 不自动重启，方便观察
      aggressiveMode: true
    });

    console.log('\n📋 清理结果:');
    console.log(`状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    
    if (result.success) {
      console.log('\n✅ 成功操作:');
      result.actions.forEach(action => {
        if (action.includes('守护者') || action.includes('设备ID') || action.includes('只读')) {
          console.log(`  🎯 ${action}`);
        } else {
          console.log(`  • ${action}`);
        }
      });
    }

    if (result.errors && result.errors.length > 0) {
      console.log('\n❌ 错误信息:');
      result.errors.forEach(error => console.log(`  • ${error}`));
    }

    console.log('\n🎯 关键功能验证:');
    
    // 检查是否包含守护者相关操作
    const guardianActions = result.actions.filter(action => 
      action.includes('守护者') || action.includes('设备ID') || action.includes('只读')
    );
    
    if (guardianActions.length > 0) {
      console.log('✅ 设备ID守护者已成功集成');
      guardianActions.forEach(action => console.log(`  🛡️ ${action}`));
    } else {
      console.log('❌ 设备ID守护者未正确集成');
    }

    // 验证storage.json文件状态
    console.log('\n📁 验证storage.json状态...');
    await verifyStorageJsonStatus();

    console.log('\n🎉 测试完成！');
    console.log('现在可以启动Cursor IDE测试守护者是否能拦截ID恢复');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 验证storage.json文件状态
async function verifyStorageJsonStatus() {
  const fs = require('fs-extra');
  const path = require('path');
  const os = require('os');

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

    if (await fs.pathExists(storageJsonPath)) {
      // 检查文件内容
      const data = await fs.readJson(storageJsonPath);
      const deviceId = data['telemetry.devDeviceId'];
      
      console.log(`  📄 文件存在: ✅`);
      console.log(`  🆔 设备ID: ${deviceId}`);
      
      // 检查文件权限（Windows）
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      try {
        const result = await execAsync(`attrib "${storageJsonPath}"`);
        const isReadOnly = result.stdout.includes('R');
        console.log(`  🔒 只读保护: ${isReadOnly ? '✅ 已启用' : '❌ 未启用'}`);
      } catch (error) {
        console.log(`  🔒 只读保护: ⚠️ 无法检查`);
      }
      
    } else {
      console.log(`  📄 文件存在: ❌ 不存在`);
    }
    
  } catch (error) {
    console.log(`  ❌ 验证失败: ${error.message}`);
  }
}

// 运行测试
if (require.main === module) {
  testIntegratedGuardian()
    .then(() => {
      console.log('\n✅ 集成测试完成');
      console.log('\n🎯 下一步:');
      console.log('1. 启动Cursor IDE');
      console.log('2. 观察守护者是否拦截ID恢复');
      console.log('3. 检查Augment扩展是否认为是新用户');
    })
    .catch(error => {
      console.error('❌ 集成测试出错:', error);
    });
}

module.exports = { testIntegratedGuardian };
