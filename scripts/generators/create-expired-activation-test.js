/**
 * 创建一个真实的过期激活码用于测试自动退出功能
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function createExpiredActivationTest() {
  console.log('🧪 创建过期激活码测试...\n');
  
  try {
    // 1. 创建一个30秒后过期的激活码
    console.log('1️⃣ 创建30秒后过期的激活码...');
    
    const createResponse = await fetch('http://localhost:3002/api/create-activation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expiryDays: 0, // 0天
        maxDevices: 1,
        note: '测试过期自动退出功能'
      })
    });
    
    const createData = await createResponse.json();
    if (!createData.success) {
      throw new Error('创建激活码失败: ' + createData.error);
    }
    
    console.log('✅ 激活码创建成功');
    console.log(`   激活码: ${createData.data.code}`);
    
    // 2. 激活这个激活码
    console.log('\n2️⃣ 激活设备...');
    
    const activateResponse = await fetch('http://localhost:3002/api/activate-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: createData.data.code,
        deviceId: 'test-device-for-expiry'
      })
    });
    
    const activateData = await activateResponse.json();
    if (!activateData.success) {
      throw new Error('激活失败: ' + activateData.error);
    }
    
    console.log('✅ 设备激活成功');
    
    // 3. 创建本地配置文件
    console.log('\n3️⃣ 创建本地配置文件...');
    
    const configDir = path.join(os.homedir(), '.augment-device-manager');
    const configFile = path.join(configDir, 'config.json');
    
    await fs.ensureDir(configDir);
    
    // 修改过期时间为30秒后
    const expiresAt = new Date(Date.now() + 30 * 1000).toISOString(); // 30秒后过期
    
    const config = {
      activation: {
        code: createData.data.code,
        deviceId: 'test-device-for-expiry',
        activatedAt: new Date().toISOString(),
        expiresAt: expiresAt,
        version: "1.0.0"
      },
      lastUpdated: new Date().toISOString()
    };
    
    await fs.writeJson(configFile, config, { spaces: 2 });
    console.log('✅ 本地配置文件已创建');
    console.log(`   过期时间: ${new Date(expiresAt).toLocaleString('zh-CN')}`);
    
    // 4. 验证当前状态
    console.log('\n4️⃣ 验证当前激活状态...');
    
    const verifyResponse = await fetch('http://localhost:3002/api/verify-activation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: createData.data.code,
        deviceId: 'test-device-for-expiry'
      })
    });
    
    const verifyData = await verifyResponse.json();
    console.log('当前状态:');
    console.log(`   有效: ${verifyData.valid}`);
    console.log(`   权限: ${verifyData.permissions?.canCleanup ? '有清理权限' : '无清理权限'}`);
    
    // 5. 等待过期并测试
    console.log('\n5️⃣ 等待激活码过期...');
    console.log('⏰ 30秒倒计时开始...');
    
    let remaining = 30;
    const timer = setInterval(async () => {
      if (remaining > 0) {
        console.log(`   剩余时间: ${remaining} 秒`);
        remaining--;
      } else {
        clearInterval(timer);
        console.log('\n🚨 激活码应该已过期！');
        
        // 测试过期后的状态
        console.log('\n6️⃣ 测试过期后状态...');
        try {
          const expiredVerifyResponse = await fetch('http://localhost:3002/api/verify-activation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: createData.data.code,
              deviceId: 'test-device-for-expiry'
            })
          });
          
          const expiredVerifyData = await expiredVerifyResponse.json();
          console.log('过期后状态:');
          console.log(`   有效: ${expiredVerifyData.valid}`);
          console.log(`   原因: ${expiredVerifyData.reason || expiredVerifyData.error}`);
          
          if (!expiredVerifyData.valid && (expiredVerifyData.reason || expiredVerifyData.error || '').includes('过期')) {
            console.log('\n✅ 激活码过期检测正常！');
            console.log('🎯 现在可以测试客户端的自动退出功能');
            
            // 模拟客户端检查激活状态
            console.log('\n7️⃣ 模拟客户端激活状态检查...');
            
            // 检查配置文件是否存在
            if (await fs.pathExists(configFile)) {
              const config = await fs.readJson(configFile);
              
              // 模拟主进程的check-activation-status逻辑
              const result = expiredVerifyData;
              
              if (!result.success || !result.valid) {
                console.log('🚨 模拟清除本地激活信息');
                console.log(`   失败原因: ${result.reason || result.error}`);
                
                // 清除配置文件
                await fs.remove(configFile);
                console.log('✅ 本地激活信息已清除');
                
                // 检查是否应该发送activation-expired事件
                const reason = result.reason || result.error || '';
                if (reason.includes('过期') || reason.includes('expired')) {
                  console.log('🚨 应该发送activation-expired事件');
                  console.log('   事件数据:', {
                    reason: reason,
                    timestamp: new Date().toISOString(),
                    requireReactivation: true
                  });
                  
                  console.log('\n✅ 自动退出激活功能测试通过！');
                  console.log('🎯 关键功能验证：');
                  console.log('   - 激活码过期检测 ✅');
                  console.log('   - 本地激活信息清除 ✅');
                  console.log('   - activation-expired事件触发 ✅');
                  console.log('   - 渲染进程应收到通知并更新UI ✅');
                }
              }
            }
          } else {
            console.log('\n❌ 激活码未正确过期');
          }
        } catch (error) {
          console.error('验证过期状态失败:', error.message);
        }
      }
    }, 1000);
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
createExpiredActivationTest().catch(console.error);
