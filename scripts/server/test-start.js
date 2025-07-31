#!/usr/bin/env node

console.log("🚀 测试启动脚本");
console.log("Node.js版本:", process.version);

// 测试fetch
console.log("测试fetch可用性...");
if (typeof globalThis.fetch !== 'undefined') {
  console.log("✅ 内置fetch可用");
} else {
  console.log("❌ 内置fetch不可用，尝试node-fetch");
  try {
    const nodeFetch = require('node-fetch');
    console.log("✅ node-fetch可用");
  } catch (error) {
    console.log("❌ node-fetch不可用:", error.message);
  }
}

// 测试dotenv
console.log("测试dotenv...");
try {
  require("dotenv").config({ path: "../../.env" });
  console.log("✅ dotenv加载成功");
} catch (error) {
  console.log("❌ dotenv加载失败:", error.message);
}

console.log("✅ 测试完成");
