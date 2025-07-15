#!/usr/bin/env node

/**
 * Augment设备管理器 - 快速清理测试脚本
 * 目标：实现98%以上的清理成功率
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Augment设备管理器 - 快速清理测试');
console.log('=' .repeat(60));
console.log('📋 目标：实现98%以上的清理成功率');
console.log('🔧 配置：跳过Cursor IDE登录清理，保留激活状态');
console.log('');

async function runQuickTest() {
  try {
    console.log('1️⃣ 执行完整清理操作...');
    await runScript('test-cleanup.js');
    
    console.log('\n2️⃣ 等待60秒让监控完成...');
    await sleep(60000);
    
    console.log('\n3️⃣ 运行详细测试报告...');
    await runScript('detailed-test-report.js');
    
    console.log('\n✅ 快速测试完成！');
    console.log('\n📋 如何解读结果：');
    console.log('  • 清理成功率 ≥98%：优秀，Augment扩展应识别为新用户');
    console.log('  • 清理成功率 80-97%：良好，大部分识别信息已清除');
    console.log('  • 清理成功率 <80%：需要改进，可能仍被识别为老用户');
    console.log('');
    console.log('🎯 关键指标：');
    console.log('  • telemetry.devDeviceId 必须更新（30分）');
    console.log('  • Augment扩展存储必须清理（20分）');
    console.log('  • 工作区数据必须清理（15分）');
    console.log('  • 数据库Augment数据必须清理（15分）');
    
  } catch (error) {
    console.error('❌ 快速测试失败:', error.message);
    process.exit(1);
  }
}

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptName], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`脚本 ${scriptName} 执行失败，退出码: ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(new Error(`启动脚本 ${scriptName} 失败: ${error.message}`));
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 处理命令行参数
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('使用方法：');
  console.log('  node quick-test.js              # 运行完整测试');
  console.log('  node quick-test.js --cleanup    # 仅运行清理');
  console.log('  node quick-test.js --report     # 仅运行报告');
  console.log('  node quick-test.js --check      # 仅检查痕迹');
  process.exit(0);
}

if (args.includes('--cleanup')) {
  console.log('🧹 仅运行清理操作...');
  runScript('test-cleanup.js').then(() => {
    console.log('✅ 清理完成！建议等待60秒后运行报告检查。');
  }).catch(console.error);
} else if (args.includes('--report')) {
  console.log('📋 仅运行详细报告...');
  runScript('detailed-test-report.js').catch(console.error);
} else if (args.includes('--check')) {
  console.log('🔍 仅检查用户识别痕迹...');
  runScript('check-all-traces.js').catch(console.error);
} else {
  // 运行完整测试
  runQuickTest();
}
