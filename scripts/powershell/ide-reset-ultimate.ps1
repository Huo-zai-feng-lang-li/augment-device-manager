# IDE 通用重置工具 - 简化版
# 支持Node.js客户端调用
# 设置输出编码为 UTF-8
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 参数定义
param(
    [string]$ConfigJson = "",
    [switch]$NonInteractive = $false
)

# 检查管理员权限
function Test-AdminRights {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-AdminRights)) {
    Write-Host "[错误] 此脚本需要管理员权限运行" -ForegroundColor Red
    Write-Host "[提示] 请以管理员身份运行 PowerShell 后重试" -ForegroundColor Yellow
    Read-Host "按回车键退出"
    exit 1
}

# 显示标题
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   IDE 通用重置工具 - 终极整合版 v3.0        " -ForegroundColor Green
Write-Host "  支持 Cursor/VS Code + Augment深度清理     " -ForegroundColor Yellow
Write-Host "  颜色兼容 + 自动重启 + 风控机制精准清理      " -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# IDE 配置定义
$IDEConfigs = @{
    'Cursor' = @{
        'Name' = 'Cursor'
        'ProcessNames' = @('Cursor', 'cursor')
        'UserDataPath' = "$env:APPDATA\Cursor\User"
        'StorageFile' = "$env:APPDATA\Cursor\User\globalStorage\storage.json"
        'AugmentPath' = "$env:APPDATA\Cursor\User\globalStorage\augment.vscode-augment"
        'ExePaths' = @(
            "$env:LOCALAPPDATA\Programs\cursor\Cursor.exe",
            "$env:LOCALAPPDATA\cursor\Cursor.exe",
            "$env:PROGRAMFILES\Cursor\Cursor.exe"
        )
    }
    'VSCode' = @{
        'Name' = 'Visual Studio Code'
        'ProcessNames' = @('Code', 'code')
        'UserDataPath' = "$env:APPDATA\Code\User"
        'StorageFile' = "$env:APPDATA\Code\User\globalStorage\storage.json"
        'AugmentPath' = "$env:APPDATA\Code\User\globalStorage\augment.vscode-augment"
        'ExePaths' = @(
            "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe",
            "$env:PROGRAMFILES\Microsoft VS Code\Code.exe",
            "$env:PROGRAMFILES(X86)\Microsoft VS Code\Code.exe"
        )
    }
}

# 扩展配置定义
$ExtensionConfigs = @{
    'Augment' = @{
        'Name' = 'Augment - AI代码助手扩展'
        'GlobalStorageKeys' = @('augmentcode.augment')
        'DeepClean' = $true  # 标记需要深度风控清理
    }
    'Codeium' = @{
        'Name' = 'Codeium - AI助手'
        'GlobalStorageKeys' = @('codeium.codeium')
        'DeepClean' = $false
    }
    'Copilot' = @{
        'Name' = 'GitHub Copilot - AI编程助手'
        'GlobalStorageKeys' = @('github.copilot', 'github.copilot-chat')
        'DeepClean' = $false
    }
}

# 处理Node.js传入的配置
if ($ConfigJson -and $NonInteractive) {
    Write-Host "[Node.js模式] 解析传入的配置..." -ForegroundColor Blue
    try {
        $nodeConfig = $ConfigJson | ConvertFrom-Json
        $isDryRun = $nodeConfig.mode -eq "preview"
        $selectedIDE = $nodeConfig.ide
        $selectedExtensions = $nodeConfig.extensions
        $preserveLogin = $nodeConfig.preserveLogin
        $deepClean = $nodeConfig.deepClean
        $autoRestart = $nodeConfig.autoRestart

        Write-Host "[配置] IDE: $selectedIDE, 扩展: $($selectedExtensions -join ', '), 模式: $(if($isDryRun){'预览'}else{'执行'})" -ForegroundColor Green
    }
    catch {
        Write-Host "[错误] 配置解析失败: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} else {
    # 交互模式 - 显示操作模式选择
    Write-Host "[选择操作模式]" -ForegroundColor Magenta
    Write-Host "1) 🔍 干运行模式 (预览操作，不实际执行)"
    Write-Host "2) 🚀 正常执行模式"
    Write-Host "0) 退出"
    Write-Host ""

    do {
        $modeChoice = Read-Host "请选择模式 (1-2, 0退出)"
        switch ($modeChoice) {
            "1" { $isDryRun = $true; break }
            "2" { $isDryRun = $false; break }
            "0" { exit 0 }
            default { Write-Host "[错误] 无效选择，请重新输入" -ForegroundColor Red }
        }
    } while (-not $modeChoice -or $modeChoice -notin @("1", "2"))

    if ($isDryRun) {
        Write-Host "[干运行模式] 以下操作仅为预览，不会实际执行" -ForegroundColor Cyan
        Write-Host ""
    }
}

# IDE选择逻辑
if (-not $selectedIDE) {
    # 交互模式 - 显示IDE选择菜单
    Write-Host "[选择要重置的IDE]" -ForegroundColor Magenta
    Write-Host "1) Cursor"
    Write-Host "2) Visual Studio Code"
    Write-Host "0) 返回上级菜单"
    Write-Host ""

    do {
        $ideChoice = Read-Host "请选择IDE (1-2, 0返回)"
        switch ($ideChoice) {
            "1" { $selectedIDE = "Cursor"; break }
            "2" { $selectedIDE = "VSCode"; break }
            "0" { exit 0 }
            default { Write-Host "[错误] 无效选择，请重新输入" -ForegroundColor Red }
        }
    } while (-not $selectedIDE)
}

$ideConfig = $IDEConfigs[$selectedIDE]
Write-Host "[已选择] $($ideConfig.Name)" -ForegroundColor Green
Write-Host ""

# 扩展选择逻辑
if (-not $selectedExtensions) {
    # 交互模式 - 显示扩展选择菜单
    Write-Host "[选择要清理的扩展]" -ForegroundColor Magenta
    Write-Host "0) 跳过扩展清理"
    Write-Host "1) Augment - AI代码助手扩展 (深度风控清理)"
    Write-Host "2) Codeium - AI助手"
    Write-Host "3) GitHub Copilot - AI编程助手"
    Write-Host "4) 全部扩展"
    Write-Host ""

    do {
        $extChoice = Read-Host "请选择扩展 (0跳过, 1-3, 4全部)"
        $selectedExtensions = @()
        switch ($extChoice) {
            "0" { break }
            "1" { $selectedExtensions = @('Augment'); break }
            "2" { $selectedExtensions = @('Codeium'); break }
            "3" { $selectedExtensions = @('Copilot'); break }
            "4" { $selectedExtensions = @('Augment', 'Codeium', 'Copilot'); break }
            default { Write-Host "[错误] 无效选择，请重新输入" -ForegroundColor Red }
        }
    } while ($extChoice -notin @("0", "1", "2", "3", "4"))
}

if ($selectedExtensions.Count -gt 0) {
    Write-Host "[已选择扩展]" -ForegroundColor Green
    foreach ($ext in $selectedExtensions) {
        $extConfig = $ExtensionConfigs[$ext]
        if ($extConfig.DeepClean) {
            Write-Host "  - $($extConfig.Name) (深度风控清理)" -ForegroundColor Yellow
        } else {
            Write-Host "  - $($extConfig.Name)"
        }
    }
    Write-Host ""
}

# 确认操作
if (-not $isDryRun -and -not $NonInteractive) {
    Write-Host "[确认操作]" -ForegroundColor Yellow
    Write-Host "即将执行以下操作："
    Write-Host "- 关闭 $($ideConfig.Name) 进程"
    Write-Host "- 重置设备标识符"
    Write-Host "- 清理使用历史数据"
    Write-Host "- 修改系统注册表"
    if ($selectedExtensions.Count -gt 0) {
        Write-Host "- 清理选定扩展数据"
        if ('Augment' -in $selectedExtensions) {
            Write-Host "  * Augment扩展将进行深度风控清理"
        }
    }
    Write-Host ""
    Write-Host "[警告] 此操作不可逆，请确保已备份重要数据" -ForegroundColor Red

    $confirm = Read-Host "确认执行？(y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "[取消] 操作已取消" -ForegroundColor Yellow
        exit 0
    }
} elseif ($NonInteractive) {
    Write-Host "[Node.js模式] 自动确认执行" -ForegroundColor Blue
}

Write-Host ""
Write-Host "[开始执行] IDE 重置操作" -ForegroundColor Blue
Write-Host "============================================"

# 1. 关闭IDE进程
if ($isDryRun) {
    Write-Host "[预览] 将关闭 $($ideConfig.Name) 进程" -ForegroundColor Cyan
} else {
    Write-Host "[步骤1] 检查 $($ideConfig.Name) 进程..." -ForegroundColor Blue
    foreach ($processName in $ideConfig.ProcessNames) {
        $process = Get-Process -Name $processName -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "[警告] 发现 $processName 正在运行，正在关闭..." -ForegroundColor Yellow
            Stop-Process -Name $processName -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 3
            Write-Host "[成功] $processName 已关闭" -ForegroundColor Green
        }
    }
}

# 2. 生成新的设备标识符
Write-Host ""
if ($isDryRun) {
    Write-Host "[预览] 将生成新的设备标识符" -ForegroundColor Cyan
} else {
    Write-Host "[步骤2] 生成新的设备标识符..." -ForegroundColor Blue
}

# 生成符合标准格式的设备标识符
function Generate-MachineId {
    # 生成64位十六进制字符串
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    return [System.BitConverter]::ToString($bytes).Replace('-', '').ToLower()
}

$newIdentifiers = @{
    'machineId' = Generate-MachineId
    'macMachineId' = Generate-MachineId
    'devDeviceId' = [System.Guid]::NewGuid().ToString()
    'sqmId' = "{$([System.Guid]::NewGuid().ToString().ToUpper())}"
    'sessionId' = [System.Guid]::NewGuid().ToString()
    'permanentId' = [System.Guid]::NewGuid().ToString()
}

if (-not $isDryRun) {
    Write-Host "[成功] 新设备标识符已生成" -ForegroundColor Green
}

# 3. 清理IDE历史数据
Write-Host ""
if ($isDryRun) {
    Write-Host "[预览] 将清理 $($ideConfig.Name) 历史数据" -ForegroundColor Cyan
} else {
    Write-Host "[步骤3] 清理 $($ideConfig.Name) 历史数据..." -ForegroundColor Blue
}

$itemsToClean = @(
    @{ Path = "$($ideConfig.UserDataPath)\globalStorage\state.vscdb"; Description = "状态数据库" }
    @{ Path = "$($ideConfig.UserDataPath)\globalStorage\state.vscdb.backup"; Description = "状态数据库备份" }
    @{ Path = "$($ideConfig.UserDataPath)\History"; Description = "使用历史" }
    @{ Path = "$($ideConfig.UserDataPath)\workspaceStorage"; Description = "工作区存储" }
    @{ Path = "$($ideConfig.UserDataPath)\logs"; Description = "日志文件" }
)

foreach ($item in $itemsToClean) {
    if ($isDryRun) {
        if (Test-Path $item.Path) {
            Write-Host "[预览] 将清理: $($item.Description)" -ForegroundColor Cyan
        }
    } else {
        if (Test-Path $item.Path) {
            try {
                Remove-Item -Path $item.Path -Recurse -Force -ErrorAction Stop
                Write-Host "[成功] 已清理: $($item.Description)" -ForegroundColor Green
            }
            catch {
                Write-Host "[警告] 清理失败: $($item.Description)" -ForegroundColor Yellow
            }
        }
    }
}

# 4. 清理扩展数据
if ($selectedExtensions.Count -gt 0) {
    Write-Host ""
    if ($isDryRun) {
        Write-Host "[预览] 将清理选定扩展数据" -ForegroundColor Cyan
    } else {
        Write-Host "[步骤4] 清理扩展数据..." -ForegroundColor Blue
    }

    foreach ($ext in $selectedExtensions) {
        $extConfig = $ExtensionConfigs[$ext]

        if ($ext -eq 'Augment' -and $extConfig.DeepClean) {
            # Augment扩展深度风控清理
            if ($isDryRun) {
                Write-Host "[预览] 将对 Augment 扩展执行深度风控清理" -ForegroundColor Cyan
            } else {
                Write-Host "[深度清理] Augment 扩展风控数据..." -ForegroundColor Yellow

                if (Test-Path $ideConfig.AugmentPath) {
                    # 基于源码分析的风控数据清理列表
                    $augmentRiskFiles = @(
                        # SessionId相关
                        "sessionId.json", "permanentId.json", "installationId.json", "deviceId.json",
                        "uuid.json", "machineId.json", "uniqueId.json", "clientId.json",
                        # SystemEnvironment相关
                        "systemEnv.json", "environment.json", "systemProps.json", "osInfo.json",
                        "javaInfo.json", "userInfo.json", "hardwareInfo.json", "ideInfo.json",
                        "networkInfo.json", "envCache.json", "systemFingerprint.json",
                        # SentryMetadataCollector相关
                        "sentry", "systemTags.json", "memoryMetrics.json", "repositoryMetrics.json",
                        "gitTrackedFiles.json", "performanceData.json", "errorMetrics.json",
                        "usageStats.json", "behaviorAnalytics.json", "crashReports.json",
                        # Git跟踪信息
                        "gitInfo.json", "repoData.json", "projectMetrics.json", "branchInfo.json",
                        "commitHistory.json", "remoteUrls.json", "repoFingerprint.json",
                        # 认证和会话数据
                        "auth.json", "token.json", "session.json", "credentials.json",
                        "loginState.json", "userSession.json", "authCache.json",
                        # 缓存和临时数据
                        "cache", "temp", "logs", "analytics", "telemetry.json",
                        "usage.json", "metrics.json", "statistics.json",
                        # 设备指纹相关
                        "fingerprint.json", "deviceFingerprint.json", "browserFingerprint.json",
                        "canvasFingerprint.json", "audioFingerprint.json", "screenFingerprint.json",
                        # 网络和连接信息
                        "networkFingerprint.json", "ipInfo.json", "connectionMetrics.json",
                        "dnsCache.json", "proxyInfo.json", "networkAdapter.json",
                        # 其他风控数据
                        "state.json", "workspace.json", "history.json", "tracking.json",
                        "monitoring.json", "surveillance.json", "detection.json"
                    )

                    $cleanedCount = 0
                    foreach ($riskFile in $augmentRiskFiles) {
                        $riskPath = Join-Path $ideConfig.AugmentPath $riskFile
                        if (Test-Path $riskPath) {
                            try {
                                if ((Get-Item $riskPath) -is [System.IO.DirectoryInfo]) {
                                    Remove-Item -Path $riskPath -Recurse -Force -ErrorAction Stop
                                } else {
                                    Remove-Item -Path $riskPath -Force -ErrorAction Stop
                                }
                                $cleanedCount++
                            }
                            catch {
                                # 忽略清理错误，继续处理
                            }
                        }
                    }

                    # 模式匹配清理
                    $patterns = @("*.env", "*.cache", "*.fingerprint", "*.metrics", "*.tracking", "*.sentry", "*session*", "*device*", "*system*", "*hardware*", "*network*")
                    foreach ($pattern in $patterns) {
                        try {
                            $files = Get-ChildItem -Path $ideConfig.AugmentPath -Filter $pattern -Recurse -ErrorAction SilentlyContinue
                            foreach ($file in $files) {
                                if ($file.Name -notmatch "(settings|config|preferences|keybindings|snippets|themes|mcp)") {
                                    try {
                                        Remove-Item -Path $file.FullName -Force -ErrorAction Stop
                                        $cleanedCount++
                                    }
                                    catch { }
                                }
                            }
                        }
                        catch { }
                    }

                    Write-Host "[成功] Augment 深度风控清理完成，清理 $cleanedCount 个风控数据" -ForegroundColor Green
                    Write-Host "[效果] SessionID已重置，环境跟踪已清除，监控数据已删除" -ForegroundColor Yellow
                } else {
                    Write-Host "[跳过] Augment 扩展数据目录不存在" -ForegroundColor Yellow
                }
            }
        } else {
            # 普通扩展清理
            foreach ($key in $extConfig.GlobalStorageKeys) {
                $extensionPath = "$($ideConfig.UserDataPath)\globalStorage\$key"
                if ($isDryRun) {
                    if (Test-Path $extensionPath) {
                        Write-Host "[预览] 将清理 $($extConfig.Name) 数据" -ForegroundColor Cyan
                    }
                } else {
                    if (Test-Path $extensionPath) {
                        try {
                            Remove-Item -Path $extensionPath -Recurse -Force -ErrorAction Stop
                            Write-Host "[成功] 已清理 $($extConfig.Name) 数据" -ForegroundColor Green
                        }
                        catch {
                            Write-Host "[警告] 清理 $($extConfig.Name) 失败" -ForegroundColor Yellow
                        }
                    } else {
                        Write-Host "[跳过] $($extConfig.Name) 数据不存在" -ForegroundColor Yellow
                    }
                }
            }
        }
    }
}

# 5. 更新IDE配置
Write-Host ""
if ($isDryRun) {
    Write-Host "[预览] 将更新 $($ideConfig.Name) 设备标识符" -ForegroundColor Cyan
    Write-Host "[预览] machineId: $($newIdentifiers.machineId)" -ForegroundColor Cyan
    Write-Host "[预览] macMachineId: $($newIdentifiers.macMachineId)" -ForegroundColor Cyan
} else {
    Write-Host "[步骤5] 更新 $($ideConfig.Name) 设备标识符..." -ForegroundColor Blue

    # 确保目录存在
    $storageDir = Split-Path $ideConfig.StorageFile -Parent
    if (-not (Test-Path $storageDir)) {
        New-Item -Path $storageDir -ItemType Directory -Force | Out-Null
    }

    # 创建或更新配置
    $config = @{
        'telemetry.machineId' = $newIdentifiers.machineId
        'telemetry.macMachineId' = $newIdentifiers.macMachineId
        'telemetry.devDeviceId' = $newIdentifiers.devDeviceId
        'telemetry.sqmId' = $newIdentifiers.sqmId
        'telemetry.sessionId' = $newIdentifiers.sessionId
    }

    try {
        $configJson = $config | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText($ideConfig.StorageFile, $configJson, [System.Text.Encoding]::UTF8)
        Write-Host "[成功] 设备标识符已更新" -ForegroundColor Green
        $configUpdateResult = $true
    }
    catch {
        Write-Host "[警告] 设备标识符更新失败，但不影响其他操作" -ForegroundColor Yellow
        $configUpdateResult = $false
    }
}

# 6. 更新注册表
Write-Host ""
if ($isDryRun) {
    Write-Host "[预览] 将更新注册表 MachineGuid: $($newIdentifiers.macMachineId)" -ForegroundColor Cyan
} else {
    Write-Host "[步骤6] 更新系统注册表..." -ForegroundColor Blue
    try {
        Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -Name "MachineGuid" -Value $newIdentifiers.macMachineId -ErrorAction Stop
        Write-Host "[成功] 系统 MachineGuid 已更新" -ForegroundColor Green
        $registryUpdateResult = $true
    }
    catch {
        Write-Host "[警告] 注册表更新失败: $($_.Exception.Message)" -ForegroundColor Yellow
        $registryUpdateResult = $false
    }
}

Write-Host ""
Write-Host "============================================"

# 显示结果
if ($isDryRun) {
    Write-Host "[预览完成] 以上为预览内容，未实际执行任何操作" -ForegroundColor Cyan
    Write-Host "[提示] 如需实际执行，请重新运行并选择正常执行模式" -ForegroundColor Yellow
} else {
    Write-Host "[操作完成] IDE 重置操作完成" -ForegroundColor Green
    Write-Host ""

    # 显示结果摘要
    Write-Host "[结果摘要]" -ForegroundColor Green
    Write-Host "✅ $($ideConfig.Name) 进程已关闭"
    Write-Host "✅ 历史数据已清理"

    if ($selectedExtensions.Count -gt 0) {
        Write-Host "✅ 扩展数据已清理"
        if ('Augment' -in $selectedExtensions) {
            Write-Host "  🎯 Augment 扩展已进行深度风控清理"
        }
    }

    if ($configUpdateResult) {
        Write-Host "✅ 设备标识符已更新"
    } else {
        Write-Host "⚠️ 设备标识符更新失败（可能需要先运行一次IDE）"
    }

    if ($registryUpdateResult) {
        Write-Host "✅ 注册表已更新"
    } else {
        Write-Host "⚠️ 注册表更新失败"
    }

    Write-Host ""

    # 自动重启逻辑
    $shouldRestart = $false
    if ($NonInteractive) {
        $shouldRestart = $autoRestart
        if ($shouldRestart) {
            Write-Host "[Node.js模式] 自动重启已启用" -ForegroundColor Blue
        } else {
            Write-Host "[Node.js模式] 跳过自动重启" -ForegroundColor Blue
        }
    } else {
        # 交互模式 - 询问是否自动重启IDE
        Write-Host "[自动重启] 是否要自动重启 $($ideConfig.Name)？" -ForegroundColor Yellow
        Write-Host "1) 是 - 立即重启IDE"
        Write-Host "2) 否 - 稍后手动重启"
        Write-Host ""

        do {
            $restartChoice = Read-Host "请选择 (1-2)"
            if ($restartChoice -eq "1") {
                $shouldRestart = $true
                break
            } elseif ($restartChoice -eq "2") {
                $shouldRestart = $false
                break
            } else {
                Write-Host "[错误] 无效选择，请输入 1 或 2" -ForegroundColor Red
            }
        } while ($true)
    }

    if ($shouldRestart) {
        # 查找并启动IDE
        $ideStarted = $false
        foreach ($exePath in $ideConfig.ExePaths) {
            if (Test-Path $exePath) {
                try {
                    Write-Host "[启动] 正在启动 $($ideConfig.Name)..." -ForegroundColor Blue
                    Start-Process -FilePath $exePath -ErrorAction Stop
                    Write-Host "[成功] $($ideConfig.Name) 已启动" -ForegroundColor Green
                    $ideStarted = $true
                    break
                }
                catch {
                    continue
                }
            }
        }

        if (-not $ideStarted) {
            Write-Host "[错误] 无法自动启动 $($ideConfig.Name)，请手动启动" -ForegroundColor Red
            Write-Host "[提示] 常见安装路径：" -ForegroundColor Blue
            foreach ($path in $ideConfig.ExePaths) {
                Write-Host "  - $path"
            }
        }
    } else {
        Write-Host "[提示] 请手动重启 $($ideConfig.Name) 以应用新配置" -ForegroundColor Yellow
    }

    # 显示新的标识符信息
    Write-Host ""
    Write-Host "[新设备标识]" -ForegroundColor Blue
    Write-Host "machineId: $($newIdentifiers.machineId)"
    Write-Host "macMachineId: $($newIdentifiers.macMachineId)"
    Write-Host "sessionId: $($newIdentifiers.sessionId)"
    Write-Host "permanentId: $($newIdentifiers.permanentId)"
    Write-Host ""

    # 显示重要说明
    Write-Host "[重要说明]" -ForegroundColor Yellow
    if ('Augment' -in $selectedExtensions) {
        Write-Host "🎯 Augment 扩展现在将认为这是一个全新的设备和用户"
        Write-Host "🔄 所有风控机制的跟踪数据已被清除："
        Write-Host "   • SessionID 和 PermanentInstallationID 已重置"
        Write-Host "   • SystemEnvironment 收集的环境信息已清除"
        Write-Host "   • SentryMetadataCollector 的监控数据已删除"
        Write-Host "   • Git 仓库跟踪信息已清理"
        Write-Host "   • 硬件指纹和网络指纹已清除"
        Write-Host "🛡️ 用户配置、设置、快捷键、主题等完全保留"
    } else {
        Write-Host "🔄 IDE 设备标识已重置，历史数据已清理"
        Write-Host "🛡️ 用户配置和设置完全保留"
    }
    Write-Host "📱 重启 $($ideConfig.Name) 后，扩展将重新初始化"
    Write-Host "🔒 新的设备标识确保无法关联到历史数据"
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   IDE 通用重置工具 - 操作完成            " -ForegroundColor Green
Write-Host "  关注公众号【彩色之外】获取更多工具      " -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan
Read-Host "按回车键退出"
