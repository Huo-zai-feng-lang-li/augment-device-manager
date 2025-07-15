/**
 * 生成5分钟有效期的测试激活码
 * 给你足够时间测试激活和过期验证
 */

const fetch = require('node-fetch');

async function generate5MinTestCode() {
  console.log('🧪 生成5分钟有效期的测试激活码...\n');
  
  try {
    // 1. 登录
    console.log('🔐 登录管理后台...');
    const loginResponse = await fetch('http://localhost:3002/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ 登录成功');
    
    // 2. 生成5分钟有效期的激活码
    console.log('📝 生成激活码...');
    const expiryDays = (5 * 60) / (24 * 60 * 60); // 5分钟转换为天数
    
    const createResponse = await fetch('http://localhost:3002/api/activation-codes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        deviceId: null,
        expiryDays: expiryDays,
        notes: '5分钟测试激活码'
      })
    });
    
    const createData = await createResponse.json();
    const code = createData.data.code;
    const expiresAt = createData.data.expiresAt;
    
    console.log('✅ 激活码生成成功:');
    console.log('   激活码:', code);
    console.log('   生成时间:', new Date().toLocaleString('zh-CN'));
    console.log('   过期时间:', new Date(expiresAt).toLocaleString('zh-CN'));
    console.log('   有效期: 5分钟');
    
    // 3. 验证激活码当前状态
    console.log('\n🔍 验证激活码状态...');
    const verifyResponse = await fetch('http://localhost:3002/api/verify-activation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: code,
        deviceId: 'test-device-id'
      })
    });
    
    const verifyData = await verifyResponse.json();
    console.log('📊 当前状态:', verifyData.valid ? '✅ 有效' : '❌ 无效');
    if (!verifyData.valid) {
      console.log('   原因:', verifyData.reason);
    }
    
    console.log('\n📋 测试步骤:');
    console.log('1. 🚀 立即启动客户端应用');
    console.log('2. 📝 使用激活码激活:', code);
    console.log('3. ✅ 验证激活成功后，测试清理功能');
    console.log('4. ⏰ 等待5分钟后再次测试清理功能');
    console.log('5. 🚨 应该会提示"激活码已过期"');
    
    console.log('\n🛡️ 安全测试:');
    console.log('- 修改本地时间无法绕过验证');
    console.log('- 断网会触发安全阻止机制');
    console.log('- 服务端也使用在线时间验证');
    
    // 4. 定时提醒
    const expiryTime = new Date(expiresAt).getTime();
    
    setTimeout(() => {
      console.log('\n⚠️  提醒: 激活码还有1分钟过期');
    }, 4 * 60 * 1000); // 4分钟后提醒
    
    setTimeout(async () => {
      console.log('\n🚨 激活码已过期！现在测试过期验证...');
      
      try {
        const expiredVerifyResponse = await fetch('http://localhost:3002/api/verify-activation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: code,
            deviceId: 'test-device-id'
          })
        });
        
        const expiredVerifyData = await expiredVerifyResponse.json();
        console.log('📊 过期验证结果:', expiredVerifyData.valid ? '仍然有效' : '✅ 已正确过期');
        console.log('   原因:', expiredVerifyData.reason);
      } catch (error) {
        console.error('验证过期状态失败:', error.message);
      }
    }, 5 * 60 * 1000); // 5分钟后验证过期
    
  } catch (error) {
    console.error('❌ 生成测试激活码失败:', error.message);
  }
}

// 运行生成器
generate5MinTestCode().catch(console.error);
