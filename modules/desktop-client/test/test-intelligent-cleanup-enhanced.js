// 测试增强后的智能清理模式
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

async function testEnhancedIntelligentCleanup() {
  console.log('🧪 测试增强后的智能清理模式...');
  console.log('=' .repeat(60));

  try {
    // 导入DeviceManager
    const DeviceManager = require('../src/device-manager');
    const deviceManager = new DeviceManager();

    // 1. 检查清理前的状态
    console.log('\n📊 第1步：检查清理前状态...');
    await checkPreCleanupState();

    // 2. 创建测试配置文件
    console.log('\n🔧 第2步：创建测试配置文件...');
    await createTestConfigs();

    // 3. 执行智能清理
    console.log('\n🧠 第3步：执行智能清理模式...');
    const cleanupResult = await deviceManager.performCleanup({
      intelligentMode: true,
      cleanCursor: true,
      cleanVSCode: false,
      skipBackup: true,
      preserveActivation: true
    });

    console.log(`\n📋 清理结果: ${cleanupResult.success ? '✅ 成功' : '❌ 失败'}`);
    
    if (cleanupResult.success) {
      console.log('\n✅ 成功操作:');
      cleanupResult.actions.forEach((action, index) => {
        console.log(`  ${index + 1}. ${action}`);
      });
    }

    if (cleanupResult.errors && cleanupResult.errors.length > 0) {
      console.log('\n❌ 错误信息:');
      cleanupResult.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    // 4. 验证保护效果
    console.log('\n🔍 第4步：验证保护效果...');
    await verifyProtectionEffectiveness();

    // 5. 验证设备ID更新
    console.log('\n🆔 第5步：验证设备ID更新...');
    await verifyDeviceIdUpdate();

    console.log('\n🎉 智能清理模式测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

// 检查清理前状态
async function checkPreCleanupState() {
  const paths = [
    // Cursor设置文件
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'settings.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'keybindings.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'snippets'),
    // MCP配置
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'augment.vscode-augment', 'augment-global-state', 'mcpServers.json'),
    // 工作区存储
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'workspaceStorage'),
    // 设备身份文件
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'storage.json'),
  ];

  for (const filePath of paths) {
    const exists = await fs.pathExists(filePath);
    const fileName = path.basename(filePath);
    console.log(`  ${exists ? '✅' : '❌'} ${fileName} - ${exists ? '存在' : '不存在'}`);
  }
}

// 创建测试配置文件
async function createTestConfigs() {
  try {
    // 创建测试的settings.json
    const settingsPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'settings.json');
    const testSettings = {
      "editor.fontSize": 14,
      "editor.tabSize": 2,
      "workbench.colorTheme": "Dark+ (default dark)",
      "files.autoSave": "onFocusChange",
      "test.intelligentCleanup": true
    };
    
    await fs.ensureDir(path.dirname(settingsPath));
    await fs.writeJson(settingsPath, testSettings, { spaces: 2 });
    console.log('  ✅ 已创建测试settings.json');

    // 创建测试的keybindings.json
    const keybindingsPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'keybindings.json');
    const testKeybindings = [
      {
        "key": "ctrl+shift+p",
        "command": "workbench.action.showCommands"
      }
    ];
    
    await fs.writeJson(keybindingsPath, testKeybindings, { spaces: 2 });
    console.log('  ✅ 已创建测试keybindings.json');

    // 创建测试的MCP配置
    const mcpPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'augment.vscode-augment', 'augment-global-state', 'mcpServers.json');
    const testMcpConfig = {
      "test-server": {
        "command": "node",
        "args": ["test-server.js"],
        "env": {}
      }
    };
    
    await fs.ensureDir(path.dirname(mcpPath));
    await fs.writeJson(mcpPath, testMcpConfig, { spaces: 2 });
    console.log('  ✅ 已创建测试MCP配置');

    // 创建测试的代码片段
    const snippetsDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'snippets');
    const testSnippet = {
      "Test Snippet": {
        "prefix": "test",
        "body": ["console.log('test');"],
        "description": "Test snippet for intelligent cleanup"
      }
    };
    
    await fs.ensureDir(snippetsDir);
    await fs.writeJson(path.join(snippetsDir, 'javascript.json'), testSnippet, { spaces: 2 });
    console.log('  ✅ 已创建测试代码片段');

  } catch (error) {
    console.error('  ❌ 创建测试配置失败:', error.message);
  }
}

// 验证保护效果
async function verifyProtectionEffectiveness() {
  const protectedFiles = [
    // IDE设置文件
    { path: path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'settings.json'), name: 'settings.json' },
    { path: path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'keybindings.json'), name: 'keybindings.json' },
    { path: path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'snippets', 'javascript.json'), name: 'javascript.json' },
    // MCP配置
    { path: path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'augment.vscode-augment', 'augment-global-state', 'mcpServers.json'), name: 'mcpServers.json' },
  ];

  let protectedCount = 0;
  let totalCount = protectedFiles.length;

  for (const file of protectedFiles) {
    const exists = await fs.pathExists(file.path);
    if (exists) {
      try {
        const content = await fs.readJson(file.path);
        if (Object.keys(content).length > 0) {
          console.log(`  ✅ ${file.name} - 已保护且内容完整`);
          protectedCount++;
        } else {
          console.log(`  ⚠️ ${file.name} - 文件存在但内容为空`);
        }
      } catch (error) {
        console.log(`  ⚠️ ${file.name} - 文件存在但格式异常`);
      }
    } else {
      console.log(`  ❌ ${file.name} - 文件丢失`);
    }
  }

  const protectionRate = (protectedCount / totalCount * 100).toFixed(1);
  console.log(`\n📊 保护效果统计:`);
  console.log(`  保护成功: ${protectedCount}/${totalCount} (${protectionRate}%)`);
  
  if (protectionRate >= 90) {
    console.log(`  🎉 保护效果优秀！`);
  } else if (protectionRate >= 70) {
    console.log(`  👍 保护效果良好`);
  } else {
    console.log(`  ⚠️ 保护效果需要改进`);
  }
}

// 验证设备ID更新
async function verifyDeviceIdUpdate() {
  try {
    const storageJsonPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'storage.json');
    
    if (await fs.pathExists(storageJsonPath)) {
      const storageData = await fs.readJson(storageJsonPath);
      const deviceId = storageData['telemetry.devDeviceId'];
      
      if (deviceId) {
        console.log(`  ✅ 设备ID已更新: ${deviceId.substring(0, 8)}...`);
        console.log(`  🎯 扩展将识别为新用户`);
      } else {
        console.log(`  ❌ 设备ID未找到`);
      }
    } else {
      console.log(`  ❌ storage.json文件不存在`);
    }
  } catch (error) {
    console.log(`  ❌ 验证设备ID失败: ${error.message}`);
  }
}

// 运行测试
if (require.main === module) {
  testEnhancedIntelligentCleanup();
}

module.exports = { testEnhancedIntelligentCleanup };
