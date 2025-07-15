const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * 搜索本地备份的旧设备ID
 * 找出Cursor从哪里恢复了旧ID
 */

const OLD_DEVICE_ID = '36987e70-60fe-4401-85a4-f463c269f069';

async function findLocalBackup() {
  console.log('🔍 搜索本地备份的旧设备ID');
  console.log(`目标ID: ${OLD_DEVICE_ID}`);
  console.log('==================================================');

  const results = {
    registryMatches: [],
    fileMatches: [],
    systemMatches: []
  };

  try {
    // 第1步：搜索用户目录下的所有文件
    console.log('\n📁 第1步：搜索用户目录...');
    await searchUserDirectory(results);

    // 第2步：搜索Cursor相关目录
    console.log('\n🎯 第2步：深度搜索Cursor目录...');
    await searchCursorDirectories(results);

    // 第3步：搜索系统临时目录
    console.log('\n🗂️ 第3步：搜索临时目录...');
    await searchTempDirectories(results);

    // 第4步：搜索注册表（使用PowerShell）
    console.log('\n🔧 第4步：搜索注册表...');
    await searchRegistryWithPowerShell(results);

    // 输出结果
    outputResults(results);

  } catch (error) {
    console.error('❌ 搜索失败:', error);
  }

  return results;
}

// 搜索用户目录
async function searchUserDirectory(results) {
  const userDir = os.homedir();
  const searchPaths = [
    path.join(userDir, 'AppData', 'Roaming'),
    path.join(userDir, 'AppData', 'Local'),
    path.join(userDir, 'AppData', 'LocalLow')
  ];

  for (const searchPath of searchPaths) {
    try {
      console.log(`  🔍 搜索: ${path.basename(searchPath)}`);
      await searchInDirectory(searchPath, results, 3); // 限制深度为3
    } catch (error) {
      console.log(`  ❌ 搜索失败: ${path.basename(searchPath)}`);
    }
  }
}

// 深度搜索Cursor目录
async function searchCursorDirectories(results) {
  const cursorPaths = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor'),
    path.join(os.homedir(), 'AppData', 'Local', 'Cursor'),
    'C:\\ProgramData\\Cursor',
    'C:\\Program Files\\Cursor',
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'cursor')
  ];

  for (const cursorPath of cursorPaths) {
    try {
      if (await fs.pathExists(cursorPath)) {
        console.log(`  🎯 深度搜索: ${cursorPath}`);
        await searchInDirectory(cursorPath, results, 5); // 更深的搜索
      } else {
        console.log(`  ℹ️ 不存在: ${path.basename(cursorPath)}`);
      }
    } catch (error) {
      console.log(`  ❌ 搜索失败: ${path.basename(cursorPath)}`);
    }
  }
}

// 搜索临时目录
async function searchTempDirectories(results) {
  const tempPaths = [
    os.tmpdir(),
    'C:\\Windows\\Temp',
    path.join(os.homedir(), 'AppData', 'Local', 'Temp')
  ];

  for (const tempPath of tempPaths) {
    try {
      if (await fs.pathExists(tempPath)) {
        console.log(`  🗂️ 搜索临时目录: ${tempPath}`);
        await searchInDirectory(tempPath, results, 2);
      }
    } catch (error) {
      console.log(`  ❌ 搜索失败: ${path.basename(tempPath)}`);
    }
  }
}

// 在目录中搜索
async function searchInDirectory(dirPath, results, maxDepth, currentDepth = 0) {
  if (currentDepth >= maxDepth) return;

  try {
    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
      if (item.startsWith('.') || item === 'node_modules') continue;
      
      const itemPath = path.join(dirPath, item);
      
      try {
        const stats = await fs.stat(itemPath);
        
        if (stats.isFile()) {
          // 检查文件
          await checkFile(itemPath, results);
        } else if (stats.isDirectory()) {
          // 递归搜索子目录
          await searchInDirectory(itemPath, results, maxDepth, currentDepth + 1);
        }
      } catch (statError) {
        // 无权限访问，跳过
      }
    }
  } catch (error) {
    // 目录读取失败
  }
}

// 检查文件内容
async function checkFile(filePath, results) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();
    
    // 只检查可能包含配置的文件
    if (ext === '.json' || ext === '.db' || ext === '.sqlite' || 
        ext === '.log' || ext === '.txt' || ext === '.config' ||
        ext === '.ini' || ext === '.xml' || ext === '.plist' ||
        fileName.includes('storage') || fileName.includes('config') ||
        fileName.includes('settings') || fileName.includes('cache')) {
      
      const stats = await fs.stat(filePath);
      if (stats.size > 50 * 1024 * 1024) return; // 跳过大于50MB的文件
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        if (content.includes(OLD_DEVICE_ID)) {
          console.log(`  🎯 找到匹配文件: ${filePath}`);
          results.fileMatches.push({
            path: filePath,
            size: stats.size,
            modified: stats.mtime,
            type: 'file'
          });
        }
      } catch (readError) {
        // 文件可能是二进制或无权限读取
      }
    }
  } catch (error) {
    // 文件检查失败
  }
}

// 使用PowerShell搜索注册表
async function searchRegistryWithPowerShell(results) {
  try {
    console.log('  🔧 使用PowerShell搜索注册表...');
    
    const psScript = `
      $deviceId = "${OLD_DEVICE_ID}"
      $found = @()
      
      # 搜索HKEY_CURRENT_USER
      try {
        $keys = Get-ChildItem -Path "HKCU:\\" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*Cursor*" -or $_.Name -like "*VSCode*" }
        foreach ($key in $keys) {
          try {
            $values = Get-ItemProperty -Path $key.PSPath -ErrorAction SilentlyContinue
            foreach ($value in $values.PSObject.Properties) {
              if ($value.Value -like "*$deviceId*") {
                $found += "HKCU: $($key.Name) - $($value.Name) = $($value.Value)"
              }
            }
          } catch {}
        }
      } catch {}
      
      # 搜索HKEY_LOCAL_MACHINE
      try {
        $keys = Get-ChildItem -Path "HKLM:\\" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*Cursor*" -or $_.Name -like "*VSCode*" }
        foreach ($key in $keys) {
          try {
            $values = Get-ItemProperty -Path $key.PSPath -ErrorAction SilentlyContinue
            foreach ($value in $values.PSObject.Properties) {
              if ($value.Value -like "*$deviceId*") {
                $found += "HKLM: $($key.Name) - $($value.Name) = $($value.Value)"
              }
            }
          } catch {}
        }
      } catch {}
      
      if ($found.Count -gt 0) {
        Write-Output "REGISTRY_MATCHES_FOUND:"
        $found | ForEach-Object { Write-Output $_ }
      } else {
        Write-Output "NO_REGISTRY_MATCHES"
      }
    `;
    
    const { stdout } = await execAsync(`powershell -Command "${psScript}"`);
    
    if (stdout.includes('REGISTRY_MATCHES_FOUND:')) {
      console.log('  ✅ 在注册表中找到匹配项！');
      const matches = stdout.split('\n').filter(line => 
        line.includes('HKCU:') || line.includes('HKLM:')
      );
      results.registryMatches = matches;
    } else {
      console.log('  ℹ️ 注册表中未找到匹配项');
    }
    
  } catch (error) {
    console.log('  ❌ 注册表搜索失败:', error.message);
  }
}

// 输出结果
function outputResults(results) {
  console.log('\n📋 搜索结果报告');
  console.log('==================================================');

  if (results.fileMatches.length > 0) {
    console.log(`\n📁 文件匹配 (${results.fileMatches.length} 个):`);
    results.fileMatches.forEach((match, index) => {
      console.log(`  ${index + 1}. ${match.path}`);
      console.log(`     大小: ${match.size} 字节, 修改: ${match.modified}`);
    });
  }

  if (results.registryMatches.length > 0) {
    console.log(`\n🔧 注册表匹配 (${results.registryMatches.length} 个):`);
    results.registryMatches.forEach((match, index) => {
      console.log(`  ${index + 1}. ${match}`);
    });
  }

  if (results.fileMatches.length === 0 && results.registryMatches.length === 0) {
    console.log('\n⚠️ 未找到明显的本地备份源');
    console.log('可能的原因:');
    console.log('1. 数据存储在加密或二进制文件中');
    console.log('2. 存储在我们无权访问的系统位置');
    console.log('3. 使用了特殊的存储机制');
  } else {
    console.log('\n💡 建议的下一步:');
    console.log('1. 清理找到的所有匹配文件');
    console.log('2. 删除相关的注册表项');
    console.log('3. 重新测试Cursor启动行为');
  }
}

// 主函数
if (require.main === module) {
  findLocalBackup()
    .then(results => {
      console.log('\n🎯 搜索完成！');
      
      const totalMatches = results.fileMatches.length + results.registryMatches.length;
      if (totalMatches > 0) {
        console.log(`✅ 找到 ${totalMatches} 个可能的数据源`);
      } else {
        console.log('⚠️ 未找到明显的本地数据源');
      }
    })
    .catch(error => {
      console.error('❌ 搜索失败:', error);
    });
}

module.exports = { findLocalBackup };
