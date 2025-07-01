const { DeviceIdGuardian } = require('../src/device-id-guardian');

/**
 * 测试设备ID守护者
 */

async function testGuardian() {
  console.log('🧪 测试设备ID守护者');
  console.log('==================================================');

  const guardian = new DeviceIdGuardian();
  const targetDeviceId = '5a2321f0-89b2-4942-b9ae-2d66b3167c47';

  try {
    // 启动守护
    await guardian.startGuarding(targetDeviceId);

    // 检查状态
    const status = await guardian.getStatus();
    console.log('\n📊 当前状态:');
    console.log(`  守护状态: ${status.isGuarding ? '✅ 运行中' : '❌ 未运行'}`);
    console.log(`  目标ID: ${status.targetDeviceId}`);
    console.log(`  当前ID: ${status.currentDeviceId}`);
    console.log(`  保护状态: ${status.isProtected ? '✅ 受保护' : '❌ 未保护'}`);

    // 持续监控30秒
    console.log('\n⏰ 开始30秒监控测试...');
    console.log('请在此期间启动Cursor IDE');
    
    for (let i = 30; i > 0; i--) {
      process.stdout.write(`\r⏳ 剩余时间: ${i}秒 `);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 每5秒检查一次状态
      if (i % 5 === 0) {
        const currentStatus = await guardian.getStatus();
        if (!currentStatus.isProtected) {
          console.log('\n🚨 检测到设备ID被修改！');
        }
      }
    }

    console.log('\n\n📋 最终状态:');
    const finalStatus = await guardian.getStatus();
    console.log(`  目标ID: ${finalStatus.targetDeviceId}`);
    console.log(`  当前ID: ${finalStatus.currentDeviceId}`);
    console.log(`  保护状态: ${finalStatus.isProtected ? '✅ 成功保护' : '❌ 保护失败'}`);

    // 停止守护
    await guardian.stopGuarding();
    
    if (finalStatus.isProtected) {
      console.log('\n🎉 守护者测试成功！设备ID已受保护');
    } else {
      console.log('\n⚠️ 守护者需要进一步优化');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
if (require.main === module) {
  testGuardian()
    .then(() => {
      console.log('\n✅ 测试完成');
    })
    .catch(error => {
      console.error('❌ 测试出错:', error);
    });
}

module.exports = { testGuardian };
