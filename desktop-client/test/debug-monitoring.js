const DeviceManager = require('../src/device-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// 调试监控功能
async function debugMonitoring() {
  console.log('🔍 调试监控功能');
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
          
          if (authCount > 0 && authCount <= 6) {
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

    // 测试监控功能（短时间）
    console.log('\n🔧 执行监控测试（10秒）...');
    await deviceManager.startContinuousMonitoring(results, 10000, options);
    await checkAuthData('监控后');

    console.log('\n📋 监控操作:');
    results.actions.forEach(action => {
      console.log(`  • ${action}`);
    });

    if (results.errors.length > 0) {
      console.log('\n❌ 监控错误:');
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
  debugMonitoring();
}

module.exports = { debugMonitoring };
