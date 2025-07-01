// 测试storage.json保护功能
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function testStorageProtection() {
  console.log('🧪 测试storage.json保护功能');
  console.log('=====================================');

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

    // 2. 检查当前文件属性
    console.log('\n🔍 检查当前文件属性...');
    try {
      const { stdout } = await execAsync(`attrib "${storageJsonPath}"`);
      console.log('当前属性:', stdout.trim());
      
      if (stdout.includes('R')) {
        console.log('🔒 文件当前为只读状态');
      } else {
        console.log('🔓 文件当前可修改');
      }
    } catch (error) {
      console.log('⚠️ 无法检查文件属性:', error.message);
    }

    // 3. 读取当前内容
    console.log('\n📖 读取当前文件内容...');
    try {
      const content = await fs.readJson(storageJsonPath);
      const deviceId = content['telemetry.devDeviceId'];
      console.log('当前设备ID:', deviceId || '未设置');
    } catch (error) {
      console.log('⚠️ 无法读取文件内容:', error.message);
    }

    // 4. 测试设置只读保护
    console.log('\n🔒 测试设置只读保护...');
    try {
      await execAsync(`attrib +R "${storageJsonPath}"`);
      console.log('✅ 只读保护设置成功');
      
      // 验证设置
      const { stdout } = await execAsync(`attrib "${storageJsonPath}"`);
      if (stdout.includes('R')) {
        console.log('✅ 验证: 文件已设置为只读');
      } else {
        console.log('❌ 验证失败: 文件仍可修改');
      }
    } catch (error) {
      console.log('❌ 设置只读保护失败:', error.message);
    }

    // 5. 测试修改文件（应该失败）
    console.log('\n🧪 测试修改只读文件（应该失败）...');
    try {
      const content = await fs.readJson(storageJsonPath);
      content['test'] = 'should fail';
      await fs.writeJson(storageJsonPath, content);
      console.log('❌ 意外成功: 只读文件被修改了！');
    } catch (error) {
      console.log('✅ 预期结果: 只读文件无法修改');
    }

    // 6. 测试恢复修改权限
    console.log('\n🔓 测试恢复修改权限...');
    try {
      await execAsync(`attrib -R "${storageJsonPath}"`);
      console.log('✅ 修改权限恢复成功');
      
      // 验证恢复
      const { stdout } = await execAsync(`attrib "${storageJsonPath}"`);
      if (!stdout.includes('R')) {
        console.log('✅ 验证: 文件已恢复可修改状态');
      } else {
        console.log('❌ 验证失败: 文件仍为只读');
      }
    } catch (error) {
      console.log('❌ 恢复修改权限失败:', error.message);
    }

    // 7. 测试修改文件（应该成功）
    console.log('\n🧪 测试修改可写文件（应该成功）...');
    try {
      const content = await fs.readJson(storageJsonPath);
      const originalContent = { ...content };
      
      // 添加测试标记
      content['test-timestamp'] = new Date().toISOString();
      await fs.writeJson(storageJsonPath, content);
      console.log('✅ 文件修改成功');
      
      // 恢复原始内容
      await fs.writeJson(storageJsonPath, originalContent);
      console.log('✅ 原始内容已恢复');
      
    } catch (error) {
      console.log('❌ 文件修改失败:', error.message);
    }

    console.log('\n🎉 测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
if (require.main === module) {
  testStorageProtection().catch(console.error);
}

module.exports = { testStorageProtection };
