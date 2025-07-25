#!/usr/bin/env node
/**
 * 最终验证：实际运行修复后的代码，测试ID生成是否正确
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// 获取共享路径的辅助函数
function getSharedPath(relativePath) {
  return path.join(__dirname, 'shared', relativePath);
}

// ID格式验证函数
function validateMachineId(id) {
  if (!id || typeof id !== 'string') return { valid: false, error: 'ID为空或非字符串' };
  if (id.length !== 64) return { valid: false, error: `长度错误：${id.length}，应为64` };
  if (!/^[0-9a-f]{64}$/.test(id)) return { valid: false, error: '格式错误：应为64位十六进制字符串' };
  return { valid: true };
}

function validateDeviceId(id) {
  if (!id || typeof id !== 'string') return { valid: false, error: 'ID为空或非字符串' };
  if (id.length !== 36) return { valid: false, error: `长度错误：${id.length}，应为36` };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
    return { valid: false, error: '格式错误：应为标准UUID v4格式' };
  }
  return { valid: true };
}

function validateSqmId(id) {
  if (!id || typeof id !== 'string') return { valid: false, error: 'ID为空或非字符串' };
  if (id.length !== 38) return { valid: false, error: `长度错误：${id.length}，应为38` };
  if (!/^\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}$/.test(id)) {
    return { valid: false, error: '格式错误：应为大括号包围的大写UUID' };
  }
  return { valid: true };
}

async function testIDGeneratorActual() {
  console.log('🧪 实际测试ID生成工具');
  console.log('=' .repeat(60));
  
  try {
    const IDGenerator = require('./shared/utils/id-generator');
    
    console.log('\n📋 生成并验证10组ID：');
    
    let allValid = true;
    
    for (let i = 1; i <= 10; i++) {
      console.log(`\n第${i}组：`);
      
      const identity = IDGenerator.generateCompleteDeviceIdentity('cursor');
      
      // 验证每个字段
      const validations = {
        'telemetry.devDeviceId': validateDeviceId(identity['telemetry.devDeviceId']),
        'telemetry.machineId': validateMachineId(identity['telemetry.machineId']),
        'telemetry.macMachineId': validateMachineId(identity['telemetry.macMachineId']),
        'telemetry.sessionId': validateDeviceId(identity['telemetry.sessionId']),
        'telemetry.sqmId': validateSqmId(identity['telemetry.sqmId']),
        'storage.serviceMachineId': validateMachineId(identity['storage.serviceMachineId'])
      };
      
      Object.entries(validations).forEach(([field, validation]) => {
        const status = validation.valid ? '✅' : '❌';
        console.log(`  ${field}: ${status} ${validation.error || '格式正确'}`);
        if (!validation.valid) allValid = false;
      });
    }
    
    console.log(`\n🎯 ID生成工具测试结果: ${allValid ? '✅ 全部正确' : '❌ 存在问题'}`);
    return allValid;
    
  } catch (error) {
    console.error('❌ ID生成工具测试失败:', error.message);
    return false;
  }
}

async function simulateUnifiedCleanup() {
  console.log('\n🔧 模拟unified-cleanup-implementation.js执行');
  console.log('=' .repeat(60));
  
  try {
    // 模拟创建临时storage.json文件
    const tempDir = path.join(os.tmpdir(), 'augment-test');
    await fs.ensureDir(tempDir);
    const tempStorageJson = path.join(tempDir, 'storage.json');
    
    // 创建初始数据
    const initialData = {
      'telemetry.devDeviceId': 'old-device-id',
      'telemetry.machineId': 'old-machine-id',
      'other.setting': 'should-be-preserved'
    };
    
    await fs.writeJson(tempStorageJson, initialData, { spaces: 2 });
    
    // 模拟unified-cleanup-implementation.js的逻辑
    const IDGenerator = require('./shared/utils/id-generator');
    const storageData = await fs.readJson(tempStorageJson);
    const newIdentity = IDGenerator.generateCompleteDeviceIdentity('cursor');
    
    // 更新设备标识
    Object.assign(storageData, newIdentity);
    
    await fs.writeJson(tempStorageJson, storageData, { spaces: 2 });
    
    // 验证结果
    const updatedData = await fs.readJson(tempStorageJson);
    
    console.log('生成的设备身份:');
    Object.entries(newIdentity).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    
    // 验证格式
    const validations = {
      'telemetry.devDeviceId': validateDeviceId(updatedData['telemetry.devDeviceId']),
      'telemetry.machineId': validateMachineId(updatedData['telemetry.machineId']),
      'telemetry.macMachineId': validateMachineId(updatedData['telemetry.macMachineId']),
      'telemetry.sessionId': validateDeviceId(updatedData['telemetry.sessionId']),
      'telemetry.sqmId': validateSqmId(updatedData['telemetry.sqmId'])
    };
    
    let allValid = true;
    console.log('\n验证结果:');
    Object.entries(validations).forEach(([field, validation]) => {
      const status = validation.valid ? '✅' : '❌';
      console.log(`  ${field}: ${status} ${validation.error || '格式正确'}`);
      if (!validation.valid) allValid = false;
    });
    
    // 验证其他设置是否保留
    const preservedOtherSetting = updatedData['other.setting'] === 'should-be-preserved';
    console.log(`  其他设置保留: ${preservedOtherSetting ? '✅' : '❌'}`);
    
    // 清理临时文件
    await fs.remove(tempDir);
    
    console.log(`\n🎯 unified-cleanup模拟测试: ${allValid && preservedOtherSetting ? '✅ 成功' : '❌ 失败'}`);
    return allValid && preservedOtherSetting;
    
  } catch (error) {
    console.error('❌ unified-cleanup模拟测试失败:', error.message);
    return false;
  }
}

async function simulateDeviceManagerPowerShell() {
  console.log('\n🔧 模拟device-manager.js PowerShell方法执行');
  console.log('=' .repeat(60));
  
  try {
    // 模拟PowerShell方法中的ID生成逻辑
    const IDGenerator = require('./shared/utils/id-generator');
    const newIdentifiers = {
      devDeviceId: IDGenerator.generateDeviceId(),
      machineId: IDGenerator.generateMachineId(),
      macMachineId: IDGenerator.generateMacMachineId(),
      sessionId: IDGenerator.generateSessionId(),
      sqmId: IDGenerator.generateSqmId(),
    };
    
    console.log('PowerShell方法生成的ID:');
    Object.entries(newIdentifiers).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    
    // 验证格式
    const validations = {
      devDeviceId: validateDeviceId(newIdentifiers.devDeviceId),
      machineId: validateMachineId(newIdentifiers.machineId),
      macMachineId: validateMachineId(newIdentifiers.macMachineId),
      sessionId: validateDeviceId(newIdentifiers.sessionId),
      sqmId: validateSqmId(newIdentifiers.sqmId)
    };
    
    let allValid = true;
    console.log('\n验证结果:');
    Object.entries(validations).forEach(([field, validation]) => {
      const status = validation.valid ? '✅' : '❌';
      console.log(`  ${field}: ${status} ${validation.error || '格式正确'}`);
      if (!validation.valid) allValid = false;
    });
    
    console.log(`\n🎯 PowerShell方法模拟测试: ${allValid ? '✅ 成功' : '❌ 失败'}`);
    return allValid;
    
  } catch (error) {
    console.error('❌ PowerShell方法模拟测试失败:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔍 最终验证：实际运行修复后的代码');
  console.log('=' .repeat(80));
  
  const results = {
    idGenerator: await testIDGeneratorActual(),
    unifiedCleanup: await simulateUnifiedCleanup(),
    powerShellMethod: await simulateDeviceManagerPowerShell()
  };
  
  console.log('\n📊 最终验证结果');
  console.log('=' .repeat(60));
  console.log(`✅ ID生成工具: ${results.idGenerator ? '✅ 通过' : '❌ 失败'}`);
  console.log(`✅ unified-cleanup模拟: ${results.unifiedCleanup ? '✅ 通过' : '❌ 失败'}`);
  console.log(`✅ PowerShell方法模拟: ${results.powerShellMethod ? '✅ 通过' : '❌ 失败'}`);
  
  const allPassed = Object.values(results).every(result => result);
  
  console.log(`\n🎯 最终结果: ${allPassed ? '🎉 所有修复验证通过！' : '⚠️ 仍有问题'}`);
  
  if (allPassed) {
    console.log('\n✨ 恭喜！所有ID格式问题已成功修复：');
    console.log('  ✅ devDeviceId: 标准UUID v4格式 (36字符)');
    console.log('  ✅ machineId: 64位十六进制字符串 (64字符)');
    console.log('  ✅ macMachineId: 64位十六进制字符串 (64字符)');
    console.log('  ✅ sessionId: 标准UUID v4格式 (36字符)');
    console.log('  ✅ sqmId: 大括号包围的大写UUID (38字符)');
    console.log('  ✅ serviceMachineId: 64位十六进制字符串 (64字符)');
    console.log('\n🚀 现在项目中生成的所有ID都符合VS Code/Cursor标准格式！');
  }
}

if (require.main === module) {
  main().catch(console.error);
}
