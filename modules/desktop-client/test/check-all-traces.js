const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

async function checkAllTraces() {
  console.log("🔍 全面检查Augment扩展可能用于用户识别的所有信息...\n");

  const findings = {
    database: [],
    workspace: [],
    login: [],
    registry: [],
    network: [],
    git: [],
    deviceId: [],
    telemetry: [],
    cache: [],
    logs: [],
    config: [],
  };

  // 1. 检查数据库记录
  console.log("1. 🗄️ 检查数据库记录...");
  await checkDatabaseRecords(findings);

  // 2. 检查工作区数据
  console.log("\n2. 📂 检查工作区数据...");
  await checkWorkspaceData(findings);

  // 3. 检查登录信息
  console.log("\n3. 🔐 检查登录信息...");
  await checkLoginInfo(findings);

  // 4. 检查注册表
  console.log("\n4. 🗂️ 检查注册表...");
  await checkRegistryInfo(findings);

  // 5. 检查网络和DNS信息
  console.log("\n5. 🌐 检查网络和DNS信息...");
  await checkNetworkInfo(findings);

  // 6. 检查Git信息
  console.log("\n6. 📝 检查Git信息...");
  await checkGitInfo(findings);

  // 7. 检查设备ID
  console.log("\n7. 🆔 检查设备ID...");
  await checkDeviceIds(findings);

  // 8. 检查遥测ID
  console.log("\n8. 📡 检查遥测ID...");
  await checkTelemetryIds(findings);

  // 9. 检查缓存文件
  console.log("\n9. 💾 检查缓存文件...");
  await checkCacheFiles(findings);

  // 10. 检查日志文件
  console.log("\n10. 📋 检查日志文件...");
  await checkLogFiles(findings);

  // 11. 检查配置文件
  console.log("\n11. ⚙️ 检查配置文件...");
  await checkConfigFiles(findings);

  // 输出总结
  console.log("\n📊 检查结果总结:");
  let totalFindings = 0;

  for (const [category, items] of Object.entries(findings)) {
    if (items.length > 0) {
      console.log(`\n⚠️ ${getCategoryName(category)} (${items.length}项):`);
      items.forEach((item) => console.log(`  • ${item}`));
      totalFindings += items.length;
    }
  }

  if (totalFindings === 0) {
    console.log("\n🎉 所有用户识别信息已完全清理！");
  } else {
    console.log(
      `\n⚠️ 发现 ${totalFindings} 项可能的用户识别信息需要进一步清理`
    );
  }

  return findings;
}

// 检查数据库记录
async function checkDatabaseRecords(findings) {
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

        // 查询所有可能的用户识别信息
        const queries = [
          "SELECT * FROM ItemTable WHERE key LIKE '%user%'",
          "SELECT * FROM ItemTable WHERE key LIKE '%session%'",
          "SELECT * FROM ItemTable WHERE key LIKE '%auth%'",
          "SELECT * FROM ItemTable WHERE key LIKE '%token%'",
          "SELECT * FROM ItemTable WHERE key LIKE '%login%'",
          "SELECT * FROM ItemTable WHERE key LIKE '%account%'",
          "SELECT * FROM ItemTable WHERE key LIKE '%email%'",
          "SELECT * FROM ItemTable WHERE key LIKE '%id%'",
        ];

        for (const query of queries) {
          try {
            const result = db.exec(query);
            if (result.length > 0 && result[0].values.length > 0) {
              result[0].values.forEach((row) => {
                findings.database.push(
                  `${row[0]}: ${row[1].substring(0, 100)}...`
                );
              });
            }
          } catch (error) {
            // 忽略查询错误
          }
        }

        db.close();
      } catch (error) {
        findings.database.push(`数据库读取失败: ${error.message}`);
      }
    }
  } catch (error) {
    findings.database.push(`数据库检查失败: ${error.message}`);
  }
}

// 检查工作区数据
async function checkWorkspaceData(findings) {
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

      for (const workspace of workspaces) {
        const workspacePath = path.join(workspaceStoragePath, workspace);

        // 检查是否有Augment相关数据
        const augmentPath = path.join(workspacePath, "augment.vscode-augment");
        if (await fs.pathExists(augmentPath)) {
          findings.workspace.push(`工作区 ${workspace} 包含Augment数据`);
        }

        // 检查其他可能的用户识别文件
        try {
          const items = await fs.readdir(workspacePath);
          for (const item of items) {
            if (
              item.includes("user") ||
              item.includes("session") ||
              item.includes("auth")
            ) {
              findings.workspace.push(`工作区 ${workspace} 包含: ${item}`);
            }
          }
        } catch (error) {
          // 忽略读取错误
        }
      }
    }
  } catch (error) {
    findings.workspace.push(`工作区检查失败: ${error.message}`);
  }
}

// 检查登录信息
async function checkLoginInfo(findings) {
  try {
    // 检查globalStorage中的认证信息
    const globalStoragePath = path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Cursor",
      "User",
      "globalStorage"
    );

    if (await fs.pathExists(globalStoragePath)) {
      const items = await fs.readdir(globalStoragePath);

      for (const item of items) {
        if (
          item.includes("auth") ||
          item.includes("session") ||
          item.includes("login")
        ) {
          findings.login.push(`认证相关目录: ${item}`);
        }
      }

      // 检查storage.json中的认证信息
      const storageJsonPath = path.join(globalStoragePath, "storage.json");
      if (await fs.pathExists(storageJsonPath)) {
        try {
          const storageData = await fs.readJson(storageJsonPath);

          for (const [key, value] of Object.entries(storageData)) {
            if (
              key.includes("auth") ||
              key.includes("session") ||
              key.includes("login") ||
              key.includes("token") ||
              key.includes("user") ||
              key.includes("account")
            ) {
              findings.login.push(`storage.json: ${key}`);
            }
          }
        } catch (error) {
          findings.login.push(`storage.json读取失败: ${error.message}`);
        }
      }
    }
  } catch (error) {
    findings.login.push(`登录信息检查失败: ${error.message}`);
  }
}

// 检查注册表信息
async function checkRegistryInfo(findings) {
  if (os.platform() !== "win32") return;

  try {
    const registryKeys = [
      "HKEY_CURRENT_USER\\Software\\Augment",
      "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Augment",
      "HKEY_CURRENT_USER\\Software\\Cursor",
      "HKEY_LOCAL_MACHINE\\Software\\Augment",
      "HKEY_LOCAL_MACHINE\\Software\\Cursor",
    ];

    for (const key of registryKeys) {
      try {
        await execAsync(`reg query "${key}"`);
        findings.registry.push(`注册表项存在: ${key}`);
      } catch (error) {
        // 注册表项不存在是正常的
      }
    }
  } catch (error) {
    findings.registry.push(`注册表检查失败: ${error.message}`);
  }
}

// 检查网络和DNS信息
async function checkNetworkInfo(findings) {
  try {
    // 检查网络配置
    const networkInterfaces = os.networkInterfaces();

    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      for (const iface of interfaces) {
        if (!iface.internal && iface.family === "IPv4") {
          findings.network.push(
            `网络接口 ${name}: ${iface.address} (MAC: ${iface.mac})`
          );
        }
      }
    }

    // 检查DNS配置
    try {
      if (os.platform() === "win32") {
        const { stdout } = await execAsync("ipconfig /all");
        const dnsMatches = stdout.match(/DNS.*?(\d+\.\d+\.\d+\.\d+)/g);
        if (dnsMatches) {
          dnsMatches.forEach((dns) => {
            findings.network.push(`DNS配置: ${dns}`);
          });
        }
      }
    } catch (error) {
      // DNS检查失败
    }
  } catch (error) {
    findings.network.push(`网络信息检查失败: ${error.message}`);
  }
}

// 检查Git信息
async function checkGitInfo(findings) {
  try {
    // 检查全局Git配置
    try {
      const { stdout: userName } = await execAsync(
        "git config --global user.name"
      );
      if (userName.trim()) {
        findings.git.push(`Git用户名: ${userName.trim()}`);
      }
    } catch (error) {
      // Git用户名未设置
    }

    try {
      const { stdout: userEmail } = await execAsync(
        "git config --global user.email"
      );
      if (userEmail.trim()) {
        findings.git.push(`Git邮箱: ${userEmail.trim()}`);
      }
    } catch (error) {
      // Git邮箱未设置
    }

    // 检查SSH密钥
    const sshDir = path.join(os.homedir(), ".ssh");
    if (await fs.pathExists(sshDir)) {
      const sshFiles = await fs.readdir(sshDir);
      const keyFiles = sshFiles.filter(
        (file) => file.includes("id_") || file.includes("key")
      );
      if (keyFiles.length > 0) {
        findings.git.push(`SSH密钥文件: ${keyFiles.join(", ")}`);
      }
    }
  } catch (error) {
    findings.git.push(`Git信息检查失败: ${error.message}`);
  }
}

// 检查设备ID
async function checkDeviceIds(findings) {
  try {
    // 检查我们的设备管理器ID
    const configDir = path.join(os.homedir(), ".augment-device-manager");
    if (await fs.pathExists(configDir)) {
      const files = await fs.readdir(configDir);
      for (const file of files) {
        if (file.includes("device") || file.includes("id")) {
          findings.deviceId.push(`设备管理器文件: ${file}`);
        }
      }
    }

    // 检查系统设备ID
    if (os.platform() === "win32") {
      try {
        const { stdout } = await execAsync("wmic csproduct get uuid");
        const uuid = stdout.split("\n")[1]?.trim();
        if (uuid && uuid !== "UUID") {
          findings.deviceId.push(`系统UUID: ${uuid}`);
        }
      } catch (error) {
        // UUID获取失败
      }
    }
  } catch (error) {
    findings.deviceId.push(`设备ID检查失败: ${error.message}`);
  }
}

// 检查遥测ID
async function checkTelemetryIds(findings) {
  try {
    // 检查Cursor的遥测配置
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
      const storageData = await fs.readJson(storageJsonPath);

      const telemetryKeys = [
        "telemetry.machineId",
        "telemetry.macMachineId",
        "telemetry.devDeviceId",
        "telemetry.sqmId",
      ];

      for (const key of telemetryKeys) {
        if (storageData[key]) {
          findings.telemetry.push(`${key}: ${storageData[key]}`);
        }
      }
    }
  } catch (error) {
    findings.telemetry.push(`遥测ID检查失败: ${error.message}`);
  }
}

// 检查缓存文件
async function checkCacheFiles(findings) {
  try {
    const cachePaths = [
      path.join(os.homedir(), "AppData", "Roaming", "Cursor", "Cache"),
      path.join(os.homedir(), "AppData", "Local", "Cursor", "Cache"),
      path.join(os.homedir(), "AppData", "Roaming", "Cursor", "CachedData"),
    ];

    for (const cachePath of cachePaths) {
      if (await fs.pathExists(cachePath)) {
        try {
          const items = await fs.readdir(cachePath);
          if (items.length > 0) {
            findings.cache.push(
              `缓存目录 ${path.basename(cachePath)}: ${items.length} 个文件`
            );
          }
        } catch (error) {
          // 忽略读取错误
        }
      }
    }
  } catch (error) {
    findings.cache.push(`缓存文件检查失败: ${error.message}`);
  }
}

// 检查日志文件
async function checkLogFiles(findings) {
  try {
    const logPaths = [
      path.join(os.homedir(), "AppData", "Roaming", "Cursor", "logs"),
      path.join(os.homedir(), "AppData", "Local", "Cursor", "logs"),
    ];

    for (const logPath of logPaths) {
      if (await fs.pathExists(logPath)) {
        try {
          const items = await fs.readdir(logPath);
          if (items.length > 0) {
            findings.logs.push(
              `日志目录 ${path.basename(logPath)}: ${items.length} 个文件`
            );
          }
        } catch (error) {
          // 忽略读取错误
        }
      }
    }
  } catch (error) {
    findings.logs.push(`日志文件检查失败: ${error.message}`);
  }
}

// 检查配置文件
async function checkConfigFiles(findings) {
  try {
    const configPaths = [
      path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "settings.json"
      ),
      path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "keybindings.json"
      ),
      path.join(os.homedir(), ".cursor"),
    ];

    for (const configPath of configPaths) {
      if (await fs.pathExists(configPath)) {
        findings.config.push(`配置文件: ${path.basename(configPath)}`);
      }
    }
  } catch (error) {
    findings.config.push(`配置文件检查失败: ${error.message}`);
  }
}

// 获取分类名称
function getCategoryName(category) {
  const names = {
    database: "数据库记录",
    workspace: "工作区数据",
    login: "登录信息",
    registry: "注册表",
    network: "网络信息",
    git: "Git信息",
    deviceId: "设备ID",
    telemetry: "遥测ID",
    cache: "缓存文件",
    logs: "日志文件",
    config: "配置文件",
  };
  return names[category] || category;
}

checkAllTraces().catch(console.error);
