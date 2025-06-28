const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// 清理工作区存储
async function cleanWorkspaceStorage() {
  console.log('🧹 清理工作区存储');
  console.log('==================================================');

  try {
    const workspaceStoragePath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'workspaceStorage'
    );

    if (await fs.pathExists(workspaceStoragePath)) {
      console.log('\n📁 检查工作区存储...');
      
      const workspaces = await fs.readdir(workspaceStoragePath);
      console.log(`  找到 ${workspaces.length} 个工作区`);

      for (const workspace of workspaces) {
        const workspacePath = path.join(workspaceStoragePath, workspace);
        const workspaceDbPath = path.join(workspacePath, 'state.vscdb');
        
        console.log(`\n🔍 处理工作区: ${workspace}`);
        
        if (await fs.pathExists(workspaceDbPath)) {
          try {
            // 备份工作区数据库
            const backupPath = workspaceDbPath + '.backup.' + Date.now();
            await fs.copy(workspaceDbPath, backupPath);
            console.log(`  ✅ 已备份: ${path.basename(backupPath)}`);
            
            // 检查数据库中是否有Augment相关数据
            const initSqlJs = require('sql.js');
            const SQL = await initSqlJs();
            const dbBuffer = await fs.readFile(workspaceDbPath);
            const db = new SQL.Database(dbBuffer);

            // 查询Augment相关数据
            const augmentQuery = "SELECT key FROM ItemTable WHERE key LIKE '%augment%' OR key LIKE '%Augment%'";
            const result = db.exec(augmentQuery);
            
            if (result.length > 0 && result[0].values.length > 0) {
              console.log(`  🎯 发现 ${result[0].values.length} 条Augment相关数据:`);
              result[0].values.slice(0, 3).forEach(row => {
                console.log(`    - ${row[0]}`);
              });
              if (result[0].values.length > 3) {
                console.log(`    - ... 还有 ${result[0].values.length - 3} 条`);
              }
              
              // 删除Augment相关数据
              const deleteQuery = "DELETE FROM ItemTable WHERE key LIKE '%augment%' OR key LIKE '%Augment%'";
              db.run(deleteQuery);
              
              // 保存清理后的数据库
              const data = db.export();
              await fs.writeFile(workspaceDbPath, Buffer.from(data));
              console.log(`  🗑️ 已清理Augment数据`);
            } else {
              console.log(`  ✅ 无Augment相关数据`);
            }

            db.close();
          } catch (error) {
            console.log(`  ⚠️ 处理失败: ${error.message}`);
          }
        } else {
          console.log(`  ❌ 无state.vscdb文件`);
        }
      }

      console.log('\n✅ 工作区存储清理完成');
    } else {
      console.log('❌ 工作区存储目录不存在');
    }

  } catch (error) {
    console.error('❌ 清理工作区存储失败:', error.message);
  }
}

// 运行清理
if (require.main === module) {
  cleanWorkspaceStorage();
}

module.exports = { cleanWorkspaceStorage };
