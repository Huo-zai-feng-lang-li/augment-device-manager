#!/usr/bin/env node

/**
 * 全面系统检查 - 客户端和服务端完整性验证
 * 确保所有功能正常工作
 */

const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs-extra");
const path = require("path");

const execAsync = promisify(exec);

async function comprehensiveSystemCheck() {
  console.log("🔍 开始全面系统检查...");
  console.log("=".repeat(60));

  const results = {
    client: { status: "unknown", issues: [], successes: [] },
    server: { status: "unknown", issues: [], successes: [] },
    modules: { status: "unknown", issues: [], successes: [] },
    functionality: { status: "unknown", issues: [], successes: [] },
  };

  try {
    // 1. 客户端检查
    console.log("\n📱 客户端检查...");
    await checkClient(results.client);

    // 2. 服务端检查
    console.log("\n🖥️ 服务端检查...");
    await checkServer(results.server);

    // 3. 核心模块检查
    console.log("\n🔧 核心模块检查...");
    await checkModules(results.modules);

    // 4. 功能完整性检查
    console.log("\n⚙️ 功能完整性检查...");
    await checkFunctionality(results.functionality);

    // 5. 生成总结报告
    console.log("\n📊 系统检查报告");
    console.log("=".repeat(60));
    generateReport(results);
  } catch (error) {
    console.error("❌ 系统检查过程中发生错误:", error);
  }
}

// 客户端检查
async function checkClient(result) {
  try {
    // 检查Electron进程
    try {
      const { stdout } = await execAsync(
        'tasklist /FI "IMAGENAME eq electron.exe"'
      );
      const lines = stdout
        .split("\n")
        .filter((line) => line.includes("electron.exe"));

      if (lines.length > 0) {
        result.successes.push(
          `✅ Electron进程运行正常 (${lines.length}个进程)`
        );
      } else {
        result.issues.push("❌ 未发现Electron进程");
      }
    } catch (error) {
      result.issues.push("⚠️ 无法检查Electron进程状态");
    }

    // 检查客户端文件
    const clientFiles = [
      "desktop-client/src/main.js",
      "desktop-client/public/index.html",
      "desktop-client/public/renderer.js",
      "desktop-client/package.json",
    ];

    for (const file of clientFiles) {
      if (await fs.pathExists(file)) {
        result.successes.push(`✅ ${path.basename(file)} 文件存在`);
      } else {
        result.issues.push(`❌ ${file} 文件缺失`);
      }
    }

    // 检查依赖
    try {
      const packageJson = await fs.readJson("desktop-client/package.json");
      const hasElectron =
        packageJson.devDependencies && packageJson.devDependencies.electron;

      if (hasElectron) {
        result.successes.push("✅ Electron依赖配置正确");
      } else {
        result.issues.push("❌ Electron依赖缺失");
      }
    } catch (error) {
      result.issues.push("⚠️ 无法读取package.json");
    }

    result.status = result.issues.length === 0 ? "healthy" : "issues";
  } catch (error) {
    result.issues.push(`❌ 客户端检查失败: ${error.message}`);
    result.status = "error";
  }
}

// 服务端检查
async function checkServer(result) {
  try {
    // 检查服务端文件
    const serverFiles = [
      "admin-backend/src/server-simple.js",
      "admin-backend/package.json",
    ];

    for (const file of serverFiles) {
      if (await fs.pathExists(file)) {
        result.successes.push(`✅ ${path.basename(file)} 文件存在`);
      } else {
        result.issues.push(`❌ ${file} 文件缺失`);
      }
    }

    // 检查服务端进程
    try {
      const { stdout } = await execAsync('netstat -an | findstr ":3002"');
      if (stdout.trim()) {
        result.successes.push("✅ 服务端端口3002正在监听");
      } else {
        result.issues.push("⚠️ 服务端端口3002未监听");
      }
    } catch (error) {
      result.issues.push("⚠️ 无法检查服务端端口状态");
    }

    // 测试HTTP连接
    try {
      const response = await fetch("http://127.0.0.1:3002/api/health");
      if (response.ok) {
        result.successes.push("✅ 服务端HTTP接口响应正常");
      } else {
        result.issues.push(`❌ 服务端HTTP接口异常: ${response.status}`);
      }
    } catch (error) {
      result.issues.push("❌ 无法连接到服务端HTTP接口");
    }

    result.status = result.issues.length === 0 ? "healthy" : "issues";
  } catch (error) {
    result.issues.push(`❌ 服务端检查失败: ${error.message}`);
    result.status = "error";
  }
}

// 核心模块检查
async function checkModules(result) {
  try {
    // 检查共享模块
    const sharedModules = [
      "shared/utils/stable-device-id.js",
      "shared/utils/device-detection.js",
    ];

    for (const module of sharedModules) {
      if (await fs.pathExists(module)) {
        result.successes.push(`✅ ${path.basename(module)} 模块存在`);

        // 测试模块加载
        try {
          require(path.resolve(module));
          result.successes.push(`✅ ${path.basename(module)} 模块加载正常`);
        } catch (error) {
          result.issues.push(`❌ ${path.basename(module)} 模块加载失败`);
        }
      } else {
        result.issues.push(`❌ ${module} 模块缺失`);
      }
    }

    // 测试设备ID生成
    try {
      const {
        generateStableDeviceId,
      } = require("./shared/utils/stable-device-id");
      const deviceId = await generateStableDeviceId();

      if (deviceId && deviceId.length === 64) {
        result.successes.push("✅ 设备ID生成功能正常");
      } else {
        result.issues.push("❌ 设备ID生成异常");
      }
    } catch (error) {
      result.issues.push("❌ 设备ID模块测试失败");
    }

    result.status = result.issues.length === 0 ? "healthy" : "issues";
  } catch (error) {
    result.issues.push(`❌ 模块检查失败: ${error.message}`);
    result.status = "error";
  }
}

// 功能完整性检查
async function checkFunctionality(result) {
  try {
    // 检查设备管理器
    try {
      const DeviceManager = require("./desktop-client/src/device-manager");
      const deviceManager = new DeviceManager();
      result.successes.push("✅ 设备管理器模块加载正常");

      // 测试获取当前设备ID
      const currentId = await deviceManager.getCurrentDeviceId();
      if (currentId) {
        result.successes.push("✅ 设备ID获取功能正常");
      } else {
        result.issues.push("⚠️ 当前设备ID为空（可能是正常状态）");
      }
    } catch (error) {
      result.issues.push("❌ 设备管理器模块加载失败");
    }

    // 检查配置文件
    try {
      const config = require("./desktop-client/src/config");
      const serverUrl = config.getHttpUrl();
      result.successes.push(`✅ 配置模块正常 (${serverUrl})`);
    } catch (error) {
      result.issues.push("❌ 配置模块加载失败");
    }

    // 检查Cursor遥测ID
    try {
      const storageJsonPath = path.join(
        require("os").homedir(),
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "globalStorage",
        "storage.json"
      );

      if (await fs.pathExists(storageJsonPath)) {
        const data = await fs.readJson(storageJsonPath);
        if (data["telemetry.devDeviceId"]) {
          result.successes.push("✅ Cursor遥测ID检测正常");
        } else {
          result.issues.push("⚠️ Cursor遥测ID未找到");
        }
      } else {
        result.issues.push("⚠️ Cursor存储文件不存在");
      }
    } catch (error) {
      result.issues.push("⚠️ Cursor遥测ID检查失败");
    }

    result.status = result.issues.length === 0 ? "healthy" : "issues";
  } catch (error) {
    result.issues.push(`❌ 功能检查失败: ${error.message}`);
    result.status = "error";
  }
}

// 生成报告
function generateReport(results) {
  const sections = [
    { name: "📱 客户端", data: results.client },
    { name: "🖥️ 服务端", data: results.server },
    { name: "🔧 核心模块", data: results.modules },
    { name: "⚙️ 功能完整性", data: results.functionality },
  ];

  let overallStatus = "healthy";
  let totalIssues = 0;
  let totalSuccesses = 0;

  sections.forEach((section) => {
    console.log(`\n${section.name}:`);
    console.log(
      `  状态: ${getStatusIcon(section.data.status)} ${section.data.status}`
    );

    section.data.successes.forEach((success) => {
      console.log(`  ${success}`);
    });

    section.data.issues.forEach((issue) => {
      console.log(`  ${issue}`);
    });

    totalIssues += section.data.issues.length;
    totalSuccesses += section.data.successes.length;

    if (section.data.status === "error") {
      overallStatus = "error";
    } else if (section.data.status === "issues" && overallStatus !== "error") {
      overallStatus = "issues";
    }
  });

  console.log("\n🎯 总体状态:");
  console.log(
    `  ${getStatusIcon(overallStatus)} ${overallStatus.toUpperCase()}`
  );
  console.log(`  成功项目: ${totalSuccesses}`);
  console.log(`  问题项目: ${totalIssues}`);

  if (overallStatus === "healthy") {
    console.log("\n🎉 系统状态良好！所有组件正常工作。");
  } else if (overallStatus === "issues") {
    console.log("\n⚠️ 系统基本正常，但有一些需要注意的问题。");
  } else {
    console.log("\n❌ 系统存在严重问题，需要立即处理。");
  }

  console.log("\n💡 建议操作:");
  if (totalIssues === 0) {
    console.log("  - 系统运行良好，可以正常使用所有功能");
    console.log("  - 定期进行系统检查以确保持续稳定");
  } else {
    console.log("  - 查看上述问题列表并逐一解决");
    console.log("  - 重启相关服务或组件");
    console.log("  - 如有需要，重新安装依赖");
  }
}

function getStatusIcon(status) {
  switch (status) {
    case "healthy":
      return "✅";
    case "issues":
      return "⚠️";
    case "error":
      return "❌";
    default:
      return "❓";
  }
}

// 运行检查
comprehensiveSystemCheck();
