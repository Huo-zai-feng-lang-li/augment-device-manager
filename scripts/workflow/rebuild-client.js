#!/usr/bin/env node

// 客户端重建工作流程
const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

console.log('🚀 客户端重建工作流程');
console.log('====================');
console.log('');

async function main() {
  try {
    // 1. 检查服务器状态
    console.log('📊 步骤 1/5: 检查服务器状态...');
    try {
      execSync('npm run server:status', { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️ 服务器状态检查失败，继续执行...');
    }
    console.log('');

    // 2. 更新配置
    console.log('🔄 步骤 2/5: 更新客户端配置...');
    try {
      execSync('npm run config:update', { stdio: 'inherit' });
    } catch (error) {
      console.error('❌ 配置更新失败:', error.message);
      process.exit(1);
    }
    console.log('');

    // 3. 验证配置
    console.log('🔍 步骤 3/5: 验证配置状态...');
    try {
      execSync('npm run config:verify', { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️ 配置验证失败，但继续执行...');
    }
    console.log('');

    // 4. 清理旧的构建文件
    console.log('🧹 步骤 4/5: 清理构建文件...');
    const clientDir = path.join(__dirname, '../../modules/desktop-client');
    const distPaths = [
      path.join(clientDir, 'dist-final'),
      path.join(clientDir, 'dist'),
      path.join(__dirname, '../../dist-output')
    ];

    for (const distPath of distPaths) {
      try {
        if (await fs.pathExists(distPath)) {
          await fs.remove(distPath);
          console.log(`   ✅ 已清理: ${path.basename(distPath)}`);
        }
      } catch (error) {
        console.log(`   ⚠️ 清理失败: ${path.basename(distPath)} (${error.message})`);
      }
    }
    console.log('');

    // 5. 重新打包
    console.log('📦 步骤 5/5: 重新打包客户端...');
    console.log('   这可能需要几分钟时间，请耐心等待...');
    console.log('');
    
    try {
      process.chdir(clientDir);
      execSync('npm run build', { stdio: 'inherit' });
      
      console.log('');
      console.log('🎉 打包完成！');
      
      // 检查打包结果
      const distFinalPath = path.join(clientDir, 'dist-final');
      if (await fs.pathExists(distFinalPath)) {
        const files = await fs.readdir(distFinalPath);
        console.log('📁 打包输出:');
        files.forEach(file => {
          console.log(`   📄 ${file}`);
        });
      }
      
    } catch (error) {
      console.error('❌ 打包失败:', error.message);
      console.log('');
      console.log('💡 可能的解决方案:');
      console.log('   1. 关闭正在运行的客户端应用');
      console.log('   2. 手动删除 modules/desktop-client/dist-final 目录');
      console.log('   3. 重新运行此命令');
      process.exit(1);
    }

    console.log('');
    console.log('✅ 工作流程完成！');
    console.log('');
    console.log('📋 下一步操作:');
    console.log('   1. 测试打包的客户端是否能正常连接');
    console.log('   2. 分发 modules/desktop-client/dist-final/ 目录下的安装包');
    console.log('   3. 用户安装后即可直接使用，无需手动配置');
    console.log('');
    console.log('🔗 相关命令:');
    console.log('   npm run server:status     # 检查服务器状态');
    console.log('   npm run config:verify     # 验证配置');
    console.log('   npm run workflow:rebuild  # 重新运行此工作流程');

  } catch (error) {
    console.error('❌ 工作流程失败:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
