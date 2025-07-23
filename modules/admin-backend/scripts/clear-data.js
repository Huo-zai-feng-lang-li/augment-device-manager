#!/usr/bin/env node

/**
 * 数据清理脚本 - 清空所有激活码和使用记录
 * 使用方法：node scripts/clear-data.js
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/store.json');

// 默认数据结构（只保留管理员账户）
const defaultStore = {
  admins: [
    {
      id: 1,
      username: "admin",
      password_hash: "$2a$10$ECHs6.Vx5P4YDS4coxedReAjSl1Ph/qAAMrSIp2mXyOl0qR00QZBK" // admin123
    }
  ],
  activationCodes: [],
  usageLogs: [],
  broadcastHistory: []
};

function clearData() {
  try {
    console.log('🧹 开始清理数据...');
    
    // 确保数据目录存在
    const dataDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('📁 创建数据目录:', dataDir);
    }
    
    // 备份现有数据（如果存在）
    if (fs.existsSync(DATA_FILE)) {
      const backupFile = DATA_FILE.replace('.json', `_backup_${Date.now()}.json`);
      fs.copyFileSync(DATA_FILE, backupFile);
      console.log('💾 备份现有数据到:', backupFile);
    }
    
    // 写入清空的数据
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultStore, null, 2));
    console.log('✅ 数据清理完成!');
    console.log('📊 清理后状态:');
    console.log('   - 激活码: 0 个');
    console.log('   - 使用记录: 0 条');
    console.log('   - 广播历史: 0 条');
    console.log('   - 管理员账户: 保留 (admin/admin123)');
    console.log('');
    console.log('🔄 请重启服务以应用更改');
    
  } catch (error) {
    console.error('❌ 清理数据失败:', error.message);
    process.exit(1);
  }
}

// 确认操作
if (process.argv.includes('--force')) {
  clearData();
} else {
  console.log('⚠️  此操作将清空所有激活码和使用记录!');
  console.log('💡 如果确定要继续，请使用: node scripts/clear-data.js --force');
  console.log('📁 数据文件位置:', DATA_FILE);
}
