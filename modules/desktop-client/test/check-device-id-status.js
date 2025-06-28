const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// 检查当前设备ID状态
async function checkDeviceIdStatus() {
  console.log('🔍 检查设备ID状态');
  console.log('==================================================');

  try {
    // 检查storage.json中的设备ID
    const storageJsonPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );

    console.log('\n📊 第1步：检查storage.json中的设备ID...');
    
    if (await fs.pathExists(storageJsonPath)) {
      const data = await fs.readJson(storageJsonPath);
      
      console.log('  关键设备标识:');
      console.log(`    telemetry.devDeviceId: ${data['telemetry.devDeviceId'] || '❌ 未设置'}`);
      console.log(`    telemetry.machineId: ${data['telemetry.machineId'] ? data['telemetry.machineId'].substring(0, 16) + '...' : '❌ 未设置'}`);
      console.log(`    telemetry.macMachineId: ${data['telemetry.macMachineId'] ? data['telemetry.macMachineId'].substring(0, 16) + '...' : '❌ 未设置'}`);
      console.log(`    telemetry.sqmId: ${data['telemetry.sqmId'] || '❌ 未设置'}`);
      
      // 检查是否是老的设备ID
      const oldDeviceId = '36987e70-60fe-4401-85a4-f463c269f069';
      const currentDeviceId = data['telemetry.devDeviceId'];
      
      if (currentDeviceId === oldDeviceId) {
        console.log('\n⚠️ 警告：检测到老的设备ID！');
        console.log('  这可能是Augment扩展认为是老用户的原因');
      } else if (currentDeviceId) {
        console.log('\n✅ 设备ID已更新，不是老的ID');
      } else {
        console.log('\n❌ 设备ID未设置');
      }
      
      // 检查时间戳
      console.log('\n  时间戳信息:');
      console.log(`    telemetry.firstSessionDate: ${data['telemetry.firstSessionDate'] || '❌ 未设置'}`);
      console.log(`    telemetry.currentSessionDate: ${data['telemetry.currentSessionDate'] || '❌ 未设置'}`);
      console.log(`    telemetry.installTime: ${data['telemetry.installTime'] || '❌ 未设置'}`);
      console.log(`    telemetry.sessionCount: ${data['telemetry.sessionCount'] || '❌ 未设置'}`);
      
    } else {
      console.log('  ❌ storage.json文件不存在');
    }

    // 检查数据库中的设备ID
    console.log('\n📊 第2步：检查数据库中的设备ID...');
    
    const stateDbPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'state.vscdb'
    );

    if (await fs.pathExists(stateDbPath)) {
      try {
        const initSqlJs = require('sql.js');
        const SQL = await initSqlJs();
        const dbBuffer = await fs.readFile(stateDbPath);
        const db = new SQL.Database(dbBuffer);

        // 查询设备相关数据
        const deviceQuery = "SELECT key, value FROM ItemTable WHERE key LIKE '%telemetry%' OR key LIKE '%device%' OR key LIKE '%machine%'";
        const result = db.exec(deviceQuery);
        
        if (result.length > 0 && result[0].values.length > 0) {
          console.log('  数据库中的设备相关数据:');
          result[0].values.forEach(row => {
            const key = row[0];
            const value = row[1];
            if (key.includes('telemetry')) {
              console.log(`    ${key}: ${value ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : '空值'}`);
            }
          });
        } else {
          console.log('  ❌ 数据库中没有找到设备相关数据');
        }

        db.close();
      } catch (error) {
        console.log(`  ⚠️ 无法读取数据库: ${error.message}`);
      }
    } else {
      console.log('  ❌ state.vscdb文件不存在');
    }

    // 检查Augment扩展存储
    console.log('\n📊 第3步：检查Augment扩展存储...');
    
    const augmentStoragePath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'augment.vscode-augment'
    );

    if (await fs.pathExists(augmentStoragePath)) {
      console.log('  ✅ Augment扩展存储存在');
      
      try {
        const files = await fs.readdir(augmentStoragePath);
        console.log(`  包含 ${files.length} 个文件:`);
        files.slice(0, 5).forEach(file => {
          console.log(`    - ${file}`);
        });
        if (files.length > 5) {
          console.log(`    - ... 还有 ${files.length - 5} 个文件`);
        }
      } catch (error) {
        console.log(`  ⚠️ 无法读取扩展存储目录: ${error.message}`);
      }
    } else {
      console.log('  ❌ Augment扩展存储不存在');
    }

    // 检查工作区存储
    console.log('\n📊 第4步：检查工作区存储...');
    
    const workspaceStoragePath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'workspaceStorage'
    );

    if (await fs.pathExists(workspaceStoragePath)) {
      try {
        const workspaces = await fs.readdir(workspaceStoragePath);
        console.log(`  找到 ${workspaces.length} 个工作区:`);
        
        for (const workspace of workspaces.slice(0, 3)) {
          const workspaceDbPath = path.join(workspaceStoragePath, workspace, 'state.vscdb');
          if (await fs.pathExists(workspaceDbPath)) {
            console.log(`    - ${workspace}: 包含state.vscdb`);
          } else {
            console.log(`    - ${workspace}: 无state.vscdb`);
          }
        }
        
        if (workspaces.length > 3) {
          console.log(`    - ... 还有 ${workspaces.length - 3} 个工作区`);
        }
      } catch (error) {
        console.log(`  ⚠️ 无法读取工作区存储: ${error.message}`);
      }
    } else {
      console.log('  ❌ 工作区存储不存在');
    }

    console.log('\n✅ 设备ID状态检查完成');

  } catch (error) {
    console.error('❌ 检查设备ID状态失败:', error.message);
  }
}

// 运行检查
if (require.main === module) {
  checkDeviceIdStatus();
}

module.exports = { checkDeviceIdStatus };
