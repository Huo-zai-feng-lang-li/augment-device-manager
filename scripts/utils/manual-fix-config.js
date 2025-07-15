/**
 * 手动修复配置文件 - 不依赖网络时间API
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function manualFixConfig() {
  console.log('🔧 手动修复客户端配置文件...\n');
  
  try {
    const configPath = path.join(os.homedir(), '.augment-device-manager');
    const configFile = path.join(configPath, 'config.json');
    
    // 使用之前生成的有效激活码
    const validActivation = {
      code: '6F7D499A29EAACCBC053141CC1759BCD',
      deviceId: 'c85f8e929c3c14ab',
      activatedAt: '2025-08-03T08:50:00.000Z',
      // 设置一个未来的过期时间（2025年12月31日）
      expiresAt: '2025-12-31T23:59:59.000Z',
      version: '1.0.0'
    };
    
    const config = {
      activation: validActivation,
      lastUpdated: '2025-08-03T08:50:00.000Z'
    };
    
    console.log('📋 配置信息:');
    console.log('   激活码:', validActivation.code);
    console.log('   设备ID:', validActivation.deviceId);
    console.log('   激活时间:', new Date(validActivation.activatedAt).toLocaleString('zh-CN'));
    console.log('   过期时间:', new Date(validActivation.expiresAt).toLocaleString('zh-CN'));
    
    // 确保目录存在
    await fs.ensureDir(configPath);
    
    // 备份现有配置
    if (await fs.pathExists(configFile)) {
      const backupFile = configFile + '.manual-fix-backup.' + Date.now();
      await fs.copy(configFile, backupFile);
      console.log('\n📁 已备份现有配置:', path.basename(backupFile));
    }
    
    // 写入新配置
    await fs.writeJson(configFile, config, { spaces: 2 });
    
    console.log('\n✅ 配置文件已更新:', configFile);
    
    // 验证写入结果
    const savedConfig = await fs.readJson(configFile);
    if (savedConfig.activation && savedConfig.activation.code === validActivation.code) {
      console.log('✅ 配置验证通过');
      
      console.log('\n🎉 手动修复完成！');
      console.log('💡 关键修复内容:');
      console.log('   1. 移除了客户端main.js中的本地时间过期检查');
      console.log('   2. 设置了未来的过期时间（2025年12月31日）');
      console.log('   3. 使用已验证的有效激活码');
      console.log('\n🔄 现在请重启客户端应用测试激活状态');
    } else {
      console.log('❌ 配置验证失败');
    }
    
  } catch (error) {
    console.error('❌ 手动修复失败:', error.message);
  }
}

// 运行手动修复
manualFixConfig().catch(console.error);
