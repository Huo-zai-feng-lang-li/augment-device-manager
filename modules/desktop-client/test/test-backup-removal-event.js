/**
 * 测试删除备份事件触发机制
 * 验证当检测到备份文件时，删除操作是否能正确触发事件通知
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { EnhancedDeviceGuardian } = require('../src/enhanced-device-guardian');

async function testBackupRemovalEvent() {
  console.log('🧪 开始测试删除备份事件触发机制...\n');

  // 1. 准备测试环境
  const testDir = path.join(os.tmpdir(), `test-backup-removal-${Date.now()}`);
  const globalStorageDir = path.join(testDir, 'globalStorage');
  const workspaceStorageDir = path.join(testDir, 'workspaceStorage');
  
  await fs.ensureDir(globalStorageDir);
  await fs.ensureDir(workspaceStorageDir);
  
  const storageJsonPath = path.join(globalStorageDir, 'storage.json');
  const originalDeviceId = 'test-device-original-12345';

  // 创建初始配置文件
  const initialConfig = {
    'telemetry.devDeviceId': originalDeviceId,
    'other.setting': 'test-value'
  };
  await fs.writeJson(storageJsonPath, initialConfig, { spaces: 2 });

  // 2. 创建守护进程实例并设置事件监听
  const guardian = new EnhancedDeviceGuardian();
  
  // 重写路径配置指向测试目录
  guardian.paths = {
    ...guardian.paths,
    cursorGlobalStorage: globalStorageDir,
    cursorWorkspaceStorage: workspaceStorageDir,
    storageJson: storageJsonPath,
    backupPaths: [testDir, globalStorageDir, workspaceStorageDir],
    databasePaths: [testDir]
  };

  let backupEventReceived = false;
  let backupEventData = null;

  // 设置事件回调
  guardian.setEventCallback((eventType, data) => {
    console.log(`📡 收到事件: ${eventType}`, data);
    if (eventType === 'backup-removed') {
      backupEventReceived = true;
      backupEventData = data;
    }
  });

  try {
    // 3. 启动守护进程
    console.log('🛡️ 启动守护进程...');
    const startResult = await guardian.startGuarding(originalDeviceId);
    if (!startResult.success) {
      throw new Error(`启动失败: ${startResult.message}`);
    }
    console.log('✅ 守护进程启动成功\n');

    // 等待一下确保监控已启动
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. 创建备份文件来触发删除事件
    console.log('📁 创建测试备份文件...');
    
    // 创建各种类型的备份文件
    const backupFiles = [
      path.join(globalStorageDir, 'storage.json.backup'),
      path.join(globalStorageDir, 'storage.json.bak'),
      path.join(workspaceStorageDir, 'test.backup'),
      path.join(testDir, 'cursor-backup-123'),
    ];

    for (const backupFile of backupFiles) {
      await fs.writeFile(backupFile, 'test backup content');
      console.log(`   创建备份文件: ${path.basename(backupFile)}`);
    }

    // 5. 等待删除事件触发
    console.log('\n⏱️ 等待删除备份事件触发...');
    let waitTime = 0;
    const maxWaitTime = 15000; // 最多等待15秒

    while (!backupEventReceived && waitTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
      waitTime += 100;
      
      // 每秒输出等待状态
      if (waitTime % 1000 === 0) {
        console.log(`   等待中... ${waitTime/1000}s`);
      }
    }

    // 6. 验证结果
    console.log('\n📊 测试结果:');
    
    if (backupEventReceived) {
      console.log('✅ 删除备份事件成功触发!');
      console.log(`⚡ 响应时间: ${waitTime}ms`);
      console.log('📋 事件数据:', JSON.stringify(backupEventData, null, 2));
      
      // 检查统计数据
      const status = await guardian.getStatus();
      console.log(`📈 删除备份计数: ${status.stats.backupFilesRemoved}`);
      
      // 验证备份文件是否已被删除
      let deletedCount = 0;
      for (const backupFile of backupFiles) {
        if (!(await fs.pathExists(backupFile))) {
          deletedCount++;
        }
      }
      console.log(`🗑️ 实际删除文件数: ${deletedCount}/${backupFiles.length}`);
      
    } else {
      console.log('❌ 删除备份事件未触发');
      console.log('💡 可能原因:');
      console.log('   - 文件监控未检测到备份文件');
      console.log('   - 备份文件识别逻辑有问题');
      console.log('   - 事件通知机制未正常工作');
      
      // 检查备份文件是否仍然存在
      for (const backupFile of backupFiles) {
        if (await fs.pathExists(backupFile)) {
          console.log(`   ⚠️ 备份文件仍存在: ${path.basename(backupFile)}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  } finally {
    // 7. 清理测试环境
    console.log('\n🧹 清理测试环境...');
    await guardian.stopGuarding();
    await fs.remove(testDir);
    console.log('✅ 清理完成');
  }
}

// 运行测试
if (require.main === module) {
  testBackupRemovalEvent().catch(console.error);
}

module.exports = { testBackupRemovalEvent };
