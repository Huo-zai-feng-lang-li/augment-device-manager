const crypto = require("crypto");

// 加密配置
const ALGORITHM = "aes-256-cbc";
const SECRET_KEY = crypto
  .createHash("sha256")
  .update("augment-solution-2024-secret-key")
  .digest(); // 32字节密钥
const IV_LENGTH = 16; // 初始化向量长度

/**
 * 生成设备指纹（使用稳定的设备ID生成逻辑）
 */
async function generateDeviceFingerprint() {
  try {
    // 使用新的稳定设备ID生成器
    const { generateStableDeviceId } = require("../utils/stable-device-id");
    return await generateStableDeviceId();
  } catch (error) {
    console.error("使用稳定设备ID生成器失败，降级到传统方法:", error);

    // 降级到传统方法
    const os = require("os");
    const fs = require("fs");
    const path = require("path");

    // 设备指纹缓存文件路径
    const fingerprintCachePath = path.join(
      os.homedir(),
      ".augment-device-manager",
      "device-fingerprint.cache"
    );

    // 尝试读取缓存的设备指纹
    try {
      if (fs.existsSync(fingerprintCachePath)) {
        const cachedFingerprint = fs
          .readFileSync(fingerprintCachePath, "utf8")
          .trim();
        if (cachedFingerprint && cachedFingerprint.length === 64) {
          return cachedFingerprint;
        }
      }
    } catch (error) {
      // 缓存读取失败，继续生成新的指纹
    }

    // 收集稳定的设备信息（移除随机元素以确保激活状态稳定）
    const deviceInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os
        .cpus()
        .map((cpu) => cpu.model)
        .join(""),
      totalmem: os.totalmem(),
      networkInterfaces: JSON.stringify(os.networkInterfaces()),
      // 使用稳定的用户信息替代随机元素
      username: os.userInfo().username,
      homedir: os.homedir(),
    };

    // 生成指纹哈希
    const fingerprint = crypto
      .createHash("sha256")
      .update(JSON.stringify(deviceInfo))
      .digest("hex");

    // 缓存设备指纹
    try {
      const cacheDir = path.dirname(fingerprintCachePath);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(fingerprintCachePath, fingerprint, "utf8");
    } catch (error) {
      // 缓存写入失败不影响功能
    }

    return fingerprint;
  }
}

/**
 * 加密数据
 */
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

/**
 * 解密数据
 */
function decrypt(encryptedData) {
  try {
    const parts = encryptedData.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error("解密失败");
  }
}

/**
 * 生成激活码
 */
function generateActivationCode(deviceId, expiryDays = 30) {
  const now = new Date();
  const expiry = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

  const codeData = {
    deviceId: deviceId || "any",
    createdAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
    version: "1.0",
  };

  try {
    const encrypted = encrypt(JSON.stringify(codeData));
    // 生成32位激活码，使用加密数据的哈希
    const hash = crypto.createHash("md5").update(encrypted).digest("hex");
    return hash.toUpperCase();
  } catch (error) {
    console.error("生成激活码失败:", error);
    // 备用方案：生成随机32位字符串
    return crypto.randomBytes(16).toString("hex").toUpperCase();
  }
}

/**
 * 验证激活码格式（仅格式验证，不涉及时间）
 * 🚨 安全修复：移除本地时间使用，仅做格式验证
 * 实际的过期验证应该在服务端使用在线时间进行
 */
function validateActivationCode(code, deviceId) {
  try {
    // 检查激活码格式（支持大小写字母和数字）
    if (!code || code.length !== 32 || !/^[A-Fa-f0-9]{32}$/.test(code)) {
      return { valid: false, reason: "激活码格式错误" };
    }

    // 🔒 安全策略：仅做格式验证，不生成时间相关数据
    // 实际的激活码验证和过期检查必须在服务端使用在线时间进行
    return {
      valid: true,
      reason: "格式验证通过",
      note: "实际验证需要服务端在线时间确认",
    };
  } catch (error) {
    return { valid: false, reason: "验证失败: " + error.message };
  }
}

module.exports = {
  generateDeviceFingerprint,
  encrypt,
  decrypt,
  generateActivationCode,
  validateActivationCode,
};
