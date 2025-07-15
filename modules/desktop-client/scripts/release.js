const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 发布新版本脚本
async function release() {
  try {
    console.log('🚀 开始发布新版本...');
    
    // 1. 检查是否有未提交的更改
    console.log('📋 检查Git状态...');
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        console.log('⚠️  发现未提交的更改，请先提交所有更改');
        console.log(status);
        process.exit(1);
      }
    } catch (error) {
      console.log('⚠️  Git检查失败，请确保在Git仓库中运行此脚本');
    }
    
    // 2. 读取当前版本
    const packagePath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const currentVersion = packageJson.version;
    console.log(`📦 当前版本: v${currentVersion}`);
    
    // 3. 构建应用
    console.log('🔨 开始构建应用...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ 构建完成');
    
    // 4. 发布到GitHub Releases
    console.log('📤 发布到GitHub Releases...');
    execSync('npm run build -- --publish=always', { stdio: 'inherit' });
    console.log('✅ 发布完成');
    
    console.log(`🎉 版本 v${currentVersion} 发布成功！`);
    console.log('📝 用户将在下次启动应用时收到更新提醒');
    
  } catch (error) {
    console.error('❌ 发布失败:', error.message);
    process.exit(1);
  }
}

// 更新版本号
function updateVersion(type = 'patch') {
  const packagePath = path.join(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  const [major, minor, patch] = packageJson.version.split('.').map(Number);
  
  let newVersion;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }
  
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  
  console.log(`📦 版本号已更新: v${packageJson.version} -> v${newVersion}`);
  return newVersion;
}

// 命令行参数处理
const args = process.argv.slice(2);
const command = args[0];

if (command === 'version') {
  const type = args[1] || 'patch';
  updateVersion(type);
} else if (command === 'release') {
  release();
} else {
  console.log('使用方法:');
  console.log('  node scripts/release.js version [major|minor|patch]  # 更新版本号');
  console.log('  node scripts/release.js release                      # 发布新版本');
}
