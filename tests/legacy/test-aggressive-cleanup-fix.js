#!/usr/bin/env node

/**
 * 测试激进清理模式修复效果
 * 验证设备ID是否能在激进模式下正确变化
 */

const path = require('path');
const os = require('os');
const fs = require('fs-extra');

// 设置共享路径
function getSharedPath(relativePath) {
  return path.join(__dirname, 'shared', relativePath);
}

async function testAggressiveCleanupFix() {
  console.log('🧪 测试激进清理模式修复效果\n');

  try {
    // 1. 获取清理前的设备ID
    console.log('=== 1. 获取清理前设备ID ===');
    const { StableDeviceId } = require('./shared/utils/stable-device-id');
    const deviceIdGenerator = new StableDeviceId();
    
    const originalDeviceId = await deviceIdGenerator.generateStableDeviceId();
    console.log(`原始设备ID: ${originalDeviceId}`);
    console.log(`缓存状态: ${deviceIdGenerator.hasCachedId() ? '已缓存' : '无缓存'}`);

    // 2. 模拟激进清理模式
    console.log('\n=== 2. 执行激进清理模式 ===');
    
    // 初始化设备管理器
    const DeviceManager = require('./desktop-client/src/device-manager');
    const deviceManager = new DeviceManager();
    
    // 模拟激进清理选项
    const aggressiveOptions = {
      preserveActivation: true,    // 保留激活状态
      aggressiveMode: true,        // 激进模式
      multiRoundClean: true,       // 多轮清理
      extendedMonitoring: true,    // 延长监控
      cleanCursorExtension: true,  // 清理Cursor扩展
      deepClean: true             // 深度清理
    };

    console.log('激进清理选项:');
    console.log(`  • 保留激活状态: ${aggressiveOptions.preserveActivation}`);
    console.log(`  • 激进模式: ${aggressiveOptions.aggressiveMode}`);
    console.log(`  • 多轮清理: ${aggressiveOptions.multiRoundClean}`);
    console.log(`  • 清理扩展: ${aggressiveOptions.cleanCursorExtension}`);

    // 执行清理操作
    console.log('\n开始执行激进清理...');
    const cleanupResult = await deviceManager.performCleanup(aggressiveOptions);
    
    console.log('\n清理结果:');
    console.log(`  成功: ${cleanupResult.success}`);
    console.log(`  操作数量: ${cleanupResult.actions?.length || 0}`);
    
    if (cleanupResult.actions && cleanupResult.actions.length > 0) {
      console.log('\n清理操作详情:');
      cleanupResult.actions.forEach((action, index) => {
        if (action.includes('激进模式') || action.includes('设备ID') || action.includes('缓存')) {
          console.log(`  ${index + 1}. ${action}`);
        }
      });
    }

    if (cleanupResult.errors && cleanupResult.errors.length > 0) {
      console.log('\n错误信息:');
      cleanupResult.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    // 3. 验证设备ID是否发生变化
    console.log('\n=== 3. 验证设备ID变化 ===');
    
    // 创建新的设备ID生成器实例（避免缓存影响）
    const newDeviceIdGenerator = new StableDeviceId();
    const newDeviceId = await newDeviceIdGenerator.generateStableDeviceId();
    
    console.log(`清理前设备ID: ${originalDeviceId}`);
    console.log(`清理后设备ID: ${newDeviceId}`);
    console.log(`设备ID是否变化: ${originalDeviceId !== newDeviceId ? '✅ 是' : '❌ 否'}`);
    
    if (originalDeviceId !== newDeviceId) {
      console.log('🎉 激进清理模式修复成功！设备ID已成功变化');
      
      // 计算变化程度
      const similarity = calculateSimilarity(originalDeviceId, newDeviceId);
      console.log(`设备ID相似度: ${(similarity * 100).toFixed(2)}% (越低越好)`);
      
      if (similarity < 0.1) {
        console.log('✅ 设备ID变化程度: 优秀 (完全不同)');
      } else if (similarity < 0.3) {
        console.log('⚠️ 设备ID变化程度: 良好 (大部分不同)');
      } else {
        console.log('❌ 设备ID变化程度: 不足 (相似度过高)');
      }
    } else {
      console.log('❌ 激进清理模式仍有问题，设备ID未发生变化');
      
      // 诊断问题
      console.log('\n🔍 问题诊断:');
      const cacheFile = path.join(os.homedir(), '.augment-device-manager', 'stable-device-id.cache');
      const backupFile = path.join(os.homedir(), '.augment-device-manager', 'stable-device-id.backup');
      
      console.log(`缓存文件存在: ${await fs.pathExists(cacheFile) ? '是' : '否'}`);
      console.log(`备份文件存在: ${await fs.pathExists(backupFile) ? '是' : '否'}`);
      
      if (await fs.pathExists(cacheFile)) {
        const cacheContent = await fs.readFile(cacheFile, 'utf8');
        console.log(`缓存内容: ${cacheContent.trim()}`);
      }
    }

    // 4. 检查缓存状态
    console.log('\n=== 4. 检查缓存状态 ===');
    console.log(`新缓存状态: ${newDeviceIdGenerator.hasCachedId() ? '已缓存' : '无缓存'}`);
    
    // 5. 测试强制生成功能
    console.log('\n=== 5. 测试强制生成功能 ===');
    const forceGeneratedId = await newDeviceIdGenerator.forceGenerateNewDeviceId();
    console.log(`强制生成ID: ${forceGeneratedId}`);
    console.log(`与原始ID不同: ${originalDeviceId !== forceGeneratedId ? '✅ 是' : '❌ 否'}`);
    console.log(`与清理后ID不同: ${newDeviceId !== forceGeneratedId ? '✅ 是' : '❌ 否'}`);

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 计算两个字符串的相似度
function calculateSimilarity(str1, str2) {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  let matches = 0;
  const minLength = Math.min(str1.length, str2.length);
  
  for (let i = 0; i < minLength; i++) {
    if (str1[i] === str2[i]) {
      matches++;
    }
  }
  
  return matches / Math.max(str1.length, str2.length);
}

// 运行测试
if (require.main === module) {
  testAggressiveCleanupFix().catch(console.error);
}

module.exports = { testAggressiveCleanupFix };
