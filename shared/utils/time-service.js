/**
 * 统一时间服务
 * 确保整个项目都使用在线时间，而不是本地时间
 */

const fetch = require("node-fetch");

class TimeService {
  constructor() {
    // 使用可靠的时间API源
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
   * 获取当前时间（在线时间优先）
   * @param {boolean} allowFallback 是否允许回退到本地时间（默认false）
   * @returns {Promise<Date>} 当前时间
   */
  async getCurrentTime(allowFallback = false) {
    try {
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

      // 根据策略决定是否回退到本地时间
      if (allowFallback) {
        console.warn("⚠️ 无法获取在线时间，回退到本地时间");
        return new Date();
      } else {
        throw new Error("无法获取在线时间：所有时间API均不可用");
      }
    } catch (error) {
      if (allowFallback) {
        console.warn("⚠️ 时间获取失败，使用本地时间:", error.message);
        return new Date();
      } else {
        throw error;
      }
    }
  }

  /**
   * 从在线API获取时间
   * @returns {Promise<Date|null>}
   */
  async fetchOnlineTime() {
    for (const apiUrl of this.timeAPIs) {
      try {
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
          // 腾讯视频API返回JSONP格式
          const text = await response.text();
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

        const time = this.parseTimeFromAPI(data, apiUrl);
        if (time) {
          return time;
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
        if (data.currentTime && data.code === "1") {
          return new Date(data.currentTime);
        }
      } else if (apiUrl.includes("qq.com")) {
        if (data.t) {
          return new Date(data.t * 1000);
        }
      }
    } catch (error) {
      console.warn("解析时间数据失败:", error.message);
    }

    return null;
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
   * 获取时间戳（毫秒）
   * @param {boolean} allowFallback 是否允许回退到本地时间
   * @returns {Promise<number>}
   */
  async getTimestamp(allowFallback = false) {
    const time = await this.getCurrentTime(allowFallback);
    return time.getTime();
  }

  /**
   * 获取ISO字符串格式时间
   * @param {boolean} allowFallback 是否允许回退到本地时间
   * @returns {Promise<string>}
   */
  async getISOString(allowFallback = false) {
    const time = await this.getCurrentTime(allowFallback);
    return time.toISOString();
  }

  /**
   * 格式化时间显示
   * @param {boolean} allowFallback 是否允许回退到本地时间
   * @param {string} locale 本地化设置
   * @returns {Promise<string>}
   */
  async getFormattedTime(allowFallback = false, locale = "zh-CN") {
    const time = await this.getCurrentTime(allowFallback);
    return time.toLocaleString(locale);
  }

  /**
   * 计算剩余天数（使用在线时间）
   * @param {string|Date} expiryDate 过期时间
   * @param {boolean} allowFallback 是否允许回退到本地时间
   * @returns {Promise<number>}
   */
  async calculateRemainingDays(expiryDate, allowFallback = false) {
    const now = await this.getCurrentTime(allowFallback);
    const expiry = new Date(expiryDate);
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * 验证时间是否过期（使用在线时间）
   * @param {string|Date} expiryDate 过期时间
   * @param {boolean} allowFallback 是否允许回退到本地时间
   * @returns {Promise<boolean>}
   */
  async isExpired(expiryDate, allowFallback = false) {
    const now = await this.getCurrentTime(allowFallback);
    const expiry = new Date(expiryDate);
    return now > expiry;
  }
}

// 创建全局实例
const timeService = new TimeService();

module.exports = {
  TimeService,
  timeService, // 全局实例
};
