# 快速解决ngrok地址变化

## 🚨 问题
ngrok免费版地址每次重启都会变化，导致已分发的客户端无法连接。

## ⚡ 快速解决

### 3步解决方案
```bash
# 1. 自动更新配置
npm run config:update

# 2. 重新打包
npm run build:remote

# 3. 分发新安装包
```

### 实时监听（可选）
```bash
# 后台运行，自动检测地址变化
npm run config:watch
```

## 🔍 原理
1. **服务器启动**时自动保存ngrok地址到 `server-info.json`
2. **配置更新**脚本读取最新地址并更新客户端配置
3. **重新打包**后的客户端包含正确的服务器地址

## 📋 完整流程

### 服务器重启后
```bash
# 1. 启动服务器（获得新ngrok地址）
npm run server:start
# 输出：🌐 管理界面: https://xyz789.ngrok.io

# 2. 更新配置（自动读取新地址）
npm run config:update
# 输出：✅ 客户端配置已更新

# 3. 重新打包
npm run build:remote
# 输出：📦 打包完成: dist/

# 4. 分发给用户
# 新安装包包含正确地址，用户直接可用
```

### 开发环境
```bash
# 启动监听模式，地址变化时自动更新
npm run config:watch &
npm run server:start
```

## 🎯 长期解决方案

### 选项1：ngrok付费版（推荐）
- 费用：$8/月
- 获得固定域名：`augment-server.ngrok.io`
- 一次配置，永久有效

### 选项2：云服务器
- 购买VPS获得固定IP
- 完全控制，最稳定
- 适合生产环境

## 🔧 故障排除

### 问题：配置更新失败
```bash
❌ 服务器未启动，请先运行: npm run server:start
```
**解决**：确保服务器正在运行

### 问题：客户端仍无法连接
**检查步骤**：
1. 确认配置已更新：`cat modules/desktop-client/public/server-config.json`
2. 确认重新打包：`npm run build:remote`
3. 确认用户使用最新安装包

### 验证连接
```bash
# 检查服务器状态
npm run server:status

# 测试API连接
curl -k https://your-ngrok-url/api/health
```

## 📚 相关文档
- [ngrok地址变化解决方案.md](./ngrok地址变化解决方案.md) - 详细技术方案
- [远程控制配置指南.md](./远程控制配置指南.md) - 完整配置指南
- [命令参考手册.md](./命令参考手册.md) - 所有可用命令
