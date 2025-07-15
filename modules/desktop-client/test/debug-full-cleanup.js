const DeviceManager = require('../src/device-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// 调试完整清理流程
async function debugFullCleanup() {
  console.log('🔍 调试完整清理流程');
  console.log('==================================================');

  try {
    const deviceManager = new DeviceManager();
    
    // 检查每个清理步骤对认证数据的影响
    const checkAuthData = async (stepName) => {
      const stateDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
      
      if (await fs.pathExists(stateDbPath)) {
        try {
          const initSqlJs = require('sql.js');
          const SQL = await initSqlJs();
          const dbBuffer = await fs.readFile(stateDbPath);
          const db = new SQL.Database(dbBuffer);

          const authQuery = "SELECT key FROM ItemTable WHERE key LIKE '%cursorAuth%'";
          const result = db.exec(authQuery);
          
          const authCount = result.length > 0 ? result[0].values.length : 0;
          console.log(`  ${stepName}: 认证数据 ${authCount} 条`);
          
          if (authCount > 0) {
            result[0].values.forEach(row => {
              console.log(`    - ${row[0]}`);
            });
          }

          db.close();
          return authCount;
        } catch (error) {
          console.log(`  ${stepName}: 无法读取数据库 - ${error.message}`);
          return -1;
        }
      } else {
        console.log(`  ${stepName}: 数据库文件不存在`);
        return -1;
      }
    };

    const results = {
      success: true,
      actions: [],
      errors: []
    };

    const options = {
      skipCursorLogin: true,
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartCursor: false  // 跳过重启，方便调试
    };

    console.log('\n📊 初始状态:');
    await checkAuthData('初始状态');

    // 1. 清理激活数据
    console.log('\n🔧 第1步：清理激活数据...');
    await deviceManager.cleanActivationData(results, options);
    await checkAuthData('清理激活数据后');

    // 2. 清理Augment存储数据
    console.log('\n🔧 第2步：清理Augment存储数据...');
    await deviceManager.cleanAugmentStorage(results);
    await checkAuthData('清理Augment存储后');

    // 3. 清理SQLite状态数据库
    console.log('\n🔧 第3步：清理SQLite状态数据库...');
    await deviceManager.cleanStateDatabase(results, options);
    await checkAuthData('清理状态数据库后');

    // 4. 清理Cursor IDE扩展数据
    console.log('\n🔧 第4步：清理Cursor IDE扩展数据...');
    if (options.cleanCursorExtension) {
      await deviceManager.cleanCursorExtensionData(results, options);
      await checkAuthData('清理扩展数据后');
    }

    console.log('\n📋 所有清理操作:');
    results.actions.forEach(action => {
      console.log(`  • ${action}`);
    });

    if (results.errors.length > 0) {
      console.log('\n❌ 清理错误:');
      results.errors.forEach(error => {
        console.log(`  • ${error}`);
      });
    }

    console.log('\n✅ 调试完成');

  } catch (error) {
    console.error('❌ 调试失败:', error.message);
  }
}

// 运行调试
if (require.main === module) {
  debugFullCleanup();
}

module.exports = { debugFullCleanup };
