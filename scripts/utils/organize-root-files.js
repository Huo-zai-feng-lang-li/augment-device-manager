#!/usr/bin/env node

/**
 * 整理根目录文件脚本
 * 将散落在根目录的测试、调试、配置文件移动到合适的目录
 */

const fs = require('fs-extra');
const path = require('path');

// 文件分类规则
const fileCategories = {
  'scripts/debug': [
    'check-*.js',
    'debug-*.js'
  ],
  'scripts/cleanup': [
    'cleanup-*.js',
    'complete-*.js'
  ],
  'scripts/fix': [
    'fix-*.js',
    'force-*.js'
  ],
  'scripts/startup': [
    'start-*.js',
    'restart-*.js',
    'stop-*.js'
  ],
  'tests/current': [
    'test-*.js'
  ],
  'scripts/implementations': [
    'unified-*.js'
  ],
  'scripts/temp': [
    'update-*.js',
    'quick-*.js'
  ],
  'config': [
    'config.json',
    'server-info.json'
  ]
};

// 需要保留在根目录的文件和目录
const keepInRoot = [
  'README.md',
  'package.json',
  'package-lock.json',
  'modules',
  'scripts',
  'shared',
  'tests',
  'tools',
  'node_modules',
  'config',
  '.git',
  '.gitignore'
];

async function organizeFiles() {
  try {
    console.log('🧹 开始整理根目录文件...');
    
    // 获取根目录所有文件
    const rootFiles = await fs.readdir('.');
    const filesToMove = [];
    
    // 分析需要移动的文件
    for (const [targetDir, patterns] of Object.entries(fileCategories)) {
      for (const pattern of patterns) {
        const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
        
        for (const file of rootFiles) {
          const stat = await fs.stat(file);
          if (stat.isFile() && regex.test(file) && !keepInRoot.includes(file)) {
            filesToMove.push({
              file,
              targetDir,
              pattern
            });
          }
        }
      }
    }
    
    if (filesToMove.length === 0) {
      console.log('✅ 根目录已经很整洁，无需整理');
      return;
    }
    
    console.log(`📋 发现 ${filesToMove.length} 个文件需要整理:`);
    
    // 按目标目录分组显示
    const groupedFiles = {};
    for (const item of filesToMove) {
      if (!groupedFiles[item.targetDir]) {
        groupedFiles[item.targetDir] = [];
      }
      groupedFiles[item.targetDir].push(item.file);
    }
    
    for (const [dir, files] of Object.entries(groupedFiles)) {
      console.log(`  📁 ${dir}:`);
      files.forEach(file => console.log(`    - ${file}`));
    }
    
    console.log('');
    console.log('开始移动文件...');
    
    // 创建目标目录并移动文件
    let movedCount = 0;
    for (const item of filesToMove) {
      try {
        // 确保目标目录存在
        await fs.ensureDir(item.targetDir);
        
        const sourcePath = item.file;
        const targetPath = path.join(item.targetDir, item.file);
        
        // 检查目标文件是否已存在
        if (await fs.pathExists(targetPath)) {
          console.log(`⚠️  跳过 ${item.file} (目标位置已存在)`);
          continue;
        }
        
        // 移动文件
        await fs.move(sourcePath, targetPath);
        console.log(`✅ 移动 ${item.file} → ${item.targetDir}/`);
        movedCount++;
        
      } catch (error) {
        console.log(`❌ 移动 ${item.file} 失败: ${error.message}`);
      }
    }
    
    console.log('');
    console.log(`🎉 整理完成！成功移动 ${movedCount} 个文件`);
    console.log('');
    console.log('📁 文件已整理到以下目录:');
    for (const dir of Object.keys(groupedFiles)) {
      if (await fs.pathExists(dir)) {
        const files = await fs.readdir(dir);
        console.log(`  ${dir}/ (${files.length} 个文件)`);
      }
    }
    
  } catch (error) {
    console.error('❌ 整理失败:', error.message);
    process.exit(1);
  }
}

// 运行整理
organizeFiles().catch(console.error);
