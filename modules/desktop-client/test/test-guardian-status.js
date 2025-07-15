const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * 简单的守护进程状态测试
 * 检查实时监控是否正在工作
 */

async function testGuardianStatus() {
  console.log('🔍 检查实时监控守护进程状态...\n');

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
    // 1. 检查文件状态
    console.log('📁 检查storage.json状态...');
    if (!(await fs.pathExists(storageJsonPath))) {
      console.log('❌ storage.json文件不存在');
      return;
    }

    const stats = await fs.stat(storageJsonPath);
    console.log(`✅ 文件存在，大小: ${stats.size} bytes`);
    console.log(`📅 最后修改: ${stats.mtime.toLocaleString()}`);

    // 2. 读取当前设备ID
    const content = await fs.readJson(storageJsonPath);
    const currentDeviceId = content['telemetry.devDeviceId'];
    console.log(`🆔 当前设备ID: ${currentDeviceId}`);

    // 3. 简单的修改测试
    console.log('\n🧪 执行简单的修改测试...');
    const testId = 'guardian-test-' + Date.now();
    
    // 备份原始内容
    const originalContent = { ...content };
    
    // 修改设备ID
    content['telemetry.devDeviceId'] = testId;
    await fs.writeJson(storageJsonPath, content, { spaces: 2 });
    console.log(`✏️ 已修改设备ID为: ${testId}`);

    // 等待不同时间间隔检查恢复情况
    const checkIntervals = [500, 1000, 2000, 3000, 5000];
    let restored = false;
    let restoreTime = null;

    for (const interval of checkIntervals) {
      await new Promise(resolve => setTimeout(resolve, interval - (restoreTime || 0)));
      
      const currentContent = await fs.readJson(storageJsonPath);
      const currentId = currentContent['telemetry.devDeviceId'];
      
      console.log(`⏱️ ${interval}ms后检查: ${currentId}`);
      
      if (currentId !== testId) {
        restored = true;
        restoreTime = interval;
        console.log(`✅ 设备ID已被恢复！响应时间: ${interval}ms`);
        break;
      }
    }

    if (!restored) {
      console.log('⚠️ 设备ID未被恢复，手动恢复原始值...');
      await fs.writeJson(storageJsonPath, originalContent, { spaces: 2 });
      console.log('🔄 已手动恢复原始设备ID');
    }

    // 4. 检查临时文件监控
    console.log('\n🚨 测试临时文件监控...');
    const tempFilePath = storageJsonPath + '.vsctmp';
    
    const tempContent = { ...originalContent };
    tempContent['telemetry.devDeviceId'] = 'temp-test-' + Date.now();
    
    await fs.writeJson(tempFilePath, tempContent, { spaces: 2 });
    console.log('📝 已创建临时文件');

    // 等待处理
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (await fs.pathExists(tempFilePath)) {
      const processedContent = await fs.readJson(tempFilePath);
      const processedId = processedContent['telemetry.devDeviceId'];
      
      if (processedId !== tempContent['telemetry.devDeviceId']) {
        console.log('✅ 临时文件已被监控处理');
      } else {
        console.log('⚠️ 临时文件未被处理');
      }
      
      // 清理临时文件
      await fs.remove(tempFilePath);
      console.log('🧹 已清理临时文件');
    } else {
      console.log('⚠️ 临时文件已被删除（可能被监控处理）');
    }

    // 5. 生成状态报告
    console.log('\n📊 守护进程状态报告:');
    console.log('='.repeat(40));
    
    if (restored) {
      console.log('🟢 实时监控: 正常工作');
      console.log(`⚡ 响应时间: ${restoreTime}ms`);
      
      if (restoreTime <= 1000) {
        console.log('🟢 性能评级: 优秀');
      } else if (restoreTime <= 3000) {
        console.log('🟡 性能评级: 良好');
      } else {
        console.log('🟠 性能评级: 一般');
      }
    } else {
      console.log('🔴 实时监控: 未工作');
      console.log('💡 建议: 检查守护进程是否启动');
    }

    // 6. 检查进程信息
    console.log('\n🔍 检查相关进程...');
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      // 检查Node.js进程
      const { stdout } = await execAsync('tasklist | findstr node.exe');
      if (stdout.trim()) {
        console.log('✅ 发现Node.js进程');
        const lines = stdout.trim().split('\n');
        console.log(`📊 Node.js进程数量: ${lines.length}`);
      } else {
        console.log('⚠️ 未发现Node.js进程');
      }
      
      // 检查Electron进程
      const { stdout: electronOut } = await execAsync('tasklist | findstr electron.exe');
      if (electronOut.trim()) {
        console.log('✅ 发现Electron进程');
      } else {
        console.log('⚠️ 未发现Electron进程');
      }
      
    } catch (error) {
      console.log('⚠️ 无法检查进程信息');
    }

    console.log('\n💡 如果监控未工作，请确保:');
    console.log('  1. 应用程序正在运行');
    console.log('  2. 点击了"启动防护"按钮');
    console.log('  3. 没有权限错误');
    console.log('  4. 文件监控器正常初始化');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
if (require.main === module) {
  testGuardianStatus().catch(console.error);
}

module.exports = { testGuardianStatus };
