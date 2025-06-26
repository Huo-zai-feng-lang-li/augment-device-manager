#!/usr/bin/env node

/**
 * 调试服务器启动脚本
 */

console.log('🔍 开始调试服务器启动...');

try {
  console.log('1. 检查Node.js版本:', process.version);
  
  console.log('2. 检查工作目录:', process.cwd());
  
  console.log('3. 检查shared模块...');
  const path = require('path');
  const fs = require('fs');
  
  const sharedPath = path.join(__dirname, 'shared', 'crypto', 'encryption.js');
  console.log('   shared模块路径:', sharedPath);
  console.log('   shared模块存在:', fs.existsSync(sharedPath));
  
  if (fs.existsSync(sharedPath)) {
    console.log('4. 尝试加载shared模块...');
    const encryption = require('./shared/crypto/encryption');
    console.log('   ✅ shared模块加载成功');
    console.log('   可用函数:', Object.keys(encryption));
  } else {
    console.log('   ❌ shared模块不存在');
  }
  
  console.log('5. 检查admin-backend目录...');
  const backendPath = path.join(__dirname, 'admin-backend', 'src', 'server-simple.js');
  console.log('   服务器文件路径:', backendPath);
  console.log('   服务器文件存在:', fs.existsSync(backendPath));
  
  console.log('6. 尝试启动简化服务器...');
  
  const express = require('express');
  const app = express();
  const PORT = 3003;
  
  app.get('/', (req, res) => {
    res.json({ message: '服务器运行正常', timestamp: new Date().toISOString() });
  });
  
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 简化服务器启动成功: http://0.0.0.0:${PORT}`);
    console.log('7. 现在尝试启动完整服务器...');
    
    // 延迟启动完整服务器
    setTimeout(() => {
      try {
        server.close(() => {
          console.log('8. 简化服务器已关闭，启动完整服务器...');
          require('./admin-backend/src/server-simple.js');
        });
      } catch (error) {
        console.error('❌ 启动完整服务器失败:', error.message);
        console.error('错误堆栈:', error.stack);
      }
    }, 2000);
  });
  
  server.on('error', (error) => {
    console.error('❌ 简化服务器启动失败:', error.message);
  });
  
} catch (error) {
  console.error('❌ 调试过程中发生错误:', error.message);
  console.error('错误堆栈:', error.stack);
}
