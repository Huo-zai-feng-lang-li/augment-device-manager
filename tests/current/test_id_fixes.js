#!/usr/bin/env node
/**
 * 测试ID格式修复效果
 */

const fs = require("fs-extra");
const path = require("path");

// 获取共享路径的辅助函数
function getSharedPath(relativePath) {
  return path.join(__dirname, "shared", relativePath);
}

async function testIDGenerator() {
  console.log("🧪 测试统一ID生成工具");
  console.log("=".repeat(60));

  try {
    const IDGenerator = require("../../shared/utils/id-generator");

    // 测试单个ID生成方法
    console.log("\n📋 单个ID生成测试：");

    const deviceId = IDGenerator.generateDeviceId();
    console.log(`devDeviceId: ${deviceId}`);
    const deviceIdValidation = IDGenerator.validateDeviceId(deviceId);
    console.log(
      `验证结果: ${deviceIdValidation.valid ? "✅" : "❌"} ${
        deviceIdValidation.error || "格式正确"
      }`
    );

    const machineId = IDGenerator.generateMachineId();
    console.log(`machineId: ${machineId}`);
    const machineIdValidation = IDGenerator.validateMachineId(machineId);
    console.log(
      `验证结果: ${machineIdValidation.valid ? "✅" : "❌"} ${
        machineIdValidation.error || "格式正确"
      }`
    );

    const macMachineId = IDGenerator.generateMacMachineId();
    console.log(`macMachineId: ${macMachineId}`);
    const macMachineIdValidation = IDGenerator.validateMachineId(macMachineId);
    console.log(
      `验证结果: ${macMachineIdValidation.valid ? "✅" : "❌"} ${
        macMachineIdValidation.error || "格式正确"
      }`
    );

    const sessionId = IDGenerator.generateSessionId();
    console.log(`sessionId: ${sessionId}`);
    const sessionIdValidation = IDGenerator.validateDeviceId(sessionId);
    console.log(
      `验证结果: ${sessionIdValidation.valid ? "✅" : "❌"} ${
        sessionIdValidation.error || "格式正确"
      }`
    );

    const sqmId = IDGenerator.generateSqmId();
    console.log(`sqmId: ${sqmId}`);
    const sqmIdValidation = IDGenerator.validateSqmId(sqmId);
    console.log(
      `验证结果: ${sqmIdValidation.valid ? "✅" : "❌"} ${
        sqmIdValidation.error || "格式正确"
      }`
    );

    // 测试完整设备身份生成
    console.log("\n📦 完整设备身份生成测试：");

    const cursorIdentity = IDGenerator.generateCompleteDeviceIdentity("cursor");
    console.log("Cursor设备身份:");
    Object.entries(cursorIdentity).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    const cursorValidation = IDGenerator.validateCompleteIdentity(
      cursorIdentity,
      "cursor"
    );
    console.log(
      `Cursor身份验证: ${
        cursorValidation.valid ? "✅ 全部正确" : "❌ 存在问题"
      }`
    );
    if (!cursorValidation.valid) {
      cursorValidation.errors.forEach((error) => console.log(`  - ${error}`));
    }

    const vscodeIdentity = IDGenerator.generateCompleteDeviceIdentity("vscode");
    console.log("\nVSCode设备身份:");
    Object.entries(vscodeIdentity).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    const vscodeValidation = IDGenerator.validateCompleteIdentity(
      vscodeIdentity,
      "vscode"
    );
    console.log(
      `VSCode身份验证: ${
        vscodeValidation.valid ? "✅ 全部正确" : "❌ 存在问题"
      }`
    );
    if (!vscodeValidation.valid) {
      vscodeValidation.errors.forEach((error) => console.log(`  - ${error}`));
    }

    return true;
  } catch (error) {
    console.error("❌ ID生成工具测试失败:", error.message);
    return false;
  }
}

async function testUnifiedCleanupImplementation() {
  console.log("\n🔧 测试unified-cleanup-implementation.js修复");
  console.log("=".repeat(60));

  try {
    // 检查文件是否存在
    const filePath =
      "./scripts/implementations/unified-cleanup-implementation.js";
    if (!(await fs.pathExists(filePath))) {
      console.log("❌ 文件不存在");
      return false;
    }

    const content = await fs.readFile(filePath, "utf8");

    // 检查是否使用了IDGenerator
    const hasIDGenerator = content.includes(
      'require("../../shared/utils/id-generator")'
    );
    console.log(`使用IDGenerator: ${hasIDGenerator ? "✅" : "❌"}`);

    // 检查是否移除了错误的方法调用
    const hasGenerateUUID = content.includes("this.generateUUID()");
    console.log(`移除generateUUID()调用: ${!hasGenerateUUID ? "✅" : "❌"}`);

    const hasGenerateDeviceFingerprint = content.includes(
      "this.generateDeviceFingerprint()"
    );
    console.log(
      `移除generateDeviceFingerprint()调用: ${
        !hasGenerateDeviceFingerprint ? "✅" : "❌"
      }`
    );

    // 检查是否使用了正确的ID生成
    const hasCompleteDeviceIdentity = content.includes(
      "generateCompleteDeviceIdentity"
    );
    console.log(
      `使用generateCompleteDeviceIdentity: ${
        hasCompleteDeviceIdentity ? "✅" : "❌"
      }`
    );

    return (
      hasIDGenerator &&
      !hasGenerateUUID &&
      !hasGenerateDeviceFingerprint &&
      hasCompleteDeviceIdentity
    );
  } catch (error) {
    console.error(
      "❌ unified-cleanup-implementation.js测试失败:",
      error.message
    );
    return false;
  }
}

async function testDeviceManagerFixes() {
  console.log("\n🔧 测试device-manager.js修复");
  console.log("=".repeat(60));

  try {
    const filePath = "./modules/desktop-client/src/device-manager.js";
    if (!(await fs.pathExists(filePath))) {
      console.log("❌ 文件不存在");
      return false;
    }

    const content = await fs.readFile(filePath, "utf8");

    // 检查PowerShell方法是否使用了IDGenerator
    const hasPowerShellIDGenerator = content.includes(
      'require(getSharedPath("utils/id-generator"))'
    );
    console.log(
      `PowerShell方法使用IDGenerator: ${hasPowerShellIDGenerator ? "✅" : "❌"}`
    );

    // 检查是否移除了错误的UUID用法
    const hasWrongMachineId = content.includes(
      "machineId: crypto.randomUUID()"
    );
    console.log(`移除错误的machineId生成: ${!hasWrongMachineId ? "✅" : "❌"}`);

    // 检查是否使用了正确的方法
    const hasCorrectMachineId = content.includes(
      "IDGenerator.generateMachineId()"
    );
    console.log(
      `使用正确的machineId生成: ${hasCorrectMachineId ? "✅" : "❌"}`
    );

    // 检查是否移除了复杂的字符串拼接
    const hasComplexStringConcat = content.includes(
      "newCursorDeviceId.substring(0, 8)"
    );
    console.log(`移除复杂字符串拼接: ${!hasComplexStringConcat ? "✅" : "❌"}`);

    return (
      hasPowerShellIDGenerator &&
      !hasWrongMachineId &&
      hasCorrectMachineId &&
      !hasComplexStringConcat
    );
  } catch (error) {
    console.error("❌ device-manager.js测试失败:", error.message);
    return false;
  }
}

async function testPowerShellFixes() {
  console.log("\n🔧 测试PowerShell脚本修复");
  console.log("=".repeat(60));

  try {
    // 测试ide-reset-ultimate.ps1
    const ultimateFilePath = "./scripts/powershell/ide-reset-ultimate.ps1";
    if (await fs.pathExists(ultimateFilePath)) {
      const ultimateContent = await fs.readFile(ultimateFilePath, "utf8");
      const hasGenerateMachineId = ultimateContent.includes(
        "function Generate-MachineId"
      );
      const hasCorrectSqmId = ultimateContent.includes(
        '"{$([System.Guid]::NewGuid().ToString().ToUpper())}"'
      );
      console.log(
        `ide-reset-ultimate.ps1 Generate-MachineId函数: ${
          hasGenerateMachineId ? "✅" : "❌"
        }`
      );
      console.log(
        `ide-reset-ultimate.ps1 正确sqmId格式: ${hasCorrectSqmId ? "✅" : "❌"}`
      );
    }

    // 测试ide-reset-simple.ps1
    const simpleFilePath = "./scripts/powershell/ide-reset-simple.ps1";
    if (await fs.pathExists(simpleFilePath)) {
      const simpleContent = await fs.readFile(simpleFilePath, "utf8");
      const hasGenerateMachineId = simpleContent.includes(
        "function Generate-MachineId"
      );
      const hasCorrectSqmId = simpleContent.includes(
        '"{$([System.Guid]::NewGuid().ToString().ToUpper())}"'
      );
      console.log(
        `ide-reset-simple.ps1 Generate-MachineId函数: ${
          hasGenerateMachineId ? "✅" : "❌"
        }`
      );
      console.log(
        `ide-reset-simple.ps1 正确sqmId格式: ${hasCorrectSqmId ? "✅" : "❌"}`
      );
    }

    return true;
  } catch (error) {
    console.error("❌ PowerShell脚本测试失败:", error.message);
    return false;
  }
}

async function main() {
  console.log("🔍 ID格式修复验证测试");
  console.log("=".repeat(80));

  const results = {
    idGenerator: await testIDGenerator(),
    unifiedCleanup: await testUnifiedCleanupImplementation(),
    deviceManager: await testDeviceManagerFixes(),
    powerShell: await testPowerShellFixes(),
  };

  console.log("\n📊 测试结果总结");
  console.log("=".repeat(60));
  console.log(`✅ ID生成工具: ${results.idGenerator ? "通过" : "失败"}`);
  console.log(
    `✅ unified-cleanup-implementation.js: ${
      results.unifiedCleanup ? "通过" : "失败"
    }`
  );
  console.log(
    `✅ device-manager.js: ${results.deviceManager ? "通过" : "失败"}`
  );
  console.log(`✅ PowerShell脚本: ${results.powerShell ? "通过" : "失败"}`);

  const allPassed = Object.values(results).every((result) => result);
  console.log(
    `\n🎯 总体结果: ${allPassed ? "🎉 全部修复成功！" : "⚠️ 仍有问题需要修复"}`
  );

  if (allPassed) {
    console.log("\n✨ 所有ID格式问题已修复，现在生成的ID都符合标准格式！");
  }
}

if (require.main === module) {
  main().catch(console.error);
}
