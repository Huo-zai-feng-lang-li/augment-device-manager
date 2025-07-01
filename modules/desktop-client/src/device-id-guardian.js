const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const chokidar = require("chokidar");

/**
 * 设备ID守护者 - 实时监控和拦截IDE的自动恢复
 * 防止Cursor IDE自动修改或恢复设备ID
 */

class DeviceIdGuardian {
  constructor() {
    this.targetDeviceId = null;
    this.isGuarding = false;
    this.watcher = null;
    this.storageJsonPath = path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Cursor",
      "User",
      "globalStorage",
      "storage.json"
    );
    this.tempFilePath = this.storageJsonPath + ".vsctmp";
  }

  /**
   * 开始守护指定的设备ID
   */
  async startGuarding(deviceId) {
    if (this.isGuarding) {
      console.log("⚠️ 守护进程已在运行");
      return;
    }

    this.targetDeviceId = deviceId;
    this.isGuarding = true;

    console.log("🛡️ 启动设备ID守护进程");
    console.log(`🎯 目标设备ID: ${deviceId}`);
    console.log("==================================================");

    try {
      // 1. 设置初始保护
      await this.setupInitialProtection();

      // 2. 启动文件监控
      await this.startFileWatcher();

      // 3. 启动进程监控
      await this.startProcessMonitor();

      console.log("✅ 守护进程启动成功");
    } catch (error) {
      console.error("❌ 守护进程启动失败:", error);
      this.isGuarding = false;
    }
  }

  /**
   * 停止守护
   */
  async stopGuarding() {
    if (!this.isGuarding) return;

    console.log("🛑 停止设备ID守护进程");

    this.isGuarding = false;

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    console.log("✅ 守护进程已停止");
  }

  /**
   * 设置初始保护
   */
  async setupInitialProtection() {
    try {
      // 确保目标设备ID已设置
      await this.enforceTargetDeviceId();

      // 设置文件只读保护
      await this.setFileProtection();

      // 清理可能的临时文件
      await this.cleanupTempFiles();

      console.log("🔒 初始保护设置完成");
    } catch (error) {
      console.error("❌ 设置初始保护失败:", error);
    }
  }

  /**
   * 强制设置目标设备ID
   */
  async enforceTargetDeviceId() {
    try {
      let currentData = {};

      // 读取现有数据
      if (await fs.pathExists(this.storageJsonPath)) {
        try {
          currentData = await fs.readJson(this.storageJsonPath);
        } catch (error) {
          console.log("⚠️ 读取现有配置失败，将创建新配置");
        }
      }

      // 强制设置目标设备ID
      currentData["telemetry.devDeviceId"] = this.targetDeviceId;

      // 确保目录存在
      await fs.ensureDir(path.dirname(this.storageJsonPath));

      // 写入配置
      await fs.writeJson(this.storageJsonPath, currentData, { spaces: 2 });

      console.log(`✅ 已强制设置设备ID: ${this.targetDeviceId}`);
    } catch (error) {
      console.error("❌ 强制设置设备ID失败:", error);
    }
  }

  /**
   * 设置文件保护
   */
  async setFileProtection() {
    try {
      // 在Windows上设置只读属性
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);

      await execAsync(`attrib +R "${this.storageJsonPath}"`);
      console.log("🔒 已设置文件只读保护");
    } catch (error) {
      console.log("⚠️ 无法设置只读保护（权限不足）");
    }
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFiles() {
    try {
      const tempFiles = [
        this.tempFilePath,
        this.storageJsonPath + ".tmp",
        this.storageJsonPath + ".bak",
      ];

      for (const tempFile of tempFiles) {
        if (await fs.pathExists(tempFile)) {
          await fs.remove(tempFile);
          console.log(`🧹 已清理临时文件: ${path.basename(tempFile)}`);
        }
      }
    } catch (error) {
      console.error("❌ 清理临时文件失败:", error);
    }
  }

  /**
   * 启动文件监控
   */
  async startFileWatcher() {
    const watchDir = path.dirname(this.storageJsonPath);

    this.watcher = chokidar.watch(watchDir, {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher.on("add", (filePath) => {
      this.handleFileChange("add", filePath);
    });

    this.watcher.on("change", (filePath) => {
      this.handleFileChange("change", filePath);
    });

    this.watcher.on("unlink", (filePath) => {
      this.handleFileChange("unlink", filePath);
    });

    console.log("👁️ 文件监控已启动");
  }

  /**
   * 处理文件变化
   */
  async handleFileChange(event, filePath) {
    if (!this.isGuarding) return;

    const fileName = path.basename(filePath);

    // 监控storage.json相关文件
    if (fileName.startsWith("storage.json")) {
      console.log(`🔍 检测到文件变化: ${event} - ${fileName}`);

      if (fileName === "storage.json.vsctmp") {
        // IDE创建了临时文件，立即拦截
        await this.interceptTempFile(filePath);
      } else if (fileName === "storage.json") {
        // 主配置文件被修改，验证设备ID
        await this.verifyDeviceId();
      }
    }
  }

  /**
   * 拦截临时文件
   */
  async interceptTempFile(tempFilePath) {
    try {
      console.log("🚨 拦截IDE临时文件修改");

      // 读取临时文件内容
      const tempData = await fs.readJson(tempFilePath);

      // 检查设备ID是否被修改
      if (tempData["telemetry.devDeviceId"] !== this.targetDeviceId) {
        console.log(`⚠️ 检测到设备ID被修改:`);
        console.log(`  原ID: ${this.targetDeviceId}`);
        console.log(`  新ID: ${tempData["telemetry.devDeviceId"]}`);

        // 强制恢复目标设备ID
        tempData["telemetry.devDeviceId"] = this.targetDeviceId;

        // 写回临时文件
        await fs.writeJson(tempFilePath, tempData, { spaces: 4 });

        console.log("✅ 已拦截并恢复目标设备ID");
      }
    } catch (error) {
      console.error("❌ 拦截临时文件失败:", error);
    }
  }

  /**
   * 验证设备ID
   */
  async verifyDeviceId() {
    try {
      if (!(await fs.pathExists(this.storageJsonPath))) {
        console.log("⚠️ 配置文件被删除，正在恢复...");
        await this.enforceTargetDeviceId();
        return;
      }

      const currentData = await fs.readJson(this.storageJsonPath);
      const currentDeviceId = currentData["telemetry.devDeviceId"];

      if (currentDeviceId !== this.targetDeviceId) {
        console.log("🚨 设备ID被篡改，正在恢复...");
        console.log(`  当前ID: ${currentDeviceId}`);
        console.log(`  目标ID: ${this.targetDeviceId}`);

        // 强制恢复
        await this.enforceTargetDeviceId();
        await this.setFileProtection();

        console.log("✅ 设备ID已恢复");
      }
    } catch (error) {
      console.error("❌ 验证设备ID失败:", error);
    }
  }

  /**
   * 启动进程监控
   */
  async startProcessMonitor() {
    // 定期检查Cursor进程状态
    setInterval(async () => {
      if (!this.isGuarding) return;

      try {
        // 检查是否有新的临时文件
        if (await fs.pathExists(this.tempFilePath)) {
          await this.interceptTempFile(this.tempFilePath);
        }

        // 验证设备ID
        await this.verifyDeviceId();
      } catch (error) {
        // 静默处理错误，避免日志过多
      }
    }, 30000); // 每30秒检查一次（降低系统负载）

    console.log("⏰ 进程监控已启动");
  }

  /**
   * 获取当前状态
   */
  async getStatus() {
    try {
      const exists = await fs.pathExists(this.storageJsonPath);
      let currentDeviceId = null;

      if (exists) {
        const data = await fs.readJson(this.storageJsonPath);
        currentDeviceId = data["telemetry.devDeviceId"];
      }

      return {
        isGuarding: this.isGuarding,
        targetDeviceId: this.targetDeviceId,
        currentDeviceId: currentDeviceId,
        isProtected: currentDeviceId === this.targetDeviceId,
        configExists: exists,
      };
    } catch (error) {
      return {
        isGuarding: this.isGuarding,
        targetDeviceId: this.targetDeviceId,
        currentDeviceId: null,
        isProtected: false,
        configExists: false,
        error: error.message,
      };
    }
  }
}

module.exports = { DeviceIdGuardian };
