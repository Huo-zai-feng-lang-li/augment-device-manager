# 项目命令速查表

## 🚀 开发环境

```bash
# 一键启动完整开发环境（推荐）
npm run dev

# 安装所有依赖
npm run setup

# 只启动后端服务器
npm run server

# 只启动客户端
npm run client
```

## 📦 打包分发

```bash
# 打包桌面exe
npm run build

# 发布新版本
npm run release
```

## 🌐 远程控制

```bash
# 启动远程控制服务器
npm run server-only

# 获取公网地址（需要ngrok）
ngrok http 3002
```

---

## 📋 服务地址

- **管理后台**: http://localhost:3002 (admin/admin123)
- **客户端**: 自动打开 Electron 窗口

## 🎯 核心功能

- **权限控制**: 服务端实时控制客户端使用权限
- **跨地域**: 支持全球任意位置的客户端控制
- **实时验证**: 激活码有效 → 功能可用，无效 → 立即禁用

## ⚠️ 注意事项

- 开发环境使用 `npm run dev`
- 远程控制需要 ngrok 或云服务器
- 确保 3002 端口未被占用
