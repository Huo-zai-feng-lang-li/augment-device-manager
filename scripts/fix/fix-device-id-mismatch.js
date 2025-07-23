const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * 修复设备ID不匹配问题
 * 将配置文件中的设备ID更新为清理后生成的新ID
 */
async function fixDeviceIdMismatch() {
  console.log('🔧 修复设备ID不匹配问题');
  
  const cursorStoragePath = 'C:\\Users\\Administrator\\AppData\\Roaming\\Cursor\\User\\globalStorage\\storage.json';
  const vscodeStoragePath = 'C:\\Users\\Administrator\\AppData\\Roaming\\Code\\User\\globalStorage\\storage.json';
  
  // 从图片中看到的新设备ID（清理后生成的）
  const newDeviceId = '7d41a2e7-bdb0-4647-b36f-b55476f4596d';
  const oldDeviceId = '36987e70-60fe-4401-85a4-f463c269f069';
  
  console.log(`🎯 目标设备ID: ${newDeviceId}`);
  console.log(`🔄 旧设备ID: ${oldDeviceId}`);
  
  try {
    // 1. 更新Cursor配置文件
    console.log('\n📝 第1步：更新Cursor配置文件...');
    
    if (await fs.pathExists(cursorStoragePath)) {
      try {
        const cursorData = await fs.readJson(cursorStoragePath);
        const currentId = cursorData['telemetry.devDeviceId'];
        
        console.log(`当前Cursor设备ID: ${currentId}`);
        
        if (currentId === oldDeviceId) {
          // 更新为新的设备ID
          cursorData['telemetry.devDeviceId'] = newDeviceId;
          
          // 同时生成新的相关ID
          const crypto = require('crypto');
          cursorData['telemetry.machineId'] = crypto.randomUUID();
          cursorData['telemetry.sessionId'] = crypto.randomUUID();
          
          await fs.writeJson(cursorStoragePath, cursorData, { spaces: 2 });
          console.log(`✅ Cursor设备ID已更新为: ${newDeviceId}`);
        } else if (currentId === newDeviceId) {
          console.log('✅ Cursor设备ID已经是正确的');
        } else {
          console.log(`⚠️ Cursor设备ID是意外的值: ${currentId}`);
        }
      } catch (error) {
        console.log(`❌ 更新Cursor配置失败: ${error.message}`);
      }
    } else {
      console.log('⚠️ Cursor配置文件不存在');
    }
    
    // 2. 更新VSCode配置文件
    console.log('\n📝 第2步：更新VS Code配置文件...');
    
    if (await fs.pathExists(vscodeStoragePath)) {
      try {
        const vscodeData = await fs.readJson(vscodeStoragePath);
        const currentId = vscodeData['telemetry.devDeviceId'];
        
        console.log(`当前VS Code设备ID: ${currentId}`);
        
        if (currentId === oldDeviceId) {
          // 更新为新的设备ID
          vscodeData['telemetry.devDeviceId'] = newDeviceId;
          
          // 同时生成新的相关ID
          const crypto = require('crypto');
          vscodeData['telemetry.machineId'] = crypto.randomUUID();
          vscodeData['telemetry.sessionId'] = crypto.randomUUID();
          
          await fs.writeJson(vscodeStoragePath, vscodeData, { spaces: 2 });
          console.log(`✅ VS Code设备ID已更新为: ${newDeviceId}`);
        } else if (currentId === newDeviceId) {
          console.log('✅ VS Code设备ID已经是正确的');
        } else {
          console.log(`⚠️ VS Code设备ID是意外的值: ${currentId}`);
        }
      } catch (error) {
        console.log(`❌ 更新VS Code配置失败: ${error.message}`);
      }
    } else {
      console.log('⚠️ VS Code配置文件不存在');
    }
    
    // 3. 更新设备ID缓存文件
    console.log('\n📝 第3步：更新设备ID缓存文件...');
    
    const cacheDir = path.join(os.homedir(), '.augment-device-manager');
    const cacheFiles = [
      'stable-device-id.cache',
      'stable-device-id.backup',
      'stable-device-id-cursor.cache',
      'stable-device-id-cursor.backup',
      'stable-device-id-vscode.cache',
      'stable-device-id-vscode.backup'
    ];
    
    // 将新设备ID转换为64位哈希格式（缓存文件使用的格式）
    const crypto = require('crypto');
    const newDeviceIdHash = crypto.createHash('sha256').update(newDeviceId).digest('hex');
    
    for (const cacheFile of cacheFiles) {
      const cacheFilePath = path.join(cacheDir, cacheFile);
      if (await fs.pathExists(cacheFilePath)) {
        try {
          await fs.writeFile(cacheFilePath, newDeviceIdHash);
          console.log(`✅ 已更新缓存文件: ${cacheFile}`);
        } catch (error) {
          console.log(`⚠️ 更新缓存文件失败 ${cacheFile}: ${error.message}`);
        }
      }
    }
    
    // 4. 验证更新结果
    console.log('\n🔍 第4步：验证更新结果...');
    
    // 验证Cursor
    if (await fs.pathExists(cursorStoragePath)) {
      const cursorData = await fs.readJson(cursorStoragePath);
      const cursorId = cursorData['telemetry.devDeviceId'];
      console.log(`验证Cursor设备ID: ${cursorId}`);
      
      if (cursorId === newDeviceId) {
        console.log('✅ Cursor设备ID验证通过');
      } else {
        console.log('❌ Cursor设备ID验证失败');
      }
    }
    
    // 验证VSCode
    if (await fs.pathExists(vscodeStoragePath)) {
      const vscodeData = await fs.readJson(vscodeStoragePath);
      const vscodeId = vscodeData['telemetry.devDeviceId'];
      console.log(`验证VS Code设备ID: ${vscodeId}`);
      
      if (vscodeId === newDeviceId) {
        console.log('✅ VS Code设备ID验证通过');
      } else {
        console.log('❌ VS Code设备ID验证失败');
      }
    }
    
    console.log('\n🎯 修复完成！');
    console.log('💡 现在配置文件中的设备ID应该与前端显示的一致了');
    console.log('💡 如果需要防护，请重新启动增强防护功能');
    console.log(`💡 新的设备ID: ${newDeviceId}`);
    
  } catch (error) {
    console.error('❌ 修复失败:', error.message);
    console.error(error.stack);
  }
}

fixDeviceIdMismatch();
