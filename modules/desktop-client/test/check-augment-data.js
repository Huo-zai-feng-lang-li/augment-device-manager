const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function checkAugmentData() {
  console.log('🔍 详细检查Augment扩展数据...\n');
  
  // 1. 检查globalStorage目录
  const globalStoragePath = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'Cursor',
    'User',
    'globalStorage'
  );
  
  console.log(`📁 globalStorage路径: ${globalStoragePath}`);
  
  if (await fs.pathExists(globalStoragePath)) {
    const items = await fs.readdir(globalStoragePath);
    console.log(`📂 globalStorage包含 ${items.length} 个项目:`);
    
    for (const item of items) {
      console.log(`  📄 ${item}`);
      
      // 检查是否是Augment相关的目录
      if (item.includes('augment') || item.includes('vscode-augment')) {
        const itemPath = path.join(globalStoragePath, item);
        console.log(`    🎯 发现Augment相关目录: ${item}`);
        
        if (await fs.pathExists(itemPath)) {
          const stats = await fs.stat(itemPath);
          if (stats.isDirectory()) {
            try {
              const subItems = await fs.readdir(itemPath);
              console.log(`      📂 包含 ${subItems.length} 个文件:`);
              
              for (const subItem of subItems) {
                const subItemPath = path.join(itemPath, subItem);
                console.log(`        📄 ${subItem}`);
                
                // 尝试读取文件内容
                if (subItem.endsWith('.json')) {
                  try {
                    const content = await fs.readJson(subItemPath);
                    console.log(`          📋 JSON内容:`);
                    console.log(`          ${JSON.stringify(content, null, 2)}`);
                  } catch (error) {
                    console.log(`          ❌ 读取JSON失败: ${error.message}`);
                  }
                } else {
                  try {
                    const content = await fs.readFile(subItemPath, 'utf8');
                    console.log(`          📋 文件内容: ${content.substring(0, 300)}...`);
                  } catch (error) {
                    console.log(`          ❌ 读取文件失败: ${error.message}`);
                  }
                }
              }
            } catch (error) {
              console.log(`      ❌ 读取目录失败: ${error.message}`);
            }
          }
        }
      }
    }
  }
  
  // 2. 检查state.vscdb数据库中的Augment数据
  console.log('\n🔍 检查state.vscdb数据库...');
  const stateDbPath = path.join(globalStoragePath, 'state.vscdb');
  
  if (await fs.pathExists(stateDbPath)) {
    console.log('✅ state.vscdb存在');
    
    try {
      // 尝试使用sql.js读取数据库
      const initSqlJs = require('sql.js');
      const SQL = await initSqlJs();
      
      const data = await fs.readFile(stateDbPath);
      const db = new SQL.Database(data);
      
      // 查询所有表
      const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      console.log('📊 数据库表:');
      if (tables.length > 0) {
        tables[0].values.forEach(table => {
          console.log(`  📋 ${table[0]}`);
        });
        
        // 查询ItemTable中的Augment相关数据
        try {
          const augmentData = db.exec("SELECT * FROM ItemTable WHERE key LIKE '%augment%' OR key LIKE '%Augment%'");
          if (augmentData.length > 0) {
            console.log('\n🎯 发现Augment相关数据:');
            augmentData[0].values.forEach(row => {
              console.log(`  🔑 ${row[0]}: ${row[1]}`);
            });
          } else {
            console.log('\n✅ 未发现Augment相关数据');
          }
        } catch (error) {
          console.log(`❌ 查询Augment数据失败: ${error.message}`);
        }
      }
      
      db.close();
    } catch (error) {
      console.log(`❌ 读取数据库失败: ${error.message}`);
    }
  }
  
  // 3. 检查扩展安装目录
  console.log('\n🔍 检查扩展安装目录...');
  const extensionsPath = path.join(os.homedir(), '.cursor', 'extensions');
  
  if (await fs.pathExists(extensionsPath)) {
    const extensions = await fs.readdir(extensionsPath);
    const augmentExtensions = extensions.filter(ext => ext.includes('augment'));
    
    console.log(`📂 发现 ${augmentExtensions.length} 个Augment扩展:`);
    augmentExtensions.forEach(ext => {
      console.log(`  🧩 ${ext}`);
    });
  }
}

checkAugmentData().catch(console.error);
