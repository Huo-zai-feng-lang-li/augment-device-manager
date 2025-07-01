# skipBackup 功能说明

## 🎯 功能概述

`skipBackup` 是新增的清理选项，用于防止客户端在清理过程中创建备份文件，从而避免 IDE 从备份中恢复设备ID。

## 🔍 问题背景

### 发现的问题
1. **备份文件恢复**：Cursor IDE 从工作区的 `state.vscdb.backup` 文件中恢复设备ID
2. **客户端创建备份**：清理过程中创建大量备份文件，为IDE恢复提供了数据源
3. **管理员权限绕过**：IDE以管理员权限运行时可以绕过只读文件保护

### 备份文件类型
客户端清理时会创建以下备份：
- `cursor-backup-${timestamp}` - Cursor IDE数据备份
- `augment-backup-${timestamp}` - Augment扩展数据备份  
- `workspace-augment-backup-${timestamp}` - 工作区数据备份
- `config.json.backup.${timestamp}` - 配置文件备份
- `vscode-${variant}-complete-backup-${timestamp}` - VS Code完整备份

## ⚙️ 功能实现

### 1. 后端实现
在 `device-manager.js` 中添加了 `skipBackup` 选项支持：

```javascript
// 备份重要文件（可选）
let backupDir = null;
if (!options.skipBackup) {
  backupDir = path.join(os.tmpdir(), `cursor-backup-${Date.now()}`);
  await fs.ensureDir(backupDir);
  results.actions.push("📁 已创建备份目录");
} else {
  results.actions.push("🚫 跳过备份文件创建（防止IDE恢复）");
}
```

### 2. 前端实现
在 `renderer.js` 中添加了选项传递：

```javascript
const skipBackup = document.getElementById("skip-backup")?.checked ?? true; // 默认跳过备份

const result = await ipcRenderer.invoke("perform-device-cleanup", {
  // ... 其他选项
  skipBackup, // 跳过备份文件创建
});
```

### 3. 界面选项
在 `index.html` 中添加了用户选择：

```html
<label class="flex items-center gap-2 text-sm">
  <input type="checkbox" id="skip-backup" checked class="rounded border-slate-300" />
  <span class="text-slate-700">🚫 跳过备份文件创建（防止IDE恢复）</span>
</label>
```

## 🚀 使用方法

### 1. 界面操作
- 打开客户端清理界面
- `skipBackup` 选项默认已勾选
- 点击清理按钮即可

### 2. 代码调用
```javascript
const deviceManager = new DeviceManager();
const result = await deviceManager.performCleanup({
  preserveActivation: true,
  deepClean: true,
  cleanCursorExtension: true,
  skipBackup: true, // 关键选项
  // ... 其他选项
});
```

### 3. 测试验证
```bash
cd modules/desktop-client
node test/test-skip-backup.js
```

## ✅ 预期效果

### 启用 skipBackup (默认)
- ✅ 不创建任何备份文件
- ✅ 防止IDE从备份恢复设备ID
- ✅ 提高清理成功率
- ✅ 减少磁盘空间占用

### 禁用 skipBackup
- ❌ 创建完整备份文件
- ❌ IDE可能从备份恢复
- ❌ 降低清理效果
- ✅ 数据安全性更高

## 🔧 技术细节

### 影响的函数
1. `performCleanup()` - 主清理函数
2. `performCompleteCursorReset()` - 完全重置函数
3. `performCompleteVSCodeReset()` - VS Code重置函数
4. `cleanAugmentExtensionStorage()` - Augment扩展清理
5. `cleanAugmentWorkspaceData()` - 工作区数据清理

### 备份逻辑修改
```javascript
// 修改前
await fs.copy(sourcePath, backupPath);

// 修改后
if (!options.skipBackup && backupDir) {
  await fs.copy(sourcePath, backupPath);
}
```

## 📊 测试结果

### 功能验证
- ✅ skipBackup=true 时不创建备份文件
- ✅ skipBackup=false 时正常创建备份
- ✅ 清理功能正常工作
- ✅ 界面选项正确传递

### 性能提升
- 🚀 清理速度提升（无需备份操作）
- 💾 磁盘空间节省
- 🎯 清理成功率提高

## ⚠️ 注意事项

### 1. 数据安全
- 启用 `skipBackup` 后无法恢复清理的数据
- 建议在测试环境先验证效果
- 重要数据请手动备份

### 2. 兼容性
- 所有清理模式都支持 `skipBackup`
- 与现有选项完全兼容
- 不影响其他功能

### 3. 默认设置
- 客户端默认启用 `skipBackup`
- 用户可以手动关闭
- 测试脚本可以灵活配置

## 🎉 总结

`skipBackup` 功能有效解决了 IDE 从备份文件恢复设备ID的问题：

1. **根本解决**：不创建备份文件，断绝恢复源头
2. **用户友好**：默认启用，无需用户干预
3. **灵活配置**：支持手动开关
4. **性能优化**：提升清理速度和成功率

这个功能将显著提高客户端清理的有效性，确保 Cursor 扩展插件将设备识别为全新用户。
