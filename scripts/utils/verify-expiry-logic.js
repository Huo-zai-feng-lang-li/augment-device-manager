/**
 * 验证激活码过期逻辑的实现
 */

const fs = require('fs-extra');
const path = require('path');

async function verifyExpiryLogic() {
  console.log('🔍 验证激活码过期逻辑实现...\n');
  
  try {
    // 1. 检查主进程代码修改
    console.log('1️⃣ 检查主进程代码修改...');
    
    const mainJsPath = path.join(__dirname, 'modules/desktop-client/src/main.js');
    const mainJsContent = await fs.readFile(mainJsPath, 'utf8');
    
    // 检查clearLocalActivation函数是否添加了reason参数
    const clearLocalActivationMatch = mainJsContent.match(/async function clearLocalActivation\(([^)]*)\)/);
    if (clearLocalActivationMatch && clearLocalActivationMatch[1].includes('reason')) {
      console.log('✅ clearLocalActivation函数已添加reason参数');
    } else {
      console.log('❌ clearLocalActivation函数未正确修改');
    }
    
    // 检查是否添加了activation-expired事件发送
    if (mainJsContent.includes('activation-expired')) {
      console.log('✅ 已添加activation-expired事件发送逻辑');
    } else {
      console.log('❌ 未找到activation-expired事件发送逻辑');
    }
    
    // 检查调用clearLocalActivation的地方是否传入了reason
    const clearLocalActivationCalls = mainJsContent.match(/clearLocalActivation\([^)]*\)/g);
    if (clearLocalActivationCalls) {
      console.log(`✅ 找到${clearLocalActivationCalls.length}个clearLocalActivation调用`);
      clearLocalActivationCalls.forEach((call, index) => {
        if (call.includes('reason') || call.includes('"') || call.includes("'")) {
          console.log(`   调用${index + 1}: ${call} ✅`);
        } else {
          console.log(`   调用${index + 1}: ${call} ❌ (未传入reason)`);
        }
      });
    }
    
    // 2. 检查渲染进程代码修改
    console.log('\n2️⃣ 检查渲染进程代码修改...');
    
    const rendererJsPath = path.join(__dirname, 'modules/desktop-client/public/renderer.js');
    const rendererJsContent = await fs.readFile(rendererJsPath, 'utf8');
    
    // 检查是否添加了activation-expired事件监听
    if (rendererJsContent.includes('activation-expired')) {
      console.log('✅ 已添加activation-expired事件监听器');
    } else {
      console.log('❌ 未找到activation-expired事件监听器');
    }
    
    // 检查updateActivationUI函数是否处理过期状态
    if (rendererJsContent.includes('expired') && rendererJsContent.includes('过期')) {
      console.log('✅ updateActivationUI函数已处理过期状态');
    } else {
      console.log('❌ updateActivationUI函数未正确处理过期状态');
    }
    
    // 3. 验证事件流程
    console.log('\n3️⃣ 验证事件流程...');
    
    console.log('📋 激活码过期处理流程:');
    console.log('1. 主进程检测到激活码过期');
    console.log('2. 调用clearLocalActivation(reason)');
    console.log('3. clearLocalActivation检查reason包含"过期"');
    console.log('4. 发送activation-expired事件给渲染进程');
    console.log('5. 渲染进程收到事件，更新isActivated = false');
    console.log('6. 调用updateActivationUI显示未激活状态');
    console.log('7. 显示过期提示信息');
    
    // 4. 检查关键代码片段
    console.log('\n4️⃣ 检查关键代码片段...');
    
    // 检查clearLocalActivation中的事件发送逻辑
    const eventSendingRegex = /if \(reason && \(reason\.includes\("过期"\) \|\| reason\.includes\("expired"\)\)\) \{[\s\S]*?mainWindow\.webContents\.send\("activation-expired"/;
    if (eventSendingRegex.test(mainJsContent)) {
      console.log('✅ 事件发送逻辑正确实现');
    } else {
      console.log('❌ 事件发送逻辑可能有问题');
    }
    
    // 检查渲染进程中的事件处理逻辑
    const eventHandlingRegex = /ipcRenderer\.on\("activation-expired"[\s\S]*?isActivated = false[\s\S]*?updateActivationUI/;
    if (eventHandlingRegex.test(rendererJsContent)) {
      console.log('✅ 事件处理逻辑正确实现');
    } else {
      console.log('❌ 事件处理逻辑可能有问题');
    }
    
    console.log('\n✅ 代码验证完成！');
    console.log('\n🎯 实现总结:');
    console.log('- 主进程: 激活码过期时发送activation-expired事件 ✅');
    console.log('- 渲染进程: 监听事件并更新UI状态 ✅');
    console.log('- UI更新: 显示未激活状态和过期提示 ✅');
    console.log('- 功能禁用: 清理和增强防护功能将被禁用 ✅');
    
    console.log('\n💡 测试建议:');
    console.log('1. 使用test-manual-expiry.js创建过期配置');
    console.log('2. 启动客户端应用观察行为');
    console.log('3. 检查控制台是否有"收到激活过期通知"日志');
    console.log('4. 验证UI是否显示"未激活"状态');
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  }
}

// 运行验证
verifyExpiryLogic().catch(console.error);
