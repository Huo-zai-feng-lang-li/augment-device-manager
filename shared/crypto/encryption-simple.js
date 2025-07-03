const crypto = require("crypto");
const os = require("os");

// 简化的加密配置
const SECRET_KEY = "augment-solution-2024-secret-key-32"; // 32字节密钥

/**
 * 生成设备指纹（稳定版本，确保激活状态不会因清理操作失效）
 */
function generateDeviceFingerprint() {
  // 收集稳定的设备信息
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
  };

  // 生成指纹哈希
  const fingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify(deviceInfo))
    .digest("hex");

  return fingerprint;
}

/**
 * 简单加密（用于测试）
 */
function encrypt(text) {
  const hash = crypto.createHash("sha256").update(SECRET_KEY).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", hash, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

/**
 * 简单解密（用于测试）
 */
function decrypt(encryptedData) {
  try {
    const parts = encryptedData.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];

    const hash = crypto.createHash("sha256").update(SECRET_KEY).digest();
    const decipher = crypto.createDecipheriv("aes-256-cbc", hash, iv);

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
    // 生成一个简单的32位激活码
    const hash = crypto.createHash("md5").update(encrypted).digest("hex");
    return hash.toUpperCase();
  } catch (error) {
    console.error("生成激活码失败:", error);
    // 备用方案：生成随机32位字符串
    return crypto.randomBytes(16).toString("hex").toUpperCase();
  }
}

/**
 * 验证激活码格式（简化版，仅格式验证）
 * 🚨 安全修复：移除本地时间使用，仅做格式验证
 */
function validateActivationCode(code, deviceId) {
  try {
    // 简化验证：检查格式和长度
    if (!code || code.length !== 32) {
      return { valid: false, reason: "激活码格式错误" };
    }

    // 🔒 安全策略：仅做格式验证，不生成时间相关数据
    // 实际的激活码验证和过期检查必须在服务端使用在线时间进行
    return {
      valid: true,
      reason: "格式验证通过（简化版）",
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
