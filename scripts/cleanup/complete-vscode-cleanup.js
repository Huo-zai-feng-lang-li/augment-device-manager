const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function completeVSCodeAugmentCleanup() {
  try {
    console.log('🧹 开始完整清理VSCode中的Augment扩展数据...');
    
    const stateDbPath = 'C:\\Users\\Administrator\\AppData\\Roaming\\Code\\User\\globalStorage\\state.vscdb';
    const augmentStoragePath = 'C:\\Users\\Administrator\\AppData\\Roaming\\Code\\User\\globalStorage\\augment.vscode-augment';
    
    // 1. 清理数据库中的Augment数据
    if (fs.existsSync(stateDbPath)) {
      console.log('\n📊 第1步：清理数据库中的Augment数据...');
      
      const SQL = await initSqlJs();
      const data = fs.readFileSync(stateDbPath);
      const db = new SQL.Database(data);
      
      // 查询清理前的数据
      const beforeQuery = "SELECT COUNT(*) as count FROM ItemTable WHERE key LIKE '%augment%' OR key LIKE '%Augment%'";
      const beforeResult = db.exec(beforeQuery);
      const beforeCount = beforeResult[0].values[0][0];
      
      console.log(`  📝 清理前发现 ${beforeCount} 条Augment相关数据`);
      
      // 执行清理
      const deleteQueries = [
        "DELETE FROM ItemTable WHERE key LIKE '%augment%'",
        "DELETE FROM ItemTable WHERE key LIKE '%Augment%'",
        "DELETE FROM ItemTable WHERE key LIKE '%secret://%' AND key LIKE '%augment%'"
      ];
      
      let deletedTotal = 0;
      for (const query of deleteQueries) {
        try {
          const result = db.run(query);
          console.log(`  🗑️ 执行: ${query} - 删除 ${result.changes || 0} 条记录`);
          deletedTotal += result.changes || 0;
        } catch (error) {
          console.log(`  ⚠️ 查询执行失败: ${error.message}`);
        }
      }
      
      // 保存数据库
      const newData = db.export();
      fs.writeFileSync(stateDbPath, newData);
      db.close();
      
      console.log(`  ✅ 数据库清理完成，共删除 ${deletedTotal} 条记录`);
    } else {
      console.log('  ⚠️ VSCode state.vscdb 不存在，跳过数据库清理');
    }
    
    // 2. 清理Augment扩展目录中的身份文件
    if (fs.existsSync(augmentStoragePath)) {
      console.log('\n📁 第2步：清理Augment扩展身份文件...');
      
      const files = fs.readdirSync(augmentStoragePath, { withFileTypes: true });
      const identityPatterns = ['user-', 'session-', 'auth-', 'device-', 'fingerprint', 'cache'];
      
      let cleanedFiles = 0;
      for (const file of files) {
        const fileName = file.name;
        const shouldClean = identityPatterns.some(pattern => fileName.includes(pattern)) &&
                           !fileName.includes('mcp') && 
                           !fileName.includes('config') && 
                           !fileName.includes('settings');
        
        if (shouldClean) {
          const filePath = path.join(augmentStoragePath, fileName);
          try {
            if (file.isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true });
              console.log(`  🗑️ 删除目录: ${fileName}`);
            } else {
              fs.unlinkSync(filePath);
              console.log(`  🗑️ 删除文件: ${fileName}`);
            }
            cleanedFiles++;
          } catch (error) {
            console.log(`  ⚠️ 删除失败 ${fileName}: ${error.message}`);
          }
        } else {
          console.log(`  ✅ 保留文件: ${fileName}`);
        }
      }
      
      console.log(`  ✅ 身份文件清理完成，共清理 ${cleanedFiles} 个文件/目录`);
    } else {
      console.log('  ℹ️ Augment扩展目录不存在，跳过文件清理');
    }
    
    // 3. 验证清理结果
    console.log('\n🔍 第3步：验证清理结果...');
    
    if (fs.existsSync(stateDbPath)) {
      const SQL = await initSqlJs();
      const data = fs.readFileSync(stateDbPath);
      const db = new SQL.Database(data);
      
      const verifyQuery = "SELECT COUNT(*) as count FROM ItemTable WHERE key LIKE '%augment%' OR key LIKE '%Augment%'";
      const verifyResult = db.exec(verifyQuery);
      const remainingCount = verifyResult[0].values[0][0];
      
      console.log(`  📊 清理后剩余 ${remainingCount} 条Augment相关数据`);
      
      if (remainingCount === 0) {
        console.log('  ✅ 数据库清理完全成功！');
      } else {
        console.log('  ⚠️ 仍有部分数据未清理，可能需要手动处理');
      }
      
      db.close();
    }
    
    console.log('\n🎯 VSCode Augment扩展清理完成！');
    console.log('💡 建议：重启VSCode以确保所有更改生效');
    
  } catch (error) {
    console.error('❌ 清理失败:', error.message);
    console.error(error.stack);
  }
}

completeVSCodeAugmentCleanup();
