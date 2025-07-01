const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

/**
 * 启动时数据库清理器
 * 在Cursor启动前自动清理state.vscdb数据库
 */

const execAsync = promisify(exec);

async function startupDatabaseCleaner() {
  console.log('🧹 启动时数据库清理器');
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

  // 监控Cursor进程，在启动前清理数据库
  console.log('👁️ 开始监控Cursor进程...');
  
  const monitorInterval = setInterval(async () => {
    try {
      // 检查Cursor是否正在运行
      const result = await execAsync('tasklist /fi "imagename eq Cursor.exe"');
      const isCursorRunning = result.stdout.includes('Cursor.exe');
      
      if (!isCursorRunning) {
        // Cursor未运行，尝试清理数据库
        if (await fs.pathExists(stateDbPath)) {
          try {
            // 创建备份
            const backupPath = stateDbPath + '.backup.' + Date.now();
            await fs.copy(stateDbPath, backupPath);
            
            // 删除原数据库
            await fs.remove(stateDbPath);
            console.log('✅ 成功清理state.vscdb数据库');
            console.log('📦 备份保存至:', path.basename(backupPath));
            
            // 清理成功后停止监控
            clearInterval(monitorInterval);
            console.log('🎯 数据库清理完成，可以启动Cursor了');
            
          } catch (error) {
            console.log('⚠️ 数据库仍被锁定，继续监控...');
          }
        } else {
          console.log('ℹ️ 数据库不存在，无需清理');
          clearInterval(monitorInterval);
        }
      } else {
        console.log('🔄 Cursor正在运行，等待关闭...');
      }
      
    } catch (error) {
      // 忽略检查错误，继续监控
    }
  }, 2000); // 每2秒检查一次

  // 30秒后自动停止监控
  setTimeout(() => {
    clearInterval(monitorInterval);
    console.log('⏰ 监控超时，自动停止');
  }, 30000);
}

// 运行清理器
if (require.main === module) {
  startupDatabaseCleaner()
    .then(() => {
      console.log('🚀 数据库清理器已启动');
    })
    .catch(error => {
      console.error('❌ 启动失败:', error);
    });
}

module.exports = { startupDatabaseCleaner };
