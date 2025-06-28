const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function checkAugmentComplete() {
  console.log('🔍 全面检查Augment扩展信息清理情况...\n');
  
  const results = {
    foundData: [],
    clearedData: [],
    recommendations: []
  };
  
  // 1. 检查globalStorage中的Augment数据
  console.log('1. 📁 检查globalStorage中的Augment数据...');
  const globalStoragePath = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'Cursor',
    'User',
    'globalStorage'
  );
  
  if (await fs.pathExists(globalStoragePath)) {
    const items = await fs.readdir(globalStoragePath);
    
    // 检查augment.vscode-augment目录
    const augmentDir = path.join(globalStoragePath, 'augment.vscode-augment');
    if (await fs.pathExists(augmentDir)) {
      try {
        const augmentItems = await fs.readdir(augmentDir);
        if (augmentItems.length === 0) {
          results.clearedData.push('✅ augment.vscode-augment目录已清空');
        } else {
          console.log(`  ⚠️ augment.vscode-augment目录包含 ${augmentItems.length} 个项目:`);
          for (const item of augmentItems) {
            console.log(`    📄 ${item}`);
            results.foundData.push(`augment.vscode-augment/${item}`);
          }
        }
      } catch (error) {
        results.foundData.push(`augment.vscode-augment目录读取失败: ${error.message}`);
      }
    } else {
      results.clearedData.push('✅ augment.vscode-augment目录不存在（已清理）');
    }
  }
  
  // 2. 检查state.vscdb数据库中的Augment数据
  console.log('\n2. 🗄️ 检查state.vscdb数据库中的Augment数据...');
  const stateDbPath = path.join(globalStoragePath, 'state.vscdb');
  
  if (await fs.pathExists(stateDbPath)) {
    try {
      const initSqlJs = require('sql.js');
      const SQL = await initSqlJs();
      
      const data = await fs.readFile(stateDbPath);
      const db = new SQL.Database(data);
      
      // 查询所有Augment相关数据
      const queries = [
        "SELECT * FROM ItemTable WHERE key LIKE '%augment%'",
        "SELECT * FROM ItemTable WHERE key LIKE '%Augment%'",
        "SELECT * FROM ItemTable WHERE key LIKE '%vscode-augment%'",
        "SELECT * FROM ItemTable WHERE key LIKE '%sessions%'",
      ];
      
      let foundAugmentData = false;
      for (const query of queries) {
        try {
          const result = db.exec(query);
          if (result.length > 0 && result[0].values.length > 0) {
            foundAugmentData = true;
            console.log(`  ⚠️ 发现Augment相关数据 (${result[0].values.length}条):`);
            result[0].values.forEach(row => {
              console.log(`    🔑 ${row[0]}: ${row[1].substring(0, 100)}...`);
              results.foundData.push(`数据库记录: ${row[0]}`);
            });
          }
        } catch (error) {
          // 忽略查询错误
        }
      }
      
      if (!foundAugmentData) {
        results.clearedData.push('✅ 数据库中无Augment相关数据');
      }
      
      db.close();
    } catch (error) {
      results.foundData.push(`数据库检查失败: ${error.message}`);
    }
  }
  
  // 3. 检查workspaceStorage中的Augment数据
  console.log('\n3. 📂 检查workspaceStorage中的Augment数据...');
  const workspaceStoragePath = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'Cursor',
    'User',
    'workspaceStorage'
  );
  
  if (await fs.pathExists(workspaceStoragePath)) {
    const workspaces = await fs.readdir(workspaceStoragePath);
    let foundWorkspaceData = false;
    
    for (const workspace of workspaces) {
      const workspacePath = path.join(workspaceStoragePath, workspace);
      const augmentWorkspacePath = path.join(workspacePath, 'augment.vscode-augment');
      
      if (await fs.pathExists(augmentWorkspacePath)) {
        foundWorkspaceData = true;
        console.log(`  ⚠️ 工作区 ${workspace} 包含Augment数据`);
        results.foundData.push(`工作区数据: ${workspace}/augment.vscode-augment`);
      }
    }
    
    if (!foundWorkspaceData) {
      results.clearedData.push('✅ 工作区存储中无Augment数据');
    }
  }
  
  // 4. 检查扩展配置和缓存
  console.log('\n4. ⚙️ 检查扩展配置和缓存...');
  const extensionPaths = [
    path.join(os.homedir(), '.cursor', 'extensions'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'CachedExtensions'),
    path.join(os.homedir(), 'AppData', 'Local', 'Cursor', 'CachedExtensions'),
  ];
  
  for (const extPath of extensionPaths) {
    if (await fs.pathExists(extPath)) {
      try {
        const items = await fs.readdir(extPath);
        const augmentItems = items.filter(item => item.includes('augment'));
        
        if (augmentItems.length > 0) {
          console.log(`  📦 ${path.basename(extPath)} 中的Augment扩展:`);
          augmentItems.forEach(item => {
            console.log(`    🧩 ${item}`);
            results.foundData.push(`扩展文件: ${item}`);
          });
        }
      } catch (error) {
        // 忽略读取错误
      }
    }
  }
  
  // 5. 检查项目历史记录
  console.log('\n5. 📚 检查项目历史记录...');
  const historyPaths = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'History'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'backups'),
  ];
  
  for (const historyPath of historyPaths) {
    if (await fs.pathExists(historyPath)) {
      try {
        const items = await fs.readdir(historyPath);
        console.log(`  📁 ${path.basename(historyPath)}: ${items.length} 个项目`);
        
        // 检查是否有Augment相关的历史记录
        for (const item of items) {
          const itemPath = path.join(historyPath, item);
          if (item.toLowerCase().includes('augment')) {
            results.foundData.push(`历史记录: ${item}`);
          }
        }
      } catch (error) {
        // 忽略读取错误
      }
    }
  }
  
  // 输出总结
  console.log('\n📊 清理情况总结:');
  console.log(`✅ 已清理项目: ${results.clearedData.length}`);
  results.clearedData.forEach(item => console.log(`  ${item}`));
  
  console.log(`\n⚠️ 仍存在项目: ${results.foundData.length}`);
  results.foundData.forEach(item => console.log(`  ${item}`));
  
  // 生成建议
  if (results.foundData.length > 0) {
    console.log('\n💡 建议:');
    console.log('  1. 关闭Cursor IDE后重新运行清理');
    console.log('  2. 手动删除剩余的Augment相关文件');
    console.log('  3. 清理工作区存储中的Augment数据');
  } else {
    console.log('\n🎉 所有Augment扩展信息已完全清理！');
  }
  
  return results;
}

checkAugmentComplete().catch(console.error);
