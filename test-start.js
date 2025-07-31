#!/usr/bin/env node

console.log("🧪 测试启动脚本修改...");

// 测试启动脚本的语法
try {
  require('./scripts/server/start-server-with-auto-update.js');
  console.log("✅ 启动脚本语法正确");
} catch (error) {
  console.error("❌ 启动脚本语法错误:", error.message);
  console.error(error.stack);
}
