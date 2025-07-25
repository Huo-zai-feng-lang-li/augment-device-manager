// 共享类型定义和接口

/**
 * 激活码数据结构
 */
const ActivationCodeSchema = {
  id: "number",
  code: "string",
  device_id: "string|null",
  created_at: "string",
  expires_at: "string",
  used_at: "string|null",
  used_by_device: "string|null",
  status: "string", // 'active', 'used', 'expired'
  notes: "string",
};

/**
 * 设备信息结构
 */
const DeviceInfoSchema = {
  deviceId: "string",
  platform: "string",
  arch: "string",
  hostname: "string",
  username: "string",
  version: "string",
  cpus: "array",
  totalmem: "number",
  networkInterfaces: "object",
};

/**
 * 激活验证结果
 */
const ValidationResultSchema = {
  valid: "boolean",
  reason: "string|null",
  data: "object|null",
  expiresAt: "string|null",
};

/**
 * API响应格式
 */
const ApiResponseSchema = {
  success: "boolean",
  data: "any|null",
  error: "string|null",
  message: "string|null",
};

/**
 * 清理操作结果
 */
const CleanupResultSchema = {
  success: "boolean",
  actions: "array",
  errors: "array",
  error: "string|null",
};

/**
 * 使用记录结构
 */
const UsageLogSchema = {
  id: "number",
  activation_code: "string",
  device_id: "string",
  action: "string",
  timestamp: "string",
  details: "string",
};

/**
 * 统计信息结构
 */
const StatsSchema = {
  totalCodes: "number",
  activeCodes: "number",
  usedCodes: "number",
  expiredCodes: "number",
  totalUsage: "number",
  recentUsage: "number",
};

/**
 * 应用配置结构
 */
const AppConfigSchema = {
  activation: {
    code: "string",
    deviceId: "string",
    activatedAt: "string",
    expiresAt: "string",
    version: "string",
  },
  lastUpdated: "string",
};

/**
 * Augment扩展信息
 */
const AugmentExtensionInfoSchema = {
  installed: "boolean",
  version: "string|null",
  path: "string|null",
  storageExists: "boolean",
  storagePath: "string|null",
};

// 常量定义
const CONSTANTS = {
  // 激活码状态
  ACTIVATION_STATUS: {
    ACTIVE: "active",
    USED: "used",
    EXPIRED: "expired",
  },

  // 操作类型
  ACTION_TYPES: {
    CREATED: "created",
    ACTIVATED: "activated",
    FAILED: "failed",
    CLEANUP: "cleanup",
    RESET: "reset",
  },

  // 平台类型
  PLATFORMS: {
    WINDOWS: "win32",
    MACOS: "darwin",
    LINUX: "linux",
  },

  // 默认配置
  DEFAULTS: {
    EXPIRY_DAYS: 30,
    MAX_DEVICES: 1,
    CODE_LENGTH: 32,
  },

  // 错误消息
  ERROR_MESSAGES: {
    INVALID_CODE: "激活码格式错误",
    EXPIRED_CODE: "激活码已过期",
    DEVICE_MISMATCH: "设备不匹配",
    ALREADY_USED: "激活码已被使用",
    NETWORK_ERROR: "网络连接错误",
    VALIDATION_FAILED: "验证失败",
    CLEANUP_FAILED: "清理操作失败",
    DEVICE_INFO_FAILED: "获取设备信息失败",
  },

  // 成功消息
  SUCCESS_MESSAGES: {
    ACTIVATION_SUCCESS: "激活成功",
    CLEANUP_SUCCESS: "清理完成",
    RESET_SUCCESS: "重置成功",
    CODE_GENERATED: "激活码生成成功",
  },
};

// 验证函数
const validators = {
  /**
   * 验证激活码格式
   */
  isValidActivationCode(code) {
    return (
      typeof code === "string" &&
      code.length === CONSTANTS.DEFAULTS.CODE_LENGTH &&
      /^[A-Za-z0-9_]+$/.test(code)
    );
  },

  /**
   * 验证设备ID格式
   * 支持两种格式：
   * 1. 传统哈希格式：64位十六进制字符串 (a-f0-9)
   * 2. UUID格式：36位带连字符的UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
   */
  isValidDeviceId(deviceId) {
    if (typeof deviceId !== "string" || deviceId.length === 0) {
      return false;
    }

    // UUID格式验证：36位，包含4个连字符
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (deviceId.length === 36 && uuidRegex.test(deviceId)) {
      return true;
    }

    // 传统哈希格式验证：纯十六进制字符串
    const hashRegex = /^[a-f0-9]+$/;
    if (hashRegex.test(deviceId)) {
      return true;
    }

    return false;
  },

  /**
   * 验证日期格式
   */
  isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  },

  /**
   * 验证邮箱格式
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
};

// 工具函数
const utils = {
  /**
   * 格式化日期
   */
  formatDate(date, locale = "zh-CN") {
    return new Date(date).toLocaleString(locale);
  },

  /**
   * 计算剩余天数（使用在线时间）
   */
  async calculateRemainingDays(expiryDate) {
    const { timeService } = require("../utils/time-service");
    return await timeService.calculateRemainingDays(expiryDate, true); // 允许回退到本地时间
  },

  /**
   * 生成随机字符串
   */
  generateRandomString(length = 16) {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * 深度克隆对象
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * 延迟执行
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};

module.exports = {
  // 数据结构
  ActivationCodeSchema,
  DeviceInfoSchema,
  ValidationResultSchema,
  ApiResponseSchema,
  CleanupResultSchema,
  UsageLogSchema,
  StatsSchema,
  AppConfigSchema,
  AugmentExtensionInfoSchema,

  // 常量
  CONSTANTS,

  // 验证函数
  validators,

  // 工具函数
  utils,
};
