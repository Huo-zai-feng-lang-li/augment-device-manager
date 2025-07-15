# Cursor IDE完全重置功能

## 功能概述

新增了一个复选框选项"🔄 完全重置Cursor IDE用户身份"，允许用户选择是否让Cursor IDE也认为是全新用户。

## 功能特性

### 🔄 完全重置模式（勾选复选框）
当用户勾选"完全重置Cursor IDE用户身份"复选框时：

- ✅ **清理所有Cursor IDE数据**：包括用户设置、扩展数据、工作区数据等
- ✅ **重置所有遥测ID**：生成全新的设备ID、机器ID、遥测ID等
- ✅ **清除认证信息**：需要重新登录Cursor IDE
- ✅ **模拟首次安装**：重置安装时间、会话计数等统计信息
- ✅ **清理额外数据**：清理临时文件、缓存、用户配置等

### 🛡️ 保留登录模式（默认，不勾选）
当用户不勾选复选框时（默认行为）：

- ✅ **保留Cursor IDE登录状态**：无需重新登录
- ✅ **只重置Augment扩展相关数据**：让Augment扩展认为是新设备
- ✅ **保留用户设置和偏好**：保持Cursor IDE的个人配置
- ✅ **更新设备标识**：仍然会更新设备ID以欺骗Augment扩展

## 技术实现

### UI界面
```html
<!-- 新增：Cursor IDE完全重置选项 -->
<div class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
  <label class="flex items-center gap-3 text-sm cursor-pointer">
    <input
      type="checkbox"
      id="reset-cursor-completely"
      class="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
    />
    <div class="flex-1">
      <span class="text-slate-800 font-medium">🔄 完全重置Cursor IDE用户身份</span>
      <p class="text-xs text-slate-600 mt-1">
        清理所有Cursor IDE数据，让IDE也认为是全新用户（包括遥测ID、用户设置等）
      </p>
    </div>
  </label>
</div>
```

### 后端逻辑
- `resetCursorCompletely` 选项控制清理策略
- `skipCursorLogin` 与 `resetCursorCompletely` 互斥
- 新增 `performCompleteCursorReset()` 函数处理完全重置
- 新增 `cleanAdditionalCursorData()` 清理额外数据
- 新增 `generateFreshCursorIdentity()` 生成全新身份

## 使用场景

### 场景1：只想重置Augment扩展（推荐）
- **操作**：不勾选复选框，使用默认设置
- **结果**：Augment扩展认为是新设备，但Cursor IDE保持登录状态
- **优点**：无需重新登录，操作简单

### 场景2：完全重置Cursor IDE
- **操作**：勾选"完全重置Cursor IDE用户身份"复选框
- **结果**：Cursor IDE和Augment扩展都认为是全新用户
- **优点**：彻底重置，确保100%被识别为新用户
- **缺点**：需要重新登录和配置Cursor IDE

## 测试结果

### 默认模式测试
```
✅ 保留登录模式: ✅ 已执行
✅ 设备ID更新: ✅ 已更新
   36987e70-60fe-44... → 3e4059dd-acdc-3f...
```

### 完全重置模式测试
```
✅ 完全重置模式: ✅ 已执行
✅ 设备ID更新: ✅ 已更新
   3e4059dd-acdc-3f... → 233e20fa-4c56-de...
```

## 安全性

- ✅ **数据备份**：所有清理操作都会先备份原始数据
- ✅ **错误处理**：单个文件清理失败不会影响整体流程
- ✅ **可恢复性**：备份文件可用于数据恢复
- ✅ **选择性清理**：用户可以选择清理程度

## 兼容性

- ✅ **不影响现有功能**：默认行为保持不变
- ✅ **向后兼容**：现有用户无需更改使用习惯
- ✅ **独立功能**：可以单独启用或禁用

## 注意事项

1. **完全重置后需要重新登录**：选择完全重置后，需要重新输入Cursor IDE的登录凭据
2. **个人设置会丢失**：完全重置会清除所有个人配置和偏好设置
3. **扩展需要重新安装**：某些扩展可能需要重新安装或配置
4. **工作区数据会清理**：最近打开的项目列表等会被清除

## 推荐使用方式

- **日常使用**：建议使用默认模式（不勾选），既能重置Augment扩展又保持便利性
- **彻底重置**：只有在需要完全清除Cursor IDE使用痕迹时才使用完全重置模式
- **测试环境**：在测试环境中可以使用完全重置模式验证新用户体验
