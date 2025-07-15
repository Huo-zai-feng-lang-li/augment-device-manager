const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * 实时监控性能和防护效果测试
 * 验证监控响应速度、拦截成功率、资源占用等
 */

class ProtectionPerformanceTest {
  constructor() {
    this.storageJsonPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );
    
    this.tempFilePath = this.storageJsonPath + '.vsctmp';
    this.backupPath = this.storageJsonPath + '.backup';
    this.originalDeviceId = null;
    this.testResults = {
      performance: {},
      protection: {},
      errors: []
    };
  }

  async runAllTests() {
    console.log('🚀 开始实时监控性能和防护测试...\n');
    
    try {
      // 1. 环境检查
      await this.checkEnvironment();
      
      // 2. 性能测试
      await this.testPerformance();
      
      // 3. 防护效果测试
      await this.testProtectionEffectiveness();
      
      // 4. 压力测试
      await this.testStressScenarios();
      
      // 5. 生成报告
      this.generateReport();
      
    } catch (error) {
      console.error('❌ 测试过程中发生错误:', error);
      this.testResults.errors.push(error.message);
    } finally {
      await this.cleanup();
    }
  }

  async checkEnvironment() {
    console.log('🔍 环境检查...');
    
    // 检查文件存在
    if (!(await fs.pathExists(this.storageJsonPath))) {
      throw new Error('storage.json文件不存在');
    }
    
    // 备份原始文件
    await fs.copy(this.storageJsonPath, this.backupPath);
    
    // 读取原始设备ID
    const content = await fs.readJson(this.storageJsonPath);
    this.originalDeviceId = content['telemetry.devDeviceId'];
    
    console.log('✅ 环境检查完成');
    console.log(`📱 原始设备ID: ${this.originalDeviceId}`);
    console.log(`📁 文件路径: ${this.storageJsonPath}\n`);
  }

  async testPerformance() {
    console.log('⚡ 性能测试...');
    
    // 测试1: 文件读写性能
    const readWriteStart = Date.now();
    for (let i = 0; i < 10; i++) {
      const content = await fs.readJson(this.storageJsonPath);
      content.test_field = `test_${i}`;
      await fs.writeJson(this.storageJsonPath, content, { spaces: 2 });
      delete content.test_field;
      await fs.writeJson(this.storageJsonPath, content, { spaces: 2 });
    }
    const readWriteTime = Date.now() - readWriteStart;
    
    this.testResults.performance.readWriteTime = readWriteTime;
    console.log(`📊 文件读写性能: ${readWriteTime}ms (10次操作)`);
    
    // 测试2: 监控响应时间
    const responseStart = Date.now();
    const testDeviceId = 'perf-test-' + Date.now();
    
    const content = await fs.readJson(this.storageJsonPath);
    content['telemetry.devDeviceId'] = testDeviceId;
    await fs.writeJson(this.storageJsonPath, content, { spaces: 2 });
    
    // 等待监控响应
    let responseTime = null;
    for (let i = 0; i < 50; i++) { // 最多等待5秒
      await new Promise(resolve => setTimeout(resolve, 100));
      const currentContent = await fs.readJson(this.storageJsonPath);
      if (currentContent['telemetry.devDeviceId'] !== testDeviceId) {
        responseTime = Date.now() - responseStart;
        break;
      }
    }
    
    this.testResults.performance.responseTime = responseTime;
    if (responseTime) {
      console.log(`⚡ 监控响应时间: ${responseTime}ms`);
    } else {
      console.log('⚠️ 监控未响应（可能未启动）');
    }
    
    console.log('');
  }

  async testProtectionEffectiveness() {
    console.log('🛡️ 防护效果测试...');
    
    let interceptCount = 0;
    const totalTests = 5;
    
    for (let i = 0; i < totalTests; i++) {
      console.log(`🧪 测试 ${i + 1}/${totalTests}: 设备ID修改拦截`);
      
      const testId = `attack-test-${Date.now()}-${i}`;
      const content = await fs.readJson(this.storageJsonPath);
      content['telemetry.devDeviceId'] = testId;
      
      await fs.writeJson(this.storageJsonPath, content, { spaces: 2 });
      
      // 等待拦截
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const resultContent = await fs.readJson(this.storageJsonPath);
      if (resultContent['telemetry.devDeviceId'] !== testId) {
        interceptCount++;
        console.log(`  ✅ 拦截成功`);
      } else {
        console.log(`  ❌ 拦截失败`);
      }
    }
    
    const successRate = (interceptCount / totalTests) * 100;
    this.testResults.protection.interceptSuccessRate = successRate;
    console.log(`📊 拦截成功率: ${successRate}% (${interceptCount}/${totalTests})`);
    
    // 测试临时文件拦截
    console.log('\n🚨 临时文件拦截测试...');
    let tempInterceptCount = 0;
    
    for (let i = 0; i < 3; i++) {
      const tempTestId = `temp-attack-${Date.now()}-${i}`;
      const content = await fs.readJson(this.storageJsonPath);
      content['telemetry.devDeviceId'] = tempTestId;
      
      await fs.writeJson(this.tempFilePath, content, { spaces: 2 });
      
      // 等待处理
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (await fs.pathExists(this.tempFilePath)) {
        const tempContent = await fs.readJson(this.tempFilePath);
        if (tempContent['telemetry.devDeviceId'] !== tempTestId) {
          tempInterceptCount++;
          console.log(`  ✅ 临时文件拦截成功`);
        } else {
          console.log(`  ❌ 临时文件拦截失败`);
        }
        await fs.remove(this.tempFilePath);
      }
    }
    
    const tempSuccessRate = (tempInterceptCount / 3) * 100;
    this.testResults.protection.tempInterceptSuccessRate = tempSuccessRate;
    console.log(`📊 临时文件拦截成功率: ${tempSuccessRate}%`);
    
    console.log('');
  }

  async testStressScenarios() {
    console.log('💪 压力测试...');
    
    // 快速连续修改测试
    console.log('🔥 快速连续修改测试...');
    const stressStart = Date.now();
    let stressInterceptCount = 0;
    
    for (let i = 0; i < 10; i++) {
      const stressTestId = `stress-${Date.now()}-${i}`;
      const content = await fs.readJson(this.storageJsonPath);
      content['telemetry.devDeviceId'] = stressTestId;
      
      await fs.writeJson(this.storageJsonPath, content, { spaces: 2 });
      
      // 短暂等待
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const resultContent = await fs.readJson(this.storageJsonPath);
      if (resultContent['telemetry.devDeviceId'] !== stressTestId) {
        stressInterceptCount++;
      }
    }
    
    const stressTime = Date.now() - stressStart;
    const stressSuccessRate = (stressInterceptCount / 10) * 100;
    
    this.testResults.performance.stressTestTime = stressTime;
    this.testResults.protection.stressSuccessRate = stressSuccessRate;
    
    console.log(`📊 压力测试时间: ${stressTime}ms`);
    console.log(`📊 压力测试拦截率: ${stressSuccessRate}%`);
    
    console.log('');
  }

  generateReport() {
    console.log('📋 测试报告');
    console.log('='.repeat(50));
    
    console.log('\n⚡ 性能指标:');
    console.log(`  文件读写性能: ${this.testResults.performance.readWriteTime || 'N/A'}ms`);
    console.log(`  监控响应时间: ${this.testResults.performance.responseTime || '未响应'}ms`);
    console.log(`  压力测试时间: ${this.testResults.performance.stressTestTime || 'N/A'}ms`);
    
    console.log('\n🛡️ 防护效果:');
    console.log(`  设备ID拦截成功率: ${this.testResults.protection.interceptSuccessRate || 0}%`);
    console.log(`  临时文件拦截成功率: ${this.testResults.protection.tempInterceptSuccessRate || 0}%`);
    console.log(`  压力测试拦截率: ${this.testResults.protection.stressSuccessRate || 0}%`);
    
    console.log('\n📊 综合评估:');
    const avgSuccessRate = (
      (this.testResults.protection.interceptSuccessRate || 0) +
      (this.testResults.protection.tempInterceptSuccessRate || 0) +
      (this.testResults.protection.stressSuccessRate || 0)
    ) / 3;
    
    if (avgSuccessRate >= 80) {
      console.log('  🟢 防护效果: 优秀');
    } else if (avgSuccessRate >= 60) {
      console.log('  🟡 防护效果: 良好');
    } else if (avgSuccessRate >= 40) {
      console.log('  🟠 防护效果: 一般');
    } else {
      console.log('  🔴 防护效果: 需要改进');
    }
    
    if (this.testResults.performance.responseTime && this.testResults.performance.responseTime < 1000) {
      console.log('  🟢 响应性能: 优秀');
    } else if (this.testResults.performance.responseTime && this.testResults.performance.responseTime < 3000) {
      console.log('  🟡 响应性能: 良好');
    } else {
      console.log('  🔴 响应性能: 需要改进');
    }
    
    if (this.testResults.errors.length === 0) {
      console.log('  🟢 稳定性: 优秀');
    } else {
      console.log(`  🔴 稳定性: 发现${this.testResults.errors.length}个错误`);
    }
    
    console.log('\n💡 建议:');
    if (!this.testResults.performance.responseTime) {
      console.log('  - 确保实时监控守护进程正在运行');
      console.log('  - 检查文件监控器是否正常启动');
    }
    if (avgSuccessRate < 80) {
      console.log('  - 考虑优化监控算法');
      console.log('  - 检查文件权限设置');
    }
    if (this.testResults.performance.responseTime > 1000) {
      console.log('  - 优化文件监控性能');
      console.log('  - 减少不必要的文件操作');
    }
  }

  async cleanup() {
    console.log('\n🧹 清理测试环境...');
    
    try {
      // 恢复原始文件
      if (await fs.pathExists(this.backupPath)) {
        await fs.copy(this.backupPath, this.storageJsonPath);
        await fs.remove(this.backupPath);
      }
      
      // 清理临时文件
      if (await fs.pathExists(this.tempFilePath)) {
        await fs.remove(this.tempFilePath);
      }
      
      console.log('✅ 清理完成');
    } catch (error) {
      console.error('⚠️ 清理过程中发生错误:', error.message);
    }
  }
}

// 运行测试
if (require.main === module) {
  const test = new ProtectionPerformanceTest();
  test.runAllTests().catch(console.error);
}

module.exports = { ProtectionPerformanceTest };
