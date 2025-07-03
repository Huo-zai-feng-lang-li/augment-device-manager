/**
 * 检查客户端配置文件中的激活信息
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function checkClientConfig() {
  console.log('🔍 检查客户端配置文件...\n');
  
  try {
    const configPath = path.join(os.homedir(), '.augment-device-manager');
    const configFile = path.join(configPath, 'config.json');
    
    console.log('📁 配置目录:', configPath);
    console.log('📄 配置文件:', configFile);
    
    // 检查配置目录是否存在
    if (await fs.pathExists(configPath)) {
      console.log('✅ 配置目录存在');
      
      // 列出目录内容
      const files = await fs.readdir(configPath);
      console.log('📂 目录内容:', files);
    } else {
      console.log('❌ 配置目录不存在');
      return;
    }
    
    // 检查配置文件是否存在
    if (await fs.pathExists(configFile)) {
      console.log('✅ 配置文件存在');
      
      // 读取配置文件
      const config = await fs.readJson(configFile);
      console.log('\n📋 配置文件内容:');
      console.log(JSON.stringify(config, null, 2));
      
      // 分析激活信息
      if (config.activation) {
        console.log('\n🔑 激活信息分析:');
        console.log('   激活码:', config.activation.code);
        console.log('   设备ID:', config.activation.deviceId ? config.activation.deviceId.substring(0, 16) + '...' : '未知');
        console.log('   激活时间:', config.activation.activatedAt ? new Date(config.activation.activatedAt).toLocaleString('zh-CN') : '未知');
        console.log('   过期时间:', config.activation.expiresAt ? new Date(config.activation.expiresAt).toLocaleString('zh-CN') : '未知');
        
        // 时间分析
        if (config.activation.expiresAt) {
          const now = new Date();
          const expiryTime = new Date(config.activation.expiresAt);
          const timeDiff = expiryTime - now;
          
          console.log('\n⏰ 时间分析:');
          console.log('   当前时间:', now.toLocaleString('zh-CN'));
          console.log('   过期时间:', expiryTime.toLocaleString('zh-CN'));
          console.log('   时间差:', Math.round(timeDiff / 1000), '秒');
          console.log('   本地检查结果:', timeDiff > 0 ? '未过期' : '已过期');
          
          if (timeDiff <= 0) {
            console.log('❌ 问题确认: 客户端本地检查发现激活码已过期');
            console.log('💡 这就是为什么客户端显示"设备未激活"的原因');
          }
        }
      } else {
        console.log('❌ 配置文件中没有激活信息');
      }
      
    } else {
      console.log('❌ 配置文件不存在');
    }
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  }
}

// 运行检查
checkClientConfig().catch(console.error);
