const DeviceManager = require('../src/device-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// 测试完全重置Cursor IDE功能
async function testCompleteCursorReset() {
  console.log('🔍 测试完全重置Cursor IDE功能');
  console.log('==================================================');

  try {
    // 检查Cursor数据的函数
    const checkCursorData = async (stepName) => {
      const cursorPaths = [
        path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor'),
        path.join(os.homedir(), 'AppData', 'Local', 'Cursor'),
        path.join(os.homedir(), 'AppData', 'LocalLow', 'Cursor'),
      ];

      const storageJsonPath = path.join(
        os.homedir(),
        'AppData',
        'Roaming',
        'Cursor',
        'User',
        'globalStorage',
        'storage.json'
      );

      const stateDbPath = path.join(
        os.homedir(),
        'AppData',
        'Roaming',
        'Cursor',
        'User',
        'globalStorage',
        'state.vscdb'
      );

      console.log(`\n📊 ${stepName}:`);
      
      // 检查主要路径
      for (const cursorPath of cursorPaths) {
        const exists = await fs.pathExists(cursorPath);
        console.log(`  ${path.basename(cursorPath)}: ${exists ? '✅ 存在' : '❌ 不存在'}`);
      }

      // 检查关键文件
      const storageExists = await fs.pathExists(storageJsonPath);
      const stateDbExists = await fs.pathExists(stateDbPath);
      
      console.log(`  storage.json: ${storageExists ? '✅ 存在' : '❌ 不存在'}`);
      console.log(`  state.vscdb: ${stateDbExists ? '✅ 存在' : '❌ 不存在'}`);

      // 如果storage.json存在，检查设备ID
      if (storageExists) {
        try {
          const data = await fs.readJson(storageJsonPath);
          const deviceId = data['telemetry.devDeviceId'];
          const machineId = data['telemetry.machineId'];
          console.log(`  设备ID: ${deviceId ? deviceId.substring(0, 16) + '...' : '无'}`);
          console.log(`  机器ID: ${machineId ? machineId.substring(0, 16) + '...' : '无'}`);
          
          // 检查是否有认证信息
          const hasAuth = Object.keys(data).some(key => key.includes('cursorAuth'));
          console.log(`  认证信息: ${hasAuth ? '✅ 有' : '❌ 无'}`);
        } catch (error) {
          console.log(`  读取storage.json失败: ${error.message}`);
        }
      }

      return { storageExists, stateDbExists };
    };

    console.log('\n📊 测试前状态:');
    await checkCursorData('测试前状态');

    // 测试完全重置功能
    console.log('\n🧹 执行完全重置测试...');
    
    const deviceManager = new DeviceManager();
    const cleanupResult = await deviceManager.performCleanup({
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartCursor: false, // 跳过重启，方便测试
      resetCursorCompletely: true, // 启用完全重置
      skipCursorLogin: false, // 不跳过登录清理（因为要完全重置）
      aggressiveMode: true,
      multiRoundClean: true,
      extendedMonitoring: false // 跳过监控，专注于清理逻辑
    });

    console.log('\n📊 测试后状态:');
    await checkCursorData('测试后状态');

    console.log('\n📋 清理结果:');
    console.log(`  成功: ${cleanupResult.success}`);
    console.log(`  操作数: ${cleanupResult.actions.length}`);
    console.log(`  错误数: ${cleanupResult.errors.length}`);

    // 显示关键操作
    const resetActions = cleanupResult.actions.filter(action => 
      action.includes('完全重置') || 
      action.includes('全新') || 
      action.includes('清理Cursor') ||
      action.includes('身份')
    );
    
    if (resetActions.length > 0) {
      console.log('\n🔄 重置操作:');
      resetActions.forEach(action => {
        console.log(`  • ${action}`);
      });
    }

    if (cleanupResult.errors.length > 0) {
      console.log('\n❌ 清理错误:');
      cleanupResult.errors.slice(0, 5).forEach(error => {
        console.log(`  • ${error}`);
      });
      if (cleanupResult.errors.length > 5) {
        console.log(`  • ... 还有 ${cleanupResult.errors.length - 5} 个错误`);
      }
    }

    // 验证重置效果
    console.log('\n✅ 重置效果验证:');
    const afterData = await checkCursorData('验证');
    
    if (!afterData.storageExists && !afterData.stateDbExists) {
      console.log('  🎯 完全重置成功：所有Cursor数据已清理');
    } else if (afterData.storageExists) {
      console.log('  🔄 部分重置：storage.json已重新生成');
    } else {
      console.log('  ⚠️ 重置状态未知');
    }

    console.log('\n✅ 测试完成');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
if (require.main === module) {
  testCompleteCursorReset();
}

module.exports = { testCompleteCursorReset };
