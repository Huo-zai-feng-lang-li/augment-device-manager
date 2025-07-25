/**
 * 测试智能清理的ID随机性
 * 验证每次智能清理是否真的生成不同的随机ID
 */

const fs = require('fs-extra');
const path = require('path');
const DeviceManager = require('../../modules/desktop-client/src/device-manager');

class IntelligentCleanupRandomnessTest {
  constructor() {
    this.results = [];
    this.deviceManager = new DeviceManager();
  }

  /**
   * 执行多次智能清理并记录ID变化
   */
  async testMultipleCleanups(iterations = 3) {
    console.log(`🧪 测试智能清理ID随机性（${iterations}次清理）\n`);

    const vscodeVariants = await this.deviceManager.detectInstalledVSCodeVariants();
    
    if (vscodeVariants.length === 0) {
      console.log('❌ 未检测到VSCode安装');
      return;
    }

    const variant = vscodeVariants[0]; // 使用第一个变体
    console.log(`🎯 测试目标: ${variant.name}`);
    console.log(`📁 配置文件: ${variant.storageJson}\n`);

    // 备份原始文件
    const originalBackup = variant.storageJson + '.original-backup.' + Date.now();
    if (await fs.pathExists(variant.storageJson)) {
      await fs.copy(variant.storageJson, originalBackup);
      console.log(`💾 已备份原始文件: ${originalBackup}\n`);
    }

    try {
      for (let i = 1; i <= iterations; i++) {
        console.log(`🔄 第${i}次智能清理:`);
        
        // 执行智能清理
        const results = { actions: [], errors: [] };
        await this.deviceManager.performVSCodeIntelligentCleanup(results, variant);
        
        // 读取清理后的ID
        if (await fs.pathExists(variant.storageJson)) {
          const data = await fs.readJson(variant.storageJson);
          const currentIds = {
            iteration: i,
            devDeviceId: data['telemetry.devDeviceId'],
            machineId: data['telemetry.machineId'],
            macMachineId: data['telemetry.macMachineId'],
            sessionId: data['telemetry.sessionId'],
            serviceMachineId: data['storage.serviceMachineId']
          };
          
          this.results.push(currentIds);
          
          console.log(`  devDeviceId: ${currentIds.devDeviceId}`);
          console.log(`  machineId: ${currentIds.machineId?.substring(0, 16)}...`);
          
          // 检查错误
          if (results.errors.length > 0) {
            console.log(`  ❌ 错误: ${results.errors.join(', ')}`);
          } else {
            console.log(`  ✅ 清理成功`);
          }
        } else {
          console.log(`  ❌ 配置文件不存在`);
        }
        
        console.log('');
        
        // 短暂延迟，确保时间戳不同
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 分析结果
      this.analyzeResults();

    } finally {
      // 恢复原始文件
      if (await fs.pathExists(originalBackup)) {
        await fs.copy(originalBackup, variant.storageJson);
        console.log(`🔄 已恢复原始配置文件`);
      }
    }
  }

  /**
   * 分析ID变化模式
   */
  analyzeResults() {
    console.log('📊 ID变化分析:\n');

    if (this.results.length < 2) {
      console.log('❌ 数据不足，无法分析');
      return;
    }

    const fields = ['devDeviceId', 'machineId', 'macMachineId', 'sessionId', 'serviceMachineId'];
    
    fields.forEach(field => {
      console.log(`🔍 ${field}:`);
      
      const values = this.results.map(r => r[field]).filter(v => v);
      const uniqueValues = new Set(values);
      
      console.log(`  - 总次数: ${values.length}`);
      console.log(`  - 唯一值: ${uniqueValues.size}`);
      console.log(`  - 随机性: ${uniqueValues.size === values.length ? '✅ 完全随机' : '❌ 存在重复'}`);
      
      if (uniqueValues.size !== values.length) {
        console.log(`  - 重复情况:`);
        const valueCount = {};
        values.forEach(v => {
          valueCount[v] = (valueCount[v] || 0) + 1;
        });
        Object.entries(valueCount).forEach(([value, count]) => {
          if (count > 1) {
            console.log(`    * ${value.substring(0, 16)}... 出现${count}次`);
          }
        });
      }
      
      console.log('');
    });

    // 总体评估
    const allFieldsRandom = fields.every(field => {
      const values = this.results.map(r => r[field]).filter(v => v);
      const uniqueValues = new Set(values);
      return uniqueValues.size === values.length;
    });

    console.log('🎯 总体评估:');
    if (allFieldsRandom) {
      console.log('✅ 智能清理ID生成完全随机，每次都生成不同的ID');
    } else {
      console.log('❌ 智能清理ID生成存在问题，某些ID出现重复');
      console.log('💡 建议检查ID生成逻辑或缓存机制');
    }
  }

  /**
   * 显示详细的ID对比
   */
  showDetailedComparison() {
    console.log('\n📋 详细ID对比:');
    this.results.forEach((result, index) => {
      console.log(`第${result.iteration}次:`);
      console.log(`  devDeviceId: ${result.devDeviceId}`);
      console.log(`  machineId: ${result.machineId}`);
      console.log('');
    });
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const tester = new IntelligentCleanupRandomnessTest();
  
  // 可以通过命令行参数指定测试次数
  const iterations = process.argv[2] ? parseInt(process.argv[2]) : 3;
  
  tester.testMultipleCleanups(iterations)
    .then(() => {
      console.log('\n🏁 测试完成');
    })
    .catch(error => {
      console.error('❌ 测试失败:', error.message);
    });
}

module.exports = IntelligentCleanupRandomnessTest;
