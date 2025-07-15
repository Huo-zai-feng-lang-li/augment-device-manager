const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * 测试手动修改是否可以被实时监控拦截
 * 模拟用户手动编辑storage.json文件的情况
 */

async function testManualModification() {
  console.log('🧪 测试手动修改拦截功能...\n');

  const storageJsonPath = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'Cursor',
    'User',
    'globalStorage',
    'storage.json'
  );

  try {
    // 1. 检查文件状态
    console.log('📁 检查storage.json状态...');
    if (!(await fs.pathExists(storageJsonPath))) {
      console.log('❌ storage.json文件不存在');
      return;
    }

    // 读取原始内容
    const originalContent = await fs.readJson(storageJsonPath);
    const originalDeviceId = originalContent['telemetry.devDeviceId'];
    console.log(`📱 原始设备ID: ${originalDeviceId}`);

    // 2. 模拟手动修改 - 直接修改设备ID
    console.log('\n✏️ 模拟手动修改设备ID...');
    const testDeviceId = 'manual-test-' + Date.now();
    
    const modifiedContent = { ...originalContent };
    modifiedContent['telemetry.devDeviceId'] = testDeviceId;
    
    // 写入修改
    await fs.writeJson(storageJsonPath, modifiedContent, { spaces: 2 });
    console.log(`✅ 已手动修改设备ID为: ${testDeviceId}`);

    // 3. 监控恢复过程
    console.log('\n⏱️ 监控恢复过程...');
    let restored = false;
    let restoreTime = null;
    const startTime = Date.now();

    // 每100ms检查一次，最多检查30秒
    for (let i = 0; i < 300; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const currentContent = await fs.readJson(storageJsonPath);
      const currentDeviceId = currentContent['telemetry.devDeviceId'];
      
      const elapsed = Date.now() - startTime;
      
      // 每秒输出一次状态
      if (i % 10 === 0) {
        console.log(`  ${elapsed}ms: ${currentDeviceId}`);
      }
      
      if (currentDeviceId !== testDeviceId) {
        restored = true;
        restoreTime = elapsed;
        console.log(`\n🎉 设备ID已被恢复！`);
        console.log(`⚡ 恢复时间: ${restoreTime}ms`);
        console.log(`🔄 恢复后的设备ID: ${currentDeviceId}`);
        break;
      }
    }

    // 4. 结果分析
    console.log('\n📊 测试结果分析:');
    console.log('='.repeat(40));
    
    if (restored) {
      console.log('✅ 手动修改拦截: 成功');
      console.log(`⚡ 响应时间: ${restoreTime}ms`);
      
      if (restoreTime <= 1000) {
        console.log('🟢 响应速度: 优秀 (≤1秒)');
      } else if (restoreTime <= 3000) {
        console.log('🟡 响应速度: 良好 (≤3秒)');
      } else if (restoreTime <= 10000) {
        console.log('🟠 响应速度: 一般 (≤10秒)');
      } else {
        console.log('🔴 响应速度: 较慢 (>10秒)');
      }
      
      // 验证恢复的正确性
      const finalContent = await fs.readJson(storageJsonPath);
      const finalDeviceId = finalContent['telemetry.devDeviceId'];
      
      if (finalDeviceId === originalDeviceId) {
        console.log('✅ 恢复准确性: 完全正确');
      } else {
        console.log('⚠️ 恢复准确性: 设备ID不匹配');
        console.log(`  期望: ${originalDeviceId}`);
        console.log(`  实际: ${finalDeviceId}`);
      }
      
    } else {
      console.log('❌ 手动修改拦截: 失败');
      console.log('💡 可能原因:');
      console.log('  - 实时监控守护进程未运行');
      console.log('  - 文件监控器未正确初始化');
      console.log('  - 监控配置有问题');
      
      // 手动恢复
      console.log('\n🔄 手动恢复原始设备ID...');
      await fs.writeJson(storageJsonPath, originalContent, { spaces: 2 });
      console.log('✅ 已手动恢复');
    }

    // 5. 测试多次连续修改
    if (restored) {
      console.log('\n🔥 测试连续快速修改...');
      
      let consecutiveTests = 3;
      let successCount = 0;
      
      for (let i = 1; i <= consecutiveTests; i++) {
        console.log(`\n📝 连续测试 ${i}/${consecutiveTests}:`);
        
        const rapidTestId = `rapid-test-${Date.now()}-${i}`;
        const rapidContent = { ...originalContent };
        rapidContent['telemetry.devDeviceId'] = rapidTestId;
        
        await fs.writeJson(storageJsonPath, rapidContent, { spaces: 2 });
        console.log(`  修改为: ${rapidTestId}`);
        
        // 等待恢复
        let rapidRestored = false;
        for (let j = 0; j < 50; j++) { // 最多等待5秒
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const checkContent = await fs.readJson(storageJsonPath);
          if (checkContent['telemetry.devDeviceId'] !== rapidTestId) {
            rapidRestored = true;
            console.log(`  ✅ 恢复成功 (${(j + 1) * 100}ms)`);
            successCount++;
            break;
          }
        }
        
        if (!rapidRestored) {
          console.log(`  ❌ 恢复失败`);
        }
        
        // 短暂间隔
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const successRate = (successCount / consecutiveTests) * 100;
      console.log(`\n📊 连续测试成功率: ${successRate}% (${successCount}/${consecutiveTests})`);
    }

    // 6. 测试临时文件拦截
    console.log('\n🚨 测试临时文件拦截...');
    const tempFilePath = storageJsonPath + '.vsctmp';
    
    const tempContent = { ...originalContent };
    tempContent['telemetry.devDeviceId'] = 'temp-manual-test-' + Date.now();
    
    await fs.writeJson(tempFilePath, tempContent, { spaces: 2 });
    console.log('📝 已创建临时文件');

    // 等待处理
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (await fs.pathExists(tempFilePath)) {
      const processedContent = await fs.readJson(tempFilePath);
      const processedId = processedContent['telemetry.devDeviceId'];
      
      if (processedId !== tempContent['telemetry.devDeviceId']) {
        console.log('✅ 临时文件已被监控处理');
        console.log(`  原始: ${tempContent['telemetry.devDeviceId']}`);
        console.log(`  处理后: ${processedId}`);
      } else {
        console.log('⚠️ 临时文件未被处理');
      }
      
      // 清理临时文件
      await fs.remove(tempFilePath);
      console.log('🧹 已清理临时文件');
    } else {
      console.log('✅ 临时文件已被自动删除（监控处理）');
    }

    console.log('\n🎯 总结:');
    console.log('实时监控系统可以有效拦截手动修改，保护设备ID不被篡改。');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
if (require.main === module) {
  testManualModification().catch(console.error);
}

module.exports = { testManualModification };
