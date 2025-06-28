const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 检测设备ID变化情况
async function checkDeviceIDChanges() {
  console.log("🔍 检测设备ID变化情况");
  console.log("=" .repeat(60));

  const results = {
    storageJson: {},
    stateDb: {},
    registryIds: {},
    deviceFiles: {}
  };

  try {
    // 1. 检查Cursor storage.json中的遥测ID
    console.log("\n📊 检查Cursor storage.json中的遥测ID...");
    const storageJsonPath = path.join(
      os.homedir(),
      "AppData",
      "Roaming", 
      "Cursor",
      "User",
      "globalStorage",
      "storage.json"
    );

    if (await fs.pathExists(storageJsonPath)) {
      try {
        const storageData = await fs.readJson(storageJsonPath);
        
        // 检查关键的遥测ID
        const telemetryKeys = [
          'telemetry.machineId',
          'telemetry.macMachineId', 
          'telemetry.devDeviceId',
          'telemetry.sqmId',
          'telemetry.sessionId'
        ];

        console.log("  📋 storage.json中的遥测ID:");
        telemetryKeys.forEach(key => {
          if (storageData[key]) {
            const value = storageData[key];
            const shortValue = typeof value === 'string' ? value.substring(0, 16) + '...' : value;
            console.log(`    ${key}: ${shortValue}`);
            results.storageJson[key] = value;
          } else {
            console.log(`    ${key}: ❌ 未找到`);
          }
        });

        // 检查MCP配置是否存在
        if (storageData.mcpServers) {
          console.log(`  🛡️ MCP配置: ✅ 存在 (${Object.keys(storageData.mcpServers).length}个服务器)`);
          results.storageJson.mcpServers = Object.keys(storageData.mcpServers);
        } else {
          console.log("  🛡️ MCP配置: ❌ 不存在");
        }

      } catch (error) {
        console.log(`  ❌ 读取storage.json失败: ${error.message}`);
      }
    } else {
      console.log("  ❌ storage.json文件不存在");
    }

    // 2. 检查state.vscdb数据库中的ID（如果可能）
    console.log("\n📊 检查state.vscdb数据库...");
    const stateDbPath = path.join(
      os.homedir(),
      "AppData", 
      "Roaming",
      "Cursor",
      "User",
      "globalStorage",
      "state.vscdb"
    );

    if (await fs.pathExists(stateDbPath)) {
      console.log("  ✅ state.vscdb文件存在");
      const stats = await fs.stat(stateDbPath);
      console.log(`  📏 文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`  📅 修改时间: ${stats.mtime.toLocaleString()}`);
      results.stateDb.exists = true;
      results.stateDb.size = stats.size;
      results.stateDb.modified = stats.mtime;
    } else {
      console.log("  ❌ state.vscdb文件不存在");
      results.stateDb.exists = false;
    }

    // 3. 检查设备管理器缓存文件
    console.log("\n📊 检查设备管理器缓存文件...");
    const deviceManagerDir = path.join(os.homedir(), ".augment-device-manager");
    
    if (await fs.pathExists(deviceManagerDir)) {
      const files = await fs.readdir(deviceManagerDir);
      console.log(`  📁 设备管理器目录: ${deviceManagerDir}`);
      console.log("  📋 目录内容:");
      
      for (const file of files) {
        const filePath = path.join(deviceManagerDir, file);
        const stats = await fs.stat(filePath);
        console.log(`    ${file} (${(stats.size / 1024).toFixed(2)} KB, ${stats.mtime.toLocaleString()})`);
        
        // 检查配置文件内容
        if (file === 'config.json') {
          try {
            const config = await fs.readJson(filePath);
            if (config.activation && config.activation.deviceId) {
              const deviceId = config.activation.deviceId.substring(0, 16) + '...';
              console.log(`      设备ID: ${deviceId}`);
              results.deviceFiles.configDeviceId = config.activation.deviceId;
            }
          } catch (error) {
            console.log(`      ❌ 读取配置失败: ${error.message}`);
          }
        }
      }
    } else {
      console.log("  ❌ 设备管理器目录不存在");
    }

    // 4. 检查系统注册表MachineGuid（Windows）
    if (os.platform() === 'win32') {
      console.log("\n📊 检查系统注册表MachineGuid...");
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        const { stdout } = await execAsync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid');
        const match = stdout.match(/MachineGuid\s+REG_SZ\s+(.+)/);
        if (match) {
          const machineGuid = match[1].trim();
          console.log(`  🔑 系统MachineGuid: ${machineGuid}`);
          results.registryIds.machineGuid = machineGuid;
        }
      } catch (error) {
        console.log(`  ❌ 读取注册表失败: ${error.message}`);
      }
    }

    // 5. 生成当前设备指纹进行对比
    console.log("\n📊 生成当前设备指纹...");
    try {
      const DeviceManager = require("../src/device-manager");
      const deviceManager = new DeviceManager();
      
      // 获取共享模块路径的辅助函数
      function getSharedPath(relativePath) {
        return path.join(__dirname, "../../shared", relativePath);
      }
      
      const { generateDeviceFingerprint } = require(getSharedPath("crypto/encryption"));
      const currentFingerprint = await generateDeviceFingerprint();
      console.log(`  🔍 当前设备指纹: ${currentFingerprint.substring(0, 16)}...`);
      results.deviceFiles.currentFingerprint = currentFingerprint;
      
    } catch (error) {
      console.log(`  ❌ 生成设备指纹失败: ${error.message}`);
    }

    // 6. 分析结果
    console.log("\n" + "=" .repeat(60));
    console.log("📊 分析结果:");
    
    // 检查遥测ID是否一致
    const telemetryIds = results.storageJson;
    if (telemetryIds['telemetry.machineId'] && telemetryIds['telemetry.devDeviceId']) {
      console.log("✅ 遥测ID已更新");
      console.log(`  machineId: ${telemetryIds['telemetry.machineId'].substring(0, 16)}...`);
      console.log(`  devDeviceId: ${telemetryIds['telemetry.devDeviceId'].substring(0, 16)}...`);
    } else {
      console.log("❌ 遥测ID缺失或未更新");
    }

    // 检查设备指纹对比
    if (results.deviceFiles.configDeviceId && results.deviceFiles.currentFingerprint) {
      const configId = results.deviceFiles.configDeviceId;
      const currentId = results.deviceFiles.currentFingerprint;
      
      if (configId === currentId) {
        console.log("✅ 设备指纹一致");
      } else {
        console.log("❌ 设备指纹不一致");
        console.log(`  配置中: ${configId.substring(0, 16)}...`);
        console.log(`  当前: ${currentId.substring(0, 16)}...`);
      }
    }

    // 检查MCP配置保护
    if (results.storageJson.mcpServers && results.storageJson.mcpServers.length > 0) {
      console.log(`✅ MCP配置已保护 (${results.storageJson.mcpServers.length}个服务器)`);
      console.log(`  服务器: ${results.storageJson.mcpServers.join(', ')}`);
    } else {
      console.log("⚠️ 未检测到MCP配置");
    }

    // 输出完整结果
    console.log("\n📋 完整检测结果:");
    console.log(JSON.stringify(results, null, 2));

  } catch (error) {
    console.error("❌ 检测过程中发生错误:", error.message);
  }
}

// 运行检测
if (require.main === module) {
  checkDeviceIDChanges()
    .then(() => {
      console.log("\n🎉 设备ID检测完成");
    })
    .catch(error => {
      console.error("检测执行失败:", error);
      process.exit(1);
    });
}

module.exports = checkDeviceIDChanges;
