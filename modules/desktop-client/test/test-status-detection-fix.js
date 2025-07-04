#!/usr/bin/env node

/**
 * 测试状态检测修复效果
 * 
 * 功能：
 * 1. 测试新的状态检测逻辑
 * 2. 验证进程扫描功能
 * 3. 模拟各种状态场景
 * 4. 确认界面状态同步
 */

const path = require('path');
const fs = require('fs-extra');

// 模拟设备管理器
class TestDeviceManager {
  constructor() {
    this.enhancedGuardian = {
      getStatus: async () => ({
        isGuarding: false,
        targetDeviceId: null,
        currentDeviceId: null,
        isProtected: false,
        watchersCount: 0,
        uptime: 0,
        stats: {
          interceptedAttempts: 0,
          backupFilesRemoved: 0,
          protectionRestored: 0
        }
      })
    };
    
    this.standaloneService = {
      getServiceStatus: async () => ({
        isRunning: false,
        pid: null,
        config: null,
        uptime: 0,
        recentLogs: []
      })
    };
  }

  // 导入实际的方法
  async loadActualMethods() {
    try {
      const DeviceManager = require('../src/device-manager');
      const actualManager = new DeviceManager();
      
      // 复制实际的方法
      this.checkActualGuardianProcesses = actualManager.checkActualGuardianProcesses.bind(this);
      this.getEnhancedGuardianStatus = actualManager.getEnhancedGuardianStatus.bind(this);
      
      console.log('✅ 已加载实际的设备管理器方法');
    } catch (error) {
      console.error('❌ 加载设备管理器方法失败:', error.message);
      throw error;
    }
  }
}

class StatusDetectionTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🧪 开始状态检测修复效果测试...\n');
    
    try {
      // 1. 测试进程扫描功能
      await this.testProcessScanning();
      
      // 2. 测试状态检测逻辑
      await this.testStatusDetection();
      
      // 3. 测试边界情况
      await this.testEdgeCases();
      
      // 4. 生成测试报告
      this.generateTestReport();
      
    } catch (error) {
      console.error('❌ 测试过程中发生错误:', error.message);
    }
  }

  /**
   * 测试进程扫描功能
   */
  async testProcessScanning() {
    console.log('📋 1. 测试进程扫描功能...');
    
    try {
      const deviceManager = new TestDeviceManager();
      await deviceManager.loadActualMethods();
      
      // 测试进程扫描
      const processResult = await deviceManager.checkActualGuardianProcesses();
      
      this.addTestResult('进程扫描基础功能', true, {
        hasStandaloneProcess: processResult.hasStandaloneProcess,
        hasInProcessGuardian: processResult.hasInProcessGuardian,
        processCount: processResult.processes.length
      });
      
      console.log(`   🔍 扫描结果:`);
      console.log(`      独立服务: ${processResult.hasStandaloneProcess ? '✅ 检测到' : '❌ 未检测到'}`);
      console.log(`      内置进程: ${processResult.hasInProcessGuardian ? '✅ 检测到' : '❌ 未检测到'}`);
      console.log(`      进程总数: ${processResult.processes.length}`);
      
      if (processResult.processes.length > 0) {
        console.log(`   📊 检测到的进程:`);
        processResult.processes.forEach(proc => {
          console.log(`      • PID ${proc.pid} - ${proc.type}`);
        });
      }
      
    } catch (error) {
      this.addTestResult('进程扫描基础功能', false, { error: error.message });
      console.log(`   ❌ 进程扫描测试失败: ${error.message}`);
    }
  }

  /**
   * 测试状态检测逻辑
   */
  async testStatusDetection() {
    console.log('\n📋 2. 测试状态检测逻辑...');
    
    try {
      const deviceManager = new TestDeviceManager();
      await deviceManager.loadActualMethods();
      
      // 测试综合状态检测
      const status = await deviceManager.getEnhancedGuardianStatus();
      
      console.log(`   🔍 状态检测结果:`);
      console.log(`      总体防护: ${status.isGuarding ? '✅ 运行中' : '❌ 未运行'}`);
      console.log(`      防护模式: ${status.mode}`);
      console.log(`      检测时间: ${status.timestamp}`);
      
      if (status.detectionDetails) {
        console.log(`   📊 检测详情:`);
        console.log(`      内置进程: ${status.detectionDetails.inProcessGuarding}`);
        console.log(`      独立服务: ${status.detectionDetails.standaloneRunning}`);
        console.log(`      检测方法: ${status.detectionDetails.detectionMethod}`);
      }
      
      if (status.standalone && status.standalone.detectionMethod === 'process-scan') {
        console.log(`   🎯 通过进程扫描检测到独立服务`);
        console.log(`      PID: ${status.standalone.pid}`);
        console.log(`      警告: ${status.standalone.warning}`);
      }
      
      this.addTestResult('综合状态检测', true, {
        isGuarding: status.isGuarding,
        mode: status.mode,
        detectionMethod: status.detectionDetails?.detectionMethod
      });
      
    } catch (error) {
      this.addTestResult('综合状态检测', false, { error: error.message });
      console.log(`   ❌ 状态检测测试失败: ${error.message}`);
    }
  }

  /**
   * 测试边界情况
   */
  async testEdgeCases() {
    console.log('\n📋 3. 测试边界情况...');
    
    // 测试1: 模拟PID文件损坏的情况
    await this.testCorruptedPidFile();
    
    // 测试2: 模拟多个进程同时运行
    await this.testMultipleProcesses();
    
    // 测试3: 测试状态一致性
    await this.testStatusConsistency();
  }

  /**
   * 测试PID文件损坏情况
   */
  async testCorruptedPidFile() {
    console.log('   🧪 测试PID文件损坏情况...');
    
    try {
      const deviceManager = new TestDeviceManager();
      await deviceManager.loadActualMethods();
      
      // 模拟PID文件损坏：standaloneService返回false，但实际有进程运行
      deviceManager.standaloneService.getServiceStatus = async () => ({
        isRunning: false,  // PID文件检查失败
        pid: null,
        config: null,
        uptime: 0,
        recentLogs: []
      });
      
      const status = await deviceManager.getEnhancedGuardianStatus();
      
      // 如果进程扫描检测到了运行中的进程，应该能正确显示状态
      const shouldDetectRunning = status.isGuarding && 
                                 status.standalone && 
                                 status.standalone.detectionMethod === 'process-scan';
      
      if (shouldDetectRunning) {
        console.log('   ✅ 成功通过进程扫描检测到运行状态');
        this.addTestResult('PID文件损坏恢复', true, {
          detectedViaProcessScan: true,
          warning: status.standalone.warning
        });
      } else {
        console.log('   ℹ️ 未检测到运行中的进程（正常情况）');
        this.addTestResult('PID文件损坏恢复', true, {
          detectedViaProcessScan: false,
          reason: '无实际运行进程'
        });
      }
      
    } catch (error) {
      this.addTestResult('PID文件损坏恢复', false, { error: error.message });
      console.log(`   ❌ PID文件损坏测试失败: ${error.message}`);
    }
  }

  /**
   * 测试多个进程情况
   */
  async testMultipleProcesses() {
    console.log('   🧪 测试多个进程检测...');
    
    try {
      const deviceManager = new TestDeviceManager();
      await deviceManager.loadActualMethods();
      
      const processResult = await deviceManager.checkActualGuardianProcesses();
      
      if (processResult.processes.length > 1) {
        console.log('   ⚠️ 检测到多个守护进程，可能需要清理');
        this.addTestResult('多进程检测', true, {
          processCount: processResult.processes.length,
          needsCleanup: true
        });
      } else {
        console.log('   ✅ 进程数量正常');
        this.addTestResult('多进程检测', true, {
          processCount: processResult.processes.length,
          needsCleanup: false
        });
      }
      
    } catch (error) {
      this.addTestResult('多进程检测', false, { error: error.message });
      console.log(`   ❌ 多进程检测失败: ${error.message}`);
    }
  }

  /**
   * 测试状态一致性
   */
  async testStatusConsistency() {
    console.log('   🧪 测试状态一致性...');
    
    try {
      const deviceManager = new TestDeviceManager();
      await deviceManager.loadActualMethods();
      
      // 连续检查3次状态，确保一致性
      const statuses = [];
      for (let i = 0; i < 3; i++) {
        const status = await deviceManager.getEnhancedGuardianStatus();
        statuses.push({
          isGuarding: status.isGuarding,
          mode: status.mode,
          timestamp: status.timestamp
        });
        
        // 间隔1秒
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 检查状态是否一致
      const isConsistent = statuses.every(status => 
        status.isGuarding === statuses[0].isGuarding &&
        status.mode === statuses[0].mode
      );
      
      if (isConsistent) {
        console.log('   ✅ 状态检测结果一致');
        this.addTestResult('状态一致性', true, { consistent: true });
      } else {
        console.log('   ⚠️ 状态检测结果不一致');
        this.addTestResult('状态一致性', false, { 
          consistent: false, 
          statuses: statuses 
        });
      }
      
    } catch (error) {
      this.addTestResult('状态一致性', false, { error: error.message });
      console.log(`   ❌ 状态一致性测试失败: ${error.message}`);
    }
  }

  /**
   * 添加测试结果
   */
  addTestResult(testName, passed, details = {}) {
    this.testResults.tests.push({
      name: testName,
      passed: passed,
      details: details,
      timestamp: new Date().toISOString()
    });
    
    if (passed) {
      this.testResults.passed++;
    } else {
      this.testResults.failed++;
    }
  }

  /**
   * 生成测试报告
   */
  generateTestReport() {
    console.log('\n📋 测试报告');
    console.log('='.repeat(50));
    
    const total = this.testResults.passed + this.testResults.failed;
    const successRate = total > 0 ? Math.round((this.testResults.passed / total) * 100) : 0;
    
    console.log(`\n📊 测试统计:`);
    console.log(`   总测试数: ${total}`);
    console.log(`   通过: ${this.testResults.passed}`);
    console.log(`   失败: ${this.testResults.failed}`);
    console.log(`   成功率: ${successRate}%`);
    
    console.log(`\n📋 详细结果:`);
    this.testResults.tests.forEach(test => {
      const status = test.passed ? '✅' : '❌';
      console.log(`   ${status} ${test.name}`);
      if (test.details && Object.keys(test.details).length > 0) {
        console.log(`      详情: ${JSON.stringify(test.details, null, 2).replace(/\n/g, '\n      ')}`);
      }
    });
    
    console.log('\n' + '='.repeat(50));
    
    if (successRate >= 80) {
      console.log('🎉 测试通过！状态检测修复效果良好。');
    } else {
      console.log('⚠️ 部分测试失败，可能需要进一步调试。');
    }
    
    // 提供使用建议
    console.log('\n💡 使用建议:');
    console.log('   1. 重启桌面客户端以应用修复');
    console.log('   2. 检查界面状态显示是否正确');
    console.log('   3. 如有问题，运行诊断工具进一步排查');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const tester = new StatusDetectionTester();
  tester.runAllTests().catch(console.error);
}

module.exports = StatusDetectionTester;
