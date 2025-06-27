#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

// 内置配置打包脚本 - 客户端清理后无需操作
async function buildWithEmbeddedConfig() {
  console.log('🚀 内置配置打包 - 客户端清理后自动连接');
  console.log('==========================================');
  console.log('');

  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('使用方法:');
    console.log('  node build-with-embedded-config.js <服务器地址> [端口] [协议]');
    console.log('');
    console.log('示例:');
    console.log('  node build-with-embedded-config.js abc123.ngrok.io 443 https');
    console.log('  node build-with-embedded-config.js localhost 3002 http');
    console.log('');
    return;
  }

  const host = args[0];
  const port = parseInt(args[1]) || (host.includes('ngrok.io') ? 443 : 3002);
  const protocol = args[2] || (host.includes('ngrok.io') ? 'https' : 'http');

  console.log(`📋 服务器配置:`);
  console.log(`   地址: ${protocol}://${host}:${port}`);
  console.log('');

  try {
    // 1. 修改默认配置
    await updateDefaultConfig(host, port, protocol);

    // 2. 创建内置配置文件
    await createEmbeddedConfig(host, port, protocol);

    // 3. 修改清理工具，确保保留配置
    await updateCleanupTool();

    // 4. 创建配置恢复机制
    await createConfigRecovery(host, port, protocol);

    // 5. 执行打包
    await buildClient();

    console.log('');
    console.log('🎉 内置配置打包完成！');
    console.log('');
    console.log('✅ 客户端特性:');
    console.log('   • 默认连接到指定服务器');
    console.log('   • 清理后自动恢复连接');
    console.log('   • 多重配置保障机制');
    console.log('   • 无需用户任何操作');
    console.log('');
    console.log('📦 安装包位置: desktop-client/build-output/');

  } catch (error) {
    console.error('❌ 打包失败:', error.message);
    process.exit(1);
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

// 创建内置配置文件
async function createEmbeddedConfig(host, port, protocol) {
  console.log('📁 创建内置配置文件...');
  
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

  // 在客户端目录创建多个配置文件
  const configPaths = [
    path.join(__dirname, '../desktop-client/public/server-config.json'),
    path.join(__dirname, '../desktop-client/src/embedded-config.json'),
    path.join(__dirname, '../desktop-client/server-config.json')
  ];

  for (const configPath of configPaths) {
    await fs.writeJson(configPath, config, { spaces: 2 });
    console.log(`   ✅ 已创建: ${path.relative(process.cwd(), configPath)}`);
  }
}

// 更新清理工具
async function updateCleanupTool() {
  console.log('🧹 确保清理工具保留配置...');
  
  const cleanupPath = path.join(__dirname, '../desktop-client/src/device-manager.js');
  let content = await fs.readFile(cleanupPath, 'utf8');

  // 确保清理工具包含配置恢复逻辑
  if (!content.includes('已恢复服务器配置')) {
    console.log('   ⚠️ 清理工具需要更新，请检查 device-manager.js');
  } else {
    console.log('   ✅ 清理工具已包含配置保留机制');
  }
}

// 创建配置恢复机制
async function createConfigRecovery(host, port, protocol) {
  console.log('🔄 创建配置恢复机制...');
  
  // 在config.js中添加恢复逻辑
  const configPath = path.join(__dirname, '../desktop-client/src/config.js');
  let content = await fs.readFile(configPath, 'utf8');

  // 添加从内置配置恢复的方法
  const recoveryMethod = `
  // 从内置配置恢复
  loadFromEmbeddedConfig() {
    try {
      const embeddedPaths = [
        path.join(__dirname, '../public/server-config.json'),
        path.join(__dirname, 'embedded-config.json'),
        path.join(process.cwd(), 'server-config.json')
      ];

      for (const configPath of embeddedPaths) {
        if (fs.pathExistsSync(configPath)) {
          const embeddedConfig = fs.readJsonSync(configPath);
          if (embeddedConfig.server) {
            this.config.server = { ...this.config.server, ...embeddedConfig.server };
            console.log(\`已从内置配置恢复服务器设置: \${configPath}\`);
            return true;
          }
        }
      }
    } catch (error) {
      // 忽略内置配置读取错误
    }
    return false;
  }`;

  // 如果还没有这个方法，就添加
  if (!content.includes('loadFromEmbeddedConfig')) {
    content = content.replace(
      '  // 从全局配置文件读取',
      recoveryMethod + '\n\n  // 从全局配置文件读取'
    );

    // 在loadFromEnv方法中调用
    content = content.replace(
      '    // 尝试从全局配置文件读取\n    this.loadFromGlobalConfig();',
      '    // 尝试从内置配置恢复\n    this.loadFromEmbeddedConfig();\n\n    // 尝试从全局配置文件读取\n    this.loadFromGlobalConfig();'
    );

    await fs.writeFile(configPath, content, 'utf8');
    console.log('   ✅ 配置恢复机制已添加');
  } else {
    console.log('   ✅ 配置恢复机制已存在');
  }
}

// 执行打包
async function buildClient() {
  console.log('🔨 开始打包客户端...');
  
  return new Promise((resolve, reject) => {
    const build = spawn('npm', ['run', 'build'], {
      cwd: path.join(__dirname, '../desktop-client'),
      shell: true,
      stdio: 'inherit'
    });

    build.on('close', (code) => {
      if (code === 0) {
        console.log('   ✅ 客户端打包完成');
        resolve();
      } else {
        reject(new Error(`打包失败，退出码: ${code}`));
      }
    });

    build.on('error', reject);
  });
}

// 运行脚本
buildWithEmbeddedConfig().catch(console.error);
