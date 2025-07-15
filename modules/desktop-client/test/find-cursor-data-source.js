const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * 深度搜索Cursor数据恢复的源头
 * 找出旧设备ID存储在哪里
 */

async function findCursorDataSource() {
  console.log('🔍 深度搜索Cursor数据源');
  console.log('==================================================');

  const oldDeviceId = '36987e70-60fe-4401-85a4-f463c269f069';
  const results = {
    registryMatches: [],
    fileMatches: [],
    networkSources: [],
    recommendations: []
  };

  try {
    // 第1步：搜索注册表
    console.log('\n🔧 第1步：搜索Windows注册表...');
    await searchRegistry(oldDeviceId, results);

    // 第2步：搜索文件系统
    console.log('\n📁 第2步：搜索文件系统...');
    await searchFileSystem(oldDeviceId, results);

    // 第3步：检查网络相关
    console.log('\n🌐 第3步：检查网络数据源...');
    await checkNetworkSources(results);

    // 第4步：分析结果并给出建议
    console.log('\n💡 第4步：分析结果...');
    analyzeResults(results);

    // 输出详细报告
    outputDetailedReport(results);

  } catch (error) {
    console.error('❌ 搜索失败:', error);
  }

  return results;
}

// 搜索注册表
async function searchRegistry(oldDeviceId, results) {
  const registryPaths = [
    'HKEY_CURRENT_USER\\Software\\Cursor',
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\Cursor',
    'HKEY_CURRENT_USER\\Software\\Microsoft\\VSCode',
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography',
    'HKEY_CURRENT_USER\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel'
  ];

  for (const regPath of registryPaths) {
    try {
      console.log(`  🔍 搜索: ${regPath}`);
      
      // 搜索注册表项
      const { stdout } = await execAsync(`reg query "${regPath}" /s /f "${oldDeviceId}" 2>nul`);
      
      if (stdout && stdout.trim()) {
        console.log(`  ✅ 在注册表中找到匹配项！`);
        results.registryMatches.push({
          path: regPath,
          content: stdout.trim()
        });
      }
      
    } catch (error) {
      // 注册表项不存在或无权限，继续搜索
      console.log(`  ℹ️ ${regPath} - 未找到或无权限`);
    }
  }

  // 特别搜索Cursor相关的注册表项
  try {
    console.log('  🔍 搜索所有Cursor相关注册表项...');
    const { stdout } = await execAsync('reg query HKEY_CURRENT_USER\\Software /s /f "Cursor" 2>nul');
    
    if (stdout && stdout.includes(oldDeviceId)) {
      console.log('  🚨 在Cursor注册表项中发现旧设备ID！');
      results.registryMatches.push({
        path: 'HKEY_CURRENT_USER\\Software\\Cursor*',
        content: '包含旧设备ID的注册表项'
      });
    }
  } catch (error) {
    console.log('  ℹ️ Cursor注册表搜索完成');
  }
}

// 搜索文件系统
async function searchFileSystem(oldDeviceId, results) {
  const searchPaths = [
    // Cursor相关目录
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor'),
    path.join(os.homedir(), 'AppData', 'Local', 'Cursor'),
    
    // 可能的备份位置
    path.join(os.homedir(), 'AppData', 'Local', 'Microsoft'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft'),
    
    // 临时文件
    os.tmpdir(),
    
    // 系统目录（如果有权限）
    'C:\\ProgramData\\Cursor'
  ];

  for (const searchPath of searchPaths) {
    try {
      if (await fs.pathExists(searchPath)) {
        console.log(`  🔍 搜索目录: ${searchPath}`);
        await searchInDirectory(searchPath, oldDeviceId, results);
      } else {
        console.log(`  ℹ️ 目录不存在: ${path.basename(searchPath)}`);
      }
    } catch (error) {
      console.log(`  ❌ 搜索失败: ${path.basename(searchPath)} - ${error.message}`);
    }
  }
}

// 在目录中搜索
async function searchInDirectory(dirPath, oldDeviceId, results) {
  try {
    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      
      try {
        const stats = await fs.stat(itemPath);
        
        if (stats.isFile()) {
          // 检查文件内容
          if (item.endsWith('.json') || item.endsWith('.db') || item.endsWith('.sqlite') || 
              item.endsWith('.log') || item.endsWith('.txt') || item.endsWith('.config')) {
            
            try {
              const content = await fs.readFile(itemPath, 'utf8');
              if (content.includes(oldDeviceId)) {
                console.log(`  🎯 找到匹配文件: ${itemPath}`);
                results.fileMatches.push({
                  path: itemPath,
                  type: 'file',
                  size: stats.size,
                  modified: stats.mtime
                });
              }
            } catch (readError) {
              // 文件可能是二进制或无权限读取
            }
          }
        } else if (stats.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          // 递归搜索子目录（限制深度）
          if (dirPath.split(path.sep).length < 8) {
            await searchInDirectory(itemPath, oldDeviceId, results);
          }
        }
      } catch (statError) {
        // 无权限访问，跳过
      }
    }
  } catch (error) {
    // 目录读取失败
  }
}

// 检查网络数据源
async function checkNetworkSources(results) {
  try {
    // 检查是否有活跃的网络连接
    console.log('  🌐 检查网络连接状态...');
    
    // 检查Cursor相关的网络进程
    try {
      const { stdout } = await execAsync('netstat -an | findstr :443');
      if (stdout) {
        console.log('  ✅ 检测到HTTPS连接，可能存在网络同步');
        results.networkSources.push('检测到活跃的HTTPS连接');
      }
    } catch (error) {
      console.log('  ℹ️ 网络连接检查完成');
    }

    // 检查DNS缓存中的Cursor相关域名
    try {
      const { stdout } = await execAsync('ipconfig /displaydns | findstr cursor');
      if (stdout) {
        console.log('  ✅ DNS缓存中发现Cursor相关域名');
        results.networkSources.push('DNS缓存包含Cursor域名');
      }
    } catch (error) {
      console.log('  ℹ️ DNS缓存检查完成');
    }

  } catch (error) {
    console.log('  ❌ 网络检查失败:', error.message);
  }
}

// 分析结果
function analyzeResults(results) {
  console.log('\n🎯 分析结果:');
  
  if (results.registryMatches.length > 0) {
    console.log(`  🔴 注册表匹配: ${results.registryMatches.length} 项`);
    results.recommendations.push({
      priority: 'HIGH',
      action: '清理注册表中的Cursor数据',
      reason: '在注册表中发现旧设备ID'
    });
  }

  if (results.fileMatches.length > 0) {
    console.log(`  🔴 文件匹配: ${results.fileMatches.length} 个`);
    results.recommendations.push({
      priority: 'HIGH', 
      action: '删除包含旧设备ID的文件',
      reason: '在文件系统中发现旧设备ID'
    });
  }

  if (results.networkSources.length > 0) {
    console.log(`  🟡 网络源: ${results.networkSources.length} 个`);
    results.recommendations.push({
      priority: 'MEDIUM',
      action: '断开网络连接后重试',
      reason: '可能存在网络同步机制'
    });
  }

  if (results.registryMatches.length === 0 && results.fileMatches.length === 0) {
    console.log('  🟡 未找到明显的本地数据源');
    results.recommendations.push({
      priority: 'HIGH',
      action: '可能是网络同步或内存缓存',
      reason: '本地未找到数据源，可能来自服务端'
    });
  }
}

// 输出详细报告
function outputDetailedReport(results) {
  console.log('\n📋 详细搜索报告');
  console.log('==================================================');

  if (results.registryMatches.length > 0) {
    console.log('\n🔧 注册表匹配项:');
    results.registryMatches.forEach((match, index) => {
      console.log(`  ${index + 1}. ${match.path}`);
    });
  }

  if (results.fileMatches.length > 0) {
    console.log('\n📁 文件匹配项:');
    results.fileMatches.forEach((match, index) => {
      console.log(`  ${index + 1}. ${match.path}`);
      console.log(`     大小: ${match.size} 字节`);
      console.log(`     修改时间: ${match.modified}`);
    });
  }

  if (results.networkSources.length > 0) {
    console.log('\n🌐 网络数据源:');
    results.networkSources.forEach((source, index) => {
      console.log(`  ${index + 1}. ${source}`);
    });
  }

  console.log('\n💡 推荐的解决方案:');
  results.recommendations
    .sort((a, b) => a.priority === 'HIGH' ? -1 : 1)
    .forEach((rec, index) => {
      const priority = rec.priority === 'HIGH' ? '🔴' : '🟡';
      console.log(`  ${index + 1}. ${priority} ${rec.action}`);
      console.log(`     原因: ${rec.reason}`);
    });
}

// 主函数
if (require.main === module) {
  findCursorDataSource()
    .then(results => {
      console.log('\n🎯 搜索完成！');
      
      if (results.registryMatches.length > 0 || results.fileMatches.length > 0) {
        console.log('✅ 找到了可能的数据源，请按照建议进行清理');
      } else {
        console.log('⚠️ 未找到明显的本地数据源，可能是网络同步机制');
      }
    })
    .catch(error => {
      console.error('❌ 搜索失败:', error);
    });
}

module.exports = { findCursorDataSource };
