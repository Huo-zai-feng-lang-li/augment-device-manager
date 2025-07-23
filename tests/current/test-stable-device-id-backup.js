const { StableDeviceIdGenerator } = require('./shared/utils/stable-device-id');

async function testStableDeviceId() {
  console.log('🧪 测试稳定设备ID系统修复...\n');
  
  try {
    const generator = new StableDeviceIdGenerator();
    
    // 1. 测试生成新的Cursor设备ID
    console.log('📍 1. 测试生成新的Cursor设备ID');
    const cursorId1 = await generator.forceGenerateNewDeviceId('cursor');
    console.log(`生成的Cursor设备ID: ${cursorId1}`);
    console.log(`ID长度: ${cursorId1.length}`);
    console.log(`是否为UUID格式: ${cursorId1.includes('-') && cursorId1.length === 36 ? '✅ 是' : '❌ 否'}`);
    
    // 2. 测试缓存读取
    console.log('\n📍 2. 测试缓存读取');
    const cursorId2 = await generator.generateStableDeviceId('cursor');
    console.log(`从缓存读取的Cursor设备ID: ${cursorId2}`);
    console.log(`两次生成是否一致: ${cursorId1 === cursorId2 ? '✅ 是' : '❌ 否'}`);
    
    // 3. 测试哈希到UUID转换
    console.log('\n📍 3. 测试哈希到UUID转换');
    const testHash = 'd0c4c58323c6c0d8fefa6a14dfb9beae138346e4c8746ef970bd9dda0282b112';
    const convertedUUID = generator.hashToUUID(testHash);
    console.log(`原始哈希: ${testHash}`);
    console.log(`转换后UUID: ${convertedUUID}`);
    console.log(`转换是否正确: ${convertedUUID === 'd0c4c583-23c6-c0d8-fefa-6a14dfb9beae' ? '✅ 是' : '❌ 否'}`);
    
    // 4. 测试旧缓存兼容性
    console.log('\n📍 4. 测试旧缓存兼容性');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    const cacheDir = path.join(os.homedir(), '.augment-device-manager');
    const testCacheFile = path.join(cacheDir, 'test-cache.cache');
    
    // 写入64位哈希格式（模拟旧缓存）
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    fs.writeFileSync(testCacheFile, testHash, 'utf8');
    
    // 读取并验证转换
    const readResult = await generator.readFromCache(testCacheFile);
    console.log(`从旧格式缓存读取: ${readResult}`);
    console.log(`是否正确转换为UUID: ${readResult === convertedUUID ? '✅ 是' : '❌ 否'}`);
    
    // 清理测试文件
    if (fs.existsSync(testCacheFile)) {
      fs.unlinkSync(testCacheFile);
    }
    
    console.log('\n🎉 稳定设备ID系统修复测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
if (require.main === module) {
  testStableDeviceId().catch(console.error);
}

module.exports = { testStableDeviceId };
