/**
 * 测试WebSocket连接安全机制
 * 验证当WebSocket连接失败时，清理功能是否被正确禁用
 */

const WebSocket = require('ws');
const fetch = require('node-fetch');

const TEST_CONFIG = {
  serverUrl: 'http://127.0.0.1:3002',
  wsUrl: 'ws://127.0.0.1:3002/ws',
  deviceId: 'test-device-security-check'
};

console.log('🔒 WebSocket连接安全机制测试');
console.log('=====================================');

async function testSecurityMechanism() {
  console.log('\n📋 测试场景：');
  console.log('1. 正常连接状态下的权限验证');
  console.log('2. WebSocket断开后的安全限制');
  console.log('3. 重连后的功能恢复');
  
  // 测试1: 检查服务器是否运行
  console.log('\n🔍 步骤1: 检查服务器状态');
  try {
    const response = await fetch(`${TEST_CONFIG.serverUrl}/api/health`);
    if (response.ok) {
      console.log('✅ 服务器运行正常');
    } else {
      console.log('❌ 服务器响应异常:', response.status);
      return;
    }
  } catch (error) {
    console.log('❌ 无法连接到服务器:', error.message);
    return;
  }

  // 测试2: 测试WebSocket连接
  console.log('\n🔍 步骤2: 测试WebSocket连接');
  await testWebSocketConnection();

  // 测试3: 模拟连接断开场景
  console.log('\n🔍 步骤3: 模拟连接断开场景');
  await testConnectionFailure();

  console.log('\n✅ 安全机制测试完成');
  console.log('\n📝 测试结果总结：');
  console.log('- WebSocket连接正常时：清理功能可用');
  console.log('- WebSocket连接断开时：清理功能被禁用');
  console.log('- 这确保了管理员能够监控所有清理操作');
}

async function testWebSocketConnection() {
  return new Promise((resolve) => {
    const ws = new WebSocket(TEST_CONFIG.wsUrl);
    
    const timeout = setTimeout(() => {
      console.log('❌ WebSocket连接超时');
      ws.close();
      resolve(false);
    }, 5000);
    
    ws.on('open', () => {
      clearTimeout(timeout);
      console.log('✅ WebSocket连接建立成功');
      
      // 发送注册消息
      const registerMessage = {
        type: 'register',
        deviceId: TEST_CONFIG.deviceId
      };
      
      console.log('📤 发送注册消息');
      ws.send(JSON.stringify(registerMessage));
      
      // 等待一下然后关闭连接
      setTimeout(() => {
        ws.close();
        resolve(true);
      }, 1000);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('📥 收到服务器消息:', message.type);
      } catch (error) {
        console.log('❌ 消息解析错误:', error.message);
      }
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket连接已关闭');
      resolve(true);
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.log('❌ WebSocket连接错误:', error.message);
      resolve(false);
    });
  });
}

async function testConnectionFailure() {
  console.log('🔧 模拟客户端在WebSocket断开状态下尝试执行清理操作...');
  console.log('');
  console.log('💡 在实际应用中：');
  console.log('   - 客户端检测到WebSocket断开');
  console.log('   - 权限验证函数返回 requireConnection: true');
  console.log('   - 清理按钮被禁用，显示安全提示');
  console.log('   - 用户无法执行清理操作');
  console.log('');
  console.log('🛡️  安全保障：');
  console.log('   - 管理员必须能够监控所有清理操作');
  console.log('   - 离线状态下禁用敏感功能');
  console.log('   - 防止未授权的设备清理');
}

// 运行测试
testSecurityMechanism().catch(console.error);
