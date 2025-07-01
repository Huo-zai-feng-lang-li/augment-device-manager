const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * 清理state.vscdb数据库中的Augment相关数据
 * 精确删除用户身份信息，保留IDE基本功能
 */

async function cleanVscdbDatabase() {
  console.log('🗄️ 开始清理state.vscdb数据库');
  console.log('==================================================');

  const stateDbPath = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'Cursor',
    'User',
    'globalStorage',
    'state.vscdb'
  );

  if (!await fs.pathExists(stateDbPath)) {
    console.log('❌ state.vscdb数据库不存在');
    return;
  }

  try {
    // 方案1：尝试使用sql.js清理特定记录
    await cleanWithSqlJs(stateDbPath);
  } catch (error) {
    console.log('⚠️ sql.js方案失败，尝试备份删除方案');
    // 方案2：备份并删除整个数据库
    await backupAndDeleteDatabase(stateDbPath);
  }
}

// 方案1：使用sql.js精确清理
async function cleanWithSqlJs(stateDbPath) {
  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();

    // 读取数据库
    const data = await fs.readFile(stateDbPath);
    const db = new SQL.Database(data);

    console.log('📊 分析数据库结构...');

    // 获取所有表
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('发现表:', tables[0]?.values.map(row => row[0]) || []);

    let deletedCount = 0;

    // 清理可能包含用户身份的记录
    const cleanupQueries = [
      // 清理bubbleId相关记录（聊天气泡）
      "DELETE FROM ItemTable WHERE key LIKE 'bubbleId:%'",
      
      // 清理checkpointId相关记录（检查点）
      "DELETE FROM ItemTable WHERE key LIKE 'checkpointId:%'",
      
      // 清理messageRequestContext（消息上下文）
      "DELETE FROM ItemTable WHERE key LIKE 'messageRequestContext:%'",
      
      // 清理composerData（代码生成数据）
      "DELETE FROM ItemTable WHERE key LIKE 'composerData:%'",
      
      // 清理可能的用户会话数据
      "DELETE FROM ItemTable WHERE key LIKE '%session%'",
      "DELETE FROM ItemTable WHERE key LIKE '%user%'",
      "DELETE FROM ItemTable WHERE key LIKE '%auth%'",
      "DELETE FROM ItemTable WHERE key LIKE '%token%'",
      "DELETE FROM ItemTable WHERE key LIKE '%augment%'",
      
      // 清理cursorDiskKV表中的相关数据
      "DELETE FROM cursorDiskKV WHERE key LIKE '%bubbleId%'",
      "DELETE FROM cursorDiskKV WHERE key LIKE '%checkpointId%'",
      "DELETE FROM cursorDiskKV WHERE key LIKE '%messageRequest%'",
      "DELETE FROM cursorDiskKV WHERE key LIKE '%composer%'",
      "DELETE FROM cursorDiskKV WHERE key LIKE '%augment%'"
    ];

    for (const query of cleanupQueries) {
      try {
        const result = db.exec(query);
        if (result.length > 0) {
          deletedCount += result[0].values?.length || 0;
        }
        console.log(`✅ 执行: ${query}`);
      } catch (error) {
        console.log(`⚠️ 查询失败: ${query.substring(0, 50)}...`);
      }
    }

    // 保存清理后的数据库
    const newData = db.export();
    
    // 创建备份
    const backupPath = stateDbPath + '.backup.' + Date.now();
    await fs.copy(stateDbPath, backupPath);
    console.log(`📦 已备份原数据库: ${path.basename(backupPath)}`);
    
    // 写入清理后的数据库
    await fs.writeFile(stateDbPath, newData);
    
    db.close();

    console.log(`✅ 数据库清理完成，删除了 ${deletedCount} 条相关记录`);

  } catch (error) {
    throw new Error(`sql.js清理失败: ${error.message}`);
  }
}

// 方案2：备份并删除整个数据库
async function backupAndDeleteDatabase(stateDbPath) {
  try {
    console.log('🗑️ 执行完整数据库删除方案');
    
    // 创建备份
    const backupPath = stateDbPath + '.full-backup.' + Date.now();
    await fs.copy(stateDbPath, backupPath);
    console.log(`📦 已备份完整数据库: ${path.basename(backupPath)}`);
    
    // 删除原数据库
    await fs.remove(stateDbPath);
    console.log('✅ 已删除state.vscdb数据库');
    
    console.log('ℹ️ Cursor重启时会自动创建新的干净数据库');
    
  } catch (error) {
    throw new Error(`删除数据库失败: ${error.message}`);
  }
}

// 验证清理效果
async function verifyCleanup() {
  console.log('\n🔍 验证清理效果...');
  
  const stateDbPath = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'Cursor',
    'User',
    'globalStorage',
    'state.vscdb'
  );

  if (!await fs.pathExists(stateDbPath)) {
    console.log('✅ 数据库已被删除，清理彻底');
    return;
  }

  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const data = await fs.readFile(stateDbPath);
    const db = new SQL.Database(data);

    // 检查是否还有相关记录
    const checkQueries = [
      "SELECT COUNT(*) as count FROM ItemTable WHERE key LIKE 'bubbleId:%'",
      "SELECT COUNT(*) as count FROM ItemTable WHERE key LIKE 'checkpointId:%'",
      "SELECT COUNT(*) as count FROM ItemTable WHERE key LIKE 'messageRequestContext:%'"
    ];

    for (const query of checkQueries) {
      try {
        const result = db.exec(query);
        const count = result[0]?.values[0][0] || 0;
        const type = query.includes('bubbleId') ? 'bubbleId' : 
                    query.includes('checkpointId') ? 'checkpointId' : 'messageRequest';
        console.log(`  ${type}记录: ${count} 条`);
      } catch (error) {
        // 忽略查询错误
      }
    }

    db.close();

  } catch (error) {
    console.log('⚠️ 验证过程出错:', error.message);
  }
}

// 主函数
async function main() {
  try {
    await cleanVscdbDatabase();
    await verifyCleanup();
    
    console.log('\n🎯 数据库清理完成！');
    console.log('现在启动Cursor IDE，Augment扩展应该认为这是新设备');
    
  } catch (error) {
    console.error('❌ 清理失败:', error);
  }
}

// 运行清理
if (require.main === module) {
  main();
}

module.exports = { cleanVscdbDatabase, verifyCleanup };
