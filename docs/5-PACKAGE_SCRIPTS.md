# 📦 Package Scripts 使用指南

## 🚀 快速开始

```bash
npm run setup          # 📦 安装所有依赖
npm run dev            # 🚀 启动完整开发环境
npm run quick-start    # ⚡ 快速启动（跳过依赖检查）
```

## 🏗️ 构建发布

```bash
npm run build:status           # 📊 检查配置状态
npm run build:release          # 🚀 构建应用
npm run build:release:publish  # 🚀 构建并发布到GitHub
npm run build:force            # 🔥 强制构建（忽略Git状态）
```

## 🌐 服务器部署

```bash
npm run server:start           # 🚀 启动ngrok服务
npm run build-and-deploy       # 🚀 构建并部署
npm run full-deploy            # 🌐 完整部署流程
```

## 📋 推荐工作流程

### 日常开发

```bash
npm run dev                    # 开发环境
```

### 构建发布

```bash
npm run build:status          # 1. 检查配置
npm run build:release:publish # 2. 构建发布
```

### 生产部署

```bash
npm run full-deploy           # 一键部署
```

## 🔄 命令迁移

| 旧命令                 | 新命令                          | 状态      |
| ---------------------- | ------------------------------- | --------- |
| `npm run build:github` | `npm run build:release`         | ⚠️ 已弃用 |
| `npm run release`      | `npm run build:release:publish` | ⚠️ 已弃用 |

## 🔧 其他命令

### 测试调试

```bash
npm run test:workflow          # 🧪 工作流程测试
npm run debug:status           # 🔍 状态检查
npm run check:env              # 🔍 环境检测
```

### 清理维护

```bash
npm run clean:full             # 🧹 完整清理
npm run stop:all-node          # 🛑 停止所有进程
```

## 🔍 故障排除

- **依赖问题**: `npm run setup`
- **配置问题**: `npm run build:status`
- **构建失败**: `npm run build:force`
- **进程冲突**: `npm run stop:all-node`
