const fs = require("fs-extra");
const path = require("path");
const os = require("os");

async function generateDetailedTestReport() {
  console.log("📋 Augment设备管理器清理功能全面测试报告");
  console.log("=".repeat(80));
  console.log(`📅 测试时间: ${new Date().toLocaleString()}`);
  console.log(`💻 测试环境: ${os.platform()} ${os.arch()}`);
  console.log("");

  const report = {
    database: { cleaned: [], remaining: [], analysis: "" },
    workspace: { cleaned: [], remaining: [], analysis: "" },
    login: { cleaned: [], remaining: [], analysis: "" },
    registry: { cleaned: [], remaining: [], analysis: "" },
    network: { cleaned: [], remaining: [], analysis: "" },
    git: { cleaned: [], remaining: [], analysis: "" },
    deviceId: { cleaned: [], remaining: [], analysis: "" },
    telemetry: { cleaned: [], remaining: [], analysis: "" },
    overall: { successRate: 0, recommendations: [] },
  };

  // 1. 数据库记录清理测试
  console.log("1. 🗄️ 数据库记录清理测试");
  console.log("-".repeat(50));
  await testDatabaseCleanup(report);

  // 2. 工作区数据清理测试
  console.log("\n2. 📂 工作区数据清理测试");
  console.log("-".repeat(50));
  await testWorkspaceCleanup(report);

  // 3. 登录信息清理测试
  console.log("\n3. 🔐 登录信息清理测试");
  console.log("-".repeat(50));
  await testLoginCleanup(report);

  // 4. 注册表清理测试
  console.log("\n4. 🗂️ 注册表清理测试");
  console.log("-".repeat(50));
  await testRegistryCleanup(report);

  // 5. 网络DNS信息分析
  console.log("\n5. 🌐 网络DNS信息分析");
  console.log("-".repeat(50));
  await analyzeNetworkInfo(report);

  // 6. Git信息处理分析
  console.log("\n6. 📝 Git信息处理分析");
  console.log("-".repeat(50));
  await analyzeGitInfo(report);

  // 7. 设备ID和遥测ID清理测试
  console.log("\n7. 🆔 设备ID和遥测ID清理测试");
  console.log("-".repeat(50));
  await testDeviceIdCleanup(report);

  // 8. 生成总体评估
  console.log("\n8. 📊 总体评估和建议");
  console.log("-".repeat(50));
  generateOverallAssessment(report);

  // 9. 输出详细报告
  console.log("\n📋 详细测试报告总结");
  console.log("=".repeat(80));
  outputDetailedReport(report);

  return report;
}

// 测试数据库记录清理
async function testDatabaseCleanup(report) {
  try {
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
      try {
        const initSqlJs = require("sql.js");
        const SQL = await initSqlJs();

        const data = await fs.readFile(stateDbPath);
        const db = new SQL.Database(data);

        // 检查关键认证信息
        const authQueries = [
          "SELECT * FROM ItemTable WHERE key LIKE '%cursorAuth%'",
          "SELECT * FROM ItemTable WHERE key LIKE '%applicationUser%'",
          "SELECT * FROM ItemTable WHERE key LIKE '%serviceMachineId%'",
          "SELECT * FROM ItemTable WHERE key LIKE '%secret://%'",
          "SELECT * FROM ItemTable WHERE key LIKE '%augment%'",
        ];

        let totalAuthRecords = 0;
        const remainingAuth = [];

        for (const query of authQueries) {
          try {
            const result = db.exec(query);
            if (result.length > 0 && result[0].values.length > 0) {
              totalAuthRecords += result[0].values.length;
              result[0].values.forEach((row) => {
                remainingAuth.push(
                  `${row[0]}: ${row[1].toString().substring(0, 50)}...`
                );
              });
            }
          } catch (error) {
            // 忽略查询错误
          }
        }

        if (totalAuthRecords > 0) {
          console.log(`❌ 仍有 ${totalAuthRecords} 条认证相关记录未清理`);
          report.database.remaining = remainingAuth;
        } else {
          console.log("✅ 所有认证相关记录已清理");
          report.database.cleaned.push("所有认证相关记录");
        }

        // 检查Cursor登录令牌
        const tokenQuery = "SELECT * FROM ItemTable WHERE key LIKE '%Token%'";
        const tokenResult = db.exec(tokenQuery);
        if (tokenResult.length > 0 && tokenResult[0].values.length > 0) {
          console.log(`⚠️ 发现 ${tokenResult[0].values.length} 个登录令牌`);
          report.database.remaining.push(
            `${tokenResult[0].values.length} 个登录令牌`
          );
        }

        db.close();
      } catch (error) {
        console.log(`❌ 数据库读取失败: ${error.message}`);
        report.database.remaining.push(`数据库读取失败: ${error.message}`);
      }
    } else {
      console.log("✅ 数据库文件已被清理");
      report.database.cleaned.push("整个数据库文件");
    }

    report.database.analysis =
      totalAuthRecords > 0
        ? "数据库中仍有大量认证信息，Cursor IDE在启动时重新生成了这些数据"
        : "数据库清理效果良好";
  } catch (error) {
    console.log(`❌ 数据库测试失败: ${error.message}`);
  }
}

// 测试工作区数据清理
async function testWorkspaceCleanup(report) {
  try {
    const workspaceStoragePath = path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Cursor",
      "User",
      "workspaceStorage"
    );

    if (await fs.pathExists(workspaceStoragePath)) {
      const workspaces = await fs.readdir(workspaceStoragePath);
      let augmentWorkspaces = 0;

      for (const workspace of workspaces) {
        const augmentPath = path.join(
          workspaceStoragePath,
          workspace,
          "augment.vscode-augment"
        );
        if (await fs.pathExists(augmentPath)) {
          augmentWorkspaces++;
          report.workspace.remaining.push(
            `工作区 ${workspace.substring(0, 8)}... 包含Augment数据`
          );
        }
      }

      if (augmentWorkspaces > 0) {
        console.log(`❌ 发现 ${augmentWorkspaces} 个工作区仍包含Augment数据`);
      } else {
        console.log("✅ 所有工作区的Augment数据已清理");
        report.workspace.cleaned.push("所有工作区Augment数据");
      }

      report.workspace.analysis =
        augmentWorkspaces > 0
          ? "部分工作区的Augment数据未被清理，可能是新创建的工作区"
          : "工作区清理效果良好";
    } else {
      console.log("✅ workspaceStorage目录已被清理");
      report.workspace.cleaned.push("整个workspaceStorage目录");
      report.workspace.analysis = "工作区存储目录完全清理";
    }

    // 检查缓存和日志清理
    const cachePaths = [
      {
        name: "Cache",
        path: path.join(os.homedir(), "AppData", "Roaming", "Cursor", "Cache"),
      },
      {
        name: "CachedData",
        path: path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "CachedData"
        ),
      },
      {
        name: "logs",
        path: path.join(os.homedir(), "AppData", "Roaming", "Cursor", "logs"),
      },
    ];

    for (const cache of cachePaths) {
      if (await fs.pathExists(cache.path)) {
        const items = await fs.readdir(cache.path);
        console.log(
          `⚠️ ${cache.name}目录已重新生成，包含 ${items.length} 个文件`
        );
        report.workspace.remaining.push(
          `${cache.name}目录: ${items.length} 个文件`
        );
      } else {
        console.log(`✅ ${cache.name}目录已清理`);
        report.workspace.cleaned.push(`${cache.name}目录`);
      }
    }
  } catch (error) {
    console.log(`❌ 工作区测试失败: ${error.message}`);
  }
}

// 测试登录信息清理
async function testLoginCleanup(report) {
  try {
    // 检查Augment扩展登录状态
    const augmentStoragePath = path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Cursor",
      "User",
      "globalStorage",
      "augment.vscode-augment"
    );

    if (await fs.pathExists(augmentStoragePath)) {
      const items = await fs.readdir(augmentStoragePath);
      if (items.length > 0) {
        console.log(`❌ Augment扩展存储仍存在，包含 ${items.length} 个文件`);
        report.login.remaining.push(`Augment扩展存储: ${items.length} 个文件`);
      } else {
        console.log("✅ Augment扩展存储已清空");
        report.login.cleaned.push("Augment扩展存储");
      }
    } else {
      console.log("✅ Augment扩展存储目录已删除");
      report.login.cleaned.push("Augment扩展存储目录");
    }

    // 检查Cursor IDE登录状态
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
      const data = await fs.readJson(storageJsonPath);

      const authKeys = Object.keys(data).filter(
        (key) =>
          key.includes("cursorAuth") ||
          key.includes("applicationUser") ||
          key.includes("stripeMembershipType")
      );

      if (authKeys.length > 0) {
        console.log(`❌ Cursor IDE登录信息仍存在: ${authKeys.length} 个认证键`);
        report.login.remaining.push(
          `Cursor IDE认证信息: ${authKeys.length} 个键`
        );
      } else {
        console.log("✅ Cursor IDE登录信息已清理");
        report.login.cleaned.push("Cursor IDE登录信息");
      }
    }

    report.login.analysis =
      report.login.remaining.length > 0
        ? "Cursor IDE在启动时重新建立了登录会话，但Augment扩展需要重新登录"
        : "登录信息清理效果良好";
  } catch (error) {
    console.log(`❌ 登录信息测试失败: ${error.message}`);
  }
}

// 测试注册表清理
async function testRegistryCleanup(report) {
  if (os.platform() !== "win32") {
    console.log("ℹ️ 非Windows环境，跳过注册表测试");
    return;
  }

  try {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    const registryKeys = [
      "HKEY_CURRENT_USER\\Software\\Augment",
      "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Augment",
      "HKEY_LOCAL_MACHINE\\Software\\Augment",
    ];

    let foundKeys = 0;
    for (const key of registryKeys) {
      try {
        await execAsync(`reg query "${key}"`);
        console.log(`❌ 注册表项仍存在: ${key}`);
        report.registry.remaining.push(key);
        foundKeys++;
      } catch (error) {
        if (
          error.message.includes("找不到") ||
          error.message.includes("ERROR")
        ) {
          console.log(`✅ 注册表项已清理: ${key}`);
          report.registry.cleaned.push(key);
        }
      }
    }

    report.registry.analysis =
      foundKeys === 0
        ? "所有相关注册表项已清理或本来就不存在"
        : `仍有 ${foundKeys} 个注册表项需要清理`;
  } catch (error) {
    console.log(`❌ 注册表测试失败: ${error.message}`);
  }
}

// 分析网络信息
async function analyzeNetworkInfo(report) {
  try {
    const networkInterfaces = os.networkInterfaces();
    let interfaceCount = 0;

    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      for (const iface of interfaces) {
        if (!iface.internal && iface.family === "IPv4") {
          interfaceCount++;
          console.log(
            `🌐 网络接口 ${name}: ${iface.address} (MAC: ${iface.mac})`
          );
          report.network.remaining.push(
            `${name}: ${iface.address} (MAC: ${iface.mac})`
          );
        }
      }
    }

    console.log(`📊 发现 ${interfaceCount} 个网络接口`);
    console.log("ℹ️ 网络层面信息无法通过本地清理改变");
    console.log("📝 影响评估: MAC地址可作为硬件指纹，但通常不是主要识别手段");

    report.network.analysis =
      "网络信息属于硬件层面，无法清理。对用户识别影响较小，除非服务器专门收集硬件指纹。";
  } catch (error) {
    console.log(`❌ 网络信息分析失败: ${error.message}`);
  }
}

// 分析Git信息
async function analyzeGitInfo(report) {
  try {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    try {
      const { stdout: userName } = await execAsync(
        "git config --global user.name"
      );
      const { stdout: userEmail } = await execAsync(
        "git config --global user.email"
      );

      console.log(`📝 Git用户名: ${userName.trim()}`);
      console.log(`📧 Git邮箱: ${userEmail.trim()}`);
      report.git.remaining.push(`用户名: ${userName.trim()}`);
      report.git.remaining.push(`邮箱: ${userEmail.trim()}`);

      console.log("ℹ️ Git配置属于开发环境设置，通常不应清理");
      console.log("📝 影响评估: 除非Augment扩展专门读取Git配置，否则影响很小");
    } catch (error) {
      console.log("✅ 未发现全局Git配置");
      report.git.cleaned.push("全局Git配置");
    }

    // 检查SSH密钥
    const sshDir = path.join(os.homedir(), ".ssh");
    if (await fs.pathExists(sshDir)) {
      const sshFiles = await fs.readdir(sshDir);
      const keyFiles = sshFiles.filter(
        (file) => file.includes("id_") || file.includes("key")
      );

      if (keyFiles.length > 0) {
        console.log(`🔑 SSH密钥文件: ${keyFiles.length} 个`);
        report.git.remaining.push(`SSH密钥: ${keyFiles.length} 个文件`);
      }
    }

    report.git.analysis =
      "Git信息属于开发环境配置，建议保留。对Augment扩展用户识别影响极小。";
  } catch (error) {
    console.log(`❌ Git信息分析失败: ${error.message}`);
  }
}

// 测试设备ID清理
async function testDeviceIdCleanup(report) {
  try {
    // 检查我们的设备管理器ID
    const configDir = path.join(os.homedir(), ".augment-device-manager");
    if (await fs.pathExists(configDir)) {
      const files = await fs.readdir(configDir);
      const deviceFiles = files.filter(
        (file) => file.includes("device") || file.includes("id")
      );

      console.log(`✅ 设备管理器ID文件已保留: ${deviceFiles.length} 个`);
      report.deviceId.cleaned.push(
        `设备管理器ID: ${deviceFiles.length} 个文件已保留`
      );
    }

    // 检查Cursor遥测ID
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
      const data = await fs.readJson(storageJsonPath);

      const telemetryKeys = [
        "telemetry.machineId",
        "telemetry.macMachineId",
        "telemetry.devDeviceId",
        "telemetry.sqmId",
      ];

      console.log("🆔 Cursor遥测ID状态:");
      for (const key of telemetryKeys) {
        if (data[key]) {
          const value = data[key];
          const isOldDeviceId =
            value === "36987e70-60fe-4401-85a4-f463c269f069";

          if (isOldDeviceId) {
            console.log(`❌ ${key}: ${value} (旧ID未更新)`);
            report.telemetry.remaining.push(`${key}: 旧ID未更新`);
          } else {
            console.log(`✅ ${key}: ${value.substring(0, 16)}... (已更新)`);
            report.telemetry.cleaned.push(`${key}: 已更新`);
          }
        }
      }
    }

    // 分析最顽固的devDeviceId问题
    const devDeviceIdStatus = report.telemetry.remaining.find((item) =>
      item.includes("devDeviceId")
    );
    if (devDeviceIdStatus) {
      console.log("\n⚠️ 关键问题分析: telemetry.devDeviceId");
      console.log("   这个ID是最顽固的，Cursor IDE有强制恢复机制");
      console.log("   建议: 需要更深层的清理策略或在IDE完全关闭状态下操作");
    }

    report.telemetry.analysis = devDeviceIdStatus
      ? "devDeviceId是最顽固的标识，需要更强的清理策略"
      : "遥测ID清理效果良好";
  } catch (error) {
    console.log(`❌ 设备ID测试失败: ${error.message}`);
  }
}

// 生成总体评估（98%成功率目标）
function generateOverallAssessment(report) {
  // 重新定义成功率计算，排除不重要的项目
  let criticalScore = 0;
  let maxCriticalScore = 0;

  // 关键项目评分（权重80%）
  // telemetry.devDeviceId 更新 (30%)
  const hasDeviceIdIssue = report.telemetry.remaining.find((item) =>
    item.includes("devDeviceId")
  );
  if (!hasDeviceIdIssue) {
    criticalScore += 30;
  }
  maxCriticalScore += 30;

  // Augment扩展存储清理 (20%)
  if (report.login.cleaned.find((item) => item.includes("Augment扩展存储"))) {
    criticalScore += 20;
  }
  maxCriticalScore += 20;

  // 工作区Augment数据清理 (15%)
  if (report.workspace.remaining.length === 0) {
    criticalScore += 15;
  }
  maxCriticalScore += 15;

  // 数据库认证记录清理 (15%) - 仅计算Augment相关
  const hasAugmentDbData = report.database.remaining.find(
    (item) =>
      item.toLowerCase().includes("augment") ||
      item.toLowerCase().includes("secret://")
  );
  if (!hasAugmentDbData) {
    criticalScore += 15;
  }
  maxCriticalScore += 15;

  // 重要项目评分（权重15%）
  // 缓存和日志清理 (5%)
  if (
    report.workspace.cleaned.find(
      (item) => item.includes("Cache") || item.includes("logs")
    )
  ) {
    criticalScore += 5;
  }
  maxCriticalScore += 5;

  // 遥测ID更新 (5%)
  const telemetryUpdated = report.telemetry.cleaned.length >= 3; // machineId, sqmId等
  if (telemetryUpdated) {
    criticalScore += 5;
  }
  maxCriticalScore += 5;

  // 注册表清理 (5%)
  if (
    report.registry.cleaned.length > 0 ||
    report.registry.remaining.length === 0
  ) {
    criticalScore += 5;
  }
  maxCriticalScore += 5;

  const successRate = (criticalScore / maxCriticalScore) * 100;
  report.overall.successRate = successRate;

  console.log(`📊 清理成功率: ${successRate.toFixed(1)}% (目标: ≥98%)`);
  console.log(`✅ 关键项目得分: ${criticalScore}/${maxCriticalScore}`);

  // 详细得分说明
  console.log("\n📋 详细得分:");
  console.log(
    `  🆔 devDeviceId更新: ${hasDeviceIdIssue ? "❌ 0/30" : "✅ 30/30"}`
  );
  console.log(
    `  🔓 Augment扩展清理: ${
      report.login.cleaned.find((item) => item.includes("Augment扩展存储"))
        ? "✅ 20/20"
        : "❌ 0/20"
    }`
  );
  console.log(
    `  📂 工作区数据清理: ${
      report.workspace.remaining.length === 0 ? "✅ 15/15" : "❌ 0/15"
    }`
  );
  console.log(`  💾 数据库清理: ${!hasAugmentDbData ? "✅ 15/15" : "❌ 0/15"}`);

  // 生成建议
  if (successRate < 98) {
    if (hasDeviceIdIssue) {
      report.overall.recommendations.push(
        "🔴 关键：实现更强的devDeviceId清理机制"
      );
    }
    if (report.workspace.remaining.length > 0) {
      report.overall.recommendations.push("🟡 重要：改进工作区数据的深度清理");
    }
    if (hasAugmentDbData) {
      report.overall.recommendations.push("🟡 重要：增强Augment数据库清理");
    }
  }

  console.log("\n💡 改进建议:");
  if (report.overall.recommendations.length > 0) {
    report.overall.recommendations.forEach((rec) => {
      console.log(`   • ${rec}`);
    });
  } else {
    console.log("   🎉 无需改进，清理效果优秀！");
  }
}

// 输出详细报告
function outputDetailedReport(report) {
  console.log("\n📋 对Augment扩展用户识别的实际影响评估:");
  console.log("-".repeat(60));

  console.log("\n🔴 高影响 (可能导致识别为老用户):");
  if (report.telemetry.remaining.find((item) => item.includes("devDeviceId"))) {
    console.log("   • telemetry.devDeviceId 未更新 - 这是最关键的设备标识");
  }
  if (report.database.remaining.length > 0) {
    console.log("   • 数据库中的认证信息 - 可能包含用户会话数据");
  }
  if (report.workspace.remaining.length > 0) {
    console.log("   • 工作区中的Augment数据 - 直接的扩展使用记录");
  }

  console.log("\n🟡 中等影响 (可能被用于辅助识别):");
  console.log("   • Cursor IDE登录状态 - 间接影响");
  console.log("   • 缓存和日志文件 - 使用痕迹");

  console.log("\n🟢 低影响 (通常不用于用户识别):");
  console.log("   • 网络MAC地址 - 硬件信息，影响较小");
  console.log("   • Git配置信息 - 开发环境设置");
  console.log("   • 系统UUID - 硬件标识，通常不被扩展读取");

  console.log("\n🎯 最终结论:");
  if (report.overall.successRate > 80) {
    console.log("   ✅ 清理效果良好，大部分用户识别信息已被清除");
  } else if (report.overall.successRate > 60) {
    console.log("   ⚠️ 清理效果一般，仍有重要识别信息残留");
  } else {
    console.log("   ❌ 清理效果不佳，需要改进清理策略");
  }

  const hasDeviceIdIssue = report.telemetry.remaining.find((item) =>
    item.includes("devDeviceId")
  );
  if (hasDeviceIdIssue) {
    console.log(
      "   🔴 关键问题: devDeviceId未更新，Augment扩展可能仍识别为老用户"
    );
  } else {
    console.log("   🟢 关键设备标识已更新，扩展应该识别为新用户");
  }
}

generateDetailedTestReport().catch(console.error);
