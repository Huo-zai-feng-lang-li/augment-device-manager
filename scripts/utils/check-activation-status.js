/**
 * 检查当前激活码状态
 * 查看激活码的实际过期时间
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function checkActivationStatus() {
  console.log('🔍 检查当前激活码状态...\n');
  
  try {
    // 获取配置文件路径
    const configDir = path.join(os.homedir(), '.augment-device-manager');
    const configPath = path.join(configDir, 'config.json');
    
    console.log('📁 配置文件路径:', configPath);
    
    // 检查配置文件是否存在
    if (!(await fs.pathExists(configPath))) {
      console.log('❌ 配置文件不存在，设备未激活');
      return;
    }
    
    // 读取配置文件
    const config = await fs.readJson(configPath);
    
    if (!config.activation) {
      console.log('❌ 配置文件中没有激活信息');
      return;
    }
    
    console.log('✅ 找到激活信息:');
    console.log('   激活码:', config.activation.code ? config.activation.code.substring(0, 8) + '...' : '未知');
    console.log('   激活时间:', config.activation.activatedAt ? new Date(config.activation.activatedAt).toLocaleString('zh-CN') : '未知');
    console.log('   过期时间:', config.activation.expiresAt ? new Date(config.activation.expiresAt).toLocaleString('zh-CN') : '未知');
    
    if (config.activation.expiresAt) {
      const now = new Date();
      const expiry = new Date(config.activation.expiresAt);
      const isExpired = now > expiry;
      const timeLeft = expiry - now;
      
      console.log('\n📊 状态分析:');
      console.log('   当前本地时间:', now.toLocaleString('zh-CN'));
      console.log('   激活码过期时间:', expiry.toLocaleString('zh-CN'));
      console.log('   基于本地时间状态:', isExpired ? '❌ 已过期' : '✅ 未过期');
      
      if (!isExpired) {
        const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
        console.log('   剩余时间:', daysLeft, '天');
      }
      
      console.log('\n🌐 在线时间验证:');
      console.log('   注意: 实际验证会使用在线北京时间，不是本地时间');
      console.log('   如果你修改了本地时间，系统仍会使用真实的在线时间进行验证');
    }
    
  } catch (error) {
    console.error('❌ 检查激活状态失败:', error.message);
  }
}

// 运行检查
checkActivationStatus().catch(console.error);
