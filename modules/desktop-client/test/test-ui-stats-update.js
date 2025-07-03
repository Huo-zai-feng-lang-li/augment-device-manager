/**
 * 测试UI统计数据更新
 * 验证防护拦截后客户端UI的计数是否正确更新
 */

const path = require('path');
const fs = require('fs-extra');
const os = require('os');

const STORAGE_JSON_PATH = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'Cursor',
  'User',
  'globalStorage',
  'storage.json'
);

class UIStatsUpdateTest {
  constructor() {
    this.originalContent = null;
    this.deviceManager = null;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '📝';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runTest() {
    try {
      this.log('🚀 开始UI统计数据更新测试');

      // 1. 启动防护进程
      await this.startGuardian();

      // 2. 等待防护进程稳定
      await this.waitForStabilization();

      // 3. 备份原始文件
      await this.backupOriginalFile();

      // 4. 获取初始统计数据
      const initialStats = await this.getGuardianStats();
      this.log(`初始统计数据: ${JSON.stringify(initialStats)}`);

      // 5. 执行多次拦截测试
      await this.performMultipleInterceptions(3);

      // 6. 等待统计更新
      await this.waitForStatsUpdate();

      // 7. 获取最终统计数据
      const finalStats = await this.getGuardianStats();
      this.log(`最终统计数据: ${JSON.stringify(finalStats)}`);

      // 8. 验证统计数据变化
      this.verifyStatsUpdate(initialStats, finalStats);

      // 9. 恢复原始文件
      await this.restoreOriginalFile();

      // 10. 停止防护进程
      await this.stopGuardian();

      this.log('🎉 UI统计数据更新测试完成', 'success');

    } catch (error) {
      this.log(`💥 测试失败: ${error.message}`, 'error');
      
      // 确保清理
      try {
        await this.restoreOriginalFile();
        await this.stopGuardian();
      } catch (cleanupError) {
        this.log(`清理失败: ${cleanupError.message}`, 'error');
      }
    }
  }

  async startGuardian() {
    this.log('📍 步骤1: 启动防护进程');
    
    const DeviceManager = require('../src/device-manager');
    this.deviceManager = new DeviceManager();
    
    const result = await this.deviceManager.startEnhancedGuardianIndependently({
      enableBackupMonitoring: true,
      enableDatabaseMonitoring: true,
      enableEnhancedProtection: true
    });

    if (!result.success) {
      throw new Error(`防护进程启动失败: ${result.message}`);
    }

    this.log(`✅ 防护进程启动成功，模式: ${result.mode}`);
  }

  async waitForStabilization() {
    this.log('📍 步骤2: 等待防护进程稳定');
    
    // 等待5秒让防护进程完全启动并开始监听
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const status = await this.deviceManager.getEnhancedGuardianStatus();
    
    if (!status.isGuarding) {
      throw new Error('防护进程启动后状态异常');
    }

    this.log('✅ 防护进程状态正常');
  }

  async backupOriginalFile() {
    this.log('📍 步骤3: 备份原始文件');
    
    if (await fs.pathExists(STORAGE_JSON_PATH)) {
      this.originalContent = await fs.readJson(STORAGE_JSON_PATH);
      this.log(`✅ 原始文件已备份，当前设备ID: ${this.originalContent['telemetry.devDeviceId']}`);
    } else {
      this.log('⚠️ storage.json文件不存在');
      this.originalContent = {};
    }
  }

  async getGuardianStats() {
    const status = await this.deviceManager.getEnhancedGuardianStatus();
    
    let stats = {
      interceptedAttempts: 0,
      backupFilesRemoved: 0,
      protectionRestored: 0
    };

    if (status.standalone && status.standalone.isRunning && status.standalone.recentLogs) {
      // 从独立服务日志解析统计
      stats = this.parseStatsFromLogs(status.standalone.recentLogs);
    } else if (status.inProcess && status.inProcess.stats) {
      // 从内置进程直接获取统计
      stats = status.inProcess.stats;
    }

    return stats;
  }

  parseStatsFromLogs(logs) {
    const stats = {
      interceptedAttempts: 0,
      backupFilesRemoved: 0,
      protectionRestored: 0
    };

    if (!logs || !Array.isArray(logs)) {
      return stats;
    }

    logs.forEach(log => {
      if (typeof log === 'string') {
        // 拦截相关
        if (
          log.includes('拦截') ||
          log.includes('检测到设备ID被修改') ||
          log.includes('已拦截并恢复目标设备ID')
        ) {
          stats.interceptedAttempts++;
        }
        // 备份删除相关
        if (log.includes('删除备份') || log.includes('已删除')) {
          stats.backupFilesRemoved++;
        }
        // 保护恢复相关
        if (log.includes('恢复') || log.includes('已恢复')) {
          stats.protectionRestored++;
        }
      }
    });

    return stats;
  }

  async performMultipleInterceptions(count) {
    this.log(`📍 步骤4: 执行${count}次拦截测试`);
    
    for (let i = 1; i <= count; i++) {
      this.log(`🔍 执行第${i}次拦截测试`);
      
      // 读取当前内容
      let currentContent = {};
      if (await fs.pathExists(STORAGE_JSON_PATH)) {
        currentContent = await fs.readJson(STORAGE_JSON_PATH);
      }

      const originalDeviceId = currentContent['telemetry.devDeviceId'];
      const testDeviceId = `test-intercept-${i}-${Date.now()}`;

      // 修改设备ID
      currentContent['telemetry.devDeviceId'] = testDeviceId;
      await fs.writeJson(STORAGE_JSON_PATH, currentContent, { spaces: 2 });
      
      this.log(`已修改设备ID为: ${testDeviceId}`);

      // 等待防护进程响应
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 检查是否被恢复
      const afterContent = await fs.readJson(STORAGE_JSON_PATH);
      const afterDeviceId = afterContent['telemetry.devDeviceId'];
      
      if (afterDeviceId === originalDeviceId) {
        this.log(`✅ 第${i}次拦截成功，设备ID已恢复`);
      } else {
        this.log(`❌ 第${i}次拦截失败，设备ID未恢复: ${afterDeviceId}`);
      }

      // 间隔一下再进行下次测试
      if (i < count) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async waitForStatsUpdate() {
    this.log('📍 步骤5: 等待统计数据更新');
    
    // 等待30秒，让统计数据有时间更新
    await new Promise(resolve => setTimeout(resolve, 30000));
  }

  verifyStatsUpdate(initialStats, finalStats) {
    this.log('📍 步骤6: 验证统计数据变化');
    
    const interceptDiff = finalStats.interceptedAttempts - initialStats.interceptedAttempts;
    const backupDiff = finalStats.backupFilesRemoved - initialStats.backupFilesRemoved;
    const protectionDiff = finalStats.protectionRestored - initialStats.protectionRestored;

    this.log(`拦截次数变化: ${initialStats.interceptedAttempts} → ${finalStats.interceptedAttempts} (${interceptDiff > 0 ? '+' : ''}${interceptDiff})`);
    this.log(`删除次数变化: ${initialStats.backupFilesRemoved} → ${finalStats.backupFilesRemoved} (${backupDiff > 0 ? '+' : ''}${backupDiff})`);
    this.log(`恢复次数变化: ${initialStats.protectionRestored} → ${finalStats.protectionRestored} (${protectionDiff > 0 ? '+' : ''}${protectionDiff})`);

    if (interceptDiff > 0) {
      this.log('✅ 拦截统计数据正确更新', 'success');
    } else {
      this.log('❌ 拦截统计数据未更新', 'error');
    }

    // 检查日志内容
    this.checkLogContent();
  }

  async checkLogContent() {
    this.log('📍 检查日志内容');
    
    const status = await this.deviceManager.getEnhancedGuardianStatus();
    
    if (status.standalone && status.standalone.recentLogs) {
      this.log(`日志条目数: ${status.standalone.recentLogs.length}`);
      this.log('最近的日志内容:');
      status.standalone.recentLogs.slice(-5).forEach((log, index) => {
        this.log(`  ${index + 1}. ${log}`);
      });
    } else {
      this.log('⚠️ 无法获取日志内容');
    }
  }

  async restoreOriginalFile() {
    this.log('📍 步骤7: 恢复原始文件');
    
    try {
      if (this.originalContent) {
        await fs.writeJson(STORAGE_JSON_PATH, this.originalContent, { spaces: 2 });
        this.log('✅ 原始文件已恢复');
      }
    } catch (error) {
      this.log(`恢复原始文件失败: ${error.message}`, 'error');
    }
  }

  async stopGuardian() {
    this.log('📍 步骤8: 停止防护进程');
    
    try {
      if (this.deviceManager) {
        const result = await this.deviceManager.stopEnhancedGuardian();
        this.log(`停止结果: ${result.success ? '成功' : '失败'}`);
      }
    } catch (error) {
      this.log(`停止防护进程失败: ${error.message}`, 'error');
    }
  }
}

// 运行测试
if (require.main === module) {
  const test = new UIStatsUpdateTest();
  test.runTest().catch(console.error);
}

module.exports = UIStatsUpdateTest;
