#!/usr/bin/env node

/**
 * WebSocket连接测试脚本
 * 用于诊断客户端WebSocket连接问题
 */

const WebSocket = require('ws');

// 测试配置
const TEST_CONFIG = {
  wsUrl: 'ws://localhost:3002/ws',
  deviceId: 'test-device-' + Date.now()
};

console.log('🔍 WebSocket连接诊断工具');
console.log('========================');
console.log(`测试地址: ${TEST_CONFIG.wsUrl}`);
console.log(`设备ID: ${TEST_CONFIG.deviceId}`);
console.log('');

// 测试WebSocket连接
function testWebSocketConnection() {
  return new Promise((resolve) => {
    console.log('⏳ 正在连接WebSocket服务器...');
    
    try {
      const ws = new WebSocket(TEST_CONFIG.wsUrl);
      
      // 连接超时处理
      const timeout = setTimeout(() => {
        console.log('❌ 连接超时 (10秒)');
        ws.close();
        resolve(false);
      }, 10000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        console.log('✅ WebSocket连接建立成功');
        
        // 发送注册消息
        const registerMessage = {
          type: 'register',
          deviceId: TEST_CONFIG.deviceId
        };
        
        console.log('📤 发送注册消息:', JSON.stringify(registerMessage, null, 2));
        ws.send(JSON.stringify(registerMessage));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          console.log('📥 收到服务器消息:', JSON.stringify(message, null, 2));
          
          if (message.type === 'registered') {
            console.log('✅ 客户端注册成功');
            
            // 测试完成，关闭连接
            setTimeout(() => {
              console.log('🔚 测试完成，关闭连接');
              ws.close();
              resolve(true);
            }, 2000);
          }
        } catch (error) {
          console.log('❌ 消息解析失败:', error.message);
          console.log('原始消息:', data.toString());
        }
      });

      ws.on('close', (code, reason) => {
        clearTimeout(timeout);
        console.log(`🔌 WebSocket连接已关闭 (code: ${code}, reason: ${reason || '无'})`);
        resolve(false);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        console.log('❌ WebSocket连接错误:', error.message);
        console.log('错误详情:', error);
        resolve(false);
      });

    } catch (error) {
      console.log('❌ WebSocket初始化失败:', error.message);
      resolve(false);
    }
  });
}

// 测试服务器HTTP接口
async function testHttpConnection() {
  console.log('⏳ 测试HTTP接口连接...');
  
  try {
    const response = await fetch('http://localhost:3002/api/health');
    if (response.ok) {
      console.log('✅ HTTP接口连接正常');
      return true;
    } else {
      console.log(`❌ HTTP接口响应异常: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.log('❌ HTTP接口连接失败:', error.message);
    return false;
  }
}

// 主测试函数
async function runDiagnostics() {
  console.log('🚀 开始WebSocket连接诊断...');
  console.log('');
  
  // 1. 测试HTTP连接
  const httpOk = await testHttpConnection();
  console.log('');
  
  // 2. 测试WebSocket连接
  const wsOk = await testWebSocketConnection();
  console.log('');
  
  // 3. 输出诊断结果
  console.log('📊 诊断结果:');
  console.log(`   HTTP接口: ${httpOk ? '✅ 正常' : '❌ 异常'}`);
  console.log(`   WebSocket: ${wsOk ? '✅ 正常' : '❌ 异常'}`);
  console.log('');
  
  if (!httpOk) {
    console.log('💡 建议:');
    console.log('   1. 检查服务器是否正在运行 (npm run server-only)');
    console.log('   2. 检查端口3002是否被占用');
    console.log('   3. 检查防火墙设置');
  } else if (!wsOk) {
    console.log('💡 建议:');
    console.log('   1. 检查WebSocket服务是否正确启动');
    console.log('   2. 检查服务器日志中的错误信息');
    console.log('   3. 尝试重启服务器');
  } else {
    console.log('🎉 WebSocket连接正常！');
  }
}

// 运行诊断
runDiagnostics().catch(console.error);
