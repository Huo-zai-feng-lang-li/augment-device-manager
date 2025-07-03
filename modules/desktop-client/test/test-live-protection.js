const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * 实时保护测试 - 启动守护进程并立即测试
 * 确保守护进程正在运行时进行拦截测试
 */

async function testLiveProtection() {
  console.log('🚀 启动实时保护测试...\n');

  try {
    // 1. 导入并启动守护进程
    console.log('📦 导入守护进程...');
    const { EnhancedDeviceGuardian } = require('../src/enhanced-device-guardian');
    
    const guardian = new EnhancedDeviceGuardian();
    const targetDeviceId = 'd5c5ecfe-adfd-4a19-8325-c324932c9525';
    
    console.log('🛡️ 启动守护进程...');
    const startResult = await guardian.startGuarding(targetDeviceId);
    
    if (!startResult.success) {
      console.log('❌ 守护进程启动失败:', startResult.message);
      return;
    }
    
    console.log('✅ 守护进程启动成功');
    
    // 2. 等待监控器初始化
    console.log('⏳ 等待监控器初始化...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 3. 获取文件路径
    const storageJsonPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );
    
    // 4. 读取原始内容
    const originalContent = await fs.readJson(storageJsonPath);
    const originalDeviceId = originalContent['telemetry.devDeviceId'];
    console.log(`📱 原始设备ID: ${originalDeviceId}`);
    
    // 5. 执行实时拦截测试
    console.log('\n🧪 执行实时拦截测试...');
    
    const testDeviceId = 'live-test-' + Date.now();
    console.log(`✏️ 修改设备ID为: ${testDeviceId}`);
    
    // 修改文件
    const modifiedContent = { ...originalContent };
    modifiedContent['telemetry.devDeviceId'] = testDeviceId;
    await fs.writeJson(storageJsonPath, modifiedContent, { spaces: 2 });
    
    // 6. 监控恢复过程
    console.log('⏱️ 监控恢复过程...');
    let restored = false;
    let restoreTime = null;
    const startTime = Date.now();
    
    for (let i = 0; i < 100; i++) { // 最多等待10秒
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const currentContent = await fs.readJson(storageJsonPath);
      const currentDeviceId = currentContent['telemetry.devDeviceId'];
      
      const elapsed = Date.now() - startTime;
      
      // 每秒输出状态
      if (i % 10 === 0) {
        console.log(`  ${elapsed}ms: ${currentDeviceId}`);
      }
      
      if (currentDeviceId !== testDeviceId) {
        restored = true;
        restoreTime = elapsed;
        console.log(`\n🎉 拦截成功！设备ID已恢复`);
        console.log(`⚡ 响应时间: ${restoreTime}ms`);
        console.log(`🔄 恢复的设备ID: ${currentDeviceId}`);
        break;
      }
    }
    
    // 7. 测试结果
    if (restored) {
      console.log('\n✅ 实时监控拦截: 成功');
      
      if (restoreTime <= 1000) {
        console.log('🟢 性能评级: 优秀');
      } else if (restoreTime <= 3000) {
        console.log('🟡 性能评级: 良好');
      } else {
        console.log('🟠 性能评级: 一般');
      }
      
      // 测试连续拦截
      console.log('\n🔥 测试连续拦截能力...');
      let successCount = 0;
      const totalTests = 3;
      
      for (let i = 1; i <= totalTests; i++) {
        const rapidTestId = `rapid-${Date.now()}-${i}`;
        const rapidContent = { ...originalContent };
        rapidContent['telemetry.devDeviceId'] = rapidTestId;
        
        await fs.writeJson(storageJsonPath, rapidContent, { spaces: 2 });
        console.log(`  测试 ${i}: 修改为 ${rapidTestId}`);
        
        // 等待恢复
        let rapidRestored = false;
        for (let j = 0; j < 30; j++) { // 3秒内
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const checkContent = await fs.readJson(storageJsonPath);
          if (checkContent['telemetry.devDeviceId'] !== rapidTestId) {
            rapidRestored = true;
            successCount++;
            console.log(`    ✅ 恢复成功 (${(j + 1) * 100}ms)`);
            break;
          }
        }
        
        if (!rapidRestored) {
          console.log(`    ❌ 恢复失败`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const successRate = (successCount / totalTests) * 100;
      console.log(`📊 连续拦截成功率: ${successRate}%`);
      
    } else {
      console.log('\n❌ 实时监控拦截: 失败');
      
      // 手动恢复
      await fs.writeJson(storageJsonPath, originalContent, { spaces: 2 });
      console.log('🔄 已手动恢复原始设备ID');
    }
    
    // 8. 测试临时文件拦截
    console.log('\n🚨 测试临时文件拦截...');
    const tempFilePath = storageJsonPath + '.vsctmp';
    
    const tempContent = { ...originalContent };
    tempContent['telemetry.devDeviceId'] = 'temp-live-test-' + Date.now();
    
    await fs.writeJson(tempFilePath, tempContent, { spaces: 2 });
    console.log('📝 创建临时文件');
    
    // 等待处理
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (await fs.pathExists(tempFilePath)) {
      const processedContent = await fs.readJson(tempFilePath);
      const processedId = processedContent['telemetry.devDeviceId'];
      
      if (processedId !== tempContent['telemetry.devDeviceId']) {
        console.log('✅ 临时文件拦截成功');
      } else {
        console.log('❌ 临时文件拦截失败');
      }
      
      await fs.remove(tempFilePath);
    } else {
      console.log('✅ 临时文件已被自动删除');
    }
    
    // 9. 获取守护进程统计
    console.log('\n📊 守护进程统计:');
    try {
      const status = guardian.getStatus();
      console.log(`  运行状态: ${status.isGuarding ? '✅ 运行中' : '❌ 未运行'}`);
      console.log(`  拦截次数: ${status.stats?.interceptedAttempts || 0}`);
      console.log(`  运行时长: ${status.stats?.startTime ? Math.round((Date.now() - new Date(status.stats.startTime).getTime()) / 1000) : 0}秒`);
    } catch (error) {
      console.log('  ⚠️ 无法获取统计信息');
    }
    
    // 10. 停止守护进程
    console.log('\n🛑 停止守护进程...');
    await guardian.stopGuarding();
    console.log('✅ 守护进程已停止');
    
    console.log('\n🎯 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    console.error('堆栈:', error.stack);
  }
}

// 运行测试
if (require.main === module) {
  testLiveProtection().catch(console.error);
}

module.exports = { testLiveProtection };
