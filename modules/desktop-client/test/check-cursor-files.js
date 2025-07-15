const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function checkCursorFiles() {
  console.log('🔍 检查Cursor IDE相关文件...\n');
  
  const cursorPaths = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage'),
    path.join(os.homedir(), 'AppData', 'Local', 'Cursor'),
    path.join(os.homedir(), '.cursor')
  ];
  
  for (const cursorPath of cursorPaths) {
    console.log(`📁 检查路径: ${cursorPath}`);
    
    if (await fs.pathExists(cursorPath)) {
      console.log('  ✅ 路径存在');
      
      try {
        const items = await fs.readdir(cursorPath);
        console.log(`  📂 包含 ${items.length} 个项目:`);
        
        for (const item of items.slice(0, 10)) { // 只显示前10个
          const itemPath = path.join(cursorPath, item);
          const stats = await fs.stat(itemPath);
          const type = stats.isDirectory() ? '📁' : '📄';
          console.log(`    ${type} ${item}`);
        }
        
        if (items.length > 10) {
          console.log(`    ... 还有 ${items.length - 10} 个项目`);
        }
      } catch (error) {
        console.log(`  ❌ 读取失败: ${error.message}`);
      }
    } else {
      console.log('  ❌ 路径不存在');
    }
    console.log('');
  }
  
  // 特别检查storage.json文件
  const storageJsonPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'storage.json');
  console.log(`🔍 特别检查storage.json: ${storageJsonPath}`);
  
  if (await fs.pathExists(storageJsonPath)) {
    console.log('  ✅ storage.json存在');
    
    try {
      const data = await fs.readJson(storageJsonPath);
      console.log(`  📊 包含 ${Object.keys(data).length} 个键值对`);
      
      const relevantKeys = [
        'telemetry.machineId',
        'telemetry.macMachineId', 
        'telemetry.devDeviceId',
        'telemetry.sqmId'
      ];
      
      console.log('  🔑 关键设备标识:');
      for (const key of relevantKeys) {
        if (data[key]) {
          console.log(`    ${key}: ${data[key]}`);
        } else {
          console.log(`    ${key}: ❌ 不存在`);
        }
      }
      
      // 显示所有以telemetry开头的键
      console.log('  📡 所有telemetry相关键:');
      for (const key of Object.keys(data)) {
        if (key.startsWith('telemetry')) {
          console.log(`    ${key}: ${data[key]}`);
        }
      }
      
    } catch (error) {
      console.log(`  ❌ 读取JSON失败: ${error.message}`);
    }
  } else {
    console.log('  ❌ storage.json不存在');
  }
}

checkCursorFiles().catch(console.error);
