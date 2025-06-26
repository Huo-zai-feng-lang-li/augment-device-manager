# Augment 设备管理器

Cursor IDE Augment 扩展设备限制解决方案，包含激活码管理后台和桌面客户端，支持自
动更新功能。

## 🚀 快速启动

### 一键启动（推荐）

```bash
# 自动安装所有依赖 + 启动完整开发环境
npm run dev
```

这个命令会：

- 🔧 自动安装所有项目依赖
- 🌐 启动管理后台服务器 (http://localhost:3002)
- 💻 启动桌面客户端应用

### 其他启动方式

```bash
# 仅安装依赖
npm run setup

# 仅启动后端服务器
npm run server-only

# 仅启动客户端
npm run client
```

## 项目结构

```
augment-device-manager/
├── admin-backend/      # 后端服务 (Node.js + Express)
├── desktop-client/     # 桌面客户端 (Electron)
├── shared/            # 共享工具和加密模块
└── scripts/           # 启动和安装脚本
```

## 🌐 服务地址

- **管理后台**: http://localhost:3002 (admin/admin123)
- **桌面客户端**: 自动启动 Electron 应用

## ✨ 主要功能

### 后端管理系统

- 🔑 激活码生成和管理
- 📊 用户使用记录统计
- 🌐 Web 管理界面
- 🔄 实时远程控制客户端权限

### 桌面客户端

- ✅ 激活码验证和设备绑定
- 🧹 设备指纹清理功能
- 🔄 **自动更新功能**
- 🖥️ 跨平台支持 (Windows/macOS/Linux)

### 🔄 自动更新功能

客户端支持完整的自动更新流程：

- **启动检查**: 应用启动后 3 秒自动检查更新
- **用户选择**: 发现新版本时弹出友好提示
  - "立即更新" - 开始下载新版本
  - "稍后提醒" - 下次启动时再次提醒
  - "跳过此版本" - 跳过当前版本
- **下载进度**: 实时显示下载进度条
- **自动安装**: 下载完成后一键重启安装
- **手动检查**: 支持在"关于"页面手动检查更新

## 📦 构建打包

### 打包桌面客户端

```bash
npm run build        # 打包当前平台exe文件

# 或进入客户端目录打包指定平台
cd desktop-client
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

### 🚀 发布新版本

```bash
npm run release      # 构建并发布到GitHub Releases
```

**发布流程**：

1. 自动更新版本号
2. 构建所有平台安装包
3. 创建 GitHub Release
4. 上传安装包文件
5. 客户端自动检测到新版本

## 🛠️ 技术栈

- **后端**: Node.js, Express, WebSocket, JSON 存储
- **前端**: Electron, HTML/CSS/JS
- **加密**: AES-256, 设备指纹
- **自动更新**: electron-updater, GitHub Releases
- **跨平台**: Windows/macOS/Linux 支持

## 📋 命令速查

| 命令                  | 功能                    |
| --------------------- | ----------------------- |
| `npm run dev`         | 🚀 一键启动完整开发环境 |
| `npm run setup`       | 📦 安装所有依赖         |
| `npm run server-only` | 🌐 仅启动远程控制服务器 |
| `npm run build`       | 📦 打包桌面 exe         |
| `npm run release`     | 🚀 发布新版本           |

## 📄 许可证

MIT License
