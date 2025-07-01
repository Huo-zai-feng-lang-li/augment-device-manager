const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Cursor老用户问题诊断脚本
 * 帮助找出为什么清理后仍被识别为老用户
 */

async function diagnoseCursorIssue() {
  console.log('🔍 Cursor老用户问题诊断');
  console.log('==================================================');

  const diagnosis = {
    storageFiles: {},
    processes: {},
    registryInfo: {},
    networkInfo: {},
    recommendations: []
  };

  try {
    // 1. 检查存储文件状态
    console.log('\n📁 第1步：检查存储文件状态...');
    await checkStorageFiles(diagnosis);

    // 2. 检查进程状态
    console.log('\n🔄 第2步：检查Cursor进程状态...');
    await checkProcesses(diagnosis);

    // 3. 检查注册表信息
    console.log('\n🔧 第3步：检查系统注册表...');
    await checkRegistry(diagnosis);

    // 4. 检查网络相关信息
    console.log('\n🌐 第4步：检查网络信息...');
    await checkNetworkInfo(diagnosis);

    // 5. 分析问题并给出建议
    console.log('\n💡 第5步：问题分析与建议...');
    analyzeAndRecommend(diagnosis);

    // 输出诊断报告
    outputDiagnosisReport(diagnosis);

  } catch (error) {
    console.error('❌ 诊断过程出错:', error);
  }

  return diagnosis;
}

// 检查存储文件
async function checkStorageFiles(diagnosis) {
  const filesToCheck = [
    {
      name: 'storage.json',
      path: path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'storage.json'),
      critical: true
    },
    {
      name: 'state.vscdb',
      path: path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
      critical: true
    },
    {
      name: 'workspaceStorage',
      path: path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'workspaceStorage'),
      critical: false
    },
    {
      name: 'logs',
      path: path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'logs'),
      critical: false
    }
  ];

  for (const file of filesToCheck) {
    try {
      const exists = await fs.pathExists(file.path);
      const info = {
        exists,
        critical: file.critical,
        path: file.path
      };

      if (exists) {
        const stats = await fs.stat(file.path);
        info.isDirectory = stats.isDirectory();
        info.size = stats.size;
        info.modified = stats.mtime;

        // 如果是storage.json，读取内容
        if (file.name === 'storage.json') {
          try {
            const data = await fs.readJson(file.path);
            info.devDeviceId = data['telemetry.devDeviceId'];
            info.machineId = data['telemetry.machineId'];
            info.hasOldDeviceId = data['telemetry.devDeviceId'] === '36987e70-60fe-4401-85a4-f463c269f069';
          } catch (error) {
            info.readError = error.message;
          }
        }
      }

      diagnosis.storageFiles[file.name] = info;
      console.log(`  ${file.name}: ${exists ? '✅ 存在' : '❌ 不存在'}`);
      
      if (exists && file.name === 'storage.json' && info.hasOldDeviceId) {
        console.log(`    ⚠️ 警告：仍然是旧的设备ID！`);
      }

    } catch (error) {
      diagnosis.storageFiles[file.name] = { error: error.message };
      console.log(`  ${file.name}: ❌ 检查失败 - ${error.message}`);
    }
  }
}

// 检查进程状态
async function checkProcesses(diagnosis) {
  try {
    const { stdout } = await execAsync('tasklist /fi "imagename eq Cursor.exe" /fo csv');
    const lines = stdout.split('\n').filter(line => line.includes('Cursor.exe'));
    
    diagnosis.processes.cursorRunning = lines.length > 0;
    diagnosis.processes.processCount = lines.length;
    diagnosis.processes.details = lines;

    console.log(`  Cursor进程: ${lines.length > 0 ? '🟢 运行中' : '⚪ 未运行'}`);
    if (lines.length > 0) {
      console.log(`    进程数量: ${lines.length}`);
    }

  } catch (error) {
    diagnosis.processes.error = error.message;
    console.log(`  进程检查失败: ${error.message}`);
  }
}

// 检查注册表
async function checkRegistry(diagnosis) {
  try {
    const { stdout } = await execAsync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid');
    const match = stdout.match(/MachineGuid\s+REG_SZ\s+(.+)/);
    
    if (match) {
      diagnosis.registryInfo.machineGuid = match[1].trim();
      console.log(`  系统MachineGuid: ${diagnosis.registryInfo.machineGuid}`);
    }

  } catch (error) {
    diagnosis.registryInfo.error = error.message;
    console.log(`  注册表检查失败: ${error.message}`);
  }
}

// 检查网络信息
async function checkNetworkInfo(diagnosis) {
  try {
    // 获取网络接口信息
    const interfaces = os.networkInterfaces();
    const physicalInterfaces = {};
    
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (addrs && Array.isArray(addrs)) {
        const physicalAddr = addrs.find(addr => 
          addr.mac && addr.mac !== '00:00:00:00:00:00' && !addr.internal
        );
        if (physicalAddr) {
          physicalInterfaces[name] = physicalAddr.mac;
        }
      }
    }

    diagnosis.networkInfo.interfaces = physicalInterfaces;
    diagnosis.networkInfo.hostname = os.hostname();
    
    console.log(`  主机名: ${diagnosis.networkInfo.hostname}`);
    console.log(`  物理网卡数量: ${Object.keys(physicalInterfaces).length}`);

  } catch (error) {
    diagnosis.networkInfo.error = error.message;
    console.log(`  网络信息检查失败: ${error.message}`);
  }
}

// 分析问题并给出建议
function analyzeAndRecommend(diagnosis) {
  const recommendations = [];

  // 检查是否有旧的设备ID
  if (diagnosis.storageFiles['storage.json']?.hasOldDeviceId) {
    recommendations.push({
      priority: 'HIGH',
      issue: '仍然使用旧的设备ID',
      solution: '需要重新生成storage.json文件'
    });
  }

  // 检查进程是否在运行
  if (diagnosis.processes.cursorRunning) {
    recommendations.push({
      priority: 'HIGH',
      issue: 'Cursor进程仍在运行',
      solution: '清理前必须完全关闭Cursor进程'
    });
  }

  // 检查关键文件是否存在
  if (diagnosis.storageFiles['state.vscdb']?.exists) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: 'state.vscdb数据库文件仍存在',
      solution: '需要清理SQLite数据库中的扩展数据'
    });
  }

  // 检查工作区存储
  if (diagnosis.storageFiles['workspaceStorage']?.exists) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: '工作区存储仍存在',
      solution: '需要清理所有工作区的存储数据'
    });
  }

  diagnosis.recommendations = recommendations;

  console.log('\n🎯 发现的问题:');
  recommendations.forEach((rec, index) => {
    const priority = rec.priority === 'HIGH' ? '🔴' : '🟡';
    console.log(`  ${index + 1}. ${priority} ${rec.issue}`);
    console.log(`     解决方案: ${rec.solution}`);
  });
}

// 输出诊断报告
function outputDiagnosisReport(diagnosis) {
  console.log('\n📋 详细诊断报告');
  console.log('==================================================');

  // 存储文件状态
  console.log('\n📁 存储文件状态:');
  Object.entries(diagnosis.storageFiles).forEach(([name, info]) => {
    console.log(`  ${name}:`);
    console.log(`    存在: ${info.exists ? '是' : '否'}`);
    if (info.exists) {
      console.log(`    类型: ${info.isDirectory ? '目录' : '文件'}`);
      console.log(`    修改时间: ${info.modified}`);
      if (info.devDeviceId) {
        console.log(`    设备ID: ${info.devDeviceId}`);
        console.log(`    是否为旧ID: ${info.hasOldDeviceId ? '是' : '否'}`);
      }
    }
  });

  // 进程状态
  console.log('\n🔄 进程状态:');
  console.log(`  Cursor运行中: ${diagnosis.processes.cursorRunning ? '是' : '否'}`);
  if (diagnosis.processes.cursorRunning) {
    console.log(`  进程数量: ${diagnosis.processes.processCount}`);
  }

  // 系统信息
  console.log('\n🔧 系统信息:');
  if (diagnosis.registryInfo.machineGuid) {
    console.log(`  MachineGuid: ${diagnosis.registryInfo.machineGuid}`);
  }
  console.log(`  主机名: ${diagnosis.networkInfo.hostname}`);

  // 建议操作
  if (diagnosis.recommendations.length > 0) {
    console.log('\n💡 建议的解决步骤:');
    diagnosis.recommendations
      .sort((a, b) => a.priority === 'HIGH' ? -1 : 1)
      .forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec.solution}`);
      });
  } else {
    console.log('\n✅ 未发现明显问题，可能是网络端识别或其他因素');
  }
}

// 主函数
if (require.main === module) {
  diagnoseCursorIssue()
    .then(diagnosis => {
      console.log('\n🎯 诊断完成！');
      if (diagnosis.recommendations.length > 0) {
        console.log('请按照建议的步骤进行处理。');
      } else {
        console.log('如果问题仍然存在，可能需要考虑网络环境或硬件指纹的影响。');
      }
    })
    .catch(error => {
      console.error('❌ 诊断失败:', error);
    });
}

module.exports = { diagnoseCursorIssue };
