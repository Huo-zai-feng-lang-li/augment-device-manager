# Augment 设备管理器

Cursor IDE Augment 扩展设备限制解决方案，包含激活码管理后台和桌面客户端。

## 快速启动

### 安装依赖

```bash
npm install
cd admin-backend && npm install
cd ../desktop-client && npm install
```

### 启动项目

```bash
# 一键启动所有项目（推荐）
npm run dev

# 单独启动
npm run backend     # 仅启动后端
npm run client      # 仅启动前端
```

## 项目结构

```
augment-device-manager/
├── admin-backend/      # 后端服务 (Node.js + Express)
├── desktop-client/     # 桌面客户端 (Electron)
├── shared/            # 共享工具和加密模块
└── scripts/           # 启动和安装脚本
```

## 服务地址

- **管理后台**: http://localhost:3001 (admin/admin123)
- **桌面客户端**: 自动启动 Electron 应用

## 主要功能

### 后端管理系统

- 激活码生成和管理
- 用户使用记录统计
- Web 管理界面

### 桌面客户端

- 激活码验证和设备绑定
- 设备指纹清理功能
- 跨平台支持 (Windows/macOS/Linux)

## 构建打包

### 打包桌面客户端

```bash
npm run build        # 打包当前平台exe文件

# 或进入客户端目录打包指定平台
cd desktop-client
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

### 发布新版本

```bash
npm run release      # 构建并发布到GitHub Releases
```

## 技术栈

- **后端**: Node.js, Express, JSON 存储
- **前端**: Electron, HTML/CSS/JS
- **加密**: AES-256, 设备指纹

## 许可证

MIT License
