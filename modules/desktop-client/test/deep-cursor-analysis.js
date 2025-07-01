const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * 深度分析Cursor扩展识别机制
 * 找出为什么设备ID更新后仍被识别为老用户
 */

async function deepCursorAnalysis() {
  console.log('🔬 深度分析Cursor扩展识别机制');
  console.log('==================================================');

  const analysis = {
    storageAnalysis: {},
    systemAnalysis: {},
    networkAnalysis: {},
    possibleCauses: []
  };

  try {
    // 1. 详细分析storage.json内容
    console.log('\n📄 第1步：详细分析storage.json内容...');
    await analyzeStorageJson(analysis);

    // 2. 检查可能的其他存储位置
    console.log('\n📁 第2步：检查其他可能的存储位置...');
    await checkOtherStorageLocations(analysis);

    // 3. 分析系统级别标识
    console.log('\n🔧 第3步：分析系统级别标识...');
    await analyzeSystemIdentifiers(analysis);

    // 4. 检查网络和硬件指纹
    console.log('\n🌐 第4步：检查网络和硬件指纹...');
    await analyzeHardwareFingerprint(analysis);

    // 5. 分析可能的原因
    console.log('\n💡 第5步：分析可能的原因...');
    analyzePossibleCauses(analysis);

    // 输出详细分析报告
    outputAnalysisReport(analysis);

  } catch (error) {
    console.error('❌ 分析过程出错:', error);
  }

  return analysis;
}

// 分析storage.json内容
async function analyzeStorageJson(analysis) {
  try {
    const storageJsonPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );

    if (await fs.pathExists(storageJsonPath)) {
      const data = await fs.readJson(storageJsonPath);
      
      // 提取所有遥测相关字段
      const telemetryFields = {};
      Object.keys(data).forEach(key => {
        if (key.includes('telemetry') || key.includes('device') || key.includes('machine')) {
          telemetryFields[key] = data[key];
        }
      });

      analysis.storageAnalysis = {
        exists: true,
        allFields: Object.keys(data).length,
        telemetryFields: telemetryFields,
        telemetryCount: Object.keys(telemetryFields).length,
        currentDeviceId: data['telemetry.devDeviceId'],
        isOldDeviceId: data['telemetry.devDeviceId'] === '36987e70-60fe-4401-85a4-f463c269f069'
      };

      console.log(`  ✅ storage.json存在，包含 ${Object.keys(data).length} 个字段`);
      console.log(`  📊 遥测相关字段: ${Object.keys(telemetryFields).length} 个`);
      console.log(`  🆔 当前设备ID: ${data['telemetry.devDeviceId']}`);
      console.log(`  ⚠️ 是否为旧ID: ${analysis.storageAnalysis.isOldDeviceId ? '是' : '否'}`);

      // 显示所有遥测字段
      console.log('\n  📋 所有遥测字段:');
      Object.entries(telemetryFields).forEach(([key, value]) => {
        console.log(`    ${key}: ${value}`);
      });

    } else {
      analysis.storageAnalysis = { exists: false };
      console.log('  ❌ storage.json不存在');
    }

  } catch (error) {
    analysis.storageAnalysis = { error: error.message };
    console.log(`  ❌ 分析失败: ${error.message}`);
  }
}

// 检查其他存储位置
async function checkOtherStorageLocations(analysis) {
  const locationsToCheck = [
    {
      name: 'Cursor扩展存储',
      path: path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'augmentcode.augment')
    },
    {
      name: 'Cursor用户设置',
      path: path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'settings.json')
    },
    {
      name: 'Cursor机器设置',
      path: path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'Machine', 'settings.json')
    },
    {
      name: 'Windows注册表缓存',
      path: path.join(os.homedir(), 'AppData', 'Local', 'Cursor', 'User', 'CachedData')
    }
  ];

  analysis.otherLocations = {};

  for (const location of locationsToCheck) {
    try {
      const exists = await fs.pathExists(location.path);
      analysis.otherLocations[location.name] = {
        exists,
        path: location.path
      };

      if (exists) {
        const stats = await fs.stat(location.path);
        analysis.otherLocations[location.name].isDirectory = stats.isDirectory();
        analysis.otherLocations[location.name].modified = stats.mtime;

        // 如果是文件，尝试读取内容
        if (!stats.isDirectory() && location.name.includes('settings')) {
          try {
            const content = await fs.readJson(location.path);
            analysis.otherLocations[location.name].hasDeviceInfo = 
              JSON.stringify(content).includes('device') || 
              JSON.stringify(content).includes('machine') ||
              JSON.stringify(content).includes('telemetry');
          } catch (error) {
            // 忽略JSON解析错误
          }
        }
      }

      console.log(`  ${location.name}: ${exists ? '✅ 存在' : '❌ 不存在'}`);
      
    } catch (error) {
      analysis.otherLocations[location.name] = { error: error.message };
      console.log(`  ${location.name}: ❌ 检查失败`);
    }
  }
}

// 分析系统级别标识
async function analyzeSystemIdentifiers(analysis) {
  try {
    // 获取网络接口信息
    const interfaces = os.networkInterfaces();
    const macAddresses = [];
    
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (addrs && Array.isArray(addrs)) {
        const physicalAddr = addrs.find(addr => 
          addr.mac && addr.mac !== '00:00:00:00:00:00' && !addr.internal
        );
        if (physicalAddr) {
          macAddresses.push(physicalAddr.mac);
        }
      }
    }

    analysis.systemAnalysis = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      macAddresses: macAddresses,
      cpuModel: os.cpus()[0]?.model || 'Unknown',
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
      username: os.userInfo().username
    };

    console.log(`  🖥️ 主机名: ${analysis.systemAnalysis.hostname}`);
    console.log(`  💻 平台: ${analysis.systemAnalysis.platform}`);
    console.log(`  🔧 架构: ${analysis.systemAnalysis.arch}`);
    console.log(`  🌐 MAC地址数量: ${macAddresses.length}`);
    console.log(`  ⚙️ CPU: ${analysis.systemAnalysis.cpuModel}`);
    console.log(`  💾 内存: ${analysis.systemAnalysis.totalMemory}`);
    console.log(`  👤 用户名: ${analysis.systemAnalysis.username}`);

  } catch (error) {
    analysis.systemAnalysis = { error: error.message };
    console.log(`  ❌ 系统分析失败: ${error.message}`);
  }
}

// 分析硬件指纹
async function analyzeHardwareFingerprint(analysis) {
  try {
    // 生成硬件指纹（类似Cursor可能使用的方式）
    const hardwareInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().map(cpu => cpu.model).join(''),
      totalmem: os.totalmem(),
      username: os.userInfo().username,
      networkInterfaces: JSON.stringify(os.networkInterfaces())
    };

    const crypto = require('crypto');
    const hardwareFingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify(hardwareInfo))
      .digest('hex');

    analysis.networkAnalysis = {
      hardwareFingerprint: hardwareFingerprint,
      fingerprintComponents: Object.keys(hardwareInfo),
      isStableFingerprint: true // 这个指纹相对稳定，不会因为清理而改变
    };

    console.log(`  🔍 硬件指纹: ${hardwareFingerprint.substring(0, 32)}...`);
    console.log(`  📊 指纹组件: ${Object.keys(hardwareInfo).length} 个`);
    console.log(`  ⚠️ 指纹稳定性: 高（不会因清理而改变）`);

  } catch (error) {
    analysis.networkAnalysis = { error: error.message };
    console.log(`  ❌ 硬件指纹分析失败: ${error.message}`);
  }
}

// 分析可能的原因
function analyzePossibleCauses(analysis) {
  const causes = [];

  // 检查设备ID是否为旧ID
  if (analysis.storageAnalysis.isOldDeviceId) {
    causes.push({
      priority: 'HIGH',
      cause: '设备ID仍然是旧ID',
      explanation: 'storage.json中的devDeviceId仍然是原始的老用户ID',
      solution: '重新执行设备ID更新'
    });
  }

  // 检查硬件指纹
  if (analysis.networkAnalysis.isStableFingerprint) {
    causes.push({
      priority: 'HIGH',
      cause: '硬件指纹未改变',
      explanation: 'Cursor扩展可能使用硬件指纹识别，这个不会因为清理而改变',
      solution: '需要配合虚拟化环境或网络代理'
    });
  }

  // 检查其他存储位置
  const hasOtherStorage = Object.values(analysis.otherLocations || {}).some(loc => loc.exists);
  if (hasOtherStorage) {
    causes.push({
      priority: 'MEDIUM',
      cause: '其他存储位置仍有数据',
      explanation: '可能有其他配置文件或缓存包含用户识别信息',
      solution: '清理所有相关的配置和缓存文件'
    });
  }

  // 如果设备ID已更新但仍被识别为老用户
  if (!analysis.storageAnalysis.isOldDeviceId && analysis.storageAnalysis.currentDeviceId) {
    causes.push({
      priority: 'HIGH',
      cause: '服务端识别机制',
      explanation: '设备ID已更新，但扩展可能使用服务端的用户识别机制',
      solution: '可能需要更换网络环境或等待服务端缓存过期'
    });
  }

  analysis.possibleCauses = causes;

  console.log(`\n🎯 发现 ${causes.length} 个可能的原因:`);
  causes.forEach((cause, index) => {
    const priority = cause.priority === 'HIGH' ? '🔴' : '🟡';
    console.log(`  ${index + 1}. ${priority} ${cause.cause}`);
    console.log(`     原因: ${cause.explanation}`);
    console.log(`     解决方案: ${cause.solution}`);
  });
}

// 输出分析报告
function outputAnalysisReport(analysis) {
  console.log('\n📋 深度分析报告');
  console.log('==================================================');

  // 当前状态总结
  console.log('\n📊 当前状态总结:');
  if (analysis.storageAnalysis.currentDeviceId) {
    console.log(`  设备ID: ${analysis.storageAnalysis.currentDeviceId}`);
    console.log(`  是否为旧ID: ${analysis.storageAnalysis.isOldDeviceId ? '是' : '否'}`);
  }
  
  if (analysis.networkAnalysis.hardwareFingerprint) {
    console.log(`  硬件指纹: ${analysis.networkAnalysis.hardwareFingerprint.substring(0, 32)}...`);
  }

  // 关键发现
  console.log('\n🔍 关键发现:');
  if (analysis.storageAnalysis.isOldDeviceId) {
    console.log('  ❌ 设备ID仍然是旧的老用户ID');
  } else if (analysis.storageAnalysis.currentDeviceId) {
    console.log('  ✅ 设备ID已更新为新ID');
  }

  console.log('  ⚠️ 硬件指纹保持不变（这是正常的）');

  // 推荐的解决方案
  if (analysis.possibleCauses.length > 0) {
    console.log('\n💡 推荐的解决方案:');
    const highPriorityCauses = analysis.possibleCauses.filter(c => c.priority === 'HIGH');
    highPriorityCauses.forEach((cause, index) => {
      console.log(`  ${index + 1}. ${cause.solution}`);
    });
  }
}

// 主函数
if (require.main === module) {
  deepCursorAnalysis()
    .then(analysis => {
      console.log('\n🎯 深度分析完成！');
      
      if (analysis.storageAnalysis.isOldDeviceId) {
        console.log('\n⚠️ 发现问题：设备ID仍然是旧ID，需要重新清理');
      } else if (analysis.possibleCauses.some(c => c.cause.includes('服务端'))) {
        console.log('\n💡 可能是服务端识别问题，建议尝试更换网络环境');
      } else {
        console.log('\n✅ 本地清理看起来正常，问题可能在其他地方');
      }
    })
    .catch(error => {
      console.error('❌ 分析失败:', error);
    });
}

module.exports = { deepCursorAnalysis };
