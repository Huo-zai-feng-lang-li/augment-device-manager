#!/usr/bin/env node

/**
 * 主测试脚本 - 检查客户端清理功能的准确率
 * 目标：验证客户端点击清理后能达到的准确率
 */

const path = require('path');
const { spawn } = require('child_process');

console.log('🧪 Augment设备管理器 - 客户端清理准确率测试');
console.log('=' .repeat(60));
console.log('🎯 目标：检查客户端清理功能的实际准确率');
console.log('📋 测试流程：模拟客户端清理 → 检查清理效果 → 计算准确率');
console.log('');

async function runMainTest() {
  try {
    console.log('📊 第1步：检查清理前状态...');
    await runScript('test/check-all-traces.js');
    
    console.log('\n🧹 第2步：执行客户端标准清理...');
    await runScript('test/test-cleanup.js');
    
    console.log('\n⏳ 第3步：等待60秒让监控完成...');
    await sleep(60000);
    
    console.log('\n📋 第4步：生成详细测试报告...');
    await runScript('test/detailed-test-report.js');
    
    console.log('\n🔍 第5步：检查所有残留痕迹...');
    await runScript('test/check-all-traces.js');
    
    console.log('\n✅ 客户端清理准确率测试完成！');
    console.log('\n📋 测试结果解读：');
    console.log('  • 清理成功率 ≥98%：优秀，可以投入使用');
    console.log('  • 清理成功率 85-97%：良好，建议优化');
    console.log('  • 清理成功率 <85%：需要改进');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 运行: ${scriptPath}`);
    
    const child = spawn('node', [scriptPath], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ 完成: ${scriptPath}`);
        resolve();
      } else {
        reject(new Error(`脚本 ${scriptPath} 执行失败，退出码: ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(new Error(`启动脚本 ${scriptPath} 失败: ${error.message}`));
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => {
    console.log(`⏰ 等待 ${ms/1000} 秒...`);
    setTimeout(resolve, ms);
  });
}

// 处理命令行参数
if (require.main === module) {
  if (process.argv.includes('--help')) {
    console.log('客户端清理准确率测试使用说明:');
    console.log('  node test-main.js              # 运行完整测试');
    console.log('  node test-main.js --help       # 显示帮助');
    console.log('');
    console.log('测试流程:');
    console.log('  1. 检查清理前状态');
    console.log('  2. 执行客户端标准清理');
    console.log('  3. 等待监控完成');
    console.log('  4. 生成详细测试报告');
    console.log('  5. 检查残留痕迹');
  } else {
    runMainTest();
  }
}
