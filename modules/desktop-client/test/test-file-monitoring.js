/**
 * 测试文件监听功能
 * 验证防护进程是否正确监听storage.json文件变化
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

class FileMonitoringTest {
  constructor() {
    this.originalContent = null;
    this.testDeviceId = 'test-device-' + Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '📝';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runTest() {
    try {
      this.log('🚀 开始文件监听测试');

      // 1. 检查防护状态
      await this.checkGuardianStatus();

      // 2. 备份原始文件
      await this.backupOriginalFile();

      // 3. 测试直接修改storage.json
      await this.testDirectModification();

      // 4. 测试临时文件修改
      await this.testTempFileModification();

      // 5. 恢复原始文件
      await this.restoreOriginalFile();

      this.log('🎉 文件监听测试完成', 'success');

    } catch (error) {
      this.log(`💥 测试失败: ${error.message}`, 'error');
    }
  }

  async checkGuardianStatus() {
    this.log('📍 步骤1: 检查防护状态');
    
    const DeviceManager = require('../src/device-manager');
    const deviceManager = new DeviceManager();
    
    const status = await deviceManager.getEnhancedGuardianStatus();
    
    this.log(`防护状态: ${JSON.stringify({
      isGuarding: status.isGuarding,
      mode: status.mode,
      standalone: {
        isRunning: status.standalone?.isRunning,
        pid: status.standalone?.pid
      }
    }, null, 2)}`);

    if (!status.isGuarding) {
      throw new Error('防护进程未运行，请先启动防护');
    }

    this.log('✅ 防护进程正在运行');
  }

  async backupOriginalFile() {
    this.log('📍 步骤2: 备份原始文件');
    
    if (await fs.pathExists(STORAGE_JSON_PATH)) {
      this.originalContent = await fs.readJson(STORAGE_JSON_PATH);
      this.log('✅ 原始文件已备份');
    } else {
      this.log('⚠️ storage.json文件不存在');
      this.originalContent = {};
    }
  }

  async testDirectModification() {
    this.log('📍 步骤3: 测试直接修改storage.json');
    
    try {
      // 读取当前内容
      let currentContent = {};
      if (await fs.pathExists(STORAGE_JSON_PATH)) {
        currentContent = await fs.readJson(STORAGE_JSON_PATH);
      }

      const originalDeviceId = currentContent['telemetry.devDeviceId'];
      this.log(`当前设备ID: ${originalDeviceId}`);

      // 修改设备ID
      currentContent['telemetry.devDeviceId'] = this.testDeviceId;
      await fs.writeJson(STORAGE_JSON_PATH, currentContent, { spaces: 2 });
      
      this.log(`已修改设备ID为: ${this.testDeviceId}`);

      // 等待防护进程响应
      this.log('⏳ 等待防护进程响应...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 检查是否被恢复
      const afterContent = await fs.readJson(STORAGE_JSON_PATH);
      const afterDeviceId = afterContent['telemetry.devDeviceId'];
      
      this.log(`修改后的设备ID: ${afterDeviceId}`);

      if (afterDeviceId === this.testDeviceId) {
        this.log('❌ 防护进程未拦截直接修改', 'error');
      } else if (afterDeviceId === originalDeviceId) {
        this.log('✅ 防护进程成功拦截并恢复了直接修改', 'success');
      } else {
        this.log(`⚠️ 设备ID被恢复为其他值: ${afterDeviceId}`);
      }

    } catch (error) {
      this.log(`直接修改测试失败: ${error.message}`, 'error');
    }
  }

  async testTempFileModification() {
    this.log('📍 步骤4: 测试临时文件修改（模拟IDE行为）');
    
    try {
      const tempFilePath = STORAGE_JSON_PATH + '.vsctmp';
      
      // 读取当前内容
      let currentContent = {};
      if (await fs.pathExists(STORAGE_JSON_PATH)) {
        currentContent = await fs.readJson(STORAGE_JSON_PATH);
      }

      const originalDeviceId = currentContent['telemetry.devDeviceId'];
      this.log(`当前设备ID: ${originalDeviceId}`);

      // 创建临时文件并修改设备ID
      currentContent['telemetry.devDeviceId'] = this.testDeviceId;
      await fs.writeJson(tempFilePath, currentContent, { spaces: 2 });
      
      this.log(`已创建临时文件并修改设备ID为: ${this.testDeviceId}`);

      // 等待防护进程响应
      this.log('⏳ 等待防护进程响应...');
      await new Promise(resolve => setTimeout(resolve, 2000));

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
}

// 运行测试
if (require.main === module) {
  const test = new FileMonitoringTest();
  test.runTest().catch(console.error);
}

module.exports = FileMonitoringTest;
