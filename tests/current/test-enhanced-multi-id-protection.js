const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

/**
 * 测试增强的多ID防护机制
 * 验证防护系统是否能保护所有设备身份字段
 */

async function testEnhancedMultiIdProtection() {
  console.log("🧪 测试增强的多ID防护机制");
  console.log("=".repeat(60));

  try {
    // 1. 准备测试环境
    console.log("\n📍 第1步：准备测试环境");
    const testResults = await prepareTestEnvironment();
    
    // 2. 启动增强防护
    console.log("\n📍 第2步：启动增强防护");
    const guardian = await startEnhancedGuardian(testResults.targetIds);
    
    // 3. 测试单个ID篡改
    console.log("\n📍 第3步：测试单个ID篡改");
    await testSingleIdTampering(testResults.storageJsonPath, testResults.targetIds);
    
    // 4. 测试多个ID同时篡改
    console.log("\n📍 第4步：测试多个ID同时篡改");
    await testMultipleIdTampering(testResults.storageJsonPath, testResults.targetIds);
    
    // 5. 测试临时文件拦截
    console.log("\n📍 第5步：测试临时文件拦截");
    await testTempFileInterception(testResults.storageJsonPath, testResults.targetIds);
    
    // 6. 验证防护效果
    console.log("\n📍 第6步：验证防护效果");
    await verifyProtectionEffectiveness(testResults.storageJsonPath, testResults.targetIds);
    
    // 7. 停止防护
    console.log("\n📍 第7步：停止防护");
    await guardian.stopGuarding();
    
    console.log("\n🎉 增强多ID防护机制测试完成！");
    
  } catch (error) {
    console.error("❌ 测试失败:", error);
    process.exit(1);
  }
}

/**
 * 准备测试环境
 */
async function prepareTestEnvironment() {
  console.log("  🔧 创建测试用的storage.json文件...");
  
  const storageJsonPath = path.join(
    os.homedir(),
    "AppData",
    "Roaming",
    "Cursor",
    "User",
    "globalStorage",
    "storage.json"
  );
  
  // 生成目标设备身份数据
  const targetIds = {
    devDeviceId: crypto.randomUUID(),
    machineId: crypto.randomBytes(32).toString('hex'),
    sessionId: crypto.randomUUID(),
    sqmId: `{${crypto.randomUUID().toUpperCase()}}`,
    macMachineId: crypto.randomBytes(32).toString('hex'),
    serviceMachineId: crypto.randomUUID(),
  };
  
  // 创建包含所有设备身份字段的storage.json
  const storageData = {
    "telemetry.devDeviceId": targetIds.devDeviceId,
    "telemetry.machineId": targetIds.machineId,
    "telemetry.sessionId": targetIds.sessionId,
    "telemetry.sqmId": targetIds.sqmId,
    "telemetry.macMachineId": targetIds.macMachineId,
    "storage.serviceMachineId": targetIds.serviceMachineId,
    "telemetry.firstSessionDate": new Date().toUTCString(),
    "telemetry.currentSessionDate": new Date().toUTCString(),
  };
  
  // 确保目录存在
  await fs.ensureDir(path.dirname(storageJsonPath));
  
  // 写入测试数据
  await fs.writeJson(storageJsonPath, storageData, { spaces: 2 });
  
  console.log("  ✅ 测试环境准备完成");
  console.log(`  📁 测试文件: ${storageJsonPath}`);
  console.log("  🎯 目标设备身份:");
  for (const [key, value] of Object.entries(targetIds)) {
    console.log(`    ${key}: ${value.substring(0, 8)}...`);
  }
  
  return { storageJsonPath, targetIds };
}

/**
 * 启动增强防护
 */
async function startEnhancedGuardian(targetIds) {
  console.log("  🛡️ 启动增强设备守护进程...");
  
  const { EnhancedDeviceGuardian } = require("../../modules/desktop-client/src/enhanced-device-guardian");
  const guardian = new EnhancedDeviceGuardian();
  
  const result = await guardian.startGuarding(targetIds.devDeviceId, {
    selectedIDE: "cursor",
    enableBackupMonitoring: true,
    enableDatabaseMonitoring: false, // 简化测试，只测试文件保护
    enableEnhancedProtection: true,
  });
  
  if (!result.success) {
    throw new Error(`防护启动失败: ${result.message}`);
  }
  
  console.log("  ✅ 增强防护启动成功");
  console.log(`  🔒 保护字段数量: ${guardian.protectedFields.length}`);
  
  // 等待防护完全启动
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return guardian;
}

/**
 * 测试单个ID篡改
 */
async function testSingleIdTampering(storageJsonPath, targetIds) {
  console.log("  🔍 测试单个设备ID篡改检测...");
  
  // 读取当前数据
  const currentData = await fs.readJson(storageJsonPath);
  
  // 篡改devDeviceId
  const fakeDeviceId = crypto.randomUUID();
  currentData["telemetry.devDeviceId"] = fakeDeviceId;
  
  console.log(`  🚨 篡改devDeviceId: ${targetIds.devDeviceId} → ${fakeDeviceId}`);
  
  // 写入篡改的数据
  await fs.writeJson(storageJsonPath, currentData, { spaces: 2 });
  
  // 等待防护系统检测和恢复
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 验证是否已恢复
  const restoredData = await fs.readJson(storageJsonPath);
  const isRestored = restoredData["telemetry.devDeviceId"] === targetIds.devDeviceId;
  
  console.log(`  ${isRestored ? '✅' : '❌'} 单个ID篡改检测: ${isRestored ? '已恢复' : '未恢复'}`);
  
  if (!isRestored) {
    throw new Error("单个ID篡改检测失败");
  }
}

/**
 * 测试多个ID同时篡改
 */
async function testMultipleIdTampering(storageJsonPath, targetIds) {
  console.log("  🔍 测试多个设备ID同时篡改检测...");
  
  // 读取当前数据
  const currentData = await fs.readJson(storageJsonPath);
  
  // 同时篡改多个字段
  const fakeIds = {
    devDeviceId: crypto.randomUUID(),
    machineId: crypto.randomBytes(32).toString('hex'),
    sessionId: crypto.randomUUID(),
  };
  
  currentData["telemetry.devDeviceId"] = fakeIds.devDeviceId;
  currentData["telemetry.machineId"] = fakeIds.machineId;
  currentData["telemetry.sessionId"] = fakeIds.sessionId;
  
  console.log("  🚨 同时篡改3个设备身份字段");
  
  // 写入篡改的数据
  await fs.writeJson(storageJsonPath, currentData, { spaces: 2 });
  
  // 等待防护系统检测和恢复
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 验证是否已恢复
  const restoredData = await fs.readJson(storageJsonPath);
  const restoredCount = [
    restoredData["telemetry.devDeviceId"] === targetIds.devDeviceId,
    restoredData["telemetry.machineId"] === targetIds.machineId,
    restoredData["telemetry.sessionId"] === targetIds.sessionId,
  ].filter(Boolean).length;
  
  console.log(`  ${restoredCount === 3 ? '✅' : '❌'} 多个ID篡改检测: ${restoredCount}/3 已恢复`);
  
  if (restoredCount !== 3) {
    throw new Error("多个ID篡改检测失败");
  }
}

/**
 * 测试临时文件拦截
 */
async function testTempFileInterception(storageJsonPath, targetIds) {
  console.log("  🔍 测试临时文件拦截机制...");
  
  // 创建临时文件（模拟IDE行为）
  const tempFilePath = storageJsonPath + ".vsctmp";
  
  const tempData = {
    "telemetry.devDeviceId": crypto.randomUUID(),
    "telemetry.machineId": crypto.randomBytes(32).toString('hex'),
    "telemetry.sessionId": crypto.randomUUID(),
    "telemetry.sqmId": `{${crypto.randomUUID().toUpperCase()}}`,
  };
  
  console.log("  🚨 创建包含篡改数据的临时文件");
  
  // 写入临时文件
  await fs.writeJson(tempFilePath, tempData, { spaces: 2 });
  
  // 等待拦截机制处理
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 检查临时文件是否被修正
  if (await fs.pathExists(tempFilePath)) {
    const interceptedData = await fs.readJson(tempFilePath);
    const isIntercepted = interceptedData["telemetry.devDeviceId"] === targetIds.devDeviceId;
    
    console.log(`  ${isIntercepted ? '✅' : '❌'} 临时文件拦截: ${isIntercepted ? '已拦截' : '未拦截'}`);
    
    // 清理临时文件
    await fs.remove(tempFilePath);
    
    if (!isIntercepted) {
      throw new Error("临时文件拦截失败");
    }
  } else {
    console.log("  ⚠️ 临时文件已被删除（可能被防护系统处理）");
  }
}

/**
 * 验证防护效果
 */
async function verifyProtectionEffectiveness(storageJsonPath, targetIds) {
  console.log("  🔍 验证最终防护效果...");
  
  const finalData = await fs.readJson(storageJsonPath);
  
  const protectedFields = [
    { key: "telemetry.devDeviceId", target: targetIds.devDeviceId },
    { key: "telemetry.machineId", target: targetIds.machineId },
    { key: "telemetry.sessionId", target: targetIds.sessionId },
    { key: "telemetry.sqmId", target: targetIds.sqmId },
    { key: "telemetry.macMachineId", target: targetIds.macMachineId },
    { key: "storage.serviceMachineId", target: targetIds.serviceMachineId },
  ];
  
  let protectedCount = 0;
  for (const field of protectedFields) {
    const isProtected = finalData[field.key] === field.target;
    console.log(`    ${isProtected ? '✅' : '❌'} ${field.key}: ${isProtected ? '已保护' : '未保护'}`);
    if (isProtected) protectedCount++;
  }
  
  console.log(`  📊 防护效果: ${protectedCount}/${protectedFields.length} 字段已保护`);
  
  if (protectedCount === protectedFields.length) {
    console.log("  🎉 所有设备身份字段均已得到有效保护！");
  } else {
    throw new Error(`防护效果不佳，仅保护了 ${protectedCount}/${protectedFields.length} 个字段`);
  }
}

// 运行测试
if (require.main === module) {
  testEnhancedMultiIdProtection().catch(error => {
    console.error("❌ 测试异常:", error);
    process.exit(1);
  });
}

module.exports = { testEnhancedMultiIdProtection };
