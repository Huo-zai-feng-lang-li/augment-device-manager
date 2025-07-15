const { spawn } = require("child_process");
const path = require("path");

async function testPowerShellDirect() {
  console.log("🧪 直接测试PowerShell脚本调用...\n");

  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "ide-reset-simple.ps1");

    // 测试配置
    const config = {
      mode: "preview", // 预览模式，不实际执行
      ide: "Cursor",
      extensions: ["Augment"],
      preserveLogin: true,
      deepClean: true,
      autoRestart: false,
    };

    const configJson = JSON.stringify(config);

    console.log("📜 PowerShell脚本路径:", scriptPath);
    console.log("⚙️ 配置:", config);
    console.log("");

    // 构建PowerShell命令
    const psArgs = [
      "-ExecutionPolicy",
      "Bypass",
      "-NoProfile",
      "-File",
      scriptPath,
      "-ConfigJson",
      configJson,
      "-NonInteractive",
    ];

    console.log("🚀 启动PowerShell进程...");
    console.log("命令:", "powershell.exe", psArgs.join(" "));
    console.log("");

    // 启动PowerShell进程
    const psCommand =
      process.platform === "win32"
        ? "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
        : "pwsh";
    const psProcess = spawn(psCommand, psArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    // 收集输出
    psProcess.stdout.on("data", (data) => {
      const output = data.toString("utf8");
      stdout += output;
      console.log("📤 PowerShell输出:", output.trim());
    });

    psProcess.stderr.on("data", (data) => {
      const error = data.toString("utf8");
      stderr += error;
      console.log("❌ PowerShell错误:", error.trim());
    });

    psProcess.on("close", (code) => {
      console.log("\n📋 PowerShell执行结果:");
      console.log(`  退出码: ${code}`);
      console.log(`  标准输出长度: ${stdout.length} 字符`);
      console.log(`  错误输出长度: ${stderr.length} 字符`);

      if (code === 0) {
        console.log("✅ PowerShell脚本执行成功");
        resolve({ success: true, stdout, stderr, code });
      } else {
        console.log("❌ PowerShell脚本执行失败");
        console.log("错误详情:", stderr);
        resolve({ success: false, stdout, stderr, code });
      }
    });

    psProcess.on("error", (error) => {
      console.log("❌ PowerShell进程启动失败:", error.message);
      resolve({ success: false, error: error.message });
    });

    // 设置超时
    setTimeout(() => {
      if (!psProcess.killed) {
        psProcess.kill();
        console.log("⏰ PowerShell执行超时，已终止进程");
        resolve({ success: false, error: "timeout" });
      }
    }, 30000); // 30秒超时
  });
}

// 测试PowerShell环境
async function testPowerShellEnvironment() {
  console.log("🔍 测试PowerShell环境...\n");

  return new Promise((resolve) => {
    const psCommand =
      process.platform === "win32"
        ? "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
        : "pwsh";
    const psProcess = spawn(psCommand, ["-Command", "Get-Host"], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });

    let output = "";

    psProcess.stdout.on("data", (data) => {
      output += data.toString("utf8");
    });

    psProcess.on("close", (code) => {
      if (code === 0) {
        console.log("✅ PowerShell环境正常");
        console.log("PowerShell信息:", output.trim());
      } else {
        console.log("❌ PowerShell环境异常");
      }
      resolve(code === 0);
    });

    psProcess.on("error", (error) => {
      console.log("❌ PowerShell不可用:", error.message);
      resolve(false);
    });
  });
}

// 运行测试
if (require.main === module) {
  (async () => {
    const envOk = await testPowerShellEnvironment();
    console.log("");

    if (envOk) {
      await testPowerShellDirect();
    } else {
      console.log("⚠️ PowerShell环境不可用，跳过脚本测试");
    }
  })();
}

module.exports = { testPowerShellDirect, testPowerShellEnvironment };
