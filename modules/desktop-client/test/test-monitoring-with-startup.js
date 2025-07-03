/**
 * 完整的监听测试：启动防护 + 测试文件监听
 */

const path = require('path');
const fs = require('fs-extra');
const os = require('os');

// 测试配置
const STORAGE_JSON_PATH = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'Cursor',
  'User',
  'globalStorage',
  'storage.json'
);

class CompleteMonitoringTest {
  constructor() {
    this.originalContent = null;
    this.testDeviceId = 'test-device-' + Date.now();
    this.deviceManager = null;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '📝';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runTest() {
    try {
      this.log('🚀 开始完整的监听测试');

      // 1. 启动防护进程
      await this.startGuardian();

      // 2. 等待防护进程稳定
      await this.waitForStabilization();

      // 3. 备份原始文件
      await this.backupOriginalFile();

      // 4. 测试文件监听
      await this.testFileMonitoring();

      // 5. 恢复原始文件
      await this.restoreOriginalFile();

      // 6. 停止防护进程
      await this.stopGuardian();

      this.log('🎉 完整监听测试完成', 'success');

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

    this.log(`启动结果: ${JSON.stringify({
      success: result.success,
      message: result.message,
      mode: result.mode,
      deviceId: result.deviceId
    }, null, 2)}`);

    if (!result.success) {
      throw new Error(`防护进程启动失败: ${result.message}`);
    }

    this.log('✅ 防护进程启动成功');
  }

  async waitForStabilization() {
    this.log('📍 步骤2: 等待防护进程稳定');
    
    // 等待5秒让防护进程完全启动并开始监听
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 验证状态
    const status = await this.deviceManager.getEnhancedGuardianStatus();
    
    this.log(`防护状态: ${JSON.stringify({
      isGuarding: status.isGuarding,
      mode: status.mode,
      standalone: {
        isRunning: status.standalone?.isRunning,
        pid: status.standalone?.pid
      }
    }, null, 2)}`);

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

  async testFileMonitoring() {
    this.log('📍 步骤4: 测试文件监听功能');
    
    // 4.1 测试直接修改
    await this.testDirectModification();
    
    // 等待一下
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4.2 测试临时文件修改
    await this.testTempFileModification();
  }

  async testDirectModification() {
    this.log('🔍 测试4.1: 直接修改storage.json');
    
    try {
      // 读取当前内容
      let currentContent = {};
      if (await fs.pathExists(STORAGE_JSON_PATH)) {
        currentContent = await fs.readJson(STORAGE_JSON_PATH);
      }

      const originalDeviceId = currentContent['telemetry.devDeviceId'];
      this.log(`修改前设备ID: ${originalDeviceId}`);

      // 修改设备ID
      currentContent['telemetry.devDeviceId'] = this.testDeviceId;
      await fs.writeJson(STORAGE_JSON_PATH, currentContent, { spaces: 2 });
      
      this.log(`已修改设备ID为: ${this.testDeviceId}`);

      // 等待防护进程响应
      this.log('⏳ 等待防护进程响应（5秒）...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 检查是否被恢复
      const afterContent = await fs.readJson(STORAGE_JSON_PATH);
      const afterDeviceId = afterContent['telemetry.devDeviceId'];
      
      this.log(`修改后的设备ID: ${afterDeviceId}`);

      if (afterDeviceId === this.testDeviceId) {
        this.log('❌ 防护进程未拦截直接修改', 'error');
        return false;
      } else if (afterDeviceId === originalDeviceId) {
        this.log('✅ 防护进程成功拦截并恢复了直接修改', 'success');
        return true;
      } else {
        this.log(`⚠️ 设备ID被恢复为其他值: ${afterDeviceId}`);
        return true; // 至少被修改了
      }

    } catch (error) {
      this.log(`直接修改测试失败: ${error.message}`, 'error');
      return false;
    }
  }

  async testTempFileModification() {
    this.log('🔍 测试4.2: 临时文件修改（模拟IDE行为）');
    
    try {
      const tempFilePath = STORAGE_JSON_PATH + '.vsctmp';
      
      // 读取当前内容
      let currentContent = {};
      if (await fs.pathExists(STORAGE_JSON_PATH)) {
        currentContent = await fs.readJson(STORAGE_JSON_PATH);
      }

      const originalDeviceId = currentContent['telemetry.devDeviceId'];
      this.log(`修改前设备ID: ${originalDeviceId}`);

      // 创建临时文件并修改设备ID
      currentContent['telemetry.devDeviceId'] = this.testDeviceId;
      await fs.writeJson(tempFilePath, currentContent, { spaces: 2 });
      
      this.log(`已创建临时文件并修改设备ID为: ${this.testDeviceId}`);

      // 等待防护进程响应
      this.log('⏳ 等待防护进程响应（3秒）...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 检查临时文件是否被修改
      if (await fs.pathExists(tempFilePath)) {
        const tempContent = await fs.readJson(tempFilePath);
        const tempDeviceId = tempContent['telemetry.devDeviceId'];
        
        this.log(`临时文件中的设备ID: ${tempDeviceId}`);

        if (tempDeviceId === this.testDeviceId) {
          this.log('❌ 防护进程未拦截临时文件修改', 'error');
        } else if (tempDeviceId === originalDeviceId) {
          this.log('✅ 防护进程成功拦截并修复了临时文件', 'success');
        } else {
          this.log(`⚠️ 临时文件被修复为其他值: ${tempDeviceId}`);
        }

        // 清理临时文件
        await fs.remove(tempFilePath);
        this.log('🧹 已清理临时文件');
      } else {
        this.log('⚠️ 临时文件已被删除');
      }

    } catch (error) {
      this.log(`临时文件修改测试失败: ${error.message}`, 'error');
    }
  }

  async restoreOriginalFile() {
    this.log('📍 步骤5: 恢复原始文件');
    
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
    this.log('📍 步骤6: 停止防护进程');
    
    try {
      if (this.deviceManager) {
        const result = await this.deviceManager.stopEnhancedGuardian();
        this.log(`停止结果: ${JSON.stringify({
          success: result.success,
          message: result.message
        }, null, 2)}`);
      }
    } catch (error) {
      this.log(`停止防护进程失败: ${error.message}`, 'error');
    }
  }
}

// 运行测试
if (require.main === module) {
  const test = new CompleteMonitoringTest();
  test.runTest().catch(console.error);
}

module.exports = CompleteMonitoringTest;
