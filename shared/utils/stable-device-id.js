const crypto = require("crypto");
const os = require("os");
const fs = require("fs");
const path = require("path");

/**
 * 稳定设备ID生成工具
 * 确保在同一台设备上始终生成相同的设备ID，即使经过清理操作
 */
class StableDeviceId {
  constructor() {
    this.cacheDir = path.join(os.homedir(), ".augment-device-manager");
    this.cacheFile = path.join(this.cacheDir, "stable-device-id.cache");
    this.backupFile = path.join(this.cacheDir, "stable-device-id.backup");
  }

  /**
   * 生成稳定的设备指纹
   * 优先从缓存读取，确保设备ID的稳定性
   */
  async generateStableDeviceId() {
    try {
      // 1. 尝试从主缓存文件读取
      const cachedId = await this.readFromCache(this.cacheFile);
      if (cachedId) {
        // 同时更新备份文件
        await this.writeToCache(this.backupFile, cachedId);
        return cachedId;
      }

      // 2. 尝试从备份文件读取
      const backupId = await this.readFromCache(this.backupFile);
      if (backupId) {
        // 恢复主缓存文件
        await this.writeToCache(this.cacheFile, backupId);
        return backupId;
      }

      // 3. 生成新的设备ID
      const newId = await this.generateNewDeviceId();

      // 4. 同时保存到主缓存和备份文件
      await this.writeToCache(this.cacheFile, newId);
      await this.writeToCache(this.backupFile, newId);

      return newId;
    } catch (error) {
      console.error("生成稳定设备ID失败:", error);
      // 降级到基础设备指纹生成
      return this.generateBasicDeviceId();
    }
  }

  /**
   * 从缓存文件读取设备ID
   */
  async readFromCache(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf8").trim();
        if (content && content.length === 64) {
          return content;
        }
      }
    } catch (error) {
      // 读取失败，返回null
    }
    return null;
  }

  /**
   * 写入设备ID到缓存文件
   */
  async writeToCache(filePath, deviceId) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, deviceId, "utf8");
    } catch (error) {
      // 写入失败不影响功能
      console.warn("写入设备ID缓存失败:", error.message);
    }
  }

  /**
   * 生成新的设备ID（基于稳定的硬件信息）
   */
  async generateNewDeviceId() {
    const deviceInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os
        .cpus()
        .map((cpu) => cpu.model)
        .join(""),
      totalmem: os.totalmem(),
      username: os.userInfo().username,
      homedir: os.homedir(),
      // 添加网络接口信息（相对稳定）
      networkInterfaces: this.getStableNetworkInfo(),
    };

    // 生成哈希
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(deviceInfo))
      .digest("hex");

    return hash;
  }

  /**
   * 获取稳定的网络接口信息
   */
  getStableNetworkInfo() {
    try {
      const interfaces = os.networkInterfaces();
      const stableInfo = {};

      // 只保留物理网卡的MAC地址
      for (const [name, addrs] of Object.entries(interfaces)) {
        if (addrs && Array.isArray(addrs)) {
          const physicalAddr = addrs.find(
            (addr) =>
              addr.mac && addr.mac !== "00:00:00:00:00:00" && !addr.internal
          );
          if (physicalAddr) {
            stableInfo[name] = physicalAddr.mac;
          }
        }
      }

      return JSON.stringify(stableInfo);
    } catch (error) {
      return "{}";
    }
  }

  /**
   * 生成基础设备ID（降级方案）
   */
  generateBasicDeviceId() {
    const basicInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      username: os.userInfo().username,
      totalmem: os.totalmem(),
    };

    return crypto
      .createHash("sha256")
      .update(JSON.stringify(basicInfo))
      .digest("hex");
  }

  /**
   * 清理设备ID缓存（仅在完全重置时使用）
   */
  async clearCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
      }
      if (fs.existsSync(this.backupFile)) {
        fs.unlinkSync(this.backupFile);
      }
      return true;
    } catch (error) {
      console.error("清理设备ID缓存失败:", error);
      return false;
    }
  }

  /**
   * 强制生成新的设备ID（激进模式专用）
   * 清理所有缓存并生成全新的设备ID，包含随机元素确保每次都不同
   */
  async forceGenerateNewDeviceId() {
    try {
      // 1. 清理所有缓存
      await this.clearCache();

      // 2. 生成包含随机元素的新设备ID（激进模式专用）
      const deviceInfo = {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        cpus: os
          .cpus()
          .map((cpu) => cpu.model)
          .join(""),
        totalmem: os.totalmem(),
        username: os.userInfo().username,
        homedir: os.homedir(),
        networkInterfaces: this.getStableNetworkInfo(),
        // 激进模式：添加随机元素确保设备ID变化
        randomSeed: crypto.randomBytes(32).toString("hex"),
        timestamp: Date.now(),
        aggressiveMode: true,
        forceGenerated: crypto.randomUUID(),
      };

      // 生成新的哈希
      const newId = crypto
        .createHash("sha256")
        .update(JSON.stringify(deviceInfo))
        .digest("hex");

      // 3. 保存到缓存
      await this.writeToCache(this.cacheFile, newId);
      await this.writeToCache(this.backupFile, newId);

      return newId;
    } catch (error) {
      console.error("强制生成新设备ID失败:", error);
      // 降级到基础设备指纹生成
      return this.generateBasicDeviceId();
    }
  }

  /**
   * 生成Cursor IDE专用的设备ID（包含随机元素）
   * 用于让Cursor IDE扩展认为是新设备
   */
  async generateCursorDeviceId() {
    const crypto = require("crypto");
    const os = require("os");

    // 为Cursor IDE生成包含随机元素的设备信息
    const cursorDeviceInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os
        .cpus()
        .map((cpu) => cpu.model)
        .join(""),
      totalmem: os.totalmem(),
      username: os.userInfo().username,
      // 添加随机元素，确保每次清理后Cursor IDE认为是新设备
      randomSeed: crypto.randomBytes(16).toString("hex"),
      timestamp: Date.now(),
      cursorSpecific: crypto.randomBytes(8).toString("hex"),
    };

    return crypto
      .createHash("sha256")
      .update(JSON.stringify(cursorDeviceInfo))
      .digest("hex");
  }

  /**
   * 生成VS Code专用的设备ID（包含随机元素）
   * 用于让VS Code扩展认为是新设备
   */
  async generateVSCodeDeviceId() {
    const crypto = require("crypto");
    const os = require("os");

    // 为VS Code生成包含随机元素的设备信息
    const vscodeDeviceInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os
        .cpus()
        .map((cpu) => cpu.model)
        .join(""),
      totalmem: os.totalmem(),
      username: os.userInfo().username,
      // 添加VS Code专用随机元素，确保每次清理后VS Code认为是新设备
      randomSeed: crypto.randomBytes(16).toString("hex"),
      timestamp: Date.now(),
      vscodeSpecific: crypto.randomBytes(8).toString("hex"),
    };

    return crypto
      .createHash("sha256")
      .update(JSON.stringify(vscodeDeviceInfo))
      .digest("hex");
  }

  /**
   * 检查设备ID是否存在缓存
   */
  hasCachedId() {
    return fs.existsSync(this.cacheFile) || fs.existsSync(this.backupFile);
  }
}

// 创建单例实例
const stableDeviceId = new StableDeviceId();

module.exports = {
  StableDeviceId,
  generateStableDeviceId: async () =>
    await stableDeviceId.generateStableDeviceId(),
  generateCursorDeviceId: async () =>
    await stableDeviceId.generateCursorDeviceId(),
  generateVSCodeDeviceId: async () =>
    await stableDeviceId.generateVSCodeDeviceId(),
  clearDeviceIdCache: () => stableDeviceId.clearCache(),
  hasDeviceIdCache: () => stableDeviceId.hasCachedId(),
};
