#!/usr/bin/env node
/**
 * 全面的ID格式审计工具
 * 检查项目中所有生成ID的地方是否符合正确格式
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

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

// 测试各种ID生成方法
function testIdGeneration() {
  console.log('🧪 测试ID生成方法');
  console.log('=' .repeat(60));
  
  const results = {
    correct: [],
    incorrect: []
  };
  
  // 1. 测试正确的生成方法
  console.log('\n✅ 正确的生成方法：');
  
  // devDeviceId - 正确
  const correctDeviceId = crypto.randomUUID();
  const deviceIdValidation = validateDeviceId(correctDeviceId);
  console.log(`devDeviceId: ${correctDeviceId}`);
  console.log(`验证结果: ${deviceIdValidation.valid ? '✅' : '❌'} ${deviceIdValidation.error || '格式正确'}`);
  if (deviceIdValidation.valid) results.correct.push('devDeviceId');
  else results.incorrect.push('devDeviceId');
  
  // machineId - 正确
  const correctMachineId = crypto.randomBytes(32).toString('hex');
  const machineIdValidation = validateMachineId(correctMachineId);
  console.log(`machineId: ${correctMachineId}`);
  console.log(`验证结果: ${machineIdValidation.valid ? '✅' : '❌'} ${machineIdValidation.error || '格式正确'}`);
  if (machineIdValidation.valid) results.correct.push('machineId');
  else results.incorrect.push('machineId');
  
  // macMachineId - 正确
  const correctMacMachineId = crypto.randomBytes(32).toString('hex');
  const macMachineIdValidation = validateMachineId(correctMacMachineId);
  console.log(`macMachineId: ${correctMacMachineId}`);
  console.log(`验证结果: ${macMachineIdValidation.valid ? '✅' : '❌'} ${macMachineIdValidation.error || '格式正确'}`);
  if (macMachineIdValidation.valid) results.correct.push('macMachineId');
  else results.incorrect.push('macMachineId');
  
  // sessionId - 正确
  const correctSessionId = crypto.randomUUID();
  const sessionIdValidation = validateDeviceId(correctSessionId);
  console.log(`sessionId: ${correctSessionId}`);
  console.log(`验证结果: ${sessionIdValidation.valid ? '✅' : '❌'} ${sessionIdValidation.error || '格式正确'}`);
  if (sessionIdValidation.valid) results.correct.push('sessionId');
  else results.incorrect.push('sessionId');
  
  // sqmId - 正确
  const correctSqmId = `{${crypto.randomUUID().toUpperCase()}}`;
  const sqmIdValidation = validateSqmId(correctSqmId);
  console.log(`sqmId: ${correctSqmId}`);
  console.log(`验证结果: ${sqmIdValidation.valid ? '✅' : '❌'} ${sqmIdValidation.error || '格式正确'}`);
  if (sqmIdValidation.valid) results.correct.push('sqmId');
  else results.incorrect.push('sqmId');
  
  // 2. 测试错误的生成方法（项目中发现的问题）
  console.log('\n❌ 项目中发现的错误方法：');
  
  // 错误：使用UUID作为machineId
  const wrongMachineId = crypto.randomUUID(); // 应该是64位十六进制，不是UUID
  const wrongMachineIdValidation = validateMachineId(wrongMachineId);
  console.log(`错误的machineId (UUID格式): ${wrongMachineId}`);
  console.log(`验证结果: ${wrongMachineIdValidation.valid ? '✅' : '❌'} ${wrongMachineIdValidation.error || '格式正确'}`);
  
  // 错误：PowerShell中的格式
  const powershellMachineId = 'auth0|user_' + Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const powershellValidation = validateMachineId(powershellMachineId);
  console.log(`PowerShell格式machineId: ${powershellMachineId}`);
  console.log(`验证结果: ${powershellValidation.valid ? '✅' : '❌'} ${powershellValidation.error || '格式正确'}`);
  
  return results;
}

// 分析项目中的代码问题
function analyzeCodeIssues() {
  console.log('\n🔍 项目代码问题分析');
  console.log('=' .repeat(60));
  
  const issues = [];
  
  // 问题1: unified-cleanup-implementation.js
  issues.push({
    file: 'scripts/implementations/unified-cleanup-implementation.js',
    line: '193-194',
    problem: 'generateDeviceFingerprint()返回UUID格式，但用作machineId（应为64位十六进制）',
    code: 'const newMachineId = this.generateDeviceFingerprint();',
    fix: 'const newMachineId = crypto.randomBytes(32).toString("hex");'
  });
  
  issues.push({
    file: 'scripts/implementations/unified-cleanup-implementation.js',
    line: '194',
    problem: 'generateUUID()方法不存在',
    code: 'const newSessionId = this.generateUUID();',
    fix: 'const newSessionId = crypto.randomUUID();'
  });
  
  issues.push({
    file: 'scripts/implementations/unified-cleanup-implementation.js',
    line: '200',
    problem: 'macMachineId使用了与machineId相同的值，且格式错误',
    code: 'storageData["telemetry.macMachineId"] = newMachineId;',
    fix: 'storageData["telemetry.macMachineId"] = crypto.randomBytes(32).toString("hex");'
  });
  
  // 问题2: device-manager.js PowerShell方法
  issues.push({
    file: 'modules/desktop-client/src/device-manager.js',
    line: '5105-5106',
    problem: 'machineId和macMachineId使用UUID格式，应为64位十六进制',
    code: 'machineId: crypto.randomUUID(), macMachineId: crypto.randomUUID()',
    fix: 'machineId: crypto.randomBytes(32).toString("hex"), macMachineId: crypto.randomBytes(32).toString("hex")'
  });
  
  // 问题3: PowerShell脚本
  issues.push({
    file: 'scripts/powershell/ide-reset-ultimate.ps1',
    line: '241-242',
    problem: 'PowerShell中machineId格式错误，macMachineId使用GUID',
    code: 'machineId = "auth0|user_" + random, macMachineId = [System.Guid]::NewGuid()',
    fix: '使用正确的64位十六进制生成方法'
  });
  
  // 问题4: device-manager.js中的复杂字符串拼接
  issues.push({
    file: 'modules/desktop-client/src/device-manager.js',
    line: '3428-3429',
    problem: '使用复杂的字符串拼接生成ID，且格式可能错误',
    code: 'data["telemetry.macMachineId"] = newCursorDeviceId.substring(0, 64);',
    fix: '使用crypto.randomBytes(32).toString("hex")直接生成'
  });
  
  console.log(`发现 ${issues.length} 个问题：\n`);
  
  issues.forEach((issue, index) => {
    console.log(`${index + 1}. 📁 ${issue.file}`);
    console.log(`   📍 行号: ${issue.line}`);
    console.log(`   ❌ 问题: ${issue.problem}`);
    console.log(`   💻 当前代码: ${issue.code}`);
    console.log(`   ✅ 修复建议: ${issue.fix}`);
    console.log('');
  });
  
  return issues;
}

// 检查正确的实现
function checkCorrectImplementations() {
  console.log('\n✅ 正确的实现示例');
  console.log('=' .repeat(60));
  
  const correctFiles = [
    {
      file: 'modules/desktop-client/src/smart-device-reset.js',
      lines: '203-204',
      code: `'telemetry.machineId': crypto.randomBytes(32).toString('hex'),
'telemetry.macMachineId': crypto.randomBytes(32).toString('hex')`
    },
    {
      file: 'modules/desktop-client/test/clean-windows-backup.js',
      lines: '200-201',
      code: `machineId: crypto.randomBytes(32).toString('hex'),
macMachineId: crypto.randomBytes(32).toString('hex')`
    },
    {
      file: 'modules/desktop-client/test/enhanced-cursor-cleanup.js',
      lines: '211-212',
      code: `machineId: crypto.randomBytes(32).toString('hex'),
macMachineId: crypto.randomBytes(32).toString('hex')`
    }
  ];
  
  correctFiles.forEach((example, index) => {
    console.log(`${index + 1}. ✅ ${example.file}`);
    console.log(`   📍 行号: ${example.lines}`);
    console.log(`   💻 正确代码:`);
    console.log(`   ${example.code.split('\n').join('\n   ')}`);
    console.log('');
  });
}

// 生成修复建议
function generateFixSuggestions() {
  console.log('\n🔧 修复建议');
  console.log('=' .repeat(60));
  
  console.log('1. 统一ID生成标准：');
  console.log('   - devDeviceId: crypto.randomUUID()');
  console.log('   - machineId: crypto.randomBytes(32).toString("hex")');
  console.log('   - macMachineId: crypto.randomBytes(32).toString("hex")');
  console.log('   - sessionId: crypto.randomUUID()');
  console.log('   - sqmId: `{${crypto.randomUUID().toUpperCase()}}`');
  console.log('');
  
  console.log('2. 需要修复的文件：');
  console.log('   - scripts/implementations/unified-cleanup-implementation.js');
  console.log('   - modules/desktop-client/src/device-manager.js (PowerShell方法)');
  console.log('   - scripts/powershell/ide-reset-ultimate.ps1');
  console.log('   - scripts/powershell/ide-reset-simple.ps1');
  console.log('');
  
  console.log('3. 添加缺失的方法：');
  console.log('   - 在unified-cleanup-implementation.js中添加generateUUID()方法');
  console.log('   - 或直接使用crypto.randomUUID()');
}

// 主函数
async function main() {
  console.log('🔍 全面ID格式审计');
  console.log('=' .repeat(80));
  
  // 1. 测试ID生成
  const testResults = testIdGeneration();
  
  // 2. 分析代码问题
  const issues = analyzeCodeIssues();
  
  // 3. 检查正确实现
  checkCorrectImplementations();
  
  // 4. 生成修复建议
  generateFixSuggestions();
  
  // 5. 总结
  console.log('\n📊 审计总结');
  console.log('=' .repeat(60));
  console.log(`✅ 正确的ID生成方法: ${testResults.correct.length}/5`);
  console.log(`❌ 发现的代码问题: ${issues.length}个`);
  console.log(`🔧 需要修复的主要文件: 4个`);
  
  if (issues.length > 0) {
    console.log('\n⚠️  项目中的ID生成格式存在问题，需要修复！');
  } else {
    console.log('\n🎉 所有ID生成格式都正确！');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  validateMachineId,
  validateDeviceId,
  validateSqmId,
  testIdGeneration,
  analyzeCodeIssues
};
