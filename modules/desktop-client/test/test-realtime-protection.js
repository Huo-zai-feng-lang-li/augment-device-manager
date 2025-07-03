const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * 测试实时监控保护效果
 * 验证新的保护机制是否正常工作
 */

async function testRealtimeProtection() {
  console.log('🧪 开始测试实时监控保护效果...\n');

  const storageJsonPath = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'Cursor',
    'User',
    'globalStorage',
    'storage.json'
  );

  try {
    // 1. 检查文件是否存在
    console.log('📁 检查storage.json文件...');
    if (await fs.pathExists(storageJsonPath)) {
      console.log('✅ 文件存在:', storageJsonPath);
    } else {
      console.log('❌ 文件不存在:', storageJsonPath);
      return;
    }

    // 2. 检查当前文件权限状态
    console.log('\n🔍 检查当前文件权限状态...');
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync(`attrib "${storageJsonPath}"`);
      console.log('当前属性:', stdout.trim());
      
      if (stdout.includes('R')) {
        console.log('⚠️ 文件仍为只读状态 - 可能需要手动移除');
        console.log('💡 运行命令移除只读: attrib -R "' + storageJsonPath + '"');
      } else {
        console.log('✅ 文件可正常读写');
      }
    } catch (error) {
      console.log('⚠️ 无法检查文件属性:', error.message);
    }

    // 3. 读取当前设备ID
    console.log('\n📖 读取当前设备ID...');
    let originalDeviceId;
    try {
      const content = await fs.readJson(storageJsonPath);
      originalDeviceId = content['telemetry.devDeviceId'];
      console.log('当前设备ID:', originalDeviceId || '未设置');
    } catch (error) {
      console.log('❌ 无法读取文件内容:', error.message);
      return;
    }

    // 4. 测试文件写入能力
    console.log('\n✍️ 测试文件写入能力...');
    try {
      const testContent = await fs.readJson(storageJsonPath);
      testContent['test_timestamp'] = new Date().toISOString();
      
      await fs.writeJson(storageJsonPath, testContent, { spaces: 2 });
      console.log('✅ 文件写入成功 - 权限问题已解决');
      
      // 清理测试字段
      delete testContent['test_timestamp'];
      await fs.writeJson(storageJsonPath, testContent, { spaces: 2 });
      
    } catch (error) {
      console.log('❌ 文件写入失败:', error.message);
      console.log('💡 可能仍有权限问题，请检查文件属性');
      return;
    }

    // 5. 模拟设备ID修改测试
    console.log('\n🔄 模拟设备ID修改测试...');
    const testDeviceId = 'test-device-id-' + Date.now();
    
    try {
      const content = await fs.readJson(storageJsonPath);
      content['telemetry.devDeviceId'] = testDeviceId;
      
      await fs.writeJson(storageJsonPath, content, { spaces: 2 });
      console.log('✅ 设备ID修改成功:', testDeviceId);
      
      // 等待一下，看实时监控是否会恢复
      console.log('⏳ 等待3秒，观察实时监控是否恢复...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 检查是否被恢复
      const updatedContent = await fs.readJson(storageJsonPath);
      const currentDeviceId = updatedContent['telemetry.devDeviceId'];
      
      if (currentDeviceId === testDeviceId) {
        console.log('⚠️ 设备ID未被恢复 - 实时监控可能未启动');
        console.log('💡 请确保守护进程正在运行');
        
        // 手动恢复原始设备ID
        if (originalDeviceId) {
          updatedContent['telemetry.devDeviceId'] = originalDeviceId;
          await fs.writeJson(storageJsonPath, updatedContent, { spaces: 2 });
          console.log('🔄 已手动恢复原始设备ID');
        }
      } else {
        console.log('✅ 设备ID已被实时监控恢复:', currentDeviceId);
        console.log('🛡️ 实时监控保护正常工作');
      }
      
    } catch (error) {
      console.log('❌ 设备ID修改测试失败:', error.message);
    }

    // 6. 测试临时文件拦截
    console.log('\n🚨 测试临时文件拦截...');
    const tempFilePath = storageJsonPath + '.vsctmp';
    
    try {
      const content = await fs.readJson(storageJsonPath);
      content['telemetry.devDeviceId'] = 'temp-test-id-' + Date.now();
      
      await fs.writeJson(tempFilePath, content, { spaces: 2 });
      console.log('✅ 临时文件创建成功');
      
      // 等待实时监控处理
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 检查临时文件是否被修改
      if (await fs.pathExists(tempFilePath)) {
        const tempContent = await fs.readJson(tempFilePath);
        const tempDeviceId = tempContent['telemetry.devDeviceId'];
        
        if (tempDeviceId.startsWith('temp-test-id-')) {
          console.log('⚠️ 临时文件未被拦截');
        } else {
          console.log('✅ 临时文件已被实时监控修改');
        }
        
        // 清理临时文件
        await fs.remove(tempFilePath);
        console.log('🧹 已清理测试临时文件');
      }
      
    } catch (error) {
      console.log('❌ 临时文件测试失败:', error.message);
    }

    console.log('\n🎉 实时监控保护测试完成');
    console.log('💡 如果发现问题，请检查守护进程是否正在运行');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
if (require.main === module) {
  testRealtimeProtection().catch(console.error);
}

module.exports = { testRealtimeProtection };
