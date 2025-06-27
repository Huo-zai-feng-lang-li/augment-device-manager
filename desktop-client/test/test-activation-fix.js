// 测试激活状态保留修复效果
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

async function testActivationFix() {
  console.log('🔧 测试激活状态保留修复效果...\n');

  const configDir = path.join(os.homedir(), '.augment-device-manager');
  const configFile = path.join(configDir, 'config.json');

  try {
    // 1. 检查当前配置文件结构
    console.log('📋 1. 检查当前配置文件结构');
    
    if (await fs.pathExists(configFile)) {
      const config = await fs.readJson(configFile);
      console.log('  ✅ 配置文件存在');
      console.log('  📄 配置文件结构:');
      
      if (config.activation) {
        console.log('    ✅ 激活信息存在');
        console.log(`    📝 激活码: ${config.activation.code ? config.activation.code.substring(0, 8) + '...' : '未设置'}`);
        console.log(`    🆔 设备ID: ${config.activation.deviceId ? config.activation.deviceId.substring(0, 16) + '...' : '未设置'}`);
        console.log(`    📅 激活时间: ${config.activation.activatedAt || '未设置'}`);
        console.log(`    ⏰ 过期时间: ${config.activation.expiresAt || '未设置'}`);
      } else {
        console.log('    ❌ 激活信息不存在');
      }
      
      if (config.server) {
        console.log('    ✅ 服务器配置存在');
      } else {
        console.log('    ❌ 服务器配置不存在');
      }
      
      console.log(`    📝 最后更新: ${config.lastUpdated || '未设置'}`);
    } else {
      console.log('  ❌ 配置文件不存在');
    }

    // 2. 模拟创建测试激活配置
    console.log('\n📋 2. 创建测试激活配置');
    
    const testConfig = {
      activation: {
        code: 'a1b2c3d4e5f6789012345678901234567890abcd',
        deviceId: 'test-device-id-12345678-1234-1234-1234-123456789012',
        activatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        version: '1.0'
      },
      server: {
        url: 'http://localhost:3000',
        lastConnected: new Date().toISOString()
      },
      lastUpdated: new Date().toISOString()
    };

    // 确保配置目录存在
    await fs.ensureDir(configDir);
    
    // 备份现有配置（如果存在）
    if (await fs.pathExists(configFile)) {
      const backupPath = configFile + '.original.backup';
      await fs.copy(configFile, backupPath);
      console.log(`  💾 已备份原配置到: ${backupPath}`);
    }

    // 写入测试配置
    await fs.writeJson(configFile, testConfig, { spaces: 2 });
    console.log('  ✅ 测试配置已创建');

    // 3. 测试激活状态保留逻辑
    console.log('\n📋 3. 测试激活状态保留逻辑');
    
    const DeviceManager = require('./src/device-manager');
    const deviceManager = new DeviceManager();
    
    const results = {
      success: true,
      actions: [],
      errors: []
    };

    // 模拟清理操作（保留激活状态）
    await deviceManager.cleanActivationData(results, { preserveActivation: true });
    
    console.log('  📊 清理操作结果:');
    if (results.actions.length > 0) {
      results.actions.forEach(action => {
        const icon = action.includes('✅') ? '' : action.includes('⚠️') ? '' : '  ';
        console.log(`    ${icon}${action}`);
      });
    }
    
    if (results.errors.length > 0) {
      console.log('  ❌ 错误信息:');
      results.errors.forEach(error => {
        console.log(`    • ${error}`);
      });
    }

    // 4. 验证激活状态是否正确保留
    console.log('\n📋 4. 验证激活状态保留效果');
    
    if (await fs.pathExists(configFile)) {
      const verifiedConfig = await fs.readJson(configFile);
      
      if (verifiedConfig.activation) {
        console.log('  ✅ 激活信息已保留');
        
        if (verifiedConfig.activation.code === testConfig.activation.code) {
          console.log('  ✅ 激活码正确保留');
        } else {
          console.log('  ❌ 激活码保留失败');
        }
        
        if (verifiedConfig.activation.deviceId === testConfig.activation.deviceId) {
          console.log('  ✅ 设备ID正确保留');
        } else {
          console.log('  ❌ 设备ID保留失败');
        }
        
        if (verifiedConfig.activation.expiresAt === testConfig.activation.expiresAt) {
          console.log('  ✅ 过期时间正确保留');
        } else {
          console.log('  ❌ 过期时间保留失败');
        }
      } else {
        console.log('  ❌ 激活信息丢失');
      }
      
      if (verifiedConfig.server) {
        console.log('  ✅ 服务器配置已保留');
      } else {
        console.log('  ❌ 服务器配置丢失');
      }
    } else {
      console.log('  ❌ 配置文件丢失');
    }

    // 5. 清理测试数据
    console.log('\n📋 5. 清理测试数据');
    
    // 恢复原始配置（如果存在备份）
    const originalBackup = configFile + '.original.backup';
    if (await fs.pathExists(originalBackup)) {
      await fs.copy(originalBackup, configFile);
      await fs.remove(originalBackup);
      console.log('  ✅ 已恢复原始配置');
    } else {
      // 如果没有原始配置，删除测试配置
      await fs.remove(configFile);
      console.log('  ✅ 已删除测试配置');
    }

    console.log('\n🎉 测试完成！');
    console.log('\n📋 修复总结:');
    console.log('✅ 1. 修正了配置文件结构不一致的问题');
    console.log('✅ 2. 改进了激活状态的备份和恢复机制');
    console.log('✅ 3. 添加了激活信息完整性验证');
    console.log('✅ 4. 增强了错误处理和日志反馈');

  } catch (error) {
    console.error('❌ 测试过程中出错:', error.message);
  }
}

// 运行测试
if (require.main === module) {
  testActivationFix();
}

module.exports = { testActivationFix };
