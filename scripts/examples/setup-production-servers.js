#!/usr/bin/env node

// 生产环境多服务器配置示例
const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 生产环境多服务器配置示例');
console.log('============================');
console.log('');

// 示例配置场景
const scenarios = {
  // 场景1：ngrok + 备用本地
  ngrok_with_backup: [
    'your-domain.ngrok.io:443:https',
    '127.0.0.1:3002:http'
  ],
  
  // 场景2：云服务器 + ngrok备用
  cloud_with_ngrok: [
    'augment.yourdomain.com:443:https',
    'backup.ngrok.io:443:https',
    '127.0.0.1:3002:http'
  ],
  
  // 场景3：多个ngrok地址
  multiple_ngrok: [
    'primary.ngrok.io:443:https',
    'backup1.ngrok.io:443:https',
    'backup2.ngrok.io:443:https'
  ],
  
  // 场景4：局域网 + 公网
  lan_and_wan: [
    '192.168.1.100:3002:http',
    'public.yourdomain.com:443:https'
  ]
};

console.log('📋 可用的配置场景:');
Object.keys(scenarios).forEach((key, index) => {
  console.log(`   ${index + 1}. ${key}: ${scenarios[key].join(', ')}`);
});

console.log('');
console.log('💡 使用方法:');
console.log('');

// 显示使用示例
console.log('1. 手动配置:');
console.log('   node scripts/setup/configure-multi-server.js');
console.log('');

console.log('2. 快速配置（命令行参数）:');
console.log('   node scripts/setup/configure-multi-server.js \\');
console.log('     your-domain.ngrok.io:443:https \\');
console.log('     backup.ngrok.io:443:https \\');
console.log('     127.0.0.1:3002:http');
console.log('');

console.log('3. 使用预设场景:');
Object.keys(scenarios).forEach((key, index) => {
  console.log(`   # ${key}`);
  console.log(`   node scripts/setup/configure-multi-server.js ${scenarios[key].join(' ')}`);
  console.log('');
});

console.log('🔧 配置完成后的操作:');
console.log('1. 重新打包客户端: npm run build');
console.log('2. 分发安装包: dist/ 目录');
console.log('3. 客户端会自动选择可用的服务器');
console.log('');

console.log('📊 客户端连接逻辑:');
console.log('- 启动时测试当前配置的服务器');
console.log('- 如果无法连接，自动尝试候选服务器');
console.log('- 找到可用服务器后自动更新配置');
console.log('- 支持运行时服务器切换');
console.log('');

console.log('⚠️ 注意事项:');
console.log('- ngrok免费版地址会变化，建议升级付费版');
console.log('- 云服务器提供最稳定的连接');
console.log('- 配置多个备用地址提高可用性');
console.log('- 客户端会按配置顺序尝试连接');

// 如果提供了参数，直接执行配置
if (process.argv.length > 2) {
  const configScript = path.join(__dirname, '../setup/configure-multi-server.js');
  const args = process.argv.slice(2).join(' ');
  
  console.log('');
  console.log('🚀 执行配置...');
  console.log(`命令: node ${configScript} ${args}`);
  console.log('');
  
  try {
    execSync(`node "${configScript}" ${args}`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '../..')
    });
  } catch (error) {
    console.error('配置执行失败:', error.message);
  }
}
