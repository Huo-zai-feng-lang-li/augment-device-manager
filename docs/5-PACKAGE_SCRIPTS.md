# 📦 Package Scripts 使用指南

## 🚀 快速开始

```bash
npm run setup          # 📦 安装所有依赖
npm run dev            # 🚀 启动完整开发环境
npm run quick-start    # ⚡ 快速启动（跳过依赖检查）
```

## 🌐 ngrok 服务管理

```bash
npm run server:start           # 🚀 启动ngrok服务（推荐）
npm run server:status          # 📊 检查服务状态
npm run server:stop            # 🛑 停止远程控制服务
```

**启动成功标志**：

- ✅ 后端服务：`激活码管理后台运行在 http://localhost:3002`
- ✅ ngrok 隧道
  ：`Forwarding https://xxxx.ngrok-free.app -> http://localhost:3002`
- 🔑 默认账户：`admin / admin123`

**常见问题**：

- 如果显示"启动超时"但看到成功信息，说明服务实际已启动
- 检查 `http://localhost:3002` 确认后端运行状态
- ngrok 地址会自动更新到 GitHub 配置，客户端会自动获取

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

## 自动地址更新机制

**ngrok 地址会自动变化吗？** 是的！系统具有完整的自动更新机制：

### 工作原理

1. **服务端监控**：每 30 秒自动检查 ngrok 地址变化
2. **自动更新**：地址变化时自动更新 GitHub 配置文件
3. **客户端获取**：客户端启动时自动从 GitHub 获取最新地址
4. **无缝切换**：用户无需重新下载或重新配置

### 触发场景

- ngrok 意外重启
- 网络波动导致地址变化
- 手动重启 ngrok 服务
- 免费版 ngrok 的定期地址更换

### 客户端适应性

- ✅ **自动发现**：支持多种地址获取方式
- ✅ **智能重试**：连接失败时自动尝试备用地址
- ✅ **实时更新**：无需用户手动操作

## 推荐工作流程

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

### 常见问题及解决方案

| 问题               | 症状                     | 解决方案                     |
| ------------------ | ------------------------ | ---------------------------- |
| **依赖问题**       | 模块找不到、版本冲突     | `npm run setup`              |
| **配置问题**       | 构建失败、路径错误       | `npm run build:status`       |
| **构建失败**       | 打包报错、Git 状态异常   | `npm run build:force`        |
| **进程冲突**       | 端口被占用、服务无法启动 | `npm run stop:all-node`      |
| **ngrok 启动超时** | 显示超时但实际已启动     | 检查 `http://localhost:3002` |
| **终端输出异常**   | 大量重复输出、命令无响应 | 重启终端或使用新的 cmd 窗口  |

### 排查步骤

**步骤 1：检查环境**

```bash
npm run check:env              # 🔍 环境检测
npm run server:status          # 📊 服务状态
```

**步骤 2：清理重启**

```bash
npm run stop:all-node          # 🛑 停止所有进程
npm run server:start           # 🚀 重新启动
```

**步骤 3：手动启动（如果自动启动失败）**

```bash
# 终端1：启动后端
cd modules/admin-backend
node src/server-simple.js

# 终端2：启动ngrok
tools/ngrok.exe http 3002
```

### 🚨 紧急恢复

如果遇到严重问题：

```bash
npm run clean:full             # 🧹 完整清理
npm run setup                  # 📦 重新安装依赖
npm run server:start           # 🚀 重新启动服务
```
