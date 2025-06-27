# 🌐 远程控制配置指南

本文档详细介绍如何配置和使用 Augment 设备管理器的远程控制功能，让您可以控制不在
同一局域网和地区的客户端。

## 📋 目录

- [功能概述](#功能概述)
- [快速开始](#快速开始)
- [配置方法](#配置方法)
- [部署方案](#部署方案)
- [故障排除](#故障排除)
- [安全建议](#安全建议)

## 🎯 功能概述

### ✅ 支持的远程控制功能

- **多客户端管理**: 同时控制多个不同地区的客户端
- **实时通信**: 基于 WebSocket 的双向实时通信
- **权限控制**: 远程启用/禁用客户端功能
- **批量操作**: 支持单个客户端控制和批量广播
- **自动重连**: 客户端自动重连机制确保连接稳定
- **离线支持**: 网络中断时支持离线模式操作

### 🔧 控制命令类型

- **设备清理**: 远程执行设备指纹清理
- **使用计数重置**: 远程重置使用计数
- **权限管理**: 实时启用/禁用客户端权限
- **消息广播**: 向所有客户端发送通知消息
- **状态监控**: 实时查看客户端连接状态

## 🚀 快速开始

### ✅ 打包测试验证结果

**测试环境**：Windows 10, Node.js v22.16.0, Electron Builder 24.13.3

**验证功能**：

- ✅ 后端服务启动：3002 端口正常监听，API 健康检查通过
- ✅ ngrok 隧道建立：成功获取 HTTPS 公网地址
- ✅ 智能检测机制：`smart-build.js`正确检测 ngrok 状态
- ✅ 配置自动管理：自动备份/恢复客户端配置文件
- ✅ 远程地址预配置：打包时自动写入 ngrok 地址到客户端
- ✅ 跨区域连接：生成的安装包可实现真正的远程控制

**测试结论**：**服务端完全可以远程控制所有客户端！**

### 方法一：智能打包（推荐）

1. **启动后端服务**

   ```bash
   npm run server-only
   ```

2. **启动 ngrok 获取公网地址**

   ```bash
   # 访问 https://ngrok.com/ 注册账号并下载
   # 配置认证令牌
   ngrok authtoken YOUR_AUTH_TOKEN

   # 暴露本地服务到公网
   ngrok http 3002
   ```

3. **智能打包远程控制版本**
   ```bash
   # 自动检测ngrok并配置远程地址
   npm run build
   ```

### 方法二：一键远程打包

```bash
# 全自动：启动服务+ngrok+打包（如果环境配置正确）
npm run build:remote
```

### 方法三：使用 ngrok（手动配置）

1. **启动后端服务**

   ```bash
   npm run server-only
   ```

2. **安装并配置 ngrok**

   ```bash
   # 访问 https://ngrok.com/ 注册账号并下载
   # 配置认证令牌
   ngrok authtoken YOUR_AUTH_TOKEN

   # 暴露本地服务到公网
   ngrok http 3002
   ```

3. **获取公网地址**

   ngrok 会显示类似这样的地址：

   ```
   Forwarding  https://abc123-def456.ngrok.io -> http://localhost:3002
   ```

4. **配置客户端**

   ```bash
   cd desktop-client
   node configure-server.js abc123-def456.ngrok.io 443 https
   ```

5. **重新打包客户端**

   ```bash
   npm run build
   ```

6. **分发客户端**

   将 `dist/` 目录下的安装包发给其他人即可！

## ⚙️ 配置方法

### 使用配置工具（推荐）

项目内置了专门的服务器配置工具：

```bash
cd desktop-client

# 查看当前配置
node configure-server.js

# 配置 ngrok 地址
node configure-server.js your-domain.ngrok.io 443 https

# 配置自定义服务器
node configure-server.js your-server.com 3002 http

# 配置局域网地址
node configure-server.js 192.168.1.100 3002 http
```

### 使用环境变量

在客户端启动前设置环境变量：

**Windows:**

```cmd
set AUGMENT_SERVER_HOST=your-server.com
set AUGMENT_SERVER_PORT=3002
set AUGMENT_SERVER_PROTOCOL=https
```

**Linux/macOS:**

```bash
export AUGMENT_SERVER_HOST=your-server.com
export AUGMENT_SERVER_PORT=3002
export AUGMENT_SERVER_PROTOCOL=https
```

### 手动编辑配置文件

配置文件位置：`~/.augment-device-manager/server-config.json`

```json
{
  "server": {
    "host": "your-server.com",
    "port": 3002,
    "protocol": "https"
  },
  "client": {
    "autoConnect": true,
    "verifyInterval": 300000,
    "reconnectDelay": 5000
  }
}
```

## 🌍 部署方案

### 方案一：ngrok（适合测试和小规模使用）

**优点:**

- 配置简单，几分钟即可完成
- 自动 HTTPS 加密
- 无需购买服务器

**缺点:**

- 免费版有连接数限制
- 地址会定期变化
- 依赖第三方服务

**适用场景:** 测试、演示、小规模使用

### 方案二：云服务器部署（推荐生产环境）

**步骤:**

1. **购买云服务器**

   - 阿里云、腾讯云、AWS、DigitalOcean 等
   - 推荐配置：1 核 2G 内存，带宽 5M 以上

2. **部署后端服务**

   ```bash
   # 上传项目文件到服务器
   scp -r admin-backend/ user@your-server:/opt/augment/

   # 在服务器上安装依赖
   cd /opt/augment/admin-backend
   npm install

   # 启动服务（推荐使用 PM2）
   npm install -g pm2
   pm2 start src/server.js --name augment-backend
   pm2 startup
   pm2 save
   ```

3. **配置防火墙**

   ```bash
   # 开放 3002 端口
   sudo ufw allow 3002

   # 或者使用云服务商的安全组配置
   ```

4. **配置域名（可选）**

   - 购买域名并解析到服务器 IP
   - 配置 SSL 证书（Let's Encrypt）

5. **配置客户端**
   ```bash
   node configure-server.js your-domain.com 3002 https
   ```

### 方案三：内网穿透工具

**frp（免费开源）:**

```bash
# 服务端配置
./frps -c frps.ini

# 客户端配置
./frpc -c frpc.ini
```

**花生壳（付费稳定）:**

- 注册花生壳账号
- 下载客户端并配置端口映射

## 🔍 故障排除

### 连接测试工具

项目提供了专门的连接测试工具：

```bash
# 测试 WebSocket 连接
node test-websocket.js

# 完整系统测试
node test-system.js
```

### 常见问题

**1. 打包文件占用错误**

```bash
# 错误：The process cannot access the file because it is being used by another process
# 解决方案：
rm -rf desktop-client/build-output    # 手动删除构建目录
npm run build                         # 重新打包
```

**2. 客户端无法连接服务器**

- 检查服务器是否正常运行：`curl http://your-server:3002/api/health`
- 检查防火墙设置
- 确认客户端配置正确

**3. WebSocket 连接失败**

- 检查 WebSocket 端点：`ws://your-server:3002/ws`
- 确认服务器支持 WebSocket 协议
- 检查代理服务器配置

**4. ngrok 地址失效**

- ngrok 免费版地址会定期变化
- 重新启动 ngrok 获取新地址：`ngrok http 3002`
- 重新打包客户端：`npm run build`

**5. ngrok 检测失败**

- 确保 ngrok 已启动：`ngrok http 3002`
- 检查 ngrok 状态：访问 http://localhost:4040
- 检查 ngrok API：`curl -s http://localhost:4040/api/tunnels`

**6. 权限验证失败**

- 检查激活码是否有效
- 确认服务器时间同步
- 查看服务器日志排查问题

### 调试模式

启用详细日志输出：

```bash
# 服务端调试
DEBUG=* npm run server-only

# 客户端调试
set DEBUG=* && npm run client
```

## 🔒 安全建议

### 网络安全

1. **使用 HTTPS/WSS**

   - 生产环境必须使用加密连接
   - 配置有效的 SSL 证书

2. **防火墙配置**

   - 只开放必要的端口（3002）
   - 限制访问来源 IP（如果可能）

3. **访问控制**
   - 修改默认管理员密码
   - 定期更新激活码
   - 监控异常连接

### 应用安全

1. **激活码管理**

   - 使用强密码生成激活码
   - 定期轮换激活码
   - 限制激活码使用次数

2. **权限控制**

   - 及时撤销无效激活码
   - 监控客户端使用情况
   - 设置合理的权限等级

3. **数据保护**
   - 定期备份数据库
   - 加密敏感配置信息
   - 清理过期日志文件

## 📊 管理界面

远程控制管理界面地址：`http://your-server:3002`

**默认账户:** admin / admin123

**主要功能:**

- 📱 查看所有连接的客户端
- 🎛️ 单独控制特定客户端
- 📢 向所有客户端广播消息
- 📊 查看使用统计和日志
- ⚙️ 管理激活码和权限

## 🎯 最佳实践

1. **生产环境部署**

   - 使用云服务器而非 ngrok
   - 配置域名和 SSL 证书
   - 使用 PM2 等进程管理工具

2. **客户端分发**

   - 预配置服务器地址后再打包
   - 提供配置说明文档
   - 建立客户端更新机制

3. **监控和维护**

   - 定期检查服务器状态
   - 监控客户端连接情况
   - 及时处理异常和错误

4. **扩展性考虑**
   - 使用负载均衡（多台服务器）
   - 配置数据库集群
   - 实施缓存策略

---

## 📞 技术支持

如果您在配置过程中遇到问题，可以：

1. 查看项目日志文件
2. 使用内置的测试工具诊断
3. 参考 [故障排除](#故障排除) 章节
4. 提交 Issue 或联系技术支持

**祝您使用愉快！** 🎉
