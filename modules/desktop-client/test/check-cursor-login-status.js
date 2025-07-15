const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// 检查Cursor IDE登录状态
async function checkCursorLoginStatus() {
  console.log('🔍 检查Cursor IDE登录状态');
  console.log('==================================================');

  try {
    // 1. 检查关键登录文件
    console.log('\n📁 第1步：检查关键登录文件...');
    
    const loginFiles = [
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'storage.json'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage')
    ];

    for (const filePath of loginFiles) {
      const exists = await fs.pathExists(filePath);
      const fileName = path.basename(filePath);
      console.log(`  ${fileName}: ${exists ? '✅ 存在' : '❌ 不存在'}`);
      
      if (exists && fileName === 'storage.json') {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const hasAuthData = content.includes('auth') || content.includes('token') || content.includes('user');
          console.log(`    包含认证数据: ${hasAuthData ? '✅ 是' : '❌ 否'}`);
        } catch (error) {
          console.log(`    读取失败: ${error.message}`);
        }
      }
    }

    // 2. 检查数据库中的登录信息
    console.log('\n🗄️ 第2步：检查数据库中的登录信息...');
    
    const stateDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
    
    if (await fs.pathExists(stateDbPath)) {
      console.log('  state.vscdb: ✅ 存在');
      
      try {
        // 尝试使用sql.js检查数据库内容
        const initSqlJs = require('sql.js');
        const SQL = await initSqlJs();
        const dbBuffer = await fs.readFile(stateDbPath);
        const db = new SQL.Database(dbBuffer);

        // 查询认证相关数据
        const authQueries = [
          "SELECT key FROM ItemTable WHERE key LIKE '%auth%' LIMIT 5",
          "SELECT key FROM ItemTable WHERE key LIKE '%token%' LIMIT 5", 
          "SELECT key FROM ItemTable WHERE key LIKE '%user%' LIMIT 5",
          "SELECT key FROM ItemTable WHERE key LIKE '%cursorAuth%' LIMIT 5"
        ];

        for (const query of authQueries) {
          try {
            const result = db.exec(query);
            const queryType = query.match(/%(.+?)%/)[1];
            if (result.length > 0 && result[0].values.length > 0) {
              console.log(`    ${queryType}相关数据: ✅ 找到 ${result[0].values.length} 条`);
              result[0].values.slice(0, 3).forEach(row => {
                console.log(`      - ${row[0]}`);
              });
            } else {
              console.log(`    ${queryType}相关数据: ❌ 未找到`);
            }
          } catch (error) {
            console.log(`    查询${query}失败: ${error.message}`);
          }
        }

        db.close();
      } catch (error) {
        if (error.message.includes('Cannot find module')) {
          console.log('    ⚠️ 需要安装sql.js模块来检查数据库内容');
          console.log('    运行: npm install sql.js');
        } else {
          console.log(`    数据库检查失败: ${error.message}`);
        }
      }
    } else {
      console.log('  state.vscdb: ❌ 不存在');
    }

    // 3. 检查扩展存储
    console.log('\n🔌 第3步：检查扩展存储...');
    
    const extensionStoragePath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'augment.vscode-augment');
    const extensionExists = await fs.pathExists(extensionStoragePath);
    console.log(`  Augment扩展存储: ${extensionExists ? '✅ 存在' : '❌ 不存在'}`);

    // 4. 总结
    console.log('\n📊 登录状态总结:');
    const globalStorageExists = await fs.pathExists(path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage'));
    const storageJsonExists = await fs.pathExists(path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'storage.json'));
    const stateDbExists = await fs.pathExists(stateDbPath);

    if (globalStorageExists && (storageJsonExists || stateDbExists)) {
      console.log('  🟢 Cursor IDE 可能已登录（存在关键文件）');
    } else {
      console.log('  🔴 Cursor IDE 可能未登录（缺少关键文件）');
    }

    console.log('\n✅ 登录状态检查完成');

  } catch (error) {
    console.error('❌ 检查登录状态失败:', error.message);
  }
}

// 运行检查
if (require.main === module) {
  checkCursorLoginStatus();
}

module.exports = { checkCursorLoginStatus };
