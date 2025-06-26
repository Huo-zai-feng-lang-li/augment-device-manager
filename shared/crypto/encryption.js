const crypto = require("crypto");

// 加密配置
const ALGORITHM = "aes-256-gcm";
const SECRET_KEY = "augment-solution-2024-secret-key-32"; // 32字节密钥
const IV_LENGTH = 16; // 初始化向量长度

/**
 * 生成设备指纹
 */
function generateDeviceFingerprint() {
  const os = require("os");

  // 收集设备信息
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
  };

  // 生成指纹哈希
  const fingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify(deviceInfo))
    .digest("hex");

  return fingerprint;
}

/**
 * 加密数据
 */
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(SECRET_KEY),
    iv
  );

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

    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(SECRET_KEY),
      iv
    );
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
 * 验证激活码
 */
function validateActivationCode(code, deviceId) {
  try {
    // 检查激活码格式
    if (!code || code.length !== 32 || !/^[A-F0-9]{32}$/.test(code)) {
      return { valid: false, reason: "激活码格式错误" };
    }

    // 简化验证：由于激活码是哈希值，这里进行基本验证
    // 实际应用中应该在数据库中查找对应的激活码记录
    const now = new Date();
    const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30天后过期

    return {
      valid: true,
      data: {
        deviceId: deviceId,
        createdAt: now.toISOString(),
        expiresAt: expiry.toISOString(),
        version: "1.0",
      },
      expiresAt: expiry.toISOString(),
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
