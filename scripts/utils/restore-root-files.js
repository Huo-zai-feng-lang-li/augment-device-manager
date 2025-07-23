#!/usr/bin/env node

/**
 * 恢复根目录文件脚本
 * 将之前整理到子目录的文件恢复到根目录
 */

const fs = require('fs-extra');
const path = require('path');

// 需要恢复的目录和文件映射
const restoreMapping = {
  'scripts/debug': ['check-*.js', 'debug-*.js'],
  'scripts/cleanup': ['cleanup-*.js', 'complete-*.js'],
  'scripts/fix': ['fix-*.js', 'force-*.js'],
  'scripts/startup': ['start-*.js', 'restart-*.js', 'stop-*.js'],
  'tests/current': ['test-*.js', 'final-*.js'],
  'scripts/implementations': ['unified-*.js'],
  'scripts/temp': ['update-*.js', 'quick-*.js'],
  'config': ['config.json', 'server-info.json']
};

async function restoreFiles() {
  try {
    console.log('🔄 开始恢复根目录文件...');
    
    let restoredCount = 0;
    const filesToRestore = [];
    
    // 扫描需要恢复的文件
    for (const [sourceDir, patterns] of Object.entries(restoreMapping)) {
      if (!await fs.pathExists(sourceDir)) {
        continue;
      }
      
      const files = await fs.readdir(sourceDir);
      
      for (const pattern of patterns) {
        const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
        
        for (const file of files) {
          const filePath = path.join(sourceDir, file);
          const stat = await fs.stat(filePath);
          
          if (stat.isFile() && regex.test(file)) {
            filesToRestore.push({
              source: filePath,
              target: file,
              sourceDir
            });
          }
        }
      }
    }
    
    if (filesToRestore.length === 0) {
      console.log('✅ 没有需要恢复的文件');
      return;
    }
    
    console.log(`📋 发现 ${filesToRestore.length} 个文件需要恢复:`);
    
    // 按源目录分组显示
    const groupedFiles = {};
    for (const item of filesToRestore) {
      if (!groupedFiles[item.sourceDir]) {
        groupedFiles[item.sourceDir] = [];
      }
      groupedFiles[item.sourceDir].push(item.target);
    }
    
    for (const [dir, files] of Object.entries(groupedFiles)) {
      console.log(`  📁 ${dir}:`);
      files.forEach(file => console.log(`    - ${file}`));
    }
    
    console.log('');
    console.log('开始恢复文件...');
    
    // 恢复文件
    for (const item of filesToRestore) {
      try {
        // 检查根目录是否已存在同名文件
        if (await fs.pathExists(item.target)) {
          console.log(`⚠️  跳过 ${item.target} (根目录已存在)`);
          continue;
        }
        
        // 移动文件到根目录
        await fs.move(item.source, item.target);
        console.log(`✅ 恢复 ${item.target} ← ${item.sourceDir}/`);
        restoredCount++;
        
      } catch (error) {
        console.log(`❌ 恢复 ${item.target} 失败: ${error.message}`);
      }
    }
    
    console.log('');
    console.log(`🎉 恢复完成！成功恢复 ${restoredCount} 个文件到根目录`);
    
    if (restoredCount > 0) {
      console.log('');
      console.log('💡 提示: 如果需要重新整理，可以运行 npm run organize');
    }
    
  } catch (error) {
    console.error('❌ 恢复失败:', error.message);
    process.exit(1);
  }
}

// 运行恢复
restoreFiles().catch(console.error);
