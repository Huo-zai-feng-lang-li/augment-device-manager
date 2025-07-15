/**
 * 停止守护进程脚本
 * 检查并终止可能的守护进程
 */

const { spawn, exec } = require("child_process");
const os = require("os");

async function stopGuardianProcesses() {
  console.log("🔍 检查并停止守护进程...\n");

  try {
    if (os.platform() === "win32") {
      await stopWindowsGuardianProcesses();
    } else {
      await stopUnixGuardianProcesses();
    }
  } catch (error) {
    console.error("❌ 停止守护进程失败:", error.message);
  }
}

// Windows平台停止守护进程
async function stopWindowsGuardianProcesses() {
  console.log("🔍 检查Windows守护进程...");

  return new Promise((resolve) => {
    // 使用wmic查询包含guardian关键字的node进程
    const cmd =
      "wmic process where \"name='node.exe' and commandline like '%guardian%'\" get processid,commandline /format:csv";

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.log("ℹ️ 未发现守护进程或查询失败");
        resolve();
        return;
      }

      const lines = stdout
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("Node"));
      const guardianProcesses = [];

      lines.forEach((line) => {
        const parts = line.split(",");
        if (parts.length >= 3) {
          const commandLine = parts[1];
          const processId = parts[2];

          if (
            commandLine &&
            processId &&
            (commandLine.includes("guardian") ||
              commandLine.includes("enhanced-device-guardian") ||
              commandLine.includes("standalone-guardian-service")) &&
            !commandLine.includes("stop-guardian-processes.js")
          ) {
            guardianProcesses.push({
              pid: processId.trim(),
              command: commandLine.trim(),
            });
          }
        }
      });

      if (guardianProcesses.length > 0) {
        console.log(`🎯 发现 ${guardianProcesses.length} 个守护进程:`);
        guardianProcesses.forEach((proc, index) => {
          console.log(`   ${index + 1}. PID: ${proc.pid}`);
          console.log(`      命令: ${proc.command.substring(0, 80)}...`);
        });

        // 终止这些进程
        console.log("\n🛑 正在终止守护进程...");
        guardianProcesses.forEach((proc) => {
          try {
            exec(`taskkill /F /PID ${proc.pid}`, (killError) => {
              if (!killError) {
                console.log(`✅ 已终止进程 PID: ${proc.pid}`);
              }
            });
          } catch (e) {
            console.log(`⚠️ 终止进程 ${proc.pid} 失败`);
          }
        });

        setTimeout(() => {
          console.log("✅ 守护进程终止操作完成");
          resolve();
        }, 2000);
      } else {
        console.log("ℹ️ 未发现运行中的守护进程");
        resolve();
      }
    });
  });
}

// Unix/Linux/macOS平台停止守护进程
async function stopUnixGuardianProcesses() {
  console.log("🔍 检查Unix守护进程...");

  return new Promise((resolve) => {
    exec("ps aux | grep node | grep guardian", (error, stdout, stderr) => {
      if (error || !stdout.trim()) {
        console.log("ℹ️ 未发现守护进程");
        resolve();
        return;
      }

      const lines = stdout.trim().split("\n");
      const guardianProcesses = [];

      lines.forEach((line) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const pid = parts[1];
          const command = parts.slice(10).join(" ");

          if (command.includes("guardian") && !command.includes("grep")) {
            guardianProcesses.push({ pid, command });
          }
        }
      });

      if (guardianProcesses.length > 0) {
        console.log(`🎯 发现 ${guardianProcesses.length} 个守护进程:`);
        guardianProcesses.forEach((proc, index) => {
          console.log(`   ${index + 1}. PID: ${proc.pid}`);
          console.log(`      命令: ${proc.command.substring(0, 80)}...`);
        });

        // 终止这些进程
        console.log("\n🛑 正在终止守护进程...");
        guardianProcesses.forEach((proc) => {
          try {
            exec(`kill -9 ${proc.pid}`, (killError) => {
              if (!killError) {
                console.log(`✅ 已终止进程 PID: ${proc.pid}`);
              }
            });
          } catch (e) {
            console.log(`⚠️ 终止进程 ${proc.pid} 失败`);
          }
        });

        setTimeout(() => {
          console.log("✅ 守护进程终止操作完成");
          resolve();
        }, 2000);
      } else {
        console.log("ℹ️ 未发现运行中的守护进程");
        resolve();
      }
    });
  });
}

// 检查剩余进程
async function checkRemainingProcesses() {
  console.log("\n🔍 检查剩余Node.js进程...");

  return new Promise((resolve) => {
    if (os.platform() === "win32") {
      exec("tasklist | findstr node.exe", (error, stdout) => {
        if (error || !stdout.trim()) {
          console.log("✅ 未发现剩余Node.js进程");
        } else {
          const lines = stdout.trim().split("\n");
          console.log(`ℹ️ 发现 ${lines.length} 个Node.js进程仍在运行`);
          console.log("💡 这些可能是其他应用的Node.js进程，不影响激活状态");
        }
        resolve();
      });
    } else {
      exec("ps aux | grep node | grep -v grep", (error, stdout) => {
        if (error || !stdout.trim()) {
          console.log("✅ 未发现剩余Node.js进程");
        } else {
          const lines = stdout.trim().split("\n");
          console.log(`ℹ️ 发现 ${lines.length} 个Node.js进程仍在运行`);
          console.log("💡 这些可能是其他应用的Node.js进程，不影响激活状态");
        }
        resolve();
      });
    }
  });
}

// 主函数
async function main() {
  await stopGuardianProcesses();
  await checkRemainingProcesses();

  console.log("\n" + "=".repeat(50));
  console.log("✅ 守护进程检查和清理完成");
  console.log("=".repeat(50));
  console.log("🎯 状态: 防护守护功能已停止");
  console.log("💡 建议: 如果仍有疑虑，可以重启计算机确保完全清理");
}

// 运行脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { stopGuardianProcesses, checkRemainingProcesses };
