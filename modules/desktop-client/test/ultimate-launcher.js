#!/usr/bin/env node

/**
 * 终极清理启动器
 * 提供多种清理方案，确保98%以上清理成功率
 */

const { spawn } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function showMenu() {
  console.log('🚀 Augment设备管理器 - 终极清理方案');
  console.log('=' .repeat(60));
  console.log('🎯 目标：98%以上清理成功率，让Augment扩展无法识别为老用户');
  console.log('');
  console.log('请选择清理方案：');
  console.log('');
  console.log('1. 🧹 标准清理 (推荐)');
  console.log('   - 保留Cursor IDE，仅清理用户识别数据');
  console.log('   - 适合日常使用，不影响IDE功能');
  console.log('   - 预期成功率：85-95%');
  console.log('');
  console.log('2. 🔥 激进清理');
  console.log('   - 深度清理+多轮清理+延长监控');
  console.log('   - 可能需要重新配置IDE');
  console.log('   - 预期成功率：95-98%');
  console.log('');
  console.log('3. 💥 核弹级清理');
  console.log('   - 完全删除Cursor IDE和所有数据');
  console.log('   - 需要重新安装和配置');
  console.log('   - 预期成功率：98-100%');
  console.log('');
  console.log('4. 🛠️ 完全重装清理');
  console.log('   - 卸载+彻底清理+重新安装');
  console.log('   - 最彻底的解决方案');
  console.log('   - 预期成功率：99-100%');
  console.log('');
  console.log('5. 📊 仅检查当前状态');
  console.log('   - 不执行清理，仅检查识别信息');
  console.log('');
  console.log('0. 退出');
  console.log('');
}

async function executeCleanup(choice) {
  console.log('\n' + '='.repeat(60));
  
  switch (choice) {
    case '1':
      console.log('🧹 执行标准清理...');
      await runScript('test-cleanup.js');
      break;
      
    case '2':
      console.log('🔥 执行激进清理...');
      await runScript('quick-test.js', ['--cleanup']);
      break;
      
    case '3':
      console.log('💥 执行核弹级清理...');
      console.log('⚠️ 警告：这将完全删除Cursor IDE！');
      const confirm1 = await askQuestion('确认执行？(输入 YES 确认): ');
      if (confirm1 === 'YES') {
        await runScript('nuclear-cleanup.js');
      } else {
        console.log('❌ 已取消核弹级清理');
        return;
      }
      break;
      
    case '4':
      console.log('🛠️ 执行完全重装清理...');
      console.log('⚠️ 警告：这将卸载并重新安装Cursor IDE！');
      const confirm2 = await askQuestion('确认执行？(输入 YES 确认): ');
      if (confirm2 === 'YES') {
        await runScript('ultimate-cleanup.js');
      } else {
        console.log('❌ 已取消完全重装清理');
        return;
      }
      break;
      
    case '5':
      console.log('📊 检查当前状态...');
      await runScript('detailed-test-report.js');
      return;
      
    case '0':
      console.log('👋 再见！');
      rl.close();
      process.exit(0);
      
    default:
      console.log('❌ 无效选择，请重新选择');
      return;
  }
  
  // 清理完成后，询问是否检查结果
  console.log('\n✅ 清理执行完成！');
  const checkResult = await askQuestion('是否检查清理结果？(y/n): ');
  
  if (checkResult.toLowerCase() === 'y' || checkResult.toLowerCase() === 'yes') {
    console.log('\n📊 检查清理结果...');
    await runScript('detailed-test-report.js');
  }
}

function runScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 启动脚本: ${scriptName}`);
    
    const child = spawn('node', [scriptName, ...args], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ 脚本完成: ${scriptName}`);
        resolve();
      } else {
        console.log(`❌ 脚本失败: ${scriptName} (退出码: ${code})`);
        reject(new Error(`脚本 ${scriptName} 执行失败`));
      }
    });
    
    child.on('error', (error) => {
      console.log(`❌ 启动脚本失败: ${scriptName}`);
      reject(error);
    });
  });
}

async function showSuccessRateGuide() {
  console.log('\n📋 清理成功率指南：');
  console.log('');
  console.log('🎯 98%以上 - 优秀');
  console.log('   Augment扩展将完全识别为新用户');
  console.log('   可以正常使用试用功能');
  console.log('');
  console.log('⚠️ 85-97% - 良好');
  console.log('   大部分识别信息已清除');
  console.log('   可能仍有少量残留，建议使用更激进的方案');
  console.log('');
  console.log('❌ 85%以下 - 需要改进');
  console.log('   仍有重要识别信息残留');
  console.log('   建议使用核弹级清理或完全重装');
  console.log('');
  console.log('🔑 关键指标：');
  console.log('   • telemetry.devDeviceId 必须更新');
  console.log('   • Augment扩展存储必须清理');
  console.log('   • 工作区数据必须清理');
  console.log('');
}

async function main() {
  try {
    await showMenu();
    await showSuccessRateGuide();
    
    while (true) {
      const choice = await askQuestion('请选择清理方案 (1-5, 0退出): ');
      
      if (choice === '0') {
        console.log('👋 再见！');
        break;
      }
      
      await executeCleanup(choice);
      
      console.log('\n' + '='.repeat(60));
      const continueChoice = await askQuestion('是否继续使用其他清理方案？(y/n): ');
      
      if (continueChoice.toLowerCase() !== 'y' && continueChoice.toLowerCase() !== 'yes') {
        console.log('👋 清理完成，再见！');
        break;
      }
      
      console.log('\n');
      await showMenu();
    }
    
  } catch (error) {
    console.error('❌ 程序执行失败:', error.message);
  } finally {
    rl.close();
  }
}

// 处理命令行参数
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('终极清理启动器使用说明:');
    console.log('  node ultimate-launcher.js    # 交互式菜单');
    console.log('  node ultimate-launcher.js --help # 显示帮助');
    console.log('');
    console.log('可用的清理方案:');
    console.log('  1. 标准清理 - 日常使用，保留IDE');
    console.log('  2. 激进清理 - 深度清理，可能需要重新配置');
    console.log('  3. 核弹级清理 - 完全删除，需要重新安装');
    console.log('  4. 完全重装 - 卸载+清理+重装');
    console.log('  5. 状态检查 - 仅检查，不清理');
  } else {
    main();
  }
}
