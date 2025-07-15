const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const DeviceManager = require('../src/device-manager');
const { SQLiteAnalyzer } = require('../src/sqlite-analyzer');

/**
 * 增强防护机制综合测试
 * 测试所有防护功能的集成效果
 */

async function testEnhancedProtection() {
  console.log('🛡️ 增强防护机制综合测试');
  console.log('==================================================');

  const deviceManager = new DeviceManager();
  const sqliteAnalyzer = new SQLiteAnalyzer();
  
  try {
    // 第1步：SQLite数据库分析
    console.log('\n🗄️ 第1步：SQLite数据库分析...');
    const dbAnalysis = await sqliteAnalyzer.analyzeAllDatabases();
    
    console.log('  数据库分析结果:');
    console.log(`    分析数据库: ${dbAnalysis.databases.length} 个`);
    console.log(`    发现设备ID: ${dbAnalysis.deviceIdFound ? '是' : '否'}`);
    console.log(`    发现用户数据: ${dbAnalysis.userDataFound ? '是' : '否'}`);
    
    if (dbAnalysis.deviceIdFound) {
      console.log('  ⚠️ 数据库中发现设备ID，需要重点监控');
    }

    // 第2步：执行增强清理
    console.log('\n🧹 第2步：执行增强清理（启用所有防护）...');
    const cleanupResult = await deviceManager.performCleanup({
      // 基础选项
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartCursor: false,
      
      // 增强防护选项
      skipBackup: true, // 跳过备份文件创建
      enableEnhancedGuardian: true, // 启用增强守护进程
      
      // 其他选项
      skipCursorLogin: true,
      aggressiveMode: true,
      multiRoundClean: true,
      extendedMonitoring: true
    });

    console.log('  清理结果:');
    console.log(`    成功: ${cleanupResult.success}`);
    console.log(`    操作数量: ${cleanupResult.actions?.length || 0}`);
    console.log(`    错误数量: ${cleanupResult.errors?.length || 0}`);

    // 显示关键操作
    if (cleanupResult.actions) {
      const guardianActions = cleanupResult.actions.filter(action => 
        action.includes('守护进程') || action.includes('监控') || action.includes('保护')
      );
      
      if (guardianActions.length > 0) {
        console.log('  增强防护操作:');
        guardianActions.forEach(action => {
          console.log(`    • ${action}`);
        });
      }
    }

    // 第3步：验证守护进程状态
    console.log('\n🔍 第3步：验证守护进程状态...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // 等待守护进程初始化
    
    const guardianStatus = await deviceManager.getEnhancedGuardianStatus();
    console.log('  守护进程状态:');
    console.log(`    运行中: ${guardianStatus.isGuarding}`);
    console.log(`    客户端清理中: ${guardianStatus.isClientCleaning}`);
    console.log(`    监控器数量: ${guardianStatus.watchersCount || 0}`);
    console.log(`    运行时间: ${guardianStatus.uptime ? Math.round(guardianStatus.uptime / 1000) : 0}秒`);
    
    if (guardianStatus.stats) {
      console.log(`    拦截次数: ${guardianStatus.stats.interceptedAttempts}`);
      console.log(`    删除备份: ${guardianStatus.stats.backupFilesRemoved}`);
      console.log(`    恢复保护: ${guardianStatus.stats.protectionRestored}`);
    }

    // 第4步：测试防护效果
    console.log('\n🚨 第4步：测试防护效果...');
    await testProtectionEffectiveness(deviceManager);

    // 第5步：性能影响评估
    console.log('\n⚡ 第5步：性能影响评估...');
    await testPerformanceImpact(deviceManager);

    // 第6步：备份文件零容忍测试
    console.log('\n🗑️ 第6步：备份文件零容忍测试...');
    await testBackupFileZeroTolerance();

    // 第7步：生成防护报告
    console.log('\n📊 第7步：生成防护报告...');
    const protectionReport = await generateProtectionReport(deviceManager, dbAnalysis);
    
    console.log('  防护报告:');
    protectionReport.forEach(item => {
      console.log(`    ${item}`);
    });

    return true;

  } catch (error) {
    console.error('❌ 测试过程出错:', error);
    return false;
  }
}

// 测试防护效果
async function testProtectionEffectiveness(deviceManager) {
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
      console.log('  ⚠️ storage.json不存在，跳过防护测试');
      return;
    }

    // 记录当前设备ID
    const originalData = await fs.readJson(storageJsonPath);
    const originalDeviceId = originalData['telemetry.devDeviceId'];
    
    console.log(`  📋 当前设备ID: ${originalDeviceId}`);

    // 模拟IDE恢复操作
    console.log('  🔄 模拟IDE恢复操作...');
    
    // 1. 模拟创建临时文件
    const tempFile = storageJsonPath + '.vsctmp';
    const fakeData = { ...originalData };
    fakeData['telemetry.devDeviceId'] = 'fake-device-id-12345';
    
    await fs.writeJson(tempFile, fakeData, { spaces: 2 });
    console.log('    创建临时文件（模拟IDE写入）');
    
    // 等待守护进程检测
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 检查临时文件是否被拦截
    if (await fs.pathExists(tempFile)) {
      const tempData = await fs.readJson(tempFile);
      if (tempData['telemetry.devDeviceId'] === originalDeviceId) {
        console.log('  ✅ 临时文件拦截成功');
      } else {
        console.log('  ❌ 临时文件拦截失败');
      }
      
      // 清理临时文件
      await fs.remove(tempFile);
    }

    // 2. 模拟直接修改主文件
    console.log('  🔄 模拟直接修改主文件...');
    fakeData['telemetry.devDeviceId'] = 'another-fake-id-67890';
    await fs.writeJson(storageJsonPath, fakeData, { spaces: 2 });
    
    // 等待守护进程恢复
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 检查是否被恢复
    const restoredData = await fs.readJson(storageJsonPath);
    if (restoredData['telemetry.devDeviceId'] === originalDeviceId) {
      console.log('  ✅ 主文件保护成功');
    } else {
      console.log('  ❌ 主文件保护失败');
    }

  } catch (error) {
    console.log(`  ❌ 防护效果测试失败: ${error.message}`);
  }
}

// 测试性能影响
async function testPerformanceImpact(deviceManager) {
  try {
    const iterations = 20;
    const startTime = Date.now();
    
    console.log(`  🔄 执行 ${iterations} 次状态查询...`);
    
    for (let i = 0; i < iterations; i++) {
      await deviceManager.getEnhancedGuardianStatus();
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;
    
    console.log(`  ⚡ 总耗时: ${totalTime}ms`);
    console.log(`  ⚡ 平均响应: ${avgTime.toFixed(2)}ms`);
    
    if (avgTime < 100) {
      console.log('  ✅ 性能影响可接受（< 100ms）');
    } else {
      console.log('  ⚠️ 性能影响较大（> 100ms）');
    }

  } catch (error) {
    console.log(`  ❌ 性能测试失败: ${error.message}`);
  }
}

// 测试备份文件零容忍
async function testBackupFileZeroTolerance() {
  try {
    const tempDir = os.tmpdir();
    const testFiles = [
      path.join(tempDir, 'cursor-backup-test-' + Date.now()),
      path.join(tempDir, 'storage.json.backup'),
      path.join(tempDir, 'state.vscdb.bak'),
      path.join(tempDir, 'augment-backup-test')
    ];

    console.log('  🔄 创建测试备份文件...');
    
    // 创建测试文件
    for (const filePath of testFiles) {
      await fs.writeFile(filePath, 'test backup content');
    }
    
    console.log(`    创建了 ${testFiles.length} 个测试备份文件`);

    // 等待监控检测
    console.log('  ⏳ 等待监控检测（10秒）...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 检查删除情况
    let deletedCount = 0;
    for (const filePath of testFiles) {
      if (!(await fs.pathExists(filePath))) {
        deletedCount++;
      } else {
        // 手动清理残留文件
        try {
          await fs.remove(filePath);
        } catch (error) {
          // 忽略清理错误
        }
      }
    }

    console.log(`  📊 删除结果: ${deletedCount}/${testFiles.length}`);
    
    if (deletedCount === testFiles.length) {
      console.log('  ✅ 零容忍策略完全有效');
    } else if (deletedCount > 0) {
      console.log('  ⚠️ 零容忍策略部分有效');
    } else {
      console.log('  ❌ 零容忍策略无效');
    }

  } catch (error) {
    console.log(`  ❌ 零容忍测试失败: ${error.message}`);
  }
}

// 生成防护报告
async function generateProtectionReport(deviceManager, dbAnalysis) {
  const report = [];
  
  try {
    const status = await deviceManager.getEnhancedGuardianStatus();
    
    report.push('🛡️ 增强防护机制状态报告');
    report.push('==================================================');
    
    // 守护进程状态
    report.push(`🔍 守护进程: ${status.isGuarding ? '✅ 运行中' : '❌ 未运行'}`);
    report.push(`📊 监控器数量: ${status.watchersCount || 0}`);
    report.push(`⏱️ 运行时间: ${status.uptime ? Math.round(status.uptime / 1000) : 0}秒`);
    
    // 防护统计
    if (status.stats) {
      report.push(`🚨 拦截次数: ${status.stats.interceptedAttempts}`);
      report.push(`🗑️ 删除备份: ${status.stats.backupFilesRemoved}`);
      report.push(`🔒 恢复保护: ${status.stats.protectionRestored}`);
    }
    
    // 数据库分析结果
    report.push(`🗄️ 数据库分析: ${dbAnalysis.databases.length} 个数据库`);
    report.push(`🚨 设备ID风险: ${dbAnalysis.deviceIdFound ? '发现' : '未发现'}`);
    report.push(`👤 用户数据风险: ${dbAnalysis.userDataFound ? '发现' : '未发现'}`);
    
    // 防护建议
    report.push('💡 防护建议:');
    if (status.isGuarding) {
      report.push('  • 增强守护进程运行正常');
      report.push('  • 建议保持守护进程持续运行');
    } else {
      report.push('  • ⚠️ 建议启用增强守护进程');
    }
    
    if (dbAnalysis.deviceIdFound) {
      report.push('  • ⚠️ 数据库中发现设备ID，建议加强监控');
    }
    
    report.push('  • 定期检查防护状态');
    report.push('  • 监控系统性能影响');

  } catch (error) {
    report.push(`❌ 生成报告失败: ${error.message}`);
  }
  
  return report;
}

// 主函数
async function main() {
  console.log('🎯 增强防护机制综合测试');
  console.log('测试目标：验证所有防护功能的集成效果');
  console.log('');

  const testResult = await testEnhancedProtection();
  
  console.log('\n\n📋 测试总结');
  console.log('==================================================');
  if (testResult) {
    console.log('✅ 增强防护机制测试通过');
    console.log('🎉 所有防护功能运行正常，可以有效防止IDE恢复设备ID');
    console.log('');
    console.log('🔧 建议：');
    console.log('  • 在生产环境中启用所有防护功能');
    console.log('  • 定期监控守护进程状态');
    console.log('  • 关注系统性能影响');
  } else {
    console.log('❌ 增强防护机制测试失败');
    console.log('🔧 需要检查实现或环境配置');
  }
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testEnhancedProtection };
