/**
 * 服务端北京时间API服务
 * 确保服务端也使用在线时间进行激活码过期验证，而不依赖服务器本地时间
 */

const fetch = require("node-fetch");

class ServerBeijingTimeAPI {
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
   * 获取北京时间（服务端安全版）
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

    // 🚨 服务端安全策略：网络失败时抛出异常，不回退到本地时间
    throw new Error("服务端无法获取在线北京时间：所有时间API均不可用");
  }

  /**
   * 从在线API获取时间
   * @returns {Promise<Date|null>}
   */
  async fetchOnlineTime() {
    for (const apiUrl of this.timeAPIs) {
      try {
        console.log(`🌐 服务端尝试获取在线时间: ${apiUrl}`);

        const response = await fetch(apiUrl, {
          timeout: 5000,
          headers: {
            "User-Agent": "Augment-Device-Manager-Server/1.0",
          },
        });

        if (!response.ok) {
          continue;
        }

        let data;
        if (apiUrl.includes("qq.com")) {
          // 腾讯视频API返回JSONP格式，需要特殊处理
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

        const beijingTime = this.parseTimeFromAPI(data, apiUrl);

        if (beijingTime) {
          console.log(
            `✅ 服务端成功获取北京时间: ${beijingTime.toLocaleString("zh-CN")}`
          );
          return beijingTime;
        }
      } catch (error) {
        console.warn(`服务端时间API ${apiUrl} 失败:`, error.message);
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
        // 苏宁时间API格式
        if (data.currentTime && data.code === "1") {
          return new Date(data.currentTime);
        }
      } else if (apiUrl.includes("qq.com")) {
        // 腾讯视频时间API格式
        if (data.t) {
          return new Date(data.t * 1000);
        }
      }
    } catch (error) {
      console.warn("服务端解析时间数据失败:", error.message);
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
   * 验证激活码是否过期（服务端安全版）
   * @param {string} expiresAt 过期时间字符串
   * @returns {Promise<Object>} 验证结果
   */
  async validateExpiration(expiresAt) {
    try {
      const beijingTime = await this.getBeijingTime();
      const expiryTime = new Date(expiresAt);

      console.log(`📅 服务端当前北京时间: ${beijingTime.toLocaleString("zh-CN")}`);
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
      console.error("⚠️ 服务端在线时间验证失败:", error.message);

      // 🚨 服务端安全策略：网络失败时返回错误，不使用本地时间
      return {
        valid: false,
        expired: false,
        currentTime: null,
        expiryTime: new Date(expiresAt).toISOString(),
        reason: "服务端无法验证激活码状态：网络时间获取失败",
        networkError: true,
        serverSecurityBlock: true,
      };
    }
  }
}

module.exports = ServerBeijingTimeAPI;
