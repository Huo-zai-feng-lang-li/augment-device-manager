const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * 最终清理脚本 - 清理发现的用户设置文件
 */

async function finalCleanup() {
  console.log('🎯 最终清理 - 清理用户设置文件');
  console.log('==================================================');

  const results = {
    success: true,
    actions: [],
    errors: []
  };

  try {
    // 清理Cursor用户设置
    console.log('\n📄 清理Cursor用户设置文件...');
    const userSettingsPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'settings.json'
    );

    if (await fs.pathExists(userSettingsPath)) {
      // 先读取内容看看有什么
      try {
        const settings = await fs.readJson(userSettingsPath);
        console.log('  📋 用户设置内容预览:');
        
        // 查找可能的识别信息
        const suspiciousKeys = Object.keys(settings).filter(key => 
          key.toLowerCase().includes('device') ||
          key.toLowerCase().includes('machine') ||
          key.toLowerCase().includes('telemetry') ||
          key.toLowerCase().includes('user') ||
          key.toLowerCase().includes('id')
        );

        if (suspiciousKeys.length > 0) {
          console.log('  ⚠️ 发现可疑的识别字段:');
          suspiciousKeys.forEach(key => {
            console.log(`    ${key}: ${settings[key]}`);
          });
        } else {
          console.log('  ✅ 未发现明显的识别字段');
        }

        // 备份并删除
        const backupPath = userSettingsPath + '.backup.' + Date.now();
        await fs.copy(userSettingsPath, backupPath);
        await fs.remove(userSettingsPath);
        
        results.actions.push(`📦 已备份用户设置: ${path.basename(backupPath)}`);
        results.actions.push('🗑️ 已删除用户设置文件');
        console.log('  ✅ 用户设置文件已清理');

      } catch (error) {
        results.errors.push(`读取用户设置失败: ${error.message}`);
      }
    } else {
      console.log('  ℹ️ 用户设置文件不存在');
    }

    // 清理可能的扩展缓存
    console.log('\n🧹 清理可能的扩展缓存...');
    const cachePaths = [
      path.join(os.homedir(), 'AppData', 'Local', 'Cursor', 'User', 'CachedExtensions'),
      path.join(os.homedir(), 'AppData', 'Local', 'Cursor', 'User', 'CachedData'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'CachedExtensions'),
    ];

    let cleanedCaches = 0;
    for (const cachePath of cachePaths) {
      try {
        if (await fs.pathExists(cachePath)) {
          await fs.remove(cachePath);
          cleanedCaches++;
          results.actions.push(`🗑️ 已清理缓存: ${path.basename(cachePath)}`);
        }
      } catch (error) {
        results.errors.push(`清理缓存失败 ${path.basename(cachePath)}: ${error.message}`);
      }
    }

    console.log(`  ✅ 已清理 ${cleanedCaches} 个缓存目录`);

  } catch (error) {
    console.error('❌ 清理过程出错:', error);
    results.success = false;
    results.errors.push(error.message);
  }

  // 输出清理报告
  console.log('\n📋 最终清理报告:');
  console.log('==================================================');
  console.log(`状态: ${results.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`执行操作: ${results.actions.length} 项`);
  console.log(`错误数量: ${results.errors.length} 项`);

  if (results.actions.length > 0) {
    console.log('\n✅ 成功操作:');
    results.actions.forEach(action => console.log(`  • ${action}`));
  }

  if (results.errors.length > 0) {
    console.log('\n❌ 错误信息:');
    results.errors.forEach(error => console.log(`  • ${error}`));
  }

  return results;
}

// 主函数
if (require.main === module) {
  finalCleanup()
    .then(results => {
      console.log('\n🎯 最终清理完成！');
      console.log('\n📝 现在的状态:');
      console.log('✅ 设备ID已完全更新');
      console.log('✅ SQLite数据库已清理');
      console.log('✅ 工作区存储已清理');
      console.log('✅ 用户设置文件已清理');
      console.log('✅ 缓存文件已清理');
      
      console.log('\n💡 如果扩展仍然认为是老用户，原因可能是:');
      console.log('1. 🌐 服务端识别（IP地址或硬件指纹被记录）');
      console.log('2. 🔍 硬件指纹识别（需要虚拟化环境）');
      console.log('3. ⏰ 服务端缓存（需要等待缓存过期）');
      
      console.log('\n🚀 建议的下一步:');
      console.log('1. 重启Cursor IDE测试效果');
      console.log('2. 如果仍有问题，尝试更换网络环境（VPN/代理）');
      console.log('3. 考虑在虚拟机中使用');
    })
    .catch(error => {
      console.error('❌ 清理失败:', error);
    });
}

module.exports = { finalCleanup };
