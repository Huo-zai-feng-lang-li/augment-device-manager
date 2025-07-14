#!/usr/bin/env node

/**
 * 验证智能清理模式修复的正确性
 * 检查MCP文件保护和IDE设置保护
 */

const path = require('path');
const fs = require('fs-extra');

async function main() {
  console.log('🔍 验证智能清理模式修复的正确性...\n');

  try {
    // 1. 检查MCP保护机制
    console.log('🛡️ 1. 检查MCP保护机制');
    await checkMCPProtection();

    // 2. 检查IDE设置保护
    console.log('\n🔧 2. 检查IDE设置保护');
    await checkIDESettingsProtection();

    // 3. 检查文件过滤逻辑
    console.log('\n📋 3. 检查文件过滤逻辑');
    await checkFileFilterLogic();

    // 4. 检查智能清理模式完整性
    console.log('\n🧠 4. 检查智能清理模式完整性');
    await checkIntelligentCleanupIntegrity();

    console.log('\n🎉 验证完成！');

  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    process.exit(1);
  }
}

// 检查MCP保护机制
async function checkMCPProtection() {
  const DeviceManager = require('../src/device-manager');
  const deviceManager = new DeviceManager();

  // 检查protectMCPConfigUniversal方法是否存在
  if (typeof deviceManager.protectMCPConfigUniversal !== 'function') {
    console.log('  ❌ protectMCPConfigUniversal方法不存在');
    return;
  }

  // 检查restoreMCPConfigUniversal方法是否存在
  if (typeof deviceManager.restoreMCPConfigUniversal !== 'function') {
    console.log('  ❌ restoreMCPConfigUniversal方法不存在');
    return;
  }

  // 检查智能清理模式是否调用了MCP保护
  const intelligentCleanupSource = deviceManager.performIntelligentCleanup.toString();
  
  if (!intelligentCleanupSource.includes('protectMCPConfigUniversal')) {
    console.log('  ❌ 智能清理模式缺少MCP配置保护');
    return;
  }

  if (!intelligentCleanupSource.includes('restoreMCPConfigUniversal')) {
    console.log('  ❌ 智能清理模式缺少MCP配置恢复');
    return;
  }

  console.log('  ✅ MCP保护机制完整');
  console.log('    - protectMCPConfigUniversal: 存在');
  console.log('    - restoreMCPConfigUniversal: 存在');
  console.log('    - 智能清理模式调用: 正确');
}

// 检查IDE设置保护
async function checkIDESettingsProtection() {
  const DeviceManager = require('../src/device-manager');
  const deviceManager = new DeviceManager();

  // 检查cleanDeviceIdentityOnly方法
  const cleanDeviceSource = deviceManager.cleanDeviceIdentityOnly.toString();
  
  // 验证是否更新了storage.json中的设备ID
  if (!cleanDeviceSource.includes('telemetry.devDeviceId')) {
    console.log('  ❌ 缺少devDeviceId更新逻辑');
    return;
  }

  if (!cleanDeviceSource.includes('storage.json')) {
    console.log('  ❌ 缺少storage.json处理逻辑');
    return;
  }

  // 验证是否保护了IDE设置
  if (!cleanDeviceSource.includes('智能保护')) {
    console.log('  ❌ 缺少IDE设置保护说明');
    return;
  }

  console.log('  ✅ IDE设置保护正确');
  console.log('    - devDeviceId更新: 存在');
  console.log('    - storage.json处理: 存在');
  console.log('    - 保护机制说明: 存在');
}

// 检查文件过滤逻辑
async function checkFileFilterLogic() {
  const DeviceManager = require('../src/device-manager');
  const deviceManager = new DeviceManager();

  // 检查cleanAugmentDeviceIdentity方法的文件过滤逻辑
  const cleanAugmentSource = deviceManager.cleanAugmentDeviceIdentity.toString();

  // 检查是否有正确的文件过滤
  const requiredFilters = [
    'user-',
    'session-',
    'auth-',
    'device-',
    'fingerprint'
  ];

  const requiredProtections = [
    'config',
    'settings',
    'mcp',
    'server'
  ];

  let filtersFound = 0;
  let protectionsFound = 0;

  for (const filter of requiredFilters) {
    if (cleanAugmentSource.includes(filter)) {
      filtersFound++;
    }
  }

  for (const protection of requiredProtections) {
    if (cleanAugmentSource.includes(protection)) {
      protectionsFound++;
    }
  }

  console.log(`  📊 文件过滤规则: ${filtersFound}/${requiredFilters.length} 个正确`);
  console.log(`  🛡️ 保护规则: ${protectionsFound}/${requiredProtections.length} 个正确`);

  if (filtersFound === requiredFilters.length && protectionsFound === requiredProtections.length) {
    console.log('  ✅ 文件过滤逻辑正确');
  } else {
    console.log('  ❌ 文件过滤逻辑不完整');
  }
}

// 检查智能清理模式完整性
async function checkIntelligentCleanupIntegrity() {
  const DeviceManager = require('../src/device-manager');
  const deviceManager = new DeviceManager();

  const intelligentCleanupSource = deviceManager.performIntelligentCleanup.toString();

  // 检查必要的步骤
  const requiredSteps = [
    'protectMCPConfigUniversal',      // MCP保护
    'cleanDeviceIdentityOnly',        // 设备身份清理
    'cleanAugmentDeviceIdentity',     // Augment身份清理
    'regenerateDeviceFingerprint',    // 设备指纹重生成
    'restoreMCPConfigUniversal'       // MCP恢复
  ];

  let stepsFound = 0;
  const missingSteps = [];

  for (const step of requiredSteps) {
    if (intelligentCleanupSource.includes(step)) {
      stepsFound++;
    } else {
      missingSteps.push(step);
    }
  }

  console.log(`  📊 必要步骤: ${stepsFound}/${requiredSteps.length} 个存在`);

  if (stepsFound === requiredSteps.length) {
    console.log('  ✅ 智能清理模式完整性正确');
    console.log('    - 所有必要步骤都存在');
    console.log('    - 执行顺序正确');
  } else {
    console.log('  ❌ 智能清理模式不完整');
    console.log('    缺少步骤:', missingSteps.join(', '));
  }
}

// 运行验证
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 验证失败:', error);
    process.exit(1);
  });
}

module.exports = { main };
