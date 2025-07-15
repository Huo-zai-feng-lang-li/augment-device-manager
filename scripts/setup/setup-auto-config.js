#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// 自动配置脚本 - 让客户端清理后无需操作即可连接
async function setupAutoConfig() {
  console.log('🔧 设置自动配置 - 客户端清理后无需操作');
  console.log('==========================================');
  console.log('');

  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('使用方法:');
    console.log('  node setup-auto-config.js <服务器地址> [端口] [协议]');
    console.log('');
    console.log('示例:');
    console.log('  node setup-auto-config.js abc123.ngrok.io 443 https');
    console.log('  node setup-auto-config.js localhost 3002 http');
    console.log('');
    return;
  }

  const host = args[0];
  const port = parseInt(args[1]) || (host.includes('ngrok.io') ? 443 : 3002);
  const protocol = args[2] || (host.includes('ngrok.io') ? 'https' : 'http');

  console.log(`📋 配置信息:`);
  console.log(`   服务器: ${protocol}://${host}:${port}`);
  console.log('');

  try {
    // 方法1: 写入注册表（Windows）
    if (process.platform === 'win32') {
      await setupWindowsRegistry(host, port, protocol);
    }

    // 方法2: 创建全局配置文件
    await setupGlobalConfig(host, port, protocol);

    // 方法3: 修改默认配置
    await updateDefaultConfig(host, port, protocol);

    console.log('');
    console.log('🎉 自动配置设置完成！');
    console.log('');
    console.log('✅ 现在客户端具有以下特性:');
    console.log('   • 清理后自动连接到指定服务器');
    console.log('   • 无需用户手动配置');
    console.log('   • 多重配置保障机制');
    console.log('');
    console.log('📦 下一步: 重新打包客户端');
    console.log('   npm run build');

  } catch (error) {
    console.error('❌ 配置失败:', error.message);
    process.exit(1);
  }
}

// 设置Windows注册表
async function setupWindowsRegistry(host, port, protocol) {
  try {
    console.log('🔑 写入Windows注册表...');
    
    // 创建注册表项
    execSync('reg add "HKEY_CURRENT_USER\\Software\\AugmentDeviceManager" /f', { stdio: 'ignore' });
    
    // 写入服务器配置
    execSync(`reg add "HKEY_CURRENT_USER\\Software\\AugmentDeviceManager" /v ServerHost /t REG_SZ /d "${host}" /f`, { stdio: 'ignore' });
    execSync(`reg add "HKEY_CURRENT_USER\\Software\\AugmentDeviceManager" /v ServerPort /t REG_DWORD /d ${port} /f`, { stdio: 'ignore' });
    execSync(`reg add "HKEY_CURRENT_USER\\Software\\AugmentDeviceManager" /v ServerProtocol /t REG_SZ /d "${protocol}" /f`, { stdio: 'ignore' });
    
    console.log('   ✅ 注册表配置完成');
  } catch (error) {
    console.log('   ⚠️ 注册表写入失败，跳过');
  }
}

// 创建全局配置文件
async function setupGlobalConfig(host, port, protocol) {
  console.log('📁 创建全局配置文件...');
  
  const config = {
    server: {
      host: host,
      port: port,
      protocol: protocol
    },
    client: {
      autoConnect: true,
      verifyInterval: 5 * 60 * 1000,
      reconnectDelay: 5000
    }
  };

  const globalConfigPaths = [
    path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'AugmentDeviceManager'),
    path.join(os.homedir(), 'Documents', 'AugmentDeviceManager'),
    path.join(__dirname, '../desktop-client')
  ];

  for (const configDir of globalConfigPaths) {
    try {
      await fs.ensureDir(configDir);
      const configFile = path.join(configDir, 'server-config.json');
      await fs.writeJson(configFile, config, { spaces: 2 });
      console.log(`   ✅ 已创建: ${configFile}`);
    } catch (error) {
      console.log(`   ⚠️ 创建失败: ${configDir}`);
    }
  }
}

// 更新默认配置
async function updateDefaultConfig(host, port, protocol) {
  console.log('⚙️ 更新默认配置...');
  
  const configPath = path.join(__dirname, '../desktop-client/src/config.js');
  
  if (!await fs.pathExists(configPath)) {
    throw new Error('配置文件不存在: ' + configPath);
  }

  let content = await fs.readFile(configPath, 'utf8');

  // 替换默认配置
  const newConfig = `// 默认配置
const DEFAULT_CONFIG = {
  server: {
    host: "${host}", // 预设服务器地址
    port: ${port}, // 预设端口
    protocol: "${protocol}", // 预设协议
  },`;

  content = content.replace(
    /\/\/ 默认配置\s*\nconst DEFAULT_CONFIG = \{\s*\n\s*server: \{[^}]+\},/,
    newConfig
  );

  await fs.writeFile(configPath, content, 'utf8');
  console.log('   ✅ 默认配置已更新');
}

// 运行脚本
setupAutoConfig().catch(console.error);
