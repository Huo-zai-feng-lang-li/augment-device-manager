/**
 * 检查备份配置文件中的激活信息
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function checkBackupConfigs() {
  console.log('🔍 检查备份配置文件...\n');
  
  try {
    const configPath = path.join(os.homedir(), '.augment-device-manager');
    
    // 获取所有备份文件
    const files = await fs.readdir(configPath);
    const backupFiles = files.filter(file => 
      file.includes('config') && 
      (file.includes('backup') || file.endsWith('.json'))
    ).sort().reverse(); // 按时间倒序
    
    console.log('📂 找到的配置相关文件:');
    backupFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`);
    });
    
    // 检查最新的几个备份文件
    console.log('\n🔍 检查最新的备份文件...');
    
    for (let i = 0; i < Math.min(3, backupFiles.length); i++) {
      const file = backupFiles[i];
      const filePath = path.join(configPath, file);
      
      console.log(`\n📄 检查文件: ${file}`);
      
      try {
        const config = await fs.readJson(filePath);
        
        if (config.activation) {
          console.log('✅ 找到激活信息:');
          console.log('   激活码:', config.activation.code);
          console.log('   激活时间:', config.activation.activatedAt ? new Date(config.activation.activatedAt).toLocaleString('zh-CN') : '未知');
          console.log('   过期时间:', config.activation.expiresAt ? new Date(config.activation.expiresAt).toLocaleString('zh-CN') : '未知');
          
          // 时间分析
          if (config.activation.expiresAt) {
            const now = new Date();
            const expiryTime = new Date(config.activation.expiresAt);
            const timeDiff = expiryTime - now;
            
            console.log('   时间差:', Math.round(timeDiff / 1000), '秒');
            console.log('   状态:', timeDiff > 0 ? '未过期' : '已过期');
          }
          
          // 如果这是最新的激活信息，恢复它
          if (i === 0 && config.activation.code === 'A7C4189DA7B397487516D1CD30C06295') {
            console.log('\n🔄 这是当前激活码的配置，准备恢复...');
            
            const mainConfigFile = path.join(configPath, 'config.json');
            await fs.writeJson(mainConfigFile, config, { spaces: 2 });
            console.log('✅ 配置文件已恢复');
            
            break;
          }
        } else {
          console.log('❌ 此文件没有激活信息');
        }
        
      } catch (error) {
        console.log('❌ 读取文件失败:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  }
}

// 运行检查
checkBackupConfigs().catch(console.error);
