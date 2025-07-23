const DeviceManager = require('./modules/desktop-client/src/device-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function fixConfigIssue() {
  console.log('🔧 修复配置问题...');
  
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
    
    // 2. 清理所有配置文件
    console.log('\n2️⃣ 清理所有配置文件...');
    const configPaths = [
      path.join(os.tmpdir(), 'augment-guardian-config.json'),
      path.join(os.tmpdir(), 'augment-guardian.pid'),
      path.join(os.tmpdir(), 'augment-guardian.log'),
      path.join(os.homedir(), '.augment', 'guardian-service', 'config.json'),
      path.join(os.homedir(), '.augment', 'guardian-service', 'guardian.pid')
    ];
    
    for (const configPath of configPaths) {
      try {
        if (await fs.pathExists(configPath)) {
          await fs.remove(configPath);
          console.log(`✅ 已删除: ${path.basename(configPath)}`);
        }
      } catch (error) {
        console.log(`删除失败 ${path.basename(configPath)}: ${error.message}`);
      }
    }
    
    // 3. 等待确保完全停止
    console.log('\n3️⃣ 等待系统完全停止（5秒）...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 4. 重新启动增强防护（正确配置）
    console.log('\n4️⃣ 重新启动增强防护（正确配置）...');
    console.log(`🎯 目标设备ID: ${targetDeviceId}`);
    console.log(`🎯 选择的IDE: VS Code`);
    
    const startResult = await deviceManager.startEnhancedGuardianIndependently({
      selectedIDE: "vscode",  // 明确设置为vscode
      enableBackupMonitoring: true,
      enableDatabaseMonitoring: true,
      enableEnhancedProtection: true,
      targetDeviceId: targetDeviceId  // 明确设置VS Code的目标ID
    });
    
    console.log(`启动结果: ${startResult.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`消息: ${startResult.message}`);
    console.log(`模式: ${startResult.mode}`);
    console.log(`设备ID: ${startResult.deviceId}`);
    
    if (!startResult.success) {
      console.log('❌ 启动失败，无法继续');
      return { success: false, error: startResult.message };
    }
    
    // 5. 等待系统稳定
    console.log('\n5️⃣ 等待系统稳定（5秒）...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 6. 验证配置
    console.log('\n6️⃣ 验证配置...');
    const status = await deviceManager.getEnhancedGuardianStatus();
    console.log(`总体防护: ${status.isGuarding ? '✅ 运行' : '❌ 未运行'}`);
    console.log(`选择的IDE: ${status.selectedIDE || '未知'}`);
    console.log(`目标设备ID: ${status.targetDeviceId || '未设置'}`);
    
    // 验证配置是否正确
    const ideCorrect = status.selectedIDE === 'vscode';
    const idCorrect = status.targetDeviceId === targetDeviceId;
    
    console.log(`IDE配置正确: ${ideCorrect ? '✅ 是' : '❌ 否'}`);
    console.log(`设备ID配置正确: ${idCorrect ? '✅ 是' : '❌ 否'}`);
    
    if (!ideCorrect || !idCorrect) {
      console.log('❌ 配置仍然不正确');
      return { success: false, error: '配置验证失败' };
    }
    
    // 7. 检查并恢复VS Code设备ID
    const vscodeStoragePath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Code',
      'User',
      'globalStorage',
      'storage.json'
    );
    
    console.log('\n7️⃣ 检查并恢复VS Code设备ID...');
    const currentData = await fs.readJson(vscodeStoragePath);
    const currentId = currentData["telemetry.devDeviceId"];
    console.log(`当前设备ID: ${currentId}`);
    
    if (currentId !== targetDeviceId) {
      console.log('🔧 设备ID不正确，强制恢复...');
      currentData["telemetry.devDeviceId"] = targetDeviceId;
      await fs.writeJson(vscodeStoragePath, currentData, { spaces: 2 });
      console.log('✅ 已强制恢复为目标设备ID');
    }
    
    // 8. 进行测试
    console.log('\n8️⃣ 进行修改测试...');
    const testId = "config-fix-test-" + Date.now();
    
    const testData = await fs.readJson(vscodeStoragePath);
    testData["telemetry.devDeviceId"] = testId;
    await fs.writeJson(vscodeStoragePath, testData, { spaces: 2 });
    console.log(`📝 已修改设备ID为: ${testId}`);
    
    // 等待自动恢复
    console.log('⏳ 等待自动恢复（10秒）...');
    let recovered = false;
    let attempts = 0;
    const maxAttempts = 20; // 10秒
    
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
        
        if (attempts % 4 === 0) { // 每2秒显示状态
          console.log(`⏳ ${attempts * 0.5}秒 - 当前ID: ${checkId.substring(0, 20)}...`);
        }
      } catch (error) {
        console.log(`读取错误: ${error.message}`);
      }
    }
    
    // 9. 最终结果
    console.log('\n9️⃣ 最终结果...');
    const finalData = await fs.readJson(vscodeStoragePath);
    const finalId = finalData["telemetry.devDeviceId"];
    console.log(`最终设备ID: ${finalId}`);
    
    if (recovered) {
      console.log('🎉 配置修复成功！增强防护现在正常工作！');
      console.log('✅ IDE选择: VS Code');
      console.log('✅ 目标设备ID: 正确设置');
      console.log('✅ 自动恢复: 正常工作');
    } else {
      console.log('❌ 配置修复失败！增强防护仍然无法自动恢复');
    }
    
    return { success: recovered, finalId, targetDeviceId };
    
  } catch (error) {
    console.error('❌ 修复失败:', error);
    return { success: false, error: error.message };
  }
}

// 运行修复
fixConfigIssue().then(result => {
  console.log('\n📊 修复完成:', result);
});
