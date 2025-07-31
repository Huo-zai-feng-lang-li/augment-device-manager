#!/usr/bin/env node

/**
 * 自动更新配置的服务器启动脚本
 * 每次启动ngrok时自动更新GitHub配置
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// 使用动态导入node-fetch或内置fetch
let fetch;
async function initFetch() {
  try {
    // 尝试使用内置fetch (Node.js 18+)
    if (typeof globalThis.fetch !== "undefined") {
      fetch = globalThis.fetch;
    } else {
      // 降级到node-fetch
      const nodeFetch = await import("node-fetch");
      fetch = nodeFetch.default;
    }
  } catch (error) {
    console.error("❌ 无法加载fetch模块:", error.message);
    process.exit(1);
  }
}

// 加载环境变量
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

console.log("🚀 自动更新配置的服务器启动脚本");
console.log("====================");

let serverProcess = null;
let ngrokProcess = null;

// PID文件路径
const PID_FILE = path.join(__dirname, "../../.server.pid");
const NGROK_PID_FILE = path.join(__dirname, "../../.ngrok.pid");

// GitHub配置
const GITHUB_CONFIG = {
  owner: "Huo-zai-feng-lang-li", // GitHub用户名
  repo: "augment-device-manager", // 配置仓库名
  branch: "main", // 分支名
  configFile: "server-config.json", // 配置文件名
  token: process.env.GITHUB_TOKEN, // GitHub Token - 必须通过环境变量设置
};

// 停止之前运行的进程
async function stopPreviousProcesses() {
  console.log("🔍 检查并停止之前运行的进程...");

  try {
    // 1. 从PID文件读取之前的进程ID
    const pidsToStop = [];

    if (fs.existsSync(PID_FILE)) {
      const serverPid = fs.readFileSync(PID_FILE, "utf8").trim();
      if (serverPid) pidsToStop.push({ pid: serverPid, name: "后端服务" });
    }

    if (fs.existsSync(NGROK_PID_FILE)) {
      const ngrokPid = fs.readFileSync(NGROK_PID_FILE, "utf8").trim();
      if (ngrokPid) pidsToStop.push({ pid: ngrokPid, name: "ngrok隧道" });
    }

    // 2. 停止指定的进程
    for (const { pid, name } of pidsToStop) {
      try {
        const { execSync } = require("child_process");
        execSync(`taskkill /F /PID ${pid}`, { stdio: "pipe" });
        console.log(`✅ 已停止${name} (PID: ${pid})`);
      } catch (error) {
        console.log(`⚠️ ${name} (PID: ${pid}) 可能已经停止`);
      }
    }

    // 3. 通用清理：停止所有可能相关的进程
    console.log("🧹 执行通用进程清理...");
    try {
      const { execSync } = require("child_process");

      // 清理可能占用3002端口的进程
      try {
        const netstatOutput = execSync("netstat -ano | findstr :3002", {
          encoding: "utf8",
        });
        const lines = netstatOutput
          .split("\n")
          .filter((line) => line.includes("LISTENING"));

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== "0") {
            try {
              execSync(`taskkill /F /PID ${pid}`, { stdio: "pipe" });
              console.log(`✅ 已停止占用3002端口的进程 (PID: ${pid})`);
            } catch (e) {
              // 忽略错误
            }
          }
        }
      } catch (error) {
        // 没有进程占用3002端口
      }

      // 清理可能的ngrok进程
      try {
        execSync("taskkill /F /IM ngrok.exe", { stdio: "pipe" });
        console.log("✅ 已清理ngrok进程");
      } catch (error) {
        // 没有ngrok进程需要清理
      }
    } catch (error) {
      console.log("⚠️ 通用清理过程中出现错误:", error.message);
    }

    // 4. 清理PID文件
    [PID_FILE, NGROK_PID_FILE].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    // 5. 等待进程完全退出
    await sleep(2000);
    console.log("✅ 进程清理完成，环境已准备就绪");
  } catch (error) {
    console.log("⚠️ 进程清理过程中出现错误:", error.message);
    console.log("🔄 继续启动新服务...");
  }
}

async function main() {
  try {
    // 初始化fetch
    await initFetch();

    // 🔥 新增：停止之前运行的进程
    await stopPreviousProcesses();

    // 检查ngrok配置
    const ngrokPath = await checkNgrok();

    // 启动后端服务
    console.log("🚀 启动后端服务...");
    serverProcess = await startServer();

    // 等待服务启动
    await sleep(3000);

    // 启动ngrok
    console.log("🔗 启动ngrok隧道...");
    ngrokProcess = await startNgrok(ngrokPath);

    // 等待ngrok启动
    await sleep(5000);

    // 获取公网地址
    const ngrokUrl = await getNgrokUrl();
    if (ngrokUrl) {
      console.log("");
      console.log("🎉 服务启动成功！");
      console.log(`🌐 管理界面: https://${ngrokUrl}`);
      console.log(`📱 客户端连接地址: ${ngrokUrl}`);

      // 🔥 关键：自动更新GitHub配置
      console.log("\n📤 自动更新GitHub配置...");
      await updateGitHubConfig(ngrokUrl);

      console.log("");
      console.log("💡 服务将持续运行，按 Ctrl+C 停止");
      console.log("✨ 客户端会自动获取最新地址，无需重新分发！");

      // 保存服务信息
      await saveServerInfo(ngrokUrl);

      // 启动配置监控
      startConfigMonitoring(ngrokUrl);
    } else {
      throw new Error("无法获取ngrok公网地址");
    }
  } catch (error) {
    console.error("❌ 服务启动失败:", error.message);
    cleanup();
    process.exit(1);
  }
}

// 更新GitHub配置
async function updateGitHubConfig(ngrokUrl) {
  const serverConfig = {
    version: "1.0.0",
    lastUpdated: new Date().toISOString(),
    server: {
      host: ngrokUrl,
      port: 443,
      protocol: "https",
    },
    metadata: {
      buildTime: new Date().toISOString(),
      ngrokUrl: `https://${ngrokUrl}`,
      status: "active",
      autoUpdated: true,
    },
  };

  try {
    if (GITHUB_CONFIG.token) {
      await updateViaGitHubAPI(serverConfig);
    } else {
      await updateViaLocalGit(serverConfig);
    }
    console.log("✅ GitHub配置更新成功");
  } catch (error) {
    console.error("❌ GitHub配置更新失败:", error.message);
    console.log("💡 提示: 客户端可能无法获取最新地址");
  }
}

// 通过GitHub API更新配置
async function updateViaGitHubAPI(config) {
  const { owner, repo, branch, configFile, token } = GITHUB_CONFIG;

  try {
    // 获取当前文件内容
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${configFile}`;
    const getResponse = await fetch(getUrl, {
      headers: {
        Authorization: `token ${token}`,
        "User-Agent": "Augment-Auto-Updater",
      },
    });

    let sha = null;
    if (getResponse.ok) {
      const fileData = await getResponse.json();
      sha = fileData.sha;
    }

    // 更新文件
    const updateUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${configFile}`;
    const content = Buffer.from(JSON.stringify(config, null, 2)).toString(
      "base64"
    );

    const updateResponse = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "Augment-Auto-Updater",
      },
      body: JSON.stringify({
        message: `Auto-update server config: ${config.server.host}`,
        content: content,
        branch: branch,
        ...(sha && { sha }),
      }),
    });

    if (!updateResponse.ok) {
      throw new Error(`GitHub API更新失败: ${updateResponse.statusText}`);
    }

    console.log("✅ GitHub配置更新成功（API方式）");
  } catch (error) {
    throw new Error(`GitHub API更新失败: ${error.message}`);
  }
}

// 通过本地git更新配置
async function updateViaLocalGit(config) {
  const { execSync } = require("child_process");
  const tempDir = path.join(__dirname, "../../temp-config-repo");
  const { owner, repo, branch, configFile } = GITHUB_CONFIG;

  try {
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      execSync(`rmdir /s /q "${tempDir}"`, { stdio: "pipe" });
    }

    // 克隆仓库
    execSync(`git clone https://github.com/${owner}/${repo}.git ${tempDir}`, {
      stdio: "pipe",
    });

    // 切换分支
    execSync(`git checkout ${branch}`, { cwd: tempDir, stdio: "pipe" });

    // 更新配置文件
    const configPath = path.join(tempDir, configFile);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // 提交更改
    execSync(`git add ${configFile}`, { cwd: tempDir, stdio: "pipe" });
    execSync(
      `git commit -m "Auto-update server config: ${config.server.host}"`,
      { cwd: tempDir, stdio: "pipe" }
    );
    execSync(`git push origin ${branch}`, { cwd: tempDir, stdio: "pipe" });

    // 清理临时目录
    execSync(`rmdir /s /q "${tempDir}"`, { stdio: "pipe" });

    console.log("✅ GitHub配置更新成功（本地git方式）");
  } catch (error) {
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      try {
        execSync(`rmdir /s /q "${tempDir}"`, { stdio: "pipe" });
      } catch (e) {}
    }
    throw new Error(`本地git更新失败: ${error.message}`);
  }
}

// 启动配置监控
function startConfigMonitoring(currentUrl) {
  console.log("\n🔍 启动配置监控...");

  setInterval(async () => {
    try {
      const newUrl = await getNgrokUrl();
      if (newUrl && newUrl !== currentUrl) {
        console.log(`\n🔄 检测到地址变化: ${currentUrl} → ${newUrl}`);
        console.log("📤 自动更新GitHub配置...");

        await updateGitHubConfig(newUrl);
        currentUrl = newUrl;

        console.log("✅ 配置更新完成，客户端将自动获取新地址");
      }
    } catch (error) {
      console.log(`⚠️ 配置监控错误: ${error.message}`);
    }
  }, 30000); // 每30秒检查一次
}

// 检查ngrok
async function checkNgrok() {
  const localNgrokPath = path.join(__dirname, "../../tools/ngrok.exe");

  try {
    await fs.promises.access(localNgrokPath);
    console.log("✅ 检测到本地ngrok.exe");
    return localNgrokPath;
  } catch (error) {
    throw new Error("未检测到ngrok，请先配置认证令牌");
  }
}

// 启动后端服务
function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn("npm", ["run", "dev"], {
      shell: true,
      stdio: "pipe",
      cwd: path.join(__dirname, "../../modules/admin-backend"),
    });

    server.stdout.on("data", (data) => {
      const output = data.toString();
      console.log("后端:", output.trim());
      if (output.includes("3002") && output.includes("运行在")) {
        console.log("✅ 后端服务已启动");
        // 🔥 新增：记录后端服务PID
        fs.writeFileSync(PID_FILE, server.pid.toString());
        resolve(server);
      }
    });

    server.stderr.on("data", (data) => {
      console.log("后端错误:", data.toString().trim());
    });

    server.on("error", reject);

    // 简单的超时机制，给更多时间让服务启动
    setTimeout(() => {
      reject(new Error("后端服务启动超时"));
    }, 60000); // 增加到60秒
  });
}

// 启动ngrok
function startNgrok(ngrokPath) {
  return new Promise((resolve, reject) => {
    const ngrok = spawn(ngrokPath, ["http", "3002"], {
      shell: true,
      stdio: "pipe",
    });

    let resolved = false;

    ngrok.stdout.on("data", (data) => {
      console.log("ngrok:", data.toString().trim());
    });

    ngrok.stderr.on("data", (data) => {
      console.log("ngrok:", data.toString().trim());
    });

    ngrok.on("error", reject);

    // 使用API检测ngrok状态
    const checkAPI = async () => {
      for (let i = 0; i < 120; i++) {
        // 增加到120秒
        try {
          // 尝试多个可能的端口
          const ports = [4040, 4041, 4042];
          for (const port of ports) {
            try {
              const response = await fetch(
                `http://localhost:${port}/api/tunnels`
              );
              if (response.ok) {
                const data = await response.json();
                if (data.tunnels && data.tunnels.length > 0) {
                  console.log(`✅ ngrok隧道已建立 (端口: ${port})`);
                  console.log(`🌐 公网地址: ${data.tunnels[0].public_url}`);
                  if (!resolved) {
                    resolved = true;
                    // 🔥 新增：记录ngrok进程PID
                    fs.writeFileSync(NGROK_PID_FILE, ngrok.pid.toString());
                    resolve(ngrok);
                  }
                  return;
                }
              }
            } catch (portError) {
              // 继续尝试下一个端口
            }
          }
        } catch (error) {
          // 继续等待
        }
        await sleep(1000);
      }

      if (!resolved) {
        reject(new Error("ngrok隧道建立超时"));
      }
    };

    checkAPI();
  });
}

// 获取ngrok地址
async function getNgrokUrl() {
  try {
    // 尝试多个可能的端口
    const ports = [4040, 4041, 4042];
    for (const port of ports) {
      try {
        const response = await fetch(`http://localhost:${port}/api/tunnels`);
        if (response.ok) {
          const data = await response.json();
          const httpsTunnel = data.tunnels.find((t) => t.proto === "https");
          if (httpsTunnel) {
            const url = new URL(httpsTunnel.public_url);
            return url.hostname;
          }
        }
      } catch (portError) {
        // 继续尝试下一个端口
      }
    }
  } catch (error) {
    console.error("获取ngrok地址失败:", error.message);
  }
  return null;
}

// 保存服务信息
async function saveServerInfo(ngrokUrl) {
  const serverInfo = {
    ngrokUrl: ngrokUrl,
    managementUrl: `https://${ngrokUrl}`,
    startTime: new Date().toISOString(),
    status: "running",
    autoUpdate: true,
  };

  try {
    await fs.promises.writeFile(
      path.join(__dirname, "../../server-info.json"),
      JSON.stringify(serverInfo, null, 2)
    );
  } catch (error) {
    // 忽略保存错误
  }
}

// 清理进程
function cleanup() {
  console.log("\n🧹 停止服务...");

  if (serverProcess) {
    serverProcess.kill();
    console.log("✅ 后端服务已停止");
  }

  if (ngrokProcess) {
    ngrokProcess.kill();
    console.log("✅ ngrok已停止");
  }

  // 删除服务信息文件和PID文件
  try {
    fs.unlinkSync(path.join(__dirname, "../../server-info.json"));
  } catch (error) {
    // 忽略删除错误
  }

  // 🔥 新增：清理PID文件
  [PID_FILE, NGROK_PID_FILE].forEach((file) => {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`✅ 已清理PID文件: ${path.basename(file)}`);
      }
    } catch (error) {
      // 忽略删除错误
    }
  });
}

// 睡眠函数
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 处理退出信号
process.on("SIGINT", () => {
  console.log("\n🛑 收到停止信号...");
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

// 显示配置帮助
function showConfigHelp() {
  console.log("\n" + "=".repeat(50));
  console.log("🔧 GitHub配置设置");
  console.log("=".repeat(50));
  console.log("1. 修改脚本中的GitHub配置:");
  console.log(`   owner: "${GITHUB_CONFIG.owner}" // 您的GitHub用户名`);
  console.log(`   repo: "${GITHUB_CONFIG.repo}"   // 配置仓库名`);
  console.log("\n2. 可选：设置GitHub Token环境变量:");
  console.log("   set GITHUB_TOKEN=your_token_here");
  console.log("\n3. 在GitHub创建配置仓库:");
  console.log(
    `   https://github.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`
  );
  console.log("\n" + "=".repeat(50));
}

// 检查配置
if (
  GITHUB_CONFIG.owner === "your-username" ||
  GITHUB_CONFIG.repo === "augment-config"
) {
  console.log("⚠️ 请先配置GitHub信息");
  showConfigHelp();
  process.exit(1);
}

// 运行主函数
main().catch(console.error);
