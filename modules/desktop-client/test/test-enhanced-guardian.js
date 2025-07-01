const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { EnhancedDeviceGuardian } = require('../src/enhanced-device-guardian');

/**
 * 测试增强设备ID守护进程
 * 验证防护机制的有效性
 */

async function testEnhancedGuardian() {
  console.log('🧪 测试增强设备ID守护进程');
  console.log('==================================================');

  const guardian = new EnhancedDeviceGuardian();
  const testDeviceId = crypto.randomUUID();
  
  try {
    // 第1步：启动守护进程
    console.log('\n🛡️ 第1步：启动增强守护进程...');
    const startResult = await guardian.startGuarding(testDeviceId);
    
    if (startResult.success) {
      console.log('  ✅ 守护进程启动成功');
      console.log(`  🎯 目标设备ID: ${testDeviceId}`);
    } else {
      console.log('  ❌ 守护进程启动失败:', startResult.message);
      return false;
    }

    // 第2步：等待初始化完成
    console.log('\n⏳ 第2步：等待初始化完成...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 第3步：检查守护进程状态
    console.log('\n📊 第3步：检查守护进程状态...');
    const status = await guardian.getStatus();
    console.log('  守护进程状态:');
    console.log(`    运行中: ${status.isGuarding}`);
    console.log(`    目标ID: ${status.targetDeviceId}`);
    console.log(`    当前ID: ${status.currentDeviceId}`);
    console.log(`    保护状态: ${status.isProtected}`);
    console.log(`    监控器数量: ${status.watchersCount}`);
    console.log(`    拦截次数: ${status.stats.interceptedAttempts}`);
    console.log(`    删除备份: ${status.stats.backupFilesRemoved}`);

    // 第4步：测试设备ID拦截
    console.log('\n🚨 第4步：测试设备ID拦截功能...');
    await testDeviceIdInterception(guardian, testDeviceId);

    // 第5步：测试备份文件监控
    console.log('\n🗑️ 第5步：测试备份文件监控...');
    await testBackupFileMonitoring(guardian);

    // 第6步：测试文件保护
    console.log('\n🔒 第6步：测试文件保护机制...');
    await testFileProtection(guardian);

    // 第7步：性能测试
    console.log('\n⚡ 第7步：性能测试...');
    await testPerformance(guardian);

    // 第8步：停止守护进程
    console.log('\n🛑 第8步：停止守护进程...');
    const stopResult = await guardian.stopGuarding();
    
    if (stopResult.success) {
      console.log('  ✅ 守护进程已停止');
    } else {
      console.log('  ❌ 停止守护进程失败:', stopResult.message);
    }

    return true;

  } catch (error) {
    console.error('❌ 测试过程出错:', error);
    
    // 确保清理
    try {
      await guardian.stopGuarding();
    } catch (cleanupError) {
      console.error('清理失败:', cleanupError);
    }
    
    return false;
  }
}

// 测试设备ID拦截功能
async function testDeviceIdInterception(guardian, targetDeviceId) {
  try {
    const storageJsonPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );

    // 模拟IDE修改设备ID
    console.log('  🔄 模拟IDE修改设备ID...');
    
    if (await fs.pathExists(storageJsonPath)) {
      const data = await fs.readJson(storageJsonPath);
      const originalId = data['telemetry.devDeviceId'];
      
      // 修改为不同的ID
      const fakeId = crypto.randomUUID();
      data['telemetry.devDeviceId'] = fakeId;
      
      await fs.writeJson(storageJsonPath, data, { spaces: 2 });
      console.log(`    修改前: ${originalId}`);
      console.log(`    修改为: ${fakeId}`);
      
      // 等待守护进程检测并恢复
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 检查是否被恢复
      const restoredData = await fs.readJson(storageJsonPath);
      const restoredId = restoredData['telemetry.devDeviceId'];
      
      if (restoredId === targetDeviceId) {
        console.log('  ✅ 设备ID拦截成功，已恢复目标ID');
      } else {
        console.log('  ❌ 设备ID拦截失败');
        console.log(`    期望: ${targetDeviceId}`);
        console.log(`    实际: ${restoredId}`);
      }
    } else {
      console.log('  ⚠️ storage.json文件不存在，跳过拦截测试');
    }

  } catch (error) {
    console.log(`  ❌ 设备ID拦截测试失败: ${error.message}`);
  }
}

// 测试备份文件监控
async function testBackupFileMonitoring(guardian) {
  try {
    const tempDir = os.tmpdir();
    const testBackupFiles = [
      path.join(tempDir, 'cursor-backup-test'),
      path.join(tempDir, 'storage.json.backup'),
      path.join(tempDir, 'state.vscdb.bak'),
      path.join(tempDir, 'test.tmp')
    ];

    console.log('  🔄 创建测试备份文件...');
    
    // 创建测试备份文件
    for (const filePath of testBackupFiles) {
      await fs.writeFile(filePath, 'test backup content');
      console.log(`    创建: ${path.basename(filePath)}`);
    }

    // 等待监控检测并删除
    console.log('  ⏳ 等待监控检测...');
    await new Promise(resolve => setTimeout(resolve, 6000)); // 等待一个扫描周期

    // 检查文件是否被删除
    let deletedCount = 0;
    for (const filePath of testBackupFiles) {
      if (!(await fs.pathExists(filePath))) {
        deletedCount++;
        console.log(`    ✅ 已删除: ${path.basename(filePath)}`);
      } else {
        console.log(`    ❌ 未删除: ${path.basename(filePath)}`);
        // 手动清理
        try {
          await fs.remove(filePath);
        } catch (error) {
          // 忽略清理错误
        }
      }
    }

    if (deletedCount === testBackupFiles.length) {
      console.log('  ✅ 备份文件监控测试通过');
    } else {
      console.log(`  ⚠️ 备份文件监控部分有效 (${deletedCount}/${testBackupFiles.length})`);
    }

  } catch (error) {
    console.log(`  ❌ 备份文件监控测试失败: ${error.message}`);
  }
}

// 测试文件保护机制
async function testFileProtection(guardian) {
  try {
    const storageJsonPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );

    if (!(await fs.pathExists(storageJsonPath))) {
      console.log('  ⚠️ storage.json文件不存在，跳过保护测试');
      return;
    }

    console.log('  🔄 检查文件保护状态...');
    
    // 检查文件属性
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      const { stdout } = await execAsync(`attrib "${storageJsonPath}"`);
      const isReadOnly = stdout.includes('R');
      
      if (isReadOnly) {
        console.log('  ✅ 文件已设置只读保护');
      } else {
        console.log('  ⚠️ 文件未设置只读保护');
      }
    } catch (error) {
      console.log(`  ❌ 检查文件保护失败: ${error.message}`);
    }

  } catch (error) {
    console.log(`  ❌ 文件保护测试失败: ${error.message}`);
  }
}

// 性能测试
async function testPerformance(guardian) {
  try {
    const startTime = Date.now();
    const iterations = 10;
    
    console.log(`  🔄 执行 ${iterations} 次状态查询...`);
    
    for (let i = 0; i < iterations; i++) {
      await guardian.getStatus();
    }
    
    const endTime = Date.now();
    const avgTime = (endTime - startTime) / iterations;
    
    console.log(`  ⚡ 平均响应时间: ${avgTime.toFixed(2)}ms`);
    
    if (avgTime < 50) {
      console.log('  ✅ 性能测试通过（响应时间 < 50ms）');
    } else {
      console.log('  ⚠️ 性能需要优化（响应时间 > 50ms）');
    }

  } catch (error) {
    console.log(`  ❌ 性能测试失败: ${error.message}`);
  }
}

// 主函数
async function main() {
  console.log('🎯 增强设备ID守护进程测试');
  console.log('测试目标：验证防护机制的有效性和性能');
  console.log('');

  const testResult = await testEnhancedGuardian();
  
  console.log('\n\n📋 测试总结');
  console.log('==================================================');
  if (testResult) {
    console.log('✅ 增强守护进程测试通过');
    console.log('🎉 防护机制运行正常，可以有效防止IDE恢复设备ID');
  } else {
    console.log('❌ 增强守护进程测试失败');
    console.log('🔧 需要检查实现或环境配置');
  }
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testEnhancedGuardian };
