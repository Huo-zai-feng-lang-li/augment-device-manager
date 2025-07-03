# PowerShell脚本 - 快速退出激活状态
# 用于紧急情况下快速清除激活状态和停止守护进程

Write-Host "🚨 快速退出激活状态..." -ForegroundColor Red
Write-Host ""

$actions = @()
$errors = @()

try {
    # 1. 终止所有相关进程
    Write-Host "🛑 终止守护进程..." -ForegroundColor Yellow
    
    try {
        # 终止所有Node.js进程（包含guardian关键字的）
        $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
            $_.CommandLine -like "*guardian*" -or 
            $_.ProcessName -like "*guardian*"
        }
        
        if ($nodeProcesses) {
            $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
            $actions += "✅ 已终止 $($nodeProcesses.Count) 个守护进程"
        } else {
            $actions += "ℹ️ 未发现运行中的守护进程"
        }
        
        # 终止所有Node.js进程（更激进的方式）
        Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        $actions += "✅ 已终止所有Node.js进程"
        
    } catch {
        $errors += "终止进程失败: $($_.Exception.Message)"
    }

    # 2. 删除激活配置文件
    Write-Host "🗑️ 删除激活配置..." -ForegroundColor Yellow
    
    $configDir = Join-Path $env:USERPROFILE ".augment-device-manager"
    $configFile = Join-Path $configDir "config.json"
    
    try {
        if (Test-Path $configFile) {
            Remove-Item $configFile -Force
            $actions += "✅ 已删除激活配置文件"
        } else {
            $actions += "ℹ️ 激活配置文件不存在"
        }
    } catch {
        $errors += "删除配置文件失败: $($_.Exception.Message)"
    }

    # 3. 删除配置目录（如果为空）
    try {
        if (Test-Path $configDir) {
            $files = Get-ChildItem $configDir -ErrorAction SilentlyContinue
            if ($files.Count -eq 0) {
                Remove-Item $configDir -Force
                $actions += "✅ 已删除配置目录"
            } else {
                $actions += "ℹ️ 配置目录不为空，保留"
            }
        }
    } catch {
        $errors += "处理配置目录失败: $($_.Exception.Message)"
    }

    # 4. 清理其他激活相关文件
    Write-Host "🧹 清理相关文件..." -ForegroundColor Yellow
    
    $cleanupPaths = @(
        (Join-Path $env:USERPROFILE ".augment"),
        (Join-Path $env:USERPROFILE ".cursor-augment"),
        (Join-Path $env:USERPROFILE "AppData\Local\augment-device-manager")
    )

    foreach ($cleanupPath in $cleanupPaths) {
        try {
            if (Test-Path $cleanupPath) {
                Remove-Item $cleanupPath -Recurse -Force
                $actions += "✅ 已清理: $(Split-Path $cleanupPath -Leaf)"
            }
        } catch {
            $errors += "清理 $cleanupPath 失败: $($_.Exception.Message)"
        }
    }

    # 5. 清理注册表相关项（可选）
    Write-Host "🔧 清理注册表..." -ForegroundColor Yellow
    
    try {
        $regPaths = @(
            "HKCU:\Software\augment-device-manager",
            "HKLM:\Software\augment-device-manager"
        )
        
        foreach ($regPath in $regPaths) {
            if (Test-Path $regPath) {
                Remove-Item $regPath -Recurse -Force -ErrorAction SilentlyContinue
                $actions += "✅ 已清理注册表: $regPath"
            }
        }
    } catch {
        $errors += "清理注册表失败: $($_.Exception.Message)"
    }

    # 6. 显示结果
    Write-Host ""
    Write-Host ("=" * 40) -ForegroundColor Cyan
    Write-Host "📊 快速退出结果" -ForegroundColor Cyan
    Write-Host ("=" * 40) -ForegroundColor Cyan
    
    if ($actions.Count -gt 0) {
        Write-Host ""
        Write-Host "✅ 完成操作:" -ForegroundColor Green
        foreach ($action in $actions) {
            Write-Host "   $action" -ForegroundColor White
        }
    }
    
    if ($errors.Count -gt 0) {
        Write-Host ""
        Write-Host "❌ 错误信息:" -ForegroundColor Red
        foreach ($error in $errors) {
            Write-Host "   $error" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "🎯 状态: 激活状态已清除，守护进程已停止" -ForegroundColor Green
    Write-Host "💡 建议: 重启应用程序以确保所有更改生效" -ForegroundColor Cyan
    
    # 7. 验证结果
    Write-Host ""
    Write-Host "🔍 验证激活状态..." -ForegroundColor Yellow
    if (!(Test-Path $configFile)) {
        Write-Host "✅ 确认: 激活配置已清除" -ForegroundColor Green
    } else {
        Write-Host "⚠️ 警告: 激活配置文件仍然存在" -ForegroundColor Yellow
    }

    # 8. 检查剩余进程
    Write-Host ""
    Write-Host "🔍 检查剩余进程..." -ForegroundColor Yellow
    $remainingProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($remainingProcesses) {
        Write-Host "⚠️ 发现 $($remainingProcesses.Count) 个剩余Node.js进程" -ForegroundColor Yellow
        Write-Host "💡 如需完全清理，请手动终止或重启计算机" -ForegroundColor Cyan
    } else {
        Write-Host "✅ 未发现剩余Node.js进程" -ForegroundColor Green
    }

} catch {
    Write-Host "❌ 快速退出失败: $($_.Exception.Message)" -ForegroundColor Red
    $errors += $_.Exception.Message
}

Write-Host ""
Write-Host "🔍 验证命令:" -ForegroundColor Cyan
Write-Host "   - 检查配置: node check-activation-status.js" -ForegroundColor White
Write-Host "   - 检查进程: tasklist | findstr node" -ForegroundColor White
Write-Host "   - 重新激活: 获取新的激活码并重新激活" -ForegroundColor White

# 返回结果
if ($errors.Count -eq 0) {
    Write-Host ""
    Write-Host "✅ 快速退出激活状态完成！" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "⚠️ 快速退出完成，但存在一些问题" -ForegroundColor Yellow
    exit 1
}
