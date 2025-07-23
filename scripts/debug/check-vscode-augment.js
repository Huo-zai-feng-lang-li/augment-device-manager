const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function checkVSCodeAugmentData() {
  try {
    const stateDbPath = 'C:\\Users\\Administrator\\AppData\\Roaming\\Code\\User\\globalStorage\\state.vscdb';
    
    if (!fs.existsSync(stateDbPath)) {
      console.log('❌ VSCode state.vscdb 不存在');
      return;
    }
    
    console.log('🔍 检查VSCode数据库中的Augment相关数据...');
    
    const SQL = await initSqlJs();
    const data = fs.readFileSync(stateDbPath);
    const db = new SQL.Database(data);
    
    // 查询所有包含augment的记录
    const augmentQuery = "SELECT key, value FROM ItemTable WHERE key LIKE '%augment%' OR key LIKE '%Augment%'";
    const augmentResult = db.exec(augmentQuery);
    
    console.log('\n📊 VSCode数据库中的Augment相关数据：');
    if (augmentResult.length > 0 && augmentResult[0].values.length > 0) {
      augmentResult[0].values.forEach(([key, value]) => {
        console.log(`  📝 ${key}: ${value ? (value.length > 100 ? value.substring(0, 100) + '...' : value) : 'null'}`);
      });
      console.log(`\n✅ 发现 ${augmentResult[0].values.length} 条Augment相关数据`);
    } else {
      console.log('  ✅ 未发现Augment相关数据');
    }
    
    // 查询认证相关数据
    const authQuery = "SELECT key, value FROM ItemTable WHERE key LIKE '%auth%' OR key LIKE '%token%' OR key LIKE '%login%'";
    const authResult = db.exec(authQuery);
    
    console.log('\n🔐 VSCode数据库中的认证相关数据：');
    if (authResult.length > 0 && authResult[0].values.length > 0) {
      authResult[0].values.slice(0, 5).forEach(([key, value]) => {
        console.log(`  🔑 ${key}: ${value ? '[有数据]' : 'null'}`);
      });
      if (authResult[0].values.length > 5) {
        console.log(`  ... 还有 ${authResult[0].values.length - 5} 条认证数据`);
      }
    } else {
      console.log('  ✅ 未发现认证相关数据');
    }
    
    // 查询设备相关数据
    const deviceQuery = "SELECT key, value FROM ItemTable WHERE key LIKE '%device%' OR key LIKE '%Device%'";
    const deviceResult = db.exec(deviceQuery);
    
    console.log('\n📱 VSCode数据库中的设备相关数据：');
    if (deviceResult.length > 0 && deviceResult[0].values.length > 0) {
      deviceResult[0].values.forEach(([key, value]) => {
        console.log(`  📱 ${key}: ${value ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : 'null'}`);
      });
    } else {
      console.log('  ✅ 未发现设备相关数据');
    }
    
    db.close();
    
    console.log('\n🎯 检查完成！');
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  }
}

checkVSCodeAugmentData();
