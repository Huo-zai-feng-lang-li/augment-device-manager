# PowerShell脚本 - 修复客户端配置文件

Write-Host "🔧 修复客户端配置文件..." -ForegroundColor Green

$configPath = Join-Path $env:USERPROFILE ".augment-device-manager"
$configFile = Join-Path $configPath "config.json"

# 创建配置对象
$config = @{
    activation = @{
        code = "6F7D499A29EAACCBC053141CC1759BCD"
        deviceId = "c85f8e929c3c14ab"
        activatedAt = "2025-08-03T08:50:00.000Z"
        expiresAt = "2025-12-31T23:59:59.000Z"
        version = "1.0.0"
    }
    lastUpdated = "2025-08-03T08:50:00.000Z"
}

Write-Host "📋 配置信息:" -ForegroundColor Yellow
Write-Host "   激活码: $($config.activation.code)"
Write-Host "   设备ID: $($config.activation.deviceId)"
Write-Host "   过期时间: 2025年12月31日"

# 确保目录存在
if (-not (Test-Path $configPath)) {
    New-Item -Path $configPath -ItemType Directory -Force | Out-Null
}

# 备份现有配置
if (Test-Path $configFile) {
    $backupFile = "$configFile.manual-fix-backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
    Copy-Item $configFile $backupFile
    Write-Host "📁 已备份现有配置: $(Split-Path $backupFile -Leaf)" -ForegroundColor Cyan
}

# 写入新配置
$configJson = $config | ConvertTo-Json -Depth 10
$configJson | Out-File -FilePath $configFile -Encoding UTF8

Write-Host "✅ 配置文件已更新: $configFile" -ForegroundColor Green

# 验证写入结果
if (Test-Path $configFile) {
    $savedConfig = Get-Content $configFile | ConvertFrom-Json
    if ($savedConfig.activation.code -eq $config.activation.code) {
        Write-Host "✅ 配置验证通过" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎉 手动修复完成！" -ForegroundColor Green
        Write-Host "💡 关键修复内容:" -ForegroundColor Yellow
        Write-Host "   1. 移除了客户端main.js中的本地时间过期检查"
        Write-Host "   2. 设置了未来的过期时间（2025年12月31日）"
        Write-Host "   3. 使用已验证的有效激活码"
        Write-Host ""
        Write-Host "🔄 现在请重启客户端应用测试激活状态" -ForegroundColor Cyan
    } else {
        Write-Host "❌ 配置验证失败" -ForegroundColor Red
    }
} else {
    Write-Host "❌ 配置文件创建失败" -ForegroundColor Red
}
