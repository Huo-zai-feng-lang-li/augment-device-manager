const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * 为全新安装的Cursor准备干净的配置
 * 确保从一开始就是新用户身份
 */

async function prepareFreshCursor() {
  console.log('🆕 为全新Cursor安装准备配置');
  console.log('==================================================');

  const results = {
    success: true,
    actions: [],
    errors: []
  };

  try {
    // 第1步：清理旧的Cursor配置目录
    console.log('\n🧹 第1步：清理旧的Cursor配置...');
    await cleanOldCursorConfig(results);

    // 第2步：预创建全新的配置
    console.log('\n🆔 第2步：预创建全新配置...');
    await createFreshConfig(results);

    // 第3步：设置防护措施
    console.log('\n🛡️ 第3步：设置防护措施...');
    await setupProtection(results);

  } catch (error) {
    console.error('❌ 准备过程出错:', error);
    results.success = false;
    results.errors.push(error.message);
  }

  // 输出结果
  outputResults(results);
  return results;
}

// 清理旧的Cursor配置
async function cleanOldCursorConfig(results) {
  try {
    const oldConfigPaths = [
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor'),
      path.join(os.homedir(), 'AppData', 'Local', 'Cursor'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'cursor')
    ];

    for (const configPath of oldConfigPaths) {
      try {
        if (await fs.pathExists(configPath)) {
          // 创建备份（以防需要恢复）
          const backupPath = configPath + '.old_backup_' + Date.now();
          await fs.move(configPath, backupPath);
          
          results.actions.push(`📦 已备份旧配置: ${path.basename(configPath)}`);
          console.log(`  ✅ 已备份: ${configPath} -> ${path.basename(backupPath)}`);
        } else {
          console.log(`  ℹ️ 不存在: ${path.basename(configPath)}`);
        }
      } catch (error) {
        results.errors.push(`清理配置失败 ${path.basename(configPath)}: ${error.message}`);
      }
    }
  } catch (error) {
    results.errors.push(`清理旧配置失败: ${error.message}`);
  }
}

// 创建全新配置
async function createFreshConfig(results) {
  try {
    // 为新安装位置创建配置目录
    const newConfigPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor');
    const globalStoragePath = path.join(newConfigPath, 'User', 'globalStorage');
    
    await fs.ensureDir(globalStoragePath);

    // 生成全新的设备标识
    const newIdentifiers = {
      devDeviceId: crypto.randomUUID(),
      machineId: crypto.randomBytes(32).toString('hex'),
      macMachineId: crypto.randomBytes(32).toString('hex'),
      sessionId: crypto.randomUUID(),
      sqmId: `{${crypto.randomUUID().toUpperCase()}}`
    };

    // 创建storage.json
    const storageData = {
      'telemetry.devDeviceId': newIdentifiers.devDeviceId,
      'telemetry.machineId': newIdentifiers.machineId,
      'telemetry.macMachineId': newIdentifiers.macMachineId,
      'telemetry.sessionId': newIdentifiers.sessionId,
      'telemetry.sqmId': newIdentifiers.sqmId,
      'telemetry.firstSessionDate': new Date().toUTCString(),
      'telemetry.currentSessionDate': new Date().toUTCString()
    };

    const storageJsonPath = path.join(globalStoragePath, 'storage.json');
    await fs.writeJson(storageJsonPath, storageData, { spaces: 2 });

    results.actions.push(`🆔 新设备ID: ${newIdentifiers.devDeviceId}`);
    console.log(`  ✅ 新设备ID: ${newIdentifiers.devDeviceId}`);

    // 创建用户设置文件
    const userSettingsPath = path.join(newConfigPath, 'User', 'settings.json');
    const userSettings = {
      'telemetry.enableTelemetry': false,
      'telemetry.enableCrashReporter': false,
      'workbench.enableExperiments': false,
      'extensions.autoUpdate': false
    };

    await fs.ensureDir(path.dirname(userSettingsPath));
    await fs.writeJson(userSettingsPath, userSettings, { spaces: 2 });

    results.actions.push('⚙️ 已创建用户设置');
    console.log('  ✅ 用户设置已创建');

  } catch (error) {
    results.errors.push(`创建配置失败: ${error.message}`);
  }
}

// 设置防护措施
async function setupProtection(results) {
  try {
    // 创建防护标记文件
    const protectionPath = path.join(
      os.homedir(), 
      'AppData', 
      'Roaming', 
      'Cursor', 
      'User', 
      'globalStorage',
      '.fresh_install_protection'
    );

    const protectionData = {
      created: new Date().toISOString(),
      purpose: 'Prevent old device ID restoration',
      installLocation: 'E:\\cursor',
      note: 'This is a fresh Cursor installation'
    };

    await fs.writeJson(protectionPath, protectionData, { spaces: 2 });
    
    results.actions.push('🛡️ 已设置防护标记');
    console.log('  ✅ 防护标记已设置');

    // 设置文件只读属性（防止被覆盖）
    const storageJsonPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );

    try {
      // 在Windows上设置只读属性
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      await execAsync(`attrib +R "${storageJsonPath}"`);
      results.actions.push('🔒 已设置文件只读保护');
      console.log('  ✅ 文件只读保护已设置');
    } catch (error) {
      console.log('  ⚠️ 无法设置只读保护（权限不足）');
    }

  } catch (error) {
    results.errors.push(`设置防护失败: ${error.message}`);
  }
}

// 输出结果
function outputResults(results) {
  console.log('\n📋 全新Cursor准备报告');
  console.log('==================================================');
  console.log(`状态: ${results.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`执行操作: ${results.actions.length} 项`);
  console.log(`错误数量: ${results.errors.length} 项`);

  if (results.actions.length > 0) {
    console.log('\n✅ 成功操作:');
    results.actions.forEach(action => console.log(`  • ${action}`));
  }

  if (results.errors.length > 0) {
    console.log('\n❌ 错误信息:');
    results.errors.forEach(error => console.log(`  • ${error}`));
  }

  console.log('\n🎯 下一步:');
  console.log('1. 完成Cursor安装到 E:\\cursor');
  console.log('2. 首次启动Cursor IDE');
  console.log('3. 检查设备ID是否为新生成的ID');
  console.log('4. 测试Augment扩展是否认为是新用户');
  console.log('5. 如果成功，删除旧配置备份');
}

// 主函数
if (require.main === module) {
  prepareFreshCursor()
    .then(results => {
      console.log('\n🎉 全新Cursor准备完成！');
      
      if (results.success) {
        console.log('✅ 配置已准备就绪，可以启动全新的Cursor了');
      } else {
        console.log('⚠️ 准备过程中遇到一些问题，请检查错误信息');
      }
    })
    .catch(error => {
      console.error('❌ 准备失败:', error);
    });
}

module.exports = { prepareFreshCursor };
