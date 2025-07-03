/**
 * 北京时间API服务
 * 简化的在线时间获取，替代复杂的本地时间判断逻辑
 */

const fetch = require("node-fetch");

class BeijingTimeAPI {
  constructor() {
    // 只使用两个可靠的时间API源
    this.timeAPIs = [
      // 苏宁时间API（国内可靠，简洁）
      "https://f.m.suning.com/api/ct.do",
      // 腾讯视频时间API（国内备用）
      "https://vv.video.qq.com/checktime?otype=json",
    ];

    this.cachedTime = null;
    this.cacheTimestamp = null;
    this.cacheValidDuration = 5 * 60 * 1000; // 5分钟缓存
  }

  /**
   * 获取北京时间（安全版 - 网络失败时抛出异常）
   * @returns {Promise<Date>} 北京时间
   * @throws {Error} 当无法获取在线时间时抛出异常
   */
  async getBeijingTime() {
    // 检查缓存
    if (this.isValidCache()) {
      const elapsed = Date.now() - this.cacheTimestamp;
      return new Date(this.cachedTime.getTime() + elapsed);
    }

    // 尝试从在线API获取时间
    const onlineTime = await this.fetchOnlineTime();
    if (onlineTime) {
      this.updateCache(onlineTime);
      return onlineTime;
    }

    // 🚨 安全策略：网络失败时抛出异常，不回退到本地时间
    throw new Error(
      "无法获取在线北京时间：所有时间API均不可用，为确保安全已拒绝使用本地时间"
    );
  }

  /**
   * 从在线API获取时间
   * @returns {Promise<Date|null>}
   */
  async fetchOnlineTime() {
    for (const apiUrl of this.timeAPIs) {
      try {
        console.log(`🌐 尝试获取在线时间: ${apiUrl}`);

        const response = await fetch(apiUrl, {
          timeout: 5000,
          headers: {
            "User-Agent": "Augment-Device-Manager/1.0",
          },
        });

        if (!response.ok) {
          continue;
        }

        let data;
        if (apiUrl.includes("qq.com")) {
          // 腾讯视频API返回JSONP格式，需要特殊处理
          const text = await response.text();
          // 提取JSON部分：QZOutputJson={"s":"o","t":1751524191,...};
          const jsonMatch = text.match(/QZOutputJson=({.*?});/);
          if (jsonMatch) {
            data = JSON.parse(jsonMatch[1]);
          } else {
            continue;
          }
        } else {
          // 其他API返回标准JSON
          data = await response.json();
        }

        const beijingTime = this.parseTimeFromAPI(data, apiUrl);

        if (beijingTime) {
          console.log(
            `✅ 成功获取北京时间: ${beijingTime.toLocaleString("zh-CN")}`
          );
          return beijingTime;
        }
      } catch (error) {
        console.warn(`时间API ${apiUrl} 失败:`, error.message);
        continue;
      }
    }

    return null;
  }

  /**
   * 解析不同API的时间格式
   * @param {Object} data API响应数据
   * @param {string} apiUrl API地址
   * @returns {Date|null}
   */
  parseTimeFromAPI(data, apiUrl) {
    try {
      if (apiUrl.includes("suning.com")) {
        // 苏宁时间API格式：{"api":"time","code":"1","currentTime": 1751523849747,"msg":""}
        if (data.currentTime && data.code === "1") {
          // currentTime是毫秒时间戳，直接创建Date对象
          return new Date(data.currentTime);
        }
      } else if (apiUrl.includes("qq.com")) {
        // 腾讯视频时间API格式：QZOutputJson={"s":"o","t":1751524191,"ip":"...","pos":"---","rand":"..."};
        if (data.t) {
          // t是秒时间戳，需要转换为毫秒
          return new Date(data.t * 1000);
        }
      }
    } catch (error) {
      console.warn("解析时间数据失败:", error.message);
    }

    return null;
  }

  /**
   * 获取本地推算的北京时间
   * ⚠️ 警告：此方法仅用于显示目的，不应用于安全验证
   * 🚨 安全策略：激活码验证必须使用 getBeijingTime() 方法获取在线时间
   * @returns {Date}
   */
  getLocalBeijingTime() {
    const now = new Date();
    // 获取本地时区偏移（分钟）
    const localOffset = now.getTimezoneOffset();
    // 北京时间是UTC+8，即-480分钟
    const beijingOffset = -480;
    // 计算时差
    const offsetDiff = beijingOffset - localOffset;

    return new Date(now.getTime() + offsetDiff * 60 * 1000);
  }

  /**
   * 检查缓存是否有效
   * @returns {boolean}
   */
  isValidCache() {
    return (
      this.cachedTime &&
      this.cacheTimestamp &&
      Date.now() - this.cacheTimestamp < this.cacheValidDuration
    );
  }

  /**
   * 更新缓存
   * @param {Date} time
   */
  updateCache(time) {
    this.cachedTime = new Date(time);
    this.cacheTimestamp = Date.now();
  }

  /**
   * 验证激活码是否过期（安全版 - 防止时间修改绕过）
   * @param {string} expiresAt 过期时间字符串
   * @returns {Promise<Object>} 验证结果
   */
  async validateExpiration(expiresAt) {
    try {
      const beijingTime = await this.getBeijingTime();
      const expiryTime = new Date(expiresAt);

      console.log(`📅 当前北京时间: ${beijingTime.toLocaleString("zh-CN")}`);
      console.log(`📅 激活码过期时间: ${expiryTime.toLocaleString("zh-CN")}`);

      const isExpired = beijingTime > expiryTime;

      return {
        valid: !isExpired,
        expired: isExpired,
        currentTime: beijingTime.toISOString(),
        expiryTime: expiryTime.toISOString(),
        reason: isExpired ? "激活码已过期" : "激活码有效",
        onlineVerified: true,
      };
    } catch (error) {
      console.error("⚠️ 在线时间验证失败:", error.message);

      // 🚨 安全策略：在线时间验证失败时拒绝操作，防止用户通过断网+修改时间绕过验证
      return {
        valid: false,
        expired: false, // 不是因为过期，而是因为无法验证
        currentTime: null,
        expiryTime: new Date(expiresAt).toISOString(),
        reason: "无法验证激活码状态：网络连接失败，为确保安全已禁用功能",
        networkError: true,
        securityBlock: true, // 标记为安全阻止
      };
    }
  }

  /**
   * 获取时间状态信息
   * @returns {Promise<Object>}
   */
  async getTimeStatus() {
    try {
      const beijingTime = await this.getBeijingTime();
      const localTime = new Date();

      return {
        beijingTime: beijingTime.toISOString(),
        localTime: localTime.toISOString(),
        beijingTimeFormatted: beijingTime.toLocaleString("zh-CN"),
        localTimeFormatted: localTime.toLocaleString("zh-CN"),
        timeDifference: beijingTime.getTime() - localTime.getTime(),
        usingCache: this.isValidCache(),
        cacheAge: this.cacheTimestamp ? Date.now() - this.cacheTimestamp : null,
      };
    } catch (error) {
      return {
        error: error.message,
        localTime: new Date().toISOString(),
      };
    }
  }
}

module.exports = BeijingTimeAPI;
