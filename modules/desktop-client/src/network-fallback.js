/**
 * 网络降级和备用方案模块
 * 处理GitHub无法访问的情况
 */

const fetch = require('node-fetch');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class NetworkFallback {
  constructor(config) {
    this.config = config;
    this.cacheFile = path.join(os.homedir(), '.augment-device-manager', 'server-cache.json');
    this.fallbackServers = [
      // 备用服务器列表
      'https://58817b329257.ngrok-free.app', // 当前已知地址
      'localhost:3002', // 本地开发
    ];
  }

  // 获取服务器配置（带降级方案）
  async getServerConfig() {
    console.log('🔍 开始获取服务器配置...');
    
    // 方案1: 尝试从GitHub获取最新配置
    const githubConfig = await this.tryGitHubConfig();
    if (githubConfig) {
      console.log('✅ 从GitHub获取配置成功');
      await this.saveCache(githubConfig);
      return githubConfig;
    }

    // 方案2: 使用本地缓存
    console.log('⚠️ GitHub访问失败，尝试使用本地缓存...');
    const cachedConfig = await this.getCachedConfig();
    if (cachedConfig) {
      console.log('✅ 使用本地缓存配置');
      return cachedConfig;
    }

    // 方案3: 使用备用服务器列表
    console.log('⚠️ 本地缓存无效，尝试备用服务器...');
    const fallbackConfig = await this.tryFallbackServers();
    if (fallbackConfig) {
      console.log('✅ 找到可用的备用服务器');
      await this.saveCache(fallbackConfig);
      return fallbackConfig;
    }

    // 方案4: 使用默认配置
    console.log('❌ 所有方案都失败，使用默认配置');
    return this.getDefaultConfig();
  }

  // 尝试从GitHub获取配置
  async tryGitHubConfig() {
    const githubUrls = [
      'https://raw.githubusercontent.com/Huo-zai-feng-lang-li/augment-device-manager/main/server-config.json',
      'https://cdn.jsdelivr.net/gh/Huo-zai-feng-lang-li/augment-device-manager@main/server-config.json',
      'https://api.github.com/repos/Huo-zai-feng-lang-li/augment-device-manager/contents/server-config.json'
    ];

    for (const url of githubUrls) {
      try {
        console.log(`📥 尝试从 ${url} 获取配置...`);
        
        const response = await fetch(url, { 
          timeout: 5000,
          headers: { 'User-Agent': 'Augment-Client' }
        });
        
        if (!response.ok) continue;

        let configData;
        if (url.includes('api.github.com')) {
          // GitHub API返回base64编码的内容
          const apiData = await response.json();
          const content = Buffer.from(apiData.content, 'base64').toString('utf8');
          configData = JSON.parse(content);
        } else {
          // 直接获取JSON
          configData = await response.json();
        }

        if (configData.server) {
          return {
            host: configData.server.host,
            port: configData.server.port,
            protocol: configData.server.protocol,
            source: 'github',
            lastUpdated: configData.lastUpdated || new Date().toISOString()
          };
        }
      } catch (error) {
        console.log(`❌ ${url} 访问失败: ${error.message}`);
        continue;
      }
    }

    return null;
  }

  // 获取本地缓存配置
  async getCachedConfig() {
    try {
      if (await fs.pathExists(this.cacheFile)) {
        const cached = await fs.readJson(this.cacheFile);
        
        // 检查缓存是否过期（24小时）
        const cacheAge = Date.now() - new Date(cached.cachedAt).getTime();
        if (cacheAge < 24 * 60 * 60 * 1000) {
          return {
            ...cached.config,
            source: 'cache'
          };
        }
      }
    } catch (error) {
      console.log(`缓存读取失败: ${error.message}`);
    }
    return null;
  }

  // 尝试备用服务器
  async tryFallbackServers() {
    for (const server of this.fallbackServers) {
      try {
        const [host, port] = server.includes('://') 
          ? [new URL(server).hostname, new URL(server).port || (server.startsWith('https') ? 443 : 80)]
          : server.split(':');

        const protocol = server.startsWith('https') || port === '443' ? 'https' : 'http';
        const testUrl = `${protocol}://${host}:${port}/api/health`;

        console.log(`🔍 测试备用服务器: ${testUrl}`);
        
        const response = await fetch(testUrl, { 
          timeout: 3000,
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        
        if (response.ok) {
          return {
            host: host,
            port: parseInt(port),
            protocol: protocol,
            source: 'fallback'
          };
        }
      } catch (error) {
        console.log(`备用服务器 ${server} 不可用: ${error.message}`);
        continue;
      }
    }
    return null;
  }

  // 获取默认配置
  getDefaultConfig() {
    return {
      host: '58817b329257.ngrok-free.app', // 当前已知的地址
      port: 443,
      protocol: 'https',
      source: 'default'
    };
  }

  // 保存配置到缓存
  async saveCache(config) {
    try {
      await fs.ensureDir(path.dirname(this.cacheFile));
      await fs.writeJson(this.cacheFile, {
        config: config,
        cachedAt: new Date().toISOString()
      });
    } catch (error) {
      console.log(`缓存保存失败: ${error.message}`);
    }
  }

  // 检测网络连通性
  async checkNetworkConnectivity() {
    const testUrls = [
      'https://www.baidu.com',
      'https://github.com',
      'https://raw.githubusercontent.com'
    ];

    const results = {
      internet: false,
      github: false,
      githubRaw: false
    };

    for (let i = 0; i < testUrls.length; i++) {
      try {
        const response = await fetch(testUrls[i], { timeout: 3000 });
        if (response.ok) {
          if (i === 0) results.internet = true;
          if (i === 1) results.github = true;
          if (i === 2) results.githubRaw = true;
        }
      } catch (error) {
        // 连接失败
      }
    }

    return results;
  }

  // 显示网络状态和建议
  async showNetworkStatus() {
    console.log('\n🌐 网络连通性检测...');
    const connectivity = await this.checkNetworkConnectivity();
    
    console.log(`📡 互联网连接: ${connectivity.internet ? '✅ 正常' : '❌ 异常'}`);
    console.log(`🐙 GitHub访问: ${connectivity.github ? '✅ 正常' : '❌ 受限'}`);
    console.log(`📁 GitHub Raw: ${connectivity.githubRaw ? '✅ 正常' : '❌ 受限'}`);

    if (!connectivity.internet) {
      console.log('\n⚠️ 网络连接异常，请检查网络设置');
      return 'no-internet';
    }

    if (!connectivity.github || !connectivity.githubRaw) {
      console.log('\n⚠️ GitHub访问受限，可能的原因：');
      console.log('   - 网络防火墙限制');
      console.log('   - DNS解析问题');
      console.log('   - 地区网络限制');
      console.log('\n💡 解决方案：');
      console.log('   - 使用VPN或代理');
      console.log('   - 修改DNS设置');
      console.log('   - 使用本地缓存配置');
      return 'github-blocked';
    }

    console.log('\n✅ 网络连接正常');
    return 'normal';
  }
}

module.exports = NetworkFallback;
