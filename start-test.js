#!/usr/bin/env node

/**
 * 系统启动和测试脚本
 * 启动后台服务并运行完整的功能测试
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

// 配置
const CONFIG = {
  adminBackendPath: './admin-backend',
  testDelay: 5000, // 等待服务启动的时间（毫秒）
  serverPort: 3002
};

let backendProcess = null;

// 工具函数
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

// 检查端口是否被占用
function checkPort(port) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec(`netstat -an | findstr :${port}`, (error, stdout) => {
      resolve(stdout.includes(`:${port}`));
    });
  });
}

// 启动后台服务
async function startBackendServer() {
  log('启动后台管理服务...');
  
  try {
    // 检查端口是否已被占用
    const portInUse = await checkPort(CONFIG.serverPort);
    if (portInUse) {
      log(`端口 ${CONFIG.serverPort} 已被占用，尝试终止现有进程...`);
      exec(`taskkill /f /im node.exe`, (error) => {
        if (error) {
          log('终止进程失败，请手动关闭占用端口的进程', 'error');
        }
      });
      
      // 等待进程终止
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 切换到后台目录
    process.chdir(CONFIG.adminBackendPath);
    
    // 启动服务
    backendProcess = spawn('npm', ['start'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    backendProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        log(`[后台服务] ${output}`);
      }
    });

    backendProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output && !output.includes('DeprecationWarning')) {
        log(`[后台服务错误] ${output}`, 'error');
      }
    });

    backendProcess.on('close', (code) => {
      log(`后台服务进程退出，代码: ${code}`);
    });

    backendProcess.on('error', (error) => {
      log(`启动后台服务失败: ${error.message}`, 'error');
    });

    log('后台服务启动中，等待服务就绪...');
    
    // 等待服务启动
    await new Promise(resolve => setTimeout(resolve, CONFIG.testDelay));
    
    // 验证服务是否启动成功
    const serviceReady = await checkPort(CONFIG.serverPort);
    if (serviceReady) {
      log('后台服务启动成功！', 'success');
      return true;
    } else {
      log('后台服务启动失败，端口未监听', 'error');
      return false;
    }

  } catch (error) {
    log(`启动后台服务失败: ${error.message}`, 'error');
    return false;
  }
}

// 运行测试
async function runTests() {
  log('开始运行系统测试...');
  
  try {
    // 切换回根目录
    process.chdir('..');
    
    // 运行测试脚本
    const testProcess = spawn('node', ['test-system.js'], {
      stdio: 'inherit',
      shell: true
    });

    return new Promise((resolve) => {
      testProcess.on('close', (code) => {
        if (code === 0) {
          log('所有测试通过！', 'success');
        } else {
          log('部分测试失败', 'error');
        }
        resolve(code === 0);
      });

      testProcess.on('error', (error) => {
        log(`测试执行失败: ${error.message}`, 'error');
        resolve(false);
      });
    });

  } catch (error) {
    log(`运行测试失败: ${error.message}`, 'error');
    return false;
  }
}

// 清理资源
function cleanup() {
  log('清理资源...');
  
  if (backendProcess) {
    log('终止后台服务进程...');
    backendProcess.kill('SIGTERM');
    
    // 强制终止
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        backendProcess.kill('SIGKILL');
      }
    }, 3000);
  }
}

// 主函数
async function main() {
  log('='.repeat(60));
  log('设备管理系统 - 自动化测试');
  log('='.repeat(60));

  try {
    // 启动后台服务
    const serverStarted = await startBackendServer();
    if (!serverStarted) {
      log('后台服务启动失败，终止测试', 'error');
      process.exit(1);
    }

    // 运行测试
    const testsPassed = await runTests();
    
    // 输出最终结果
    log('='.repeat(60));
    if (testsPassed) {
      log('🎉 系统测试完成，所有功能正常！', 'success');
    } else {
      log('⚠️ 系统测试完成，发现问题需要修复', 'error');
    }
    log('='.repeat(60));

    process.exit(testsPassed ? 0 : 1);

  } catch (error) {
    log(`测试执行异常: ${error.message}`, 'error');
    process.exit(1);
  }
}

// 处理进程退出
process.on('SIGINT', () => {
  log('收到中断信号，正在清理...');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('收到终止信号，正在清理...');
  cleanup();
  process.exit(0);
});

process.on('exit', () => {
  cleanup();
});

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    log(`程序执行失败: ${error.message}`, 'error');
    cleanup();
    process.exit(1);
  });
}

module.exports = { main };
