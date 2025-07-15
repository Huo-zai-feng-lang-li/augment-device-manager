const DeviceManager = require('./modules/desktop-client/src/device-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function forceFixAndLock() {
  console.log('🔧 强制修复并锁定配置...');
  
  try {
    const deviceManager = new DeviceManager();
    const targetDeviceId = "ui-test-vscode-0-123456000000000";
    
    // 1. 强制停止所有服务
    console.log('\n1️⃣ 强制停止所有服务...');
    
    try {
      await deviceManager.standaloneService.stopStandaloneService();
      console.log('✅ 独立服务已停止');
    } catch (error) {
      console.log(`独立服务停止失败: ${error.message}`);
    }
    
    try {
      if (deviceManager.enhancedGuardian && deviceManager.enhancedGuardian.isGuarding) {
        await deviceManager.enhancedGuardian.stopGuarding();
        console.log('✅ 内置守护进程已停止');
      }
    } catch (error) {
      console.log(`内置守护进程停止失败: ${error.message}`);
    }
    
    // 2. 彻底清理所有配置文件
    console.log('\n2️⃣ 彻底清理所有配置文件...');
    const configPaths = [
      path.join(os.tmpdir(), 'augment-guardian-config.json'),
      path.join(os.tmpdir(), 'augment-guardian.pid'),
      path.join(os.tmpdir(), 'augment-guardian.log'),
      path.join(os.homedir(), '.augment', 'guardian-service', 'config.json'),
      path.join(os.homedir(), '.augment', 'guardian-service', 'guardian.pid'),
      path.join(os.homedir(), '.augment', 'guardian-service', 'guardian.log')
    ];
    
    for (const configPath of configPaths) {
      try {
        if (await fs.pathExists(configPath)) {
          await fs.remove(configPath);
          console.log(`✅ 已删除: ${configPath}`);
        }
      } catch (error) {
        console.log(`删除失败 ${configPath}: ${error.message}`);
      }
    }
    
    // 3. 等待确保完全停止
    console.log('\n3️⃣ 等待系统完全停止（5秒）...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 4. 创建锁定的配置文件
    console.log('\n4️⃣ 创建锁定的配置文件...');
    const lockConfig = {
      deviceId: targetDeviceId,
      startTime: Date.now(),
      options: {
        selectedIDE: "vscode",
        enableBackupMonitoring: true,
        enableDatabaseMonitoring: true,
        enableEnhancedProtection: true
      },
      locked: true,
      lockReason: "防止配置被覆盖"
    };
    
    const configPath = path.join(os.tmpdir(), 'augment-guardian-config.json');
    await fs.writeJson(configPath, lockConfig, { spaces: 2 });
    console.log(`✅ 已创建锁定配置: ${configPath}`);
    
    // 5. 重新启动增强防护（强制使用正确配置）
    console.log('\n5️⃣ 重新启动增强防护（强制使用正确配置）...');
    console.log(`🎯 目标设备ID: ${targetDeviceId}`);
    console.log(`🎯 选择的IDE: VS Code`);
    console.log(`🔒 配置已锁定，防止被覆盖`);
    
    const startResult = await deviceManager.startEnhancedGuardianIndependently({
      selectedIDE: "vscode",
      enableBackupMonitoring: true,
      enableDatabaseMonitoring: true,
      enableEnhancedProtection: true,
      targetDeviceId: targetDeviceId
    });
    
    console.log(`启动结果: ${startResult.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`消息: ${startResult.message}`);
    console.log(`模式: ${startResult.mode}`);
    console.log(`设备ID: ${startResult.deviceId}`);
    
    if (!startResult.success) {
      console.log('❌ 启动失败，无法继续');
      return { success: false, error: startResult.message };
    }
    
    // 6. 等待系统稳定
    console.log('\n6️⃣ 等待系统稳定（3秒）...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 7. 验证配置
    console.log('\n7️⃣ 验证配置...');
    const status = await deviceManager.getEnhancedGuardianStatus();
    console.log(`总体防护: ${status.isGuarding ? '✅ 运行' : '❌ 未运行'}`);
    console.log(`选择的IDE: ${status.selectedIDE || '未知'}`);
    console.log(`目标设备ID: ${status.targetDeviceId || '未设置'}`);
    
    // 验证配置是否正确
    const ideCorrect = status.selectedIDE === 'vscode';
    const idCorrect = status.targetDeviceId === targetDeviceId;
    
    console.log(`IDE配置正确: ${ideCorrect ? '✅ 是' : '❌ 否'}`);
    console.log(`设备ID配置正确: ${idCorrect ? '✅ 是' : '❌ 否'}`);
    
    // 8. 强制恢复VS Code设备ID
    const vscodeStoragePath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Code',
      'User',
      'globalStorage',
      'storage.json'
    );
    
    console.log('\n8️⃣ 强制恢复VS Code设备ID...');
    const currentData = await fs.readJson(vscodeStoragePath);
    const currentId = currentData["telemetry.devDeviceId"];
    console.log(`当前设备ID: ${currentId}`);
    
    if (currentId !== targetDeviceId) {
      console.log('🔧 设备ID不正确，强制恢复...');
      currentData["telemetry.devDeviceId"] = targetDeviceId;
      await fs.writeJson(vscodeStoragePath, currentData, { spaces: 2 });
      console.log('✅ 已强制恢复为目标设备ID');
    }
    
    // 9. 进行实时测试
    console.log('\n9️⃣ 进行实时测试...');
    const testId = "force-fix-test-" + Date.now();
    
    const testData = await fs.readJson(vscodeStoragePath);
    testData["telemetry.devDeviceId"] = testId;
    await fs.writeJson(vscodeStoragePath, testData, { spaces: 2 });
    console.log(`📝 已修改设备ID为: ${testId}`);
    
    // 等待自动恢复
    console.log('⏳ 等待自动恢复（15秒）...');
    let recovered = false;
    let attempts = 0;
    const maxAttempts = 30; // 15秒
    
    while (!recovered && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
      
      try {
        const checkData = await fs.readJson(vscodeStoragePath);
        const checkId = checkData["telemetry.devDeviceId"];
        
        if (checkId === targetDeviceId) {
          recovered = true;
          console.log(`✅ 自动恢复成功！用时: ${attempts * 0.5}秒`);
          break;
        }
        
        if (attempts % 6 === 0) { // 每3秒显示状态
          console.log(`⏳ ${attempts * 0.5}秒 - 当前ID: ${checkId.substring(0, 20)}...`);
        }
      } catch (error) {
        console.log(`读取错误: ${error.message}`);
      }
    }
    
    // 10. 最终结果和警告
    console.log('\n🔟 最终结果和警告...');
    const finalData = await fs.readJson(vscodeStoragePath);
    const finalId = finalData["telemetry.devDeviceId"];
    console.log(`最终设备ID: ${finalId}`);
    
    if (recovered) {
      console.log('🎉 强制修复成功！增强防护现在正常工作！');
      console.log('✅ IDE选择: VS Code');
      console.log('✅ 目标设备ID: 正确设置');
      console.log('✅ 自动恢复: 正常工作');
      console.log('');
      console.log('⚠️ 重要警告:');
      console.log('1. 请不要在主程序界面重新启动增强防护');
      console.log('2. 如果主程序重新启动了增强防护，配置可能会被覆盖');
      console.log('3. 如果发现配置又变错了，请重新运行此脚本');
    } else {
      console.log('❌ 强制修复失败！增强防护仍然无法自动恢复');
    }
    
    return { success: recovered, finalId, targetDeviceId };
    
  } catch (error) {
    console.error('❌ 强制修复失败:', error);
    return { success: false, error: error.message };
  }
}

// 运行强制修复
forceFixAndLock().then(result => {
  console.log('\n📊 强制修复完成:', result);
});
