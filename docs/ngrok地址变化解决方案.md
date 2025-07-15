# ngrok地址变化解决方案

## 🚨 问题描述

### 核心问题
- **ngrok免费版限制**：每次重启都会生成新的随机地址
- **客户端配置硬编码**：打包时将服务器地址写死在配置文件中
- **分发失效**：服务器重启后，所有已分发的客户端都无法连接

### 问题场景
```
1. 打包客户端时：配置文件写入 abc123.ngrok.io
2. 分发给用户：用户安装后可正常连接
3. 服务器重启：ngrok生成新地址 xyz789.ngrok.io
4. 用户断连：所有客户端无法连接新地址
```

## 🛠️ 解决方案

### 方案一：自动配置更新（推荐）

#### 实现原理
```
服务器启动 → 生成server-info.json → 脚本读取 → 更新客户端配置 → 重新打包
```

#### 核心机制
1. **信息传递链**：
   ```
   ngrok启动 → 获取公网地址 → 保存到server-info.json → 脚本读取 → 更新配置文件
   ```

2. **双重配置更新**：
   - **打包配置**：`modules/desktop-client/public/server-config.json`
   - **用户配置**：`~/.augment-device-manager/server-config.json`

3. **自动同步**：脚本从服务器信息文件读取最新地址并更新所有配置

#### 使用方法
```bash
# 1. 启动服务器（获得新ngrok地址）
npm run server:start

# 2. 自动更新配置（读取新地址并更新配置文件）
npm run config:update

# 3. 重新打包客户端
npm run build:remote

# 4. 分发新的安装包
# 新安装包包含正确的服务器地址
```

#### 实时监听模式
```bash
# 后台运行，自动检测地址变化并更新配置
npm run config:watch
```

### 方案二：固定地址（长期方案）

#### 选项A：ngrok付费版
```bash
# 升级到付费版（$8/月）
# 获得固定域名：augment-server.ngrok.io
ngrok http 3002 --domain=augment-server.ngrok.io
```
- ✅ 地址永远不变
- ✅ 一次打包，永久有效
- ✅ 所有用户都能连接

#### 选项B：云服务器
```bash
# 购买云服务器，获得固定IP
# 如：123.456.789.0 或 augment.yourdomain.com
```
- ✅ 完全控制
- ✅ 地址永远不变
- ✅ 更稳定

### 方案三：用户手动配置

#### 内置配置工具
客户端内置配置更新页面：`config-updater.html`
- 用户可以自己更新服务器地址
- 无需重新安装客户端
- 支持实时配置验证

## 📋 详细操作指南

### 自动配置更新流程

#### 1. 服务器信息文件
```json
// server-info.json（服务器启动时自动生成）
{
  "ngrokUrl": "840b-2408-8207-60d0-5330-143a-21b5-9543-a7ec.ngrok-free.app",
  "managementUrl": "https://840b-2408-8207-60d0-5330-143a-21b5-9543-a7ec.ngrok-free.app",
  "startTime": "2025-06-28T10:34:32.923Z",
  "status": "running"
}
```

#### 2. 配置更新脚本
```javascript
// scripts/setup/update-client-config.js 核心逻辑
async function updateClientConfig() {
  // 1. 读取当前服务器信息
  const serverInfo = await fs.readJson('server-info.json');
  const ngrokUrl = serverInfo.ngrokUrl;
  
  // 2. 生成新配置
  const newConfig = {
    server: {
      host: ngrokUrl,
      port: 443,
      protocol: 'https'
    }
  };
  
  // 3. 更新客户端配置文件
  await fs.writeJson('modules/desktop-client/public/server-config.json', newConfig);
  
  // 4. 更新用户配置目录
  await fs.writeJson('~/.augment-device-manager/server-config.json', newConfig);
}
```

#### 3. 执行效果示例
```bash
$ npm run config:update

🔄 动态更新客户端配置
======================

📡 检测到当前ngrok地址: 840b-2408-8207-60d0-5330-143a-21b5-9543-a7ec.ngrok-free.app
✅ 客户端配置已更新
✅ 用户配置已更新

🎯 配置详情:
   服务器地址: https://840b-2408-8207-60d0-5330-143a-21b5-9543-a7ec.ngrok-free.app
   WebSocket: wss://840b-2408-8207-60d0-5330-143a-21b5-9543-a7ec.ngrok-free.app/ws

💡 下一步操作:
1. 重新打包客户端: npm run build:remote
2. 分发新的安装包给用户
3. 或者让用户重启现有客户端（如果已安装）
```

### 实时监听配置

#### 启动监听
```bash
npm run config:watch
```

#### 监听逻辑
```javascript
// 每5秒检查一次地址变化
setInterval(async () => {
  const currentNgrokUrl = serverInfo.ngrokUrl;
  if (currentNgrokUrl !== lastNgrokUrl) {
    console.log(`🔄 检测到地址变化: ${currentNgrokUrl}`);
    await updateClientConfig();
  }
}, 5000);
```

## 🎯 最佳实践

### 开发环境
```bash
# 1. 启动服务器
npm run server:start

# 2. 后台监听地址变化
npm run config:watch

# 3. 开发过程中服务器重启时自动更新配置
```

### 生产分发
```bash
# 1. 启动生产服务器
npm run server:start

# 2. 更新配置
npm run config:update

# 3. 打包分发
npm run build:remote

# 4. 分发 dist/ 目录下的安装包
```

### 紧急修复
```bash
# 如果用户反馈无法连接：
# 1. 检查服务器状态
npm run server:status

# 2. 更新配置
npm run config:update

# 3. 重新打包分发
npm run build:remote
```

## ⚠️ 注意事项

### 限制说明
1. **ngrok免费版**：地址仍会变化，需要重新打包分发
2. **网络依赖**：配置更新需要服务器正在运行
3. **手动操作**：仍需要手动执行配置更新和重新打包

### 推荐升级
1. **ngrok付费版**：获得固定域名，一劳永逸
2. **云服务器**：完全控制，最稳定的解决方案
3. **自动化脚本**：结合CI/CD实现完全自动化

## 🔧 故障排除

### 常见问题

#### 1. 配置更新失败
```bash
❌ 服务器未启动，请先运行: npm run server:start
```
**解决**：确保服务器正在运行

#### 2. 地址检测失败
```bash
❌ 更新配置失败: server-info.json not found
```
**解决**：检查服务器是否正常启动并生成了信息文件

#### 3. 客户端仍无法连接
**解决步骤**：
1. 确认配置已更新：检查配置文件内容
2. 重新打包：`npm run build:remote`
3. 重新分发：确保用户使用最新安装包

### 验证方法
```bash
# 1. 检查服务器信息
cat server-info.json

# 2. 检查客户端配置
cat modules/desktop-client/public/server-config.json

# 3. 检查用户配置
cat ~/.augment-device-manager/server-config.json

# 4. 测试连接
curl -k https://your-ngrok-url/api/health
```
