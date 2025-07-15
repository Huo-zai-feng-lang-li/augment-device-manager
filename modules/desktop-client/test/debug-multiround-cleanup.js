const DeviceManager = require('../src/device-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// 调试多轮清理
async function debugMultiRoundCleanup() {
  console.log('🔍 调试多轮清理功能');
  console.log('==================================================');

  try {
    const deviceManager = new DeviceManager();
    
    // 检查认证数据的函数
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
      aggressiveMode: true,
      multiRoundClean: true,
      extendedMonitoring: true
    };

    console.log('\n📊 初始状态:');
    await checkAuthData('初始状态');

    // 测试多轮清理
    console.log('\n🔧 执行多轮清理...');
    await deviceManager.performMultiRoundCleanup(results, options);
    await checkAuthData('多轮清理后');

    console.log('\n📋 多轮清理操作:');
    results.actions.forEach(action => {
      console.log(`  • ${action}`);
    });

    if (results.errors.length > 0) {
      console.log('\n❌ 多轮清理错误:');
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
  debugMultiRoundCleanup();
}

module.exports = { debugMultiRoundCleanup };
