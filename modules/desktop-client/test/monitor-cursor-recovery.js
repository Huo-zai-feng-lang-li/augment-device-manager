const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * 监控Cursor启动时的数据恢复过程
 * 找出Cursor从哪里恢复了旧的设备ID
 */

let isMonitoring = false;
let monitoringInterval;
let lastKnownContent = null;

async function monitorCursorRecovery() {
  console.log('🔍 监控Cursor数据恢复过程');
  console.log('==================================================');

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
    // 第1步：强制设置新的设备ID
    console.log('\n🆔 第1步：强制设置全新设备ID...');
    const newDeviceId = await forceSetNewDeviceId(storageJsonPath);
    console.log(`  ✅ 设置新设备ID: ${newDeviceId}`);

    // 第2步：开始监控文件变化
    console.log('\n👀 第2步：开始监控文件变化...');
    console.log('  📝 请现在启动Cursor IDE，我会监控文件变化');
    
    await startFileMonitoring(storageJsonPath);

  } catch (error) {
    console.error('❌ 监控失败:', error);
  }
}

// 强制设置新的设备ID
async function forceSetNewDeviceId(storageJsonPath) {
  const newIdentifiers = {
    devDeviceId: crypto.randomUUID(),
    machineId: crypto.randomBytes(32).toString('hex'),
    macMachineId: crypto.randomBytes(32).toString('hex'),
    sessionId: crypto.randomUUID(),
    sqmId: `{${crypto.randomUUID().toUpperCase()}}`
  };

  const storageData = {
    'telemetry.devDeviceId': newIdentifiers.devDeviceId,
    'telemetry.machineId': newIdentifiers.machineId,
    'telemetry.macMachineId': newIdentifiers.macMachineId,
    'telemetry.sessionId': newIdentifiers.sessionId,
    'telemetry.sqmId': newIdentifiers.sqmId,
    'telemetry.firstSessionDate': new Date().toUTCString(),
    'telemetry.currentSessionDate': new Date().toUTCString()
  };

  await fs.ensureDir(path.dirname(storageJsonPath));
  await fs.writeJson(storageJsonPath, storageData, { spaces: 2 });
  
  lastKnownContent = JSON.stringify(storageData, null, 2);
  return newIdentifiers.devDeviceId;
}

// 开始文件监控
async function startFileMonitoring(storageJsonPath) {
  isMonitoring = true;
  let changeCount = 0;
  
  console.log('  🔄 监控已启动，等待文件变化...');
  console.log('  ⏰ 监控时间：60秒');
  console.log('  🛑 按Ctrl+C停止监控');

  // 设置文件监听器
  const watcher = fs.watch(path.dirname(storageJsonPath), (eventType, filename) => {
    if (filename === 'storage.json' && eventType === 'change') {
      handleFileChange(storageJsonPath, ++changeCount);
    }
  });

  // 同时使用轮询监控（更可靠）
  monitoringInterval = setInterval(async () => {
    await checkFileContent(storageJsonPath, ++changeCount);
  }, 1000); // 每秒检查一次

  // 60秒后停止监控
  setTimeout(() => {
    console.log('\n⏰ 监控时间结束');
    stopMonitoring(watcher);
  }, 60000);

  // 处理Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n🛑 用户停止监控');
    stopMonitoring(watcher);
    process.exit(0);
  });
}

// 处理文件变化
async function handleFileChange(storageJsonPath, changeCount) {
  try {
    if (await fs.pathExists(storageJsonPath)) {
      const currentContent = await fs.readFile(storageJsonPath, 'utf8');
      
      if (currentContent !== lastKnownContent) {
        console.log(`\n🔄 检测到文件变化 #${changeCount} - ${new Date().toLocaleTimeString()}`);
        
        try {
          const data = JSON.parse(currentContent);
          const currentDeviceId = data['telemetry.devDeviceId'];
          
          console.log(`  📄 当前设备ID: ${currentDeviceId}`);
          
          // 检查是否恢复为旧ID
          if (currentDeviceId === '36987e70-60fe-4401-85a4-f463c269f069') {
            console.log('  🚨 警告：设备ID已恢复为旧ID！');
            console.log('  🔍 这证实了Cursor确实在启动时恢复旧数据');
          } else if (currentDeviceId && currentDeviceId !== lastKnownContent.match(/"telemetry\.devDeviceId":\s*"([^"]+)"/)?.[1]) {
            console.log('  ℹ️ 设备ID发生了变化（但不是旧ID）');
          }
          
          // 显示所有遥测字段的变化
          const telemetryFields = Object.keys(data).filter(key => key.includes('telemetry'));
          console.log(`  📊 遥测字段数量: ${telemetryFields.length}`);
          
        } catch (parseError) {
          console.log('  ❌ JSON解析失败，文件可能损坏');
        }
        
        lastKnownContent = currentContent;
      }
    }
  } catch (error) {
    console.log(`  ❌ 检查文件失败: ${error.message}`);
  }
}

// 检查文件内容（轮询方式）
async function checkFileContent(storageJsonPath, changeCount) {
  if (!isMonitoring) return;
  
  try {
    if (await fs.pathExists(storageJsonPath)) {
      const stats = await fs.stat(storageJsonPath);
      const currentContent = await fs.readFile(storageJsonPath, 'utf8');
      
      if (currentContent !== lastKnownContent) {
        await handleFileChange(storageJsonPath, changeCount);
      }
    }
  } catch (error) {
    // 忽略轮询错误
  }
}

// 停止监控
function stopMonitoring(watcher) {
  isMonitoring = false;
  
  if (watcher) {
    watcher.close();
  }
  
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  
  console.log('\n📋 监控总结:');
  console.log('==================================================');
  console.log('✅ 监控已停止');
  console.log('💡 如果检测到设备ID恢复为旧ID，说明Cursor有数据恢复机制');
  console.log('🔍 下一步需要找出Cursor从哪里恢复了数据');
  
  console.log('\n🎯 可能的数据源:');
  console.log('1. 注册表备份');
  console.log('2. 其他隐藏缓存文件');
  console.log('3. 网络同步（从服务端拉取）');
  console.log('4. 内存中的备份数据');
}

// 主函数
if (require.main === module) {
  console.log('🚀 Cursor数据恢复监控器');
  console.log('这个工具会监控Cursor启动时是否恢复了旧的设备ID');
  console.log('');
  
  monitorCursorRecovery()
    .catch(error => {
      console.error('❌ 监控失败:', error);
      process.exit(1);
    });
}

module.exports = { monitorCursorRecovery };
