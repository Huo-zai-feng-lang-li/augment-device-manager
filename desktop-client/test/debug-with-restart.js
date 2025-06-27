const DeviceManager = require('../src/device-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// 调试包含重启的完整清理流程
async function debugWithRestart() {
  console.log('🔍 调试包含重启的完整清理流程');
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

    const options = {
      skipCursorLogin: true,
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartCursor: true,
      aggressiveMode: true,
      multiRoundClean: true,
      extendedMonitoring: true
    };

    console.log('\n📊 初始状态:');
    await checkAuthData('初始状态');

    // 执行完整清理（包括重启和监控）
    console.log('\n🧹 执行完整清理（包括重启和监控）...');
    const cleanupResult = await deviceManager.performCleanup(options);
    
    // 等待一段时间让监控完成
    console.log('\n⏳ 等待监控完成...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await checkAuthData('完整清理+监控后');

    console.log('\n📋 清理结果:');
    console.log(`  成功: ${cleanupResult.success}`);
    console.log(`  操作数: ${cleanupResult.actions.length}`);
    console.log(`  错误数: ${cleanupResult.errors.length}`);

    // 显示关键操作
    const keyActions = cleanupResult.actions.filter(action => 
      action.includes('登录') || 
      action.includes('保留') || 
      action.includes('state.vscdb') ||
      action.includes('监控') ||
      action.includes('启动') ||
      action.includes('认证')
    );
    
    if (keyActions.length > 0) {
      console.log('\n🔑 关键操作:');
      keyActions.forEach(action => {
        console.log(`  • ${action}`);
      });
    }

    console.log('\n✅ 调试完成');

  } catch (error) {
    console.error('❌ 调试失败:', error.message);
  }
}

// 运行调试
if (require.main === module) {
  debugWithRestart();
}

module.exports = { debugWithRestart };
