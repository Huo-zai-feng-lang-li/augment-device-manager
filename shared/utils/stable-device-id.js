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
   * @param {string} ideType - IDE类型 ('cursor', 'vscode', 或 null 为通用)
   */
  async generateStableDeviceId(ideType = null) {
    try {
      // 根据IDE类型确定缓存文件路径
      const cacheFile = ideType
        ? this.getIDESpecificCacheFile(ideType)
        : this.cacheFile;
      const backupFile = ideType
        ? this.getIDESpecificBackupFile(ideType)
        : this.backupFile;

      // 1. 尝试从主缓存文件读取
      const cachedId = await this.readFromCache(cacheFile);
      if (cachedId) {
        // 同时更新备份文件
        await this.writeToCache(backupFile, cachedId);
        return cachedId;
      }

      // 2. 尝试从备份文件读取
      const backupId = await this.readFromCache(backupFile);
      if (backupId) {
        // 恢复主缓存文件
        await this.writeToCache(cacheFile, backupId);
        return backupId;
      }

      // 3. 生成新的设备ID（根据IDE类型）
      const newId = await this.generateNewDeviceId(ideType);

      // 4. 同时保存到主缓存和备份文件
      await this.writeToCache(cacheFile, newId);
      await this.writeToCache(backupFile, newId);

      return newId;
    } catch (error) {
      console.error("生成稳定设备ID失败:", error);
      // 降级到基础设备指纹生成
      return this.generateBasicDeviceId(ideType);
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
   * @param {string} ideType - IDE类型 ('cursor', 'vscode', 或 null 为通用)
   */
  async generateNewDeviceId(ideType = null) {
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
      // 根据IDE类型添加特定标识符，确保不同IDE有不同的设备ID
      ideType: ideType || "generic",
      ideSpecific: ideType ? `${ideType}-device-id` : "generic-device-id",
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
   * @param {string} ideType - IDE类型 ('cursor', 'vscode', 或 null 为通用)
   */
  generateBasicDeviceId(ideType = null) {
    const basicInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      username: os.userInfo().username,
      totalmem: os.totalmem(),
      // 根据IDE类型添加特定标识符
      ideType: ideType || "generic",
      ideSpecific: ideType ? `${ideType}-basic-id` : "generic-basic-id",
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
   * 强制生成新的设备ID（用于清理模式）
   * 清理所有缓存并生成新的设备ID
   */
  async forceGenerateNewDeviceId(ideType = null) {
    try {
      // 1. 清理所有相关缓存
      if (ideType) {
        // 清理特定IDE的缓存
        const cacheFile = this.getIDESpecificCacheFile(ideType);
        const backupFile = this.getIDESpecificBackupFile(ideType);
        
        if (fs.existsSync(cacheFile)) {
          fs.unlinkSync(cacheFile);
        }
        if (fs.existsSync(backupFile)) {
          fs.unlinkSync(backupFile);
        }
      } else {
        // 清理通用缓存
        await this.clearCache();
      }

      // 2. 生成新的设备ID（不包含随机元素，基于硬件信息）
      const newId = await this.generateNewDeviceId(ideType);

      // 3. 保存到缓存
      if (ideType) {
        const cacheFile = this.getIDESpecificCacheFile(ideType);
        const backupFile = this.getIDESpecificBackupFile(ideType);
        await this.writeToCache(cacheFile, newId);
        await this.writeToCache(backupFile, newId);
      } else {
        await this.writeToCache(this.cacheFile, newId);
        await this.writeToCache(this.backupFile, newId);
      }

      return newId;
    } catch (error) {
      console.error("强制生成新设备ID失败:", error);
      // 降级到基础设备指纹生成
      return this.generateBasicDeviceId(ideType);
    }
  }

  /**
   * 生成Cursor IDE专用的设备ID（稳定版本）
   * 用于让Cursor IDE扩展认为是新设备，但保持稳定性
   */
  async generateCursorDeviceId() {
    // 使用与generateStableDeviceId相同的逻辑，但指定IDE类型为cursor
    return await this.generateStableDeviceId("cursor");
  }

  /**
   * 生成VS Code专用的设备ID（稳定版本）
   * 用于让VS Code扩展认为是新设备，但保持稳定性
   */
  async generateVSCodeDeviceId() {
    // 使用与generateStableDeviceId相同的逻辑，但指定IDE类型为vscode
    return await this.generateStableDeviceId("vscode");
  }

  /**
   * 获取IDE特定的缓存文件路径
   * @param {string} ideType - IDE类型 ('cursor', 'vscode')
   */
  getIDESpecificCacheFile(ideType) {
    return path.join(this.cacheDir, `stable-device-id-${ideType}.cache`);
  }

  /**
   * 获取IDE特定的备份文件路径
   * @param {string} ideType - IDE类型 ('cursor', 'vscode')
   */
  getIDESpecificBackupFile(ideType) {
    return path.join(this.cacheDir, `stable-device-id-${ideType}.backup`);
  }

  /**
   * 检查设备ID是否存在缓存
   * @param {string} ideType - IDE类型 ('cursor', 'vscode', 或 null 为通用)
   */
  hasCachedId(ideType = null) {
    if (ideType) {
      const cacheFile = this.getIDESpecificCacheFile(ideType);
      const backupFile = this.getIDESpecificBackupFile(ideType);
      return fs.existsSync(cacheFile) || fs.existsSync(backupFile);
    }
    return fs.existsSync(this.cacheFile) || fs.existsSync(this.backupFile);
  }
}

// 创建单例实例
const stableDeviceId = new StableDeviceId();

module.exports = {
  StableDeviceId,
  generateStableDeviceId: async (ideType = null) =>
    await stableDeviceId.generateStableDeviceId(ideType),
  generateCursorDeviceId: async () =>
    await stableDeviceId.generateCursorDeviceId(),
  generateVSCodeDeviceId: async () =>
    await stableDeviceId.generateVSCodeDeviceId(),
  clearDeviceIdCache: () => stableDeviceId.clearCache(),
  hasDeviceIdCache: (ideType = null) => stableDeviceId.hasCachedId(ideType),
  // 新增：IDE特定的设备ID生成
  generateIDESpecificDeviceId: async (ideType) =>
    await stableDeviceId.generateStableDeviceId(ideType),
  hasIDESpecificCache: (ideType) => stableDeviceId.hasCachedId(ideType),
};
