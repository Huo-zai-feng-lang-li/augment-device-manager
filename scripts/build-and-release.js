#!/usr/bin/env node

/**
 * 完整的构建和发布流程脚本
 * 1. 更新配置
 * 2. 构建应用
 * 3. 发布到GitHub Releases
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

async function buildAndRelease() {
  try {
    console.log('🚀 开始完整构建和发布流程...');
    console.log('================================');

    // 1. 更新配置
    console.log('\n📋 步骤 1: 更新配置');
    console.log('-------------------');
    execSync('node scripts/setup/update-build-config.js', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });

    // 2. 检查Git状态
    console.log('\n📋 步骤 2: 检查Git状态');
    console.log('----------------------');
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        console.log('⚠️ 发现未提交的更改:');
        console.log(status);
        console.log('💡 建议先提交更改，或使用 --force 强制构建');
        
        const args = process.argv.slice(2);
        if (!args.includes('--force')) {
          process.exit(1);
        }
        console.log('🔥 使用 --force 参数，继续构建...');
      } else {
        console.log('✅ Git状态干净');
      }
    } catch (error) {
      console.log('⚠️ Git检查失败，可能不在Git仓库中');
    }

    // 3. 读取版本信息
    console.log('\n📋 步骤 3: 读取版本信息');
    console.log('------------------------');
    const packagePath = path.join(__dirname, '../modules/desktop-client/package.json');
    const packageJson = await fs.readJson(packagePath);
    const version = packageJson.version;
    console.log(`📦 当前版本: v${version}`);

    // 4. 构建应用
    console.log('\n📋 步骤 4: 构建应用');
    console.log('------------------');
    console.log('🔨 开始构建...');
    
    process.chdir(path.join(__dirname, '../modules/desktop-client'));
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ 构建完成');

    // 5. 检查构建产物
    console.log('\n📋 步骤 5: 检查构建产物');
    console.log('------------------------');
    const distPath = path.join(process.cwd(), 'dist-final');
    
    if (await fs.pathExists(distPath)) {
      const files = await fs.readdir(distPath);
      console.log('📁 构建产物:');
      files.forEach(file => {
        console.log(`   - ${file}`);
      });
    } else {
      throw new Error('构建产物目录不存在');
    }

    // 6. 可选：发布到GitHub Releases
    const args = process.argv.slice(2);
    if (args.includes('--publish')) {
      console.log('\n📋 步骤 6: 发布到GitHub Releases');
      console.log('--------------------------------');
      console.log('📤 开始发布...');
      
      try {
        execSync('npm run release', { stdio: 'inherit' });
        console.log('✅ 发布完成');
      } catch (error) {
        console.log('❌ 发布失败，但构建已完成');
        console.log('💡 可以手动上传构建产物到GitHub Releases');
      }
    }

    console.log('\n🎉 构建流程完成！');
    console.log('==================');
    console.log(`📦 版本: v${version}`);
    console.log(`📁 构建产物位置: ${distPath}`);
    
    if (!args.includes('--publish')) {
      console.log('💡 如需发布，请运行: npm run build:release -- --publish');
    }

  } catch (error) {
    console.error('\n❌ 构建失败:', error.message);
    process.exit(1);
  }
}

// 显示帮助信息
function showHelp() {
  console.log('🔧 构建和发布工具');
  console.log('================');
  console.log('');
  console.log('用法:');
  console.log('  node build-and-release.js                # 仅构建');
  console.log('  node build-and-release.js --publish      # 构建并发布');
  console.log('  node build-and-release.js --force        # 强制构建（忽略Git状态）');
  console.log('  node build-and-release.js --help         # 显示帮助');
  console.log('');
  console.log('示例:');
  console.log('  node build-and-release.js --publish --force');
  console.log('');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  await buildAndRelease();
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { buildAndRelease };
