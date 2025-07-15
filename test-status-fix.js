const DeviceManager = require('./modules/desktop-client/src/device-manager');

async function testStatusFix() {
  console.log('🧪 测试状态显示修复...');
  
  try {
    const deviceManager = new DeviceManager();
    
    // 获取增强防护状态
    console.log('\n📊 获取增强防护状态...');
    const status = await deviceManager.getEnhancedGuardianStatus();
    
    console.log('\n🔍 状态详情:');
    console.log(`总体防护: ${status.isGuarding ? '🟢 运行中' : '🔴 未运行'}`);
    console.log(`运行模式: ${status.mode || '未知'}`);
    console.log(`选择的IDE: ${status.selectedIDE || '未知'}`);
    console.log(`目标设备ID: ${status.targetDeviceId || '未设置'}`);
    
    console.log('\n📋 详细状态:');
    console.log(`独立服务运行: ${status.standalone?.isRunning ? '✅ 是' : '❌ 否'}`);
    console.log(`内置进程运行: ${status.inProcess?.isGuarding ? '✅ 是' : '❌ 否'}`);
    
    if (status.standalone?.isRunning && status.standalone?.config) {
      console.log('\n⚙️ 独立服务配置:');
      console.log(`服务设备ID: ${status.standalone.config.deviceId || '未设置'}`);
      console.log(`服务选择的IDE: ${status.standalone.config.options?.selectedIDE || '未知'}`);
    }
    
    // 验证修复
    console.log('\n✅ 修复验证:');
    const isFixed = status.selectedIDE !== null && status.selectedIDE !== undefined;
    const hasTargetId = status.targetDeviceId !== null && status.targetDeviceId !== undefined;
    
    console.log(`selectedIDE显示正常: ${isFixed ? '✅ 是' : '❌ 否'}`);
    console.log(`targetDeviceId显示正常: ${hasTargetId ? '✅ 是' : '❌ 否'}`);
    
    if (isFixed && hasTargetId) {
      console.log('\n🎉 状态显示修复成功！');
      console.log(`现在正确显示: 选择的IDE = ${status.selectedIDE}, 目标设备ID = ${status.targetDeviceId}`);
    } else {
      console.log('\n⚠️ 状态显示仍有问题，可能需要重新启动增强防护');
    }
    
    return { success: isFixed && hasTargetId, status };
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return { success: false, error: error.message };
  }
}

// 运行测试
testStatusFix().then(result => {
  console.log('\n📊 测试完成:', result.success ? '✅ 成功' : '❌ 失败');
});
