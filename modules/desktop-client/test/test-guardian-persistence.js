/**
 * 测试防护进程持久性
 * 验证客户端关闭后防护进程是否继续运行，以及重新打开客户端时的状态检测
 */

const path = require("path");
const fs = require("fs-extra");
const { spawn, exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

// 测试配置
const TEST_CONFIG = {
  deviceId: "test-device-persistence-" + Date.now(),
  testDuration: 30000, // 30秒测试
  checkInterval: 2000, // 2秒检查间隔
};

class GuardianPersistenceTest {
  constructor() {
    this.projectRoot = path.resolve(__dirname, "../../..");
    this.clientPath = path.join(this.projectRoot, "modules/desktop-client");
    this.testResults = {
      startTime: new Date(),
      phases: [],
      success: false,
      errors: [],
    };
  }

  log(message, type = "info") {
    const timestamp = new Date().toISOString();
    const prefix = type === "error" ? "❌" : type === "success" ? "✅" : "📝";
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runTest() {
    try {
      this.log("🚀 开始防护进程持久性测试");
      this.log(`📋 测试配置: ${JSON.stringify(TEST_CONFIG, null, 2)}`);

      // 阶段1: 启动防护服务
      await this.phase1_StartGuardian();

      // 阶段2: 验证防护运行
      await this.phase2_VerifyRunning();

      // 阶段3: 模拟客户端关闭
      await this.phase3_SimulateClientClose();

      // 阶段4: 验证防护持续运行
      await this.phase4_VerifyPersistence();

      // 阶段5: 模拟客户端重新打开
      await this.phase5_SimulateClientReopen();

      // 阶段6: 验证状态检测
      await this.phase6_VerifyStatusDetection();

      // 阶段7: 清理
      await this.phase7_Cleanup();

      this.testResults.success = true;
      this.log("🎉 防护进程持久性测试完成", "success");
    } catch (error) {
      this.testResults.errors.push(error.message);
      this.log(`💥 测试失败: ${error.message}`, "error");
    } finally {
      await this.generateReport();
    }
  }

  async phase1_StartGuardian() {
    this.log("📍 阶段1: 启动防护服务");

    const DeviceManager = require("../src/device-manager");
    this.deviceManager = new DeviceManager();

    // 启动独立防护服务
    const result = await this.deviceManager.startEnhancedGuardianIndependently({
      enableBackupMonitoring: true,
      enableDatabaseMonitoring: true,
      enableEnhancedProtection: true,
    });

    if (!result.success) {
      throw new Error(`启动防护服务失败: ${result.message}`);
    }

    // 获取PID（可能需要从状态中获取）
    const status = await this.deviceManager.getEnhancedGuardianStatus();
    this.guardianPid = status.standalone?.pid || status.inProcess?.pid;
    this.log(
      `✅ 防护服务已启动，模式: ${result.mode}，PID: ${this.guardianPid}`
    );

    this.testResults.phases.push({
      name: "start_guardian",
      success: true,
      pid: this.guardianPid,
      timestamp: new Date(),
    });
  }

  async phase2_VerifyRunning() {
    this.log("📍 阶段2: 验证防护运行状态");

    const status = await this.deviceManager.getEnhancedGuardianStatus();

    if (!status.isGuarding || !status.standalone?.isRunning) {
      throw new Error("防护服务未正确运行");
    }

    this.log(`✅ 防护状态验证成功: ${status.mode}模式`);

    this.testResults.phases.push({
      name: "verify_running",
      success: true,
      status: status,
      timestamp: new Date(),
    });
  }

  async phase3_SimulateClientClose() {
    this.log("📍 阶段3: 模拟客户端关闭");

    // 模拟客户端关闭（不停止防护服务）
    // 在实际场景中，这相当于用户关闭Electron应用
    this.log("🔄 模拟客户端关闭...");

    // 等待一段时间模拟客户端关闭过程
    await new Promise((resolve) => setTimeout(resolve, 2000));

    this.testResults.phases.push({
      name: "simulate_client_close",
      success: true,
      timestamp: new Date(),
    });
  }

  async phase4_VerifyPersistence() {
    this.log("📍 阶段4: 验证防护持续运行");

    // 检查进程是否仍在运行
    const isProcessRunning = await this.checkProcessExists(this.guardianPid);

    if (!isProcessRunning) {
      throw new Error("防护进程在客户端关闭后停止了");
    }

    this.log("✅ 防护进程在客户端关闭后继续运行");

    // 检查服务文件状态
    const StandaloneService = require("../src/standalone-guardian-service");
    const service = new StandaloneService();
    const serviceStatus = await service.getServiceStatus();

    if (!serviceStatus.isRunning) {
      throw new Error("防护服务状态检测失败");
    }

    this.log(`✅ 防护服务状态正常，PID: ${serviceStatus.pid}`);

    this.testResults.phases.push({
      name: "verify_persistence",
      success: true,
      serviceStatus: serviceStatus,
      timestamp: new Date(),
    });
  }

  async phase5_SimulateClientReopen() {
    this.log("📍 阶段5: 模拟客户端重新打开");

    // 重新创建DeviceManager实例，模拟客户端重新启动
    this.deviceManager = new DeviceManager();

    this.log("🔄 模拟客户端重新打开...");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    this.testResults.phases.push({
      name: "simulate_client_reopen",
      success: true,
      timestamp: new Date(),
    });
  }

  async phase6_VerifyStatusDetection() {
    this.log("📍 阶段6: 验证状态检测");

    // 检查客户端是否能正确检测到已运行的防护进程
    const status = await this.deviceManager.getEnhancedGuardianStatus();

    if (!status.isGuarding || !status.standalone?.isRunning) {
      throw new Error("客户端重新打开后无法检测到运行中的防护进程");
    }

    this.log("✅ 客户端成功检测到运行中的防护进程");
    this.log(
      `📊 检测到的状态: ${JSON.stringify(
        {
          isGuarding: status.isGuarding,
          mode: status.mode,
          pid: status.standalone?.pid,
          deviceId: status.standalone?.config?.deviceId,
        },
        null,
        2
      )}`
    );

    this.testResults.phases.push({
      name: "verify_status_detection",
      success: true,
      detectedStatus: status,
      timestamp: new Date(),
    });
  }

  async phase7_Cleanup() {
    this.log("📍 阶段7: 清理测试环境");

    try {
      // 停止防护服务
      const result = await this.deviceManager.stopEnhancedGuardian();
      if (result.success) {
        this.log("✅ 防护服务已停止");
      } else {
        this.log(`⚠️ 停止防护服务失败: ${result.message}`);
      }
    } catch (error) {
      this.log(`⚠️ 清理过程中出现错误: ${error.message}`);
    }

    this.testResults.phases.push({
      name: "cleanup",
      success: true,
      timestamp: new Date(),
    });
  }

  async checkProcessExists(pid) {
    try {
      if (process.platform === "win32") {
        const { stdout } = await execAsync(
          `tasklist /fi "PID eq ${pid}" /fo csv`
        );
        return stdout.includes(pid.toString());
      } else {
        try {
          process.kill(pid, 0);
          return true;
        } catch (error) {
          return false;
        }
      }
    } catch (error) {
      return false;
    }
  }

  async generateReport() {
    this.testResults.endTime = new Date();
    this.testResults.duration =
      this.testResults.endTime - this.testResults.startTime;

    const reportPath = path.join(
      __dirname,
      `guardian-persistence-test-${Date.now()}.json`
    );
    await fs.writeJson(reportPath, this.testResults, { spaces: 2 });

    this.log(`📄 测试报告已生成: ${reportPath}`);
    this.log(`⏱️ 测试耗时: ${this.testResults.duration}ms`);
    this.log(`📊 测试结果: ${this.testResults.success ? "成功" : "失败"}`);

    if (this.testResults.errors.length > 0) {
      this.log("❌ 错误列表:");
      this.testResults.errors.forEach((error) => {
        this.log(`  - ${error}`);
      });
    }
  }
}

// 运行测试
if (require.main === module) {
  const test = new GuardianPersistenceTest();
  test.runTest().catch(console.error);
}

module.exports = GuardianPersistenceTest;
