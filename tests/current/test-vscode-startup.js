const { ipcRenderer } = require('electron');

async function testVSCodeStartup() {
  console.log('🧪 测试VS Code启动功能...');
  console.log('='.repeat(50));

  try {
    // 1. 测试动态路径检测
    console.log('\n📍 第1步：测试动态路径检测...');
    
    // 这里我们直接调用后端的restart-ide接口
    const restartResult = await ipcRenderer.invoke('restart-ide', 'vscode');
    
    console.log('🔄 VS Code重启结果:');
    console.log(`   - 成功: ${restartResult.success}`);
    console.log(`   - 消息: ${restartResult.message}`);
    if (restartResult.method) {
      console.log(`   - 启动方法: ${restartResult.method}`);
    }
    
    if (restartResult.success) {
      console.log('✅ VS Code启动成功！');
      
      // 等待一下让VS Code完全启动
      console.log('⏳ 等待VS Code完全启动...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 检查VS Code进程
      console.log('\n📊 第2步：验证VS Code进程...');
      // 这里我们无法直接调用系统命令，但可以通过其他方式验证
      
    } else {
      console.log('❌ VS Code启动失败');
      console.log(`   错误信息: ${restartResult.message}`);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 如果在渲染进程中运行
if (typeof window !== 'undefined' && window.ipcRenderer) {
  testVSCodeStartup();
} else {
  console.log('⚠️ 此脚本需要在Electron渲染进程中运行');
}
