#!/usr/bin/env node

/**
 * 系统功能测试脚本
 * 测试后台管理系统和桌面客户端的主要功能
 */

const fetch = require('node-fetch');
const WebSocket = require('ws');

// 测试配置
const TEST_CONFIG = {
  adminUrl: 'http://localhost:3002',
  wsUrl: 'ws://localhost:3002/ws',
  testUser: {
    username: 'admin',
    password: 'admin123'
  }
};

let authToken = null;

// 测试结果统计
const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

// 工具函数
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function assert(condition, message) {
  if (condition) {
    testResults.passed++;
    log(`PASS: ${message}`, 'success');
  } else {
    testResults.failed++;
    testResults.errors.push(message);
    log(`FAIL: ${message}`, 'error');
  }
}

// API请求函数
async function apiRequest(endpoint, options = {}) {
  const url = `${TEST_CONFIG.adminUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  return await response.json();
}

// 测试函数
async function testAdminLogin() {
  log('测试管理员登录...');
  
  try {
    const result = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify(TEST_CONFIG.testUser)
    });

    assert(result.success, '管理员登录成功');
    assert(result.token, '获取到认证令牌');
    
    if (result.success) {
      authToken = result.token;
    }
  } catch (error) {
    assert(false, `管理员登录失败: ${error.message}`);
  }
}

async function testActivationCodeManagement() {
  log('测试激活码管理功能...');
  
  try {
    // 创建激活码
    const createResult = await apiRequest('/api/activation-codes', {
      method: 'POST',
      body: JSON.stringify({
        expiryDays: 30,
        notes: '测试激活码'
      })
    });

    assert(createResult.success, '创建激活码成功');
    assert(createResult.data.code, '激活码生成成功');

    const testCode = createResult.data;

    // 获取激活码列表
    const listResult = await apiRequest('/api/activation-codes');
    assert(listResult.success, '获取激活码列表成功');
    assert(Array.isArray(listResult.data), '激活码列表格式正确');

    // 更新激活码
    const updateResult = await apiRequest(`/api/activation-codes/${testCode.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        notes: '更新后的测试激活码'
      })
    });

    assert(updateResult.success, '更新激活码成功');

    // 撤销激活码
    const revokeResult = await apiRequest(`/api/activation-codes/${testCode.id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({
        reason: '测试撤销'
      })
    });

    assert(revokeResult.success, '撤销激活码成功');

    // 删除激活码
    const deleteResult = await apiRequest(`/api/activation-codes/${testCode.id}`, {
      method: 'DELETE'
    });

    assert(deleteResult.success, '删除激活码成功');

  } catch (error) {
    assert(false, `激活码管理测试失败: ${error.message}`);
  }
}

async function testActivationValidation() {
  log('测试激活验证功能...');
  
  try {
    // 创建测试激活码
    const createResult = await apiRequest('/api/activation-codes', {
      method: 'POST',
      body: JSON.stringify({
        expiryDays: 30,
        notes: '验证测试激活码'
      })
    });

    assert(createResult.success, '创建测试激活码成功');
    const testCode = createResult.data.code;
    const testDeviceId = 'test-device-123';

    // 验证激活码
    const validateResult = await apiRequest('/api/validate-code', {
      method: 'POST',
      body: JSON.stringify({
        code: testCode,
        deviceId: testDeviceId
      })
    });

    assert(validateResult.success, '激活码验证成功');

    // 实时验证激活状态
    const verifyResult = await apiRequest('/api/verify-activation', {
      method: 'POST',
      body: JSON.stringify({
        code: testCode,
        deviceId: testDeviceId
      })
    });

    assert(verifyResult.success && verifyResult.valid, '实时验证激活状态成功');

    // 测试权限验证
    const permissionResult = await apiRequest('/api/client/execute-operation', {
      method: 'POST',
      body: JSON.stringify({
        code: testCode,
        deviceId: testDeviceId,
        operation: 'cleanup',
        parameters: {}
      })
    });

    assert(permissionResult.success, '权限验证成功');

  } catch (error) {
    assert(false, `激活验证测试失败: ${error.message}`);
  }
}

async function testUserManagement() {
  log('测试用户管理功能...');
  
  try {
    // 获取用户列表
    const usersResult = await apiRequest('/api/users');
    assert(usersResult.success, '获取用户列表成功');
    assert(Array.isArray(usersResult.data), '用户列表格式正确');

    // 获取使用记录
    const logsResult = await apiRequest('/api/usage-logs');
    assert(logsResult.success, '获取使用记录成功');
    assert(Array.isArray(logsResult.data), '使用记录格式正确');

  } catch (error) {
    assert(false, `用户管理测试失败: ${error.message}`);
  }
}

async function testStatistics() {
  log('测试统计功能...');
  
  try {
    const statsResult = await apiRequest('/api/stats');
    assert(statsResult.success, '获取统计数据成功');
    assert(typeof statsResult.data === 'object', '统计数据格式正确');
    assert(typeof statsResult.data.totalCodes === 'number', '激活码总数统计正确');
    assert(typeof statsResult.data.usedCodes === 'number', '已使用激活码统计正确');

  } catch (error) {
    assert(false, `统计功能测试失败: ${error.message}`);
  }
}

async function testWebSocketConnection() {
  log('测试WebSocket连接...');
  
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(TEST_CONFIG.wsUrl);
      
      ws.on('open', () => {
        assert(true, 'WebSocket连接建立成功');
        
        // 发送注册消息
        ws.send(JSON.stringify({
          type: 'register',
          deviceId: 'test-device-ws'
        }));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.type === 'registered') {
            assert(message.success, 'WebSocket注册成功');
          }
        } catch (error) {
          assert(false, `WebSocket消息解析失败: ${error.message}`);
        }
      });

      ws.on('error', (error) => {
        assert(false, `WebSocket连接错误: ${error.message}`);
        resolve();
      });

      // 3秒后关闭连接
      setTimeout(() => {
        ws.close();
        resolve();
      }, 3000);

    } catch (error) {
      assert(false, `WebSocket测试失败: ${error.message}`);
      resolve();
    }
  });
}

// 主测试函数
async function runTests() {
  log('开始系统功能测试...');
  log('='.repeat(50));

  try {
    await testAdminLogin();
    await testActivationCodeManagement();
    await testActivationValidation();
    await testUserManagement();
    await testStatistics();
    await testWebSocketConnection();

  } catch (error) {
    log(`测试执行错误: ${error.message}`, 'error');
  }

  // 输出测试结果
  log('='.repeat(50));
  log(`测试完成! 通过: ${testResults.passed}, 失败: ${testResults.failed}`);
  
  if (testResults.failed > 0) {
    log('失败的测试:', 'error');
    testResults.errors.forEach(error => log(`  - ${error}`, 'error'));
  }

  process.exit(testResults.failed > 0 ? 1 : 0);
}

// 运行测试
if (require.main === module) {
  runTests().catch(error => {
    log(`测试运行失败: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = { runTests };
