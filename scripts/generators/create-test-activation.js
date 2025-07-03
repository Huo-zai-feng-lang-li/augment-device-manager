/**
 * 创建测试激活配置
 * 用于测试激活状态监控机制
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function createTestActivation() {
  console.log('🧪 创建测试激活配置...\n');
  
  try {
    const configDir = path.join(os.homedir(), '.augment-device-manager');
    const configFile = path.join(configDir, 'config.json');
    
    await fs.ensureDir(configDir);
    
    // 创建2分钟后过期的激活配置
    const expiryTime = new Date(Date.now() + 2 * 60 * 1000); // 2分钟后过期
    
    const config = {
      activation: {
        activated: true,
        code: "TEST1234567890ABCDEF1234567890AB",
        activatedAt: new Date().toISOString(),
        expiresAt: expiryTime.toISOString(),
        deviceId: "test-device-monitoring-" + Date.now()
      }
    };
    
    await fs.writeJson(configFile, config, { spaces: 2 });
    
    console.log('✅ 测试激活码配置已创建');
    console.log(`   激活时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log(`   过期时间: ${expiryTime.toLocaleString('zh-CN')}`);
    console.log(`   配置文件: ${configFile}`);
    console.log(`   设备ID: ${config.activation.deviceId}`);
    
    console.log('\n⏰ 测试计划:');
    console.log('1. 现在启动客户端应用');
    console.log('2. 启动增强防护功能');
    console.log('3. 等待2分钟让激活码过期');
    console.log('4. 观察增强防护是否在60秒内自动停止');
    console.log('5. 检查控制台日志确认自动停止操作');
    
    console.log('\n🔍 监控验证:');
    console.log('- 主进程监控: 每30秒检查，过期后30秒内应该停止');
    console.log('- 内置守护进程: 每60秒检查，过期后60秒内应该停止');
    console.log('- 独立守护服务: 每60秒检查，过期后60秒内应该退出');
    
    console.log('\n💡 验证命令:');
    console.log('- 检查激活状态: node check-activation-status.js');
    console.log('- 检查进程状态: tasklist | findstr node');
    console.log('- 检查日志文件: type %TEMP%\\augment-guardian.log');
    
  } catch (error) {
    console.error('❌ 创建测试激活配置失败:', error.message);
  }
}

// 运行
createTestActivation().catch(console.error);
