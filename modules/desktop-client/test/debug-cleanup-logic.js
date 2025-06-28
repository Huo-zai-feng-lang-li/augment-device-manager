const DeviceManager = require('../src/device-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// 调试清理逻辑
async function debugCleanupLogic() {
  console.log('🔍 调试清理逻辑');
  console.log('==================================================');

  try {
    // 1. 检查清理前的数据库状态
    console.log('\n📊 第1步：检查清理前的数据库状态...');
    
    const stateDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
    
    if (await fs.pathExists(stateDbPath)) {
      try {
        const initSqlJs = require('sql.js');
        const SQL = await initSqlJs();
        const dbBuffer = await fs.readFile(stateDbPath);
        const db = new SQL.Database(dbBuffer);

        // 查询认证相关数据
        const authQuery = "SELECT key, value FROM ItemTable WHERE key LIKE '%cursorAuth%'";
        const result = db.exec(authQuery);
        
        if (result.length > 0 && result[0].values.length > 0) {
          console.log('  清理前的认证数据:');
          result[0].values.forEach(row => {
            const key = row[0];
            const value = row[1];
            console.log(`    ${key}: ${value ? '有值' : '无值'}`);
          });
        } else {
          console.log('  ❌ 清理前没有找到认证数据');
        }

        db.close();
      } catch (error) {
        console.log(`  ⚠️ 无法读取数据库: ${error.message}`);
      }
    } else {
      console.log('  ❌ 数据库文件不存在');
    }

    // 2. 执行清理操作（只测试数据库清理部分）
    console.log('\n🧹 第2步：执行数据库清理测试...');
    
    const deviceManager = new DeviceManager();
    const results = {
      success: true,
      actions: [],
      errors: []
    };

    // 测试选项
    const options = {
      skipCursorLogin: true,  // 关键：保留Cursor登录
      preserveActivation: true,
      deepClean: true
    };

    console.log(`  测试选项: skipCursorLogin=${options.skipCursorLogin}`);

    // 只测试数据库清理函数
    await deviceManager.cleanAugmentSessionsFromDatabase(results, options);

    console.log('\n📋 清理操作结果:');
    results.actions.forEach(action => {
      console.log(`  • ${action}`);
    });

    if (results.errors.length > 0) {
      console.log('\n❌ 清理错误:');
      results.errors.forEach(error => {
        console.log(`  • ${error}`);
      });
    }

    // 3. 检查清理后的数据库状态
    console.log('\n📊 第3步：检查清理后的数据库状态...');
    
    if (await fs.pathExists(stateDbPath)) {
      try {
        const initSqlJs = require('sql.js');
        const SQL = await initSqlJs();
        const dbBuffer = await fs.readFile(stateDbPath);
        const db = new SQL.Database(dbBuffer);

        // 查询认证相关数据
        const authQuery = "SELECT key, value FROM ItemTable WHERE key LIKE '%cursorAuth%'";
        const result = db.exec(authQuery);
        
        if (result.length > 0 && result[0].values.length > 0) {
          console.log('  清理后的认证数据:');
          result[0].values.forEach(row => {
            const key = row[0];
            const value = row[1];
            console.log(`    ${key}: ${value ? '有值' : '无值'}`);
          });
        } else {
          console.log('  ❌ 清理后没有找到认证数据');
        }

        db.close();
      } catch (error) {
        console.log(`  ⚠️ 无法读取数据库: ${error.message}`);
      }
    } else {
      console.log('  ❌ 数据库文件不存在');
    }

    console.log('\n✅ 调试完成');

  } catch (error) {
    console.error('❌ 调试失败:', error.message);
  }
}

// 运行调试
if (require.main === module) {
  debugCleanupLogic();
}

module.exports = { debugCleanupLogic };
