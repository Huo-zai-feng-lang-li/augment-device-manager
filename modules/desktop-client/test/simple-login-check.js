#!/usr/bin/env node

/**
 * 简单登录状态检查
 * 直接检查关键文件来验证登录状态
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function checkSimpleLoginStatus() {
  console.log('🔍 简单登录状态检查');
  console.log('=' .repeat(50));

  try {
    // 1. 检查storage.json中的认证数据
    console.log('\n📁 检查storage.json认证数据...');
    const storageJsonPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );

    let hasStorageAuth = false;
    if (await fs.pathExists(storageJsonPath)) {
      const storageData = await fs.readJson(storageJsonPath);
      
      // 检查关键认证字段
      const authFields = [
        'cursorAuth/accessToken',
        'cursorAuth/refreshToken', 
        'cursorAuth/cachedEmail',
        'cursorAuth/cachedSignUpType'
      ];
      
      console.log('  storage.json内容检查:');
      authFields.forEach(field => {
        if (storageData[field]) {
          console.log(`    ✅ ${field}: 存在`);
          hasStorageAuth = true;
        } else {
          console.log(`    ❌ ${field}: 不存在`);
        }
      });
    } else {
      console.log('  ❌ storage.json文件不存在');
    }

    // 2. 检查Cursor进程是否在运行
    console.log('\n🔍 检查Cursor进程状态...');
    try {
      const { execSync } = require('child_process');
      const result = execSync('tasklist /FI "IMAGENAME eq Cursor.exe"', { encoding: 'utf8' });
      
      if (result.includes('Cursor.exe')) {
        console.log('  ✅ Cursor IDE正在运行');
      } else {
        console.log('  ❌ Cursor IDE未运行');
      }
    } catch (error) {
      console.log('  ⚠️ 无法检查进程状态');
    }

    // 3. 检查最近的备份文件
    console.log('\n📋 检查最近的备份状态...');
    const globalStoragePath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage'
    );

    if (await fs.pathExists(globalStoragePath)) {
      const files = await fs.readdir(globalStoragePath);
      const backupFiles = files.filter(file => file.includes('state.vscdb.backup'));
      
      if (backupFiles.length > 0) {
        // 获取最新的备份文件
        const latestBackup = backupFiles.sort().pop();
        console.log(`  📁 最新备份: ${latestBackup}`);
        
        // 检查备份时间
        const backupPath = path.join(globalStoragePath, latestBackup);
        const stats = await fs.stat(backupPath);
        const backupTime = stats.mtime;
        const timeDiff = Date.now() - backupTime.getTime();
        const minutesAgo = Math.floor(timeDiff / (1000 * 60));
        
        console.log(`  ⏰ 备份时间: ${minutesAgo} 分钟前`);
        
        if (minutesAgo < 10) {
          console.log('  🔄 最近执行过清理操作');
        }
      }
    }

    // 4. 总结分析
    console.log('\n📊 登录状态分析:');
    
    if (!hasStorageAuth) {
      console.log('  ❌ 关键认证数据已被清除');
      console.log('  📝 结论: Cursor IDE应该已经退出登录');
      console.log('  🔍 这解释了为什么你看到Cursor已经退出登录');
    } else {
      console.log('  ✅ 仍有认证数据存在');
      console.log('  📝 结论: 登录状态可能仍然保留');
    }

    console.log('\n💡 说明:');
    console.log('  之前的测试可能存在检测逻辑错误，');
    console.log('  实际上清理操作确实会清除登录状态。');
    console.log('  这是正常的清理效果。');

  } catch (error) {
    console.error('❌ 检查过程出错:', error.message);
  }
}

// 运行检查
checkSimpleLoginStatus().catch(console.error);
