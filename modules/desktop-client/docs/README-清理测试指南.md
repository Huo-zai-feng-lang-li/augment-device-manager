# Augment 设备管理器清理功能测试指南

## 🎯 目标

实现 98%以上的清理成功率，确保 Augment 扩展将设备识别为全新用户。

## 📋 快速使用指南

### 1. 运行完整清理操作

```bash
cd desktop-client
node test-cleanup.js
```

### 2. 运行全面清理测试报告

```bash
cd desktop-client
node detailed-test-report.js
```

### 3. 检查所有用户识别痕迹

```bash
cd desktop-client
node check-all-traces.js
```

## 🔧 清理策略配置

### 标准清理配置（推荐）

```javascript
const cleanupOptions = {
  preserveActivation: true, // 保留激活状态
  deepClean: true, // 深度清理
  cleanCursorExtension: true, // 清理Cursor扩展数据
  autoRestartCursor: true, // 自动重启Cursor
  skipCursorLogin: true, // 跳过Cursor IDE登录清理
};
```

### 激进清理配置（98%成功率目标）

```javascript
const aggressiveCleanupOptions = {
  preserveActivation: true, // 保留激活状态
  deepClean: true, // 深度清理
  cleanCursorExtension: true, // 清理Cursor扩展数据
  autoRestartCursor: false, // 手动重启（更彻底）
  skipCursorLogin: true, // 跳过Cursor IDE登录清理
  aggressiveMode: true, // 激进模式
  multiRoundClean: true, // 多轮清理
  extendedMonitoring: true, // 延长监控时间
};
```

## 📊 清理成功率评估标准

### 98%成功率要求

- ✅ **必须清理项目（权重 80%）**：

  - telemetry.devDeviceId 更新 (30%)
  - Augment 扩展存储清理 (20%)
  - 工作区 Augment 数据清理 (15%)
  - 数据库认证记录清理 (15%)

- ✅ **重要清理项目（权重 15%）**：

  - 缓存和日志清理
  - 遥测 ID 更新（machineId, sqmId）
  - 注册表清理

- ✅ **次要项目（权重 5%）**：
  - 临时文件清理
  - 备份文件管理

### 不计入成功率的项目

- 🟢 **Cursor IDE 登录信息**：属于 IDE 本身功能，不影响 Augment 扩展识别
- 🟢 **网络 MAC 地址**：硬件层面，无法清理
- 🟢 **Git 配置信息**：开发环境设置，建议保留
- 🟢 **系统 UUID**：硬件标识，通常不被扩展读取

## 🚀 最佳实践流程

### 步骤 1：一键快速测试（推荐）

```bash
# 运行完整的清理和测试流程
node quick-test.js

# 或者分步执行：
node quick-test.js --cleanup    # 仅清理
node quick-test.js --report     # 仅报告
node quick-test.js --check      # 仅检查
```

### 步骤 2：传统分步流程

```bash
# 1. 执行清理
node test-cleanup.js

# 2. 等待60秒让监控完成
# （重要：让持续监控完成工作）

# 3. 运行详细测试报告
node detailed-test-report.js

# 4. 检查所有痕迹（可选）
node check-all-traces.js
```

### 步骤 3：验证关键指标

检查以下关键成功指标：

- ✅ `telemetry.devDeviceId` 已更新（最重要）
- ✅ Augment 扩展存储已清理
- ✅ 工作区 Augment 数据已清理
- ✅ 清理成功率 ≥ 98%

## 📋 测试报告解读

### 成功率计算公式

```
成功率 = (已清理的关键项目数 / 总关键项目数) × 100%
```

### 关键指标

- **🔴 telemetry.devDeviceId**: 最重要，必须更新
- **🟡 Augment 扩展数据**: 重要，必须清理
- **🟢 工作区数据**: 重要，建议清理

### 常见问题排查

#### 问题 1：devDeviceId 未更新

**症状**: `telemetry.devDeviceId: 36987e70-60fe-4401-85a4-f463c269f069` **解决方
案**:

1. 确保 Cursor 完全关闭
2. 运行激进清理模式
3. 手动删除 storage.json 后重启

#### 问题 2：工作区数据残留

**症状**: 发现工作区仍包含 Augment 数据 **解决方案**:

1. 清理所有工作区目录
2. 删除.cursor 配置文件
3. 重新创建工作区

#### 问题 3：数据库记录残留

**症状**: 仍有认证相关记录未清理 **解决方案**:

1. 使用多轮清理模式
2. 延长监控时间
3. 手动删除 state.vscdb

## 🔄 多轮清理策略

### 第一轮：标准清理

```bash
node test-cleanup.js
```

### 第二轮：验证和补充清理

```bash
node detailed-test-report.js
# 如果成功率 < 98%，继续第三轮
```

### 第三轮：激进清理

```bash
# 手动关闭Cursor IDE
taskkill /f /im "Cursor.exe" /t

# 删除关键文件
rm -f "C:\Users\%USERNAME%\AppData\Roaming\Cursor\User\globalStorage\storage.json"
rm -f "C:\Users\%USERNAME%\AppData\Roaming\Cursor\User\globalStorage\state.vscdb"

# 重新运行清理
node test-cleanup.js
```

## 📈 成功率优化建议

### 达到 98%成功率的关键

1. **确保 Cursor 完全关闭**：使用强制关闭命令
2. **多轮清理验证**：不满足 98%就重复清理
3. **延长监控时间**：从 30 秒延长到 60 秒
4. **手动干预关键文件**：直接删除顽固文件

### 监控和验证

- 清理后等待 2 分钟再测试
- 检查 Cursor 是否重新生成了旧数据
- 验证 Augment 扩展的实际行为

## ⚠️ 重要说明

### Cursor IDE 登录信息处理

**结论：不需要清理 Cursor IDE 的登录信息**

**原因**：

1. Cursor IDE 登录属于 IDE 本身的功能
2. 不影响 Augment 扩展的用户识别
3. 清理后会影响 IDE 的正常使用
4. Augment 扩展有独立的认证系统

### 保留项目

- ✅ Cursor IDE 账户登录状态
- ✅ IDE 个人设置和偏好
- ✅ Git 全局配置
- ✅ SSH 密钥
- ✅ 网络配置

### 清理项目

- 🗑️ Augment 扩展存储数据
- 🗑️ 设备遥测标识
- 🗑️ 扩展会话令牌
- 🗑️ 工作区使用记录
- 🗑️ 缓存和临时文件

## 🎯 最终目标确认

**成功标准**：

- 清理成功率 ≥ 98%
- telemetry.devDeviceId 已更新
- Augment 扩展要求重新登录
- 扩展将设备识别为新用户

**验证方法**：

1. 运行详细测试报告
2. 启动 Cursor IDE
3. 检查 Augment 扩展行为
4. 确认是否要求重新登录

## 🎉 成功案例

### 最新测试结果（2025-06-27）

**✅ 关键突破：telemetry.devDeviceId 成功更新！**

**清理前**：

```
telemetry.devDeviceId: 36987e70-60fe-4401-85a4-f463c269f069 (旧ID)
```

**清理后**：

```
telemetry.devDeviceId: cf5209c6-579c-af34-592b-1356f4f39c9e (新ID)
telemetry.machineId: cf5209c6579caf34... (已更新)
telemetry.sqmId: {CF5209C6-579C-AF34...} (已更新)
```

**成功要素**：

1. ✅ 激进清理模式 (`aggressiveMode: true`)
2. ✅ 多轮清理 (`multiRoundClean: true`)
3. ✅ 延长监控时间 (`extendedMonitoring: true`)
4. ✅ 跳过 Cursor IDE 登录清理 (`skipCursorLogin: true`)

### Cursor IDE 登录信息处理确认

**✅ 确认：不需要清理 Cursor IDE 的登录信息**

**原因**：

1. Cursor IDE 登录属于 IDE 本身的功能
2. 不影响 Augment 扩展的用户识别
3. 清理后会影响 IDE 的正常使用
4. Augment 扩展有独立的认证系统
5. **实测证明**：保留 Cursor 登录状态不影响设备 ID 重置效果

### 清理效果总结

- 🗑️ **Augment 扩展存储数据** ✅ 已清理
- 🗑️ **设备遥测标识** ✅ 已更新
- 🗑️ **扩展会话令牌** ✅ 已清理
- 🗑️ **工作区使用记录** ✅ 已清理
- 🗑️ **缓存和临时文件** ✅ 已清理
- ✅ **Cursor IDE 登录状态** 保留（不影响识别）

## 📞 技术支持

如果清理成功率低于 98%，请检查：

1. 是否使用了激进清理模式
2. 是否等待了足够的监控时间
3. telemetry.devDeviceId 是否成功更新
4. Augment 扩展存储是否完全清理

**联系方式**：查看项目 README 或提交 Issue
