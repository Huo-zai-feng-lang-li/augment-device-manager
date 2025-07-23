#!/usr/bin/env node

/**
 * 远程连接问题修复工具
 * 自动修复server:start脚本的常见问题
 */

const { execSync, spawn } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

console.log("🔧 远程连接问题修复工具");
console.log("=" .repeat(50));

class RemoteConnectionFixer {
  constructor() {
    this.fixes = [];
    this.errors = [];
  }

  async fix() {
    console.log("\n🚀 开始修复远程连接问题...");
    
    try {
      await this.fixPortOccupation();
      await this.checkNgrokAuth();
      await this.fixNetworkIssues();
      await this.testConnections();
      
      this.generateReport();
    } catch (error) {
      console.error("❌ 修复过程中出现错误:", error.message);
    }
  }

  // 修复端口占用问题
  async fixPortOccupation() {
    console.log("\n🔌 修复端口占用问题...");
    
    try {
      if (process.platform === "win32") {
        // 检查端口3002占用情况
        try {
          const result = execSync("netstat -ano | findstr :3002", { 
            encoding: "utf8", 
            stdio: "pipe" 
          });
          
          if (result.trim()) {
            console.log("  ⚠️ 检测到端口3002被占用");
            
            // 提取占用进程的PID
            const lines = result.trim().split("\n");
            const pids = new Set();
            
            lines.forEach(line => {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 5 && 
                  parts[1].includes("0.0.0.0:3002") && 
                  parts[3] === "LISTENING") {
                const pid = parts[4];
                if (pid && pid !== "0") {
                  pids.add(pid);
                }
              }
            });

            // 终止占用进程
            for (const pid of pids) {
              try {
                console.log(`  🔄 终止进程 PID: ${pid}`);
                execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
                this.fixes.push(`终止了占用端口3002的进程 (PID: ${pid})`);
              } catch (error) {
                console.log(`  ⚠️ 无法终止进程 ${pid}: ${error.message}`);
              }
            }

            // 等待端口释放
            console.log("  ⏳ 等待端口释放...");
            await this.sleep(3000);
            
            // 再次检查
            try {
              const checkResult = execSync("netstat -ano | findstr :3002", { 
                encoding: "utf8", 
                stdio: "pipe" 
              });
              if (checkResult.trim()) {
                this.errors.push("端口3002仍被占用，可能需要手动处理");
              } else {
                console.log("  ✅ 端口3002已释放");
                this.fixes.push("成功释放端口3002");
              }
            } catch (error) {
              console.log("  ✅ 端口3002已释放");
              this.fixes.push("成功释放端口3002");
            }
          } else {
            console.log("  ✅ 端口3002可用");
          }
        } catch (error) {
          console.log("  ✅ 端口3002可用");
        }

        // 同时检查并清理可能的ngrok进程
        try {
          console.log("  🔄 清理ngrok进程...");
          execSync("taskkill /IM ngrok.exe /F 2>nul", { stdio: "ignore" });
          this.fixes.push("清理了ngrok进程");
        } catch (error) {
          console.log("  ℹ️ 无ngrok进程需要清理");
        }
      }
    } catch (error) {
      this.errors.push(`端口修复失败: ${error.message}`);
    }
  }

  // 检查ngrok认证配置
  async checkNgrokAuth() {
    console.log("\n🔗 检查ngrok认证配置...");
    
    try {
      const ngrokConfigPath = path.join(require("os").homedir(), ".ngrok2", "ngrok.yml");
      
      if (await fs.pathExists(ngrokConfigPath)) {
        console.log("  ✅ ngrok配置文件存在");
        
        // 检查配置内容
        try {
          const configContent = await fs.readFile(ngrokConfigPath, "utf8");
          if (configContent.includes("authtoken:")) {
            console.log("  ✅ 认证令牌已配置");
            this.fixes.push("ngrok认证令牌已正确配置");
          } else {
            console.log("  ⚠️ 配置文件存在但缺少认证令牌");
            this.errors.push("ngrok配置文件缺少认证令牌");
          }
        } catch (error) {
          this.errors.push("无法读取ngrok配置文件");
        }
      } else {
        console.log("  ❌ ngrok配置文件不存在");
        console.log("  💡 需要配置ngrok认证令牌");
        console.log("     1. 访问 https://ngrok.com/ 注册账号");
        console.log("     2. 获取认证令牌");
        console.log("     3. 运行: ngrok authtoken YOUR_TOKEN");
        this.errors.push("ngrok未配置认证令牌");
      }

      // 检查本地ngrok.exe
      const localNgrokPath = path.join(process.cwd(), "tools", "ngrok.exe");
      if (await fs.pathExists(localNgrokPath)) {
        console.log("  ✅ 本地ngrok.exe存在");
        
        // 测试ngrok版本
        try {
          const version = execSync(`"${localNgrokPath}" version`, { 
            encoding: "utf8", 
            stdio: "pipe",
            timeout: 5000
          });
          console.log(`  📋 ngrok版本: ${version.trim()}`);
          this.fixes.push("本地ngrok.exe可正常使用");
        } catch (error) {
          console.log("  ⚠️ ngrok.exe可能损坏或需要认证");
          this.errors.push("ngrok.exe无法正常运行");
        }
      } else {
        this.errors.push("本地ngrok.exe不存在");
      }
    } catch (error) {
      this.errors.push(`ngrok检查失败: ${error.message}`);
    }
  }

  // 修复网络问题
  async fixNetworkIssues() {
    console.log("\n🌐 检查网络连接...");
    
    try {
      // 检查DNS解析
      try {
        execSync("nslookup google.com", { stdio: "pipe", timeout: 5000 });
        console.log("  ✅ DNS解析正常");
        this.fixes.push("DNS解析正常");
      } catch (error) {
        console.log("  ❌ DNS解析失败");
        this.errors.push("DNS解析失败，可能影响ngrok连接");
      }

      // 检查防火墙状态
      if (process.platform === "win32") {
        try {
          const firewallResult = execSync("netsh advfirewall show allprofiles state", { 
            encoding: "utf8", 
            stdio: "pipe" 
          });
          
          if (firewallResult.includes("ON")) {
            console.log("  🛡️ Windows防火墙已启用");
            console.log("  💡 如果连接失败，可能需要添加防火墙例外");
          } else {
            console.log("  🛡️ Windows防火墙已禁用");
          }
        } catch (error) {
          console.log("  ⚠️ 无法检查防火墙状态");
        }
      }

      // 检查代理设置
      if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
        console.log("  🔄 检测到代理设置:");
        if (process.env.HTTP_PROXY) {
          console.log(`    HTTP_PROXY: ${process.env.HTTP_PROXY}`);
        }
        if (process.env.HTTPS_PROXY) {
          console.log(`    HTTPS_PROXY: ${process.env.HTTPS_PROXY}`);
        }
        console.log("  💡 代理可能影响ngrok连接");
      } else {
        console.log("  ✅ 未检测到代理设置");
      }
    } catch (error) {
      this.errors.push(`网络检查失败: ${error.message}`);
    }
  }

  // 测试连接
  async testConnections() {
    console.log("\n🧪 测试连接...");
    
    try {
      // 尝试启动后端服务进行测试
      console.log("  🚀 尝试启动后端服务...");
      
      const backendPath = path.join(process.cwd(), "modules", "admin-backend");
      
      if (await fs.pathExists(backendPath)) {
        // 检查依赖是否安装
        const nodeModulesPath = path.join(backendPath, "node_modules");
        if (!await fs.pathExists(nodeModulesPath)) {
          console.log("  📦 安装后端依赖...");
          try {
            execSync("npm install", { 
              cwd: backendPath, 
              stdio: "pipe",
              timeout: 60000
            });
            console.log("  ✅ 后端依赖安装完成");
            this.fixes.push("安装了后端依赖");
          } catch (error) {
            console.log("  ❌ 后端依赖安装失败");
            this.errors.push("后端依赖安装失败");
          }
        }

        // 启动后端服务进行测试（短时间）
        console.log("  🔄 测试后端服务启动...");
        try {
          const testServer = spawn("npm", ["run", "dev"], {
            cwd: backendPath,
            stdio: "pipe",
            shell: true
          });

          let serverStarted = false;
          
          testServer.stdout.on("data", (data) => {
            const output = data.toString();
            if (output.includes("3002") && output.includes("运行在")) {
              console.log("  ✅ 后端服务测试启动成功");
              serverStarted = true;
              this.fixes.push("后端服务可正常启动");
              
              // 立即停止测试服务
              testServer.kill();
            }
          });

          testServer.stderr.on("data", (data) => {
            console.log("  ⚠️ 后端启动警告:", data.toString().trim());
          });

          // 等待5秒测试
          await this.sleep(5000);
          
          if (!serverStarted) {
            testServer.kill();
            this.errors.push("后端服务启动测试失败");
          }
        } catch (error) {
          this.errors.push(`后端服务测试失败: ${error.message}`);
        }
      } else {
        this.errors.push("后端目录不存在");
      }
    } catch (error) {
      this.errors.push(`连接测试失败: ${error.message}`);
    }
  }

  // 生成修复报告
  generateReport() {
    console.log("\n" + "=".repeat(50));
    console.log("📊 修复报告");
    console.log("=".repeat(50));

    if (this.fixes.length > 0) {
      console.log("\n✅ 成功修复的问题:");
      this.fixes.forEach((fix, index) => {
        console.log(`  ${index + 1}. ${fix}`);
      });
    }

    if (this.errors.length > 0) {
      console.log("\n❌ 仍需手动处理的问题:");
      this.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });

      console.log("\n💡 建议的解决步骤:");
      console.log("  1. 配置ngrok认证令牌:");
      console.log("     - 访问 https://ngrok.com/ 注册账号");
      console.log("     - 获取认证令牌");
      console.log("     - 运行: tools\\ngrok.exe authtoken YOUR_TOKEN");
      console.log("");
      console.log("  2. 启动服务:");
      console.log("     - 运行: npm run server:start");
      console.log("     - 或分步骤: npm run server-only (启动后端)");
      console.log("     - 然后: tools\\ngrok.exe http 3002 (启动ngrok)");
      console.log("");
      console.log("  3. 检查防火墙和网络:");
      console.log("     - 确保网络连接正常");
      console.log("     - 如有必要，添加防火墙例外");
    } else {
      console.log("\n🎉 所有问题已修复！");
      console.log("💡 现在可以运行: npm run server:start");
    }

    console.log("\n" + "=".repeat(50));
  }

  // 睡眠函数
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 运行修复
async function main() {
  const fixer = new RemoteConnectionFixer();
  await fixer.fix();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { RemoteConnectionFixer };
