# 项目命令速查表

## 🚀 开发环境

```bash
# 一键启动完整开发环境（推荐）
# 自动安装所有依赖 + 启动后端 + 启动客户端
npm run dev

# 仅安装所有依赖
npm run setup

# 只启动后端服务器
npm run server-only

# 只启动客户端
npm run client
```

## 📦 打包分发

### 本地版本打包

```bash
# 智能打包：自动检测ngrok并配置远程控制版本
npm run build
```

### 远程控制版本打包

```bash
# 一键远程打包（推荐）
npm run build:remote

# 手动三步法（最稳定）
# 1. npm run server-only
# 2. ngrok http 3002 (新终端)
# 3. npm run build
```

### 发布版本

```bash
# 发布新版本（自动更新版本号 + 构建 + 发布到GitHub）
npm run release
```

### 🔧 打包故障排除

```bash
# 文件占用问题：手动删除构建目录
rm -rf desktop-client/build-output

# 检查ngrok状态
curl -s http://localhost:4040/api/tunnels
```

## 🔄 自动更新功能

客户端已集成完整的自动更新功能：

- **自动检查**: 启动后 3 秒自动检查更新
- **用户友好**: 弹窗提示用户选择更新方式
- **进度显示**: 实时显示下载进度
- **一键安装**: 下载完成后自动重启安装
- **手动检查**: 支持在客户端"关于"页面手动检查

## 🌐 远程控制

### 基础命令

```bash
# 启动远程控制服务器
npm run server-only

# 获取公网地址（需要ngrok）
ngrok http 3002
```

### 客户端配置

```bash
# 进入客户端目录
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

### 连接测试

```bash
# 测试 WebSocket 连接
node test-websocket.js

# 完整系统测试
node test-system.js
```

### 环境变量配置

```bash
# Windows
set AUGMENT_SERVER_HOST=your-server.com
set AUGMENT_SERVER_PORT=3002
set AUGMENT_SERVER_PROTOCOL=https

# Linux/macOS
export AUGMENT_SERVER_HOST=your-server.com
export AUGMENT_SERVER_PORT=3002
export AUGMENT_SERVER_PROTOCOL=https
```

### 详细配置指南

完整的远程控制配置请参考：[📖 远程控制配置指南](./REMOTE_CONTROL.md)

---

## 📋 服务地址

- **管理后台**: http://localhost:3002 (admin/admin123)
- **客户端**: 自动打开 Electron 窗口

## 🎯 核心功能

- **权限控制**: 服务端实时控制客户端使用权限
- **跨地域**: 支持全球任意位置的客户端控制
- **实时验证**: 激活码有效 → 功能可用，无效 → 立即禁用
- **自动更新**: 客户端支持完整的自动更新流程
- **一键启动**: `npm run dev` 自动安装依赖并启动所有服务

## 📦 发布新版本流程

1. **修改代码**: 完成功能开发和测试
2. **发布版本**: 运行 `npm run release`
3. **自动流程**:
   - 自动更新版本号
   - 构建所有平台安装包
   - 创建 GitHub Release
   - 上传安装包文件
4. **客户端更新**: 用户启动客户端时自动检测到新版本

## ⚠️ 注意事项

- 开发环境使用 `npm run dev` 一键启动
- 远程控制需要 ngrok 或云服务器
- 确保 3002 端口未被占用
- 发布前需配置 GitHub 仓库信息
