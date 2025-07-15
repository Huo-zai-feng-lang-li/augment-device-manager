const DeviceManager = require('../src/device-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// 调试完整清理流程
async function debugCompleteCleanup() {
  console.log('🔍 调试完整清理流程（包括监控）');
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
          } else if (authCount > 6) {
            console.log(`    - 显示前6条...`);
            result[0].values.slice(0, 6).forEach(row => {
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
      autoRestartCursor: false,  // 跳过重启，方便调试
      aggressiveMode: true,
      multiRoundClean: true,
      extendedMonitoring: false  // 跳过监控，专注于清理逻辑
    };

    console.log('\n📊 初始状态:');
    await checkAuthData('初始状态');

    // 执行完整清理（不包括监控）
    console.log('\n🧹 执行完整清理...');
    const cleanupResult = await deviceManager.performCleanup(options);
    await checkAuthData('完整清理后');

    console.log('\n📋 清理结果:');
    console.log(`  成功: ${cleanupResult.success}`);
    console.log(`  操作数: ${cleanupResult.actions.length}`);
    console.log(`  错误数: ${cleanupResult.errors.length}`);

    // 显示关键操作
    const keyActions = cleanupResult.actions.filter(action => 
      action.includes('登录') || 
      action.includes('保留') || 
      action.includes('state.vscdb') ||
      action.includes('多轮清理') ||
      action.includes('认证')
    );
    
    if (keyActions.length > 0) {
      console.log('\n🔑 关键操作:');
      keyActions.forEach(action => {
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

    console.log('\n✅ 调试完成');

  } catch (error) {
    console.error('❌ 调试失败:', error.message);
  }
}

// 运行调试
if (require.main === module) {
  debugCompleteCleanup();
}

module.exports = { debugCompleteCleanup };
