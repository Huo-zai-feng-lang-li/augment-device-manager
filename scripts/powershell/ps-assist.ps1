# PowerShell Assisted Cleanup for IDE Device Reset
param(
    [string]$Config = ""
)

Write-Host "[PowerShell] Starting assisted cleanup..." -ForegroundColor Blue

if ($Config) {
    try {
        $configObj = $Config | ConvertFrom-Json
        $ide = $configObj.ide
        $isDryRun = $configObj.mode -eq "preview"
        
        Write-Host "[SUCCESS] Config parsed: IDE=$ide, Mode=$(if($isDryRun){'Preview'}else{'Execute'})" -ForegroundColor Green
    }
    catch {
        Write-Host "[ERROR] Config parsing failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} else {
    $ide = "Cursor"
    $isDryRun = $false
    Write-Host "[INFO] Using default config: IDE=Cursor, Mode=Execute" -ForegroundColor Yellow
}

# Generate new device identifiers
$newDeviceId = [System.Guid]::NewGuid().ToString()
$newMachineId = [System.Guid]::NewGuid().ToString()
$newSessionId = [System.Guid]::NewGuid().ToString()

Write-Host "[STEP 1] Generated new identifiers:" -ForegroundColor Blue
Write-Host "  DeviceId: $newDeviceId"
Write-Host "  MachineId: $newMachineId"
Write-Host "  SessionId: $newSessionId"

# Close IDE processes
if ($ide -eq "Cursor") {
    $processNames = @('Cursor', 'cursor')
    $storageFile = "$env:APPDATA\Cursor\User\globalStorage\storage.json"
    $augmentPath = "$env:APPDATA\Cursor\User\globalStorage\augment.vscode-augment"
    $mcpConfigPath = "$env:APPDATA\Cursor\User\globalStorage\augment.vscode-augment\augment-global-state\mcpServers.json"
} else {
    $processNames = @('Code', 'code')
    $storageFile = "$env:APPDATA\Code\User\globalStorage\storage.json"
    $augmentPath = "$env:APPDATA\Code\User\globalStorage\augment.vscode-augment"
    $mcpConfigPath = "$env:APPDATA\Code\User\globalStorage\augment.vscode-augment\augment-global-state\mcpServers.json"
}

Write-Host "[STEP 2] Closing $ide processes..." -ForegroundColor Blue
foreach ($processName in $processNames) {
    $processes = Get-Process -Name $processName -ErrorAction SilentlyContinue
    if ($processes) {
        if (-not $isDryRun) {
            Stop-Process -Name $processName -Force -ErrorAction SilentlyContinue
            Write-Host "[SUCCESS] Closed $processName processes" -ForegroundColor Green
        } else {
            Write-Host "[PREVIEW] Would close $processName processes" -ForegroundColor Cyan
        }
    }
}

# Update device identifiers in storage.json
Write-Host "[STEP 3] Updating device identifiers..." -ForegroundColor Blue

if (-not $isDryRun) {
    # Ensure directory exists
    $storageDir = Split-Path $storageFile -Parent
    if (-not (Test-Path $storageDir)) {
        New-Item -Path $storageDir -ItemType Directory -Force | Out-Null
    }

    # Read existing config or create new one
    $config = @{}
    if (Test-Path $storageFile) {
        try {
            $existingContent = Get-Content $storageFile -Raw -Encoding UTF8
            $config = $existingContent | ConvertFrom-Json -AsHashtable
        }
        catch {
            Write-Host "[WARNING] Could not read existing config, creating new one" -ForegroundColor Yellow
        }
    }

    # Update only device-related identifiers, preserve login data
    $config['telemetry.devDeviceId'] = $newDeviceId
    $config['telemetry.machineId'] = $newMachineId
    $config['telemetry.macMachineId'] = $newMachineId
    $config['telemetry.sessionId'] = $newSessionId
    $config['telemetry.sqmId'] = "{$($newMachineId.ToUpper())}"
    $config['telemetry.firstSessionDate'] = (Get-Date).ToUniversalTime().ToString("R")
    $config['telemetry.currentSessionDate'] = (Get-Date).ToUniversalTime().ToString("R")

    try {
        $configJson = $config | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText($storageFile, $configJson, [System.Text.Encoding]::UTF8)
        Write-Host "[SUCCESS] Device identifiers updated in $storageFile" -ForegroundColor Green
    }
    catch {
        Write-Host "[ERROR] Failed to update storage.json: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "[PREVIEW] Would update device identifiers in $storageFile" -ForegroundColor Cyan
}

# Clean Augment extension data (but preserve IDE login and MCP config)
Write-Host "[STEP 4] Cleaning Augment extension data..." -ForegroundColor Blue

if (-not $isDryRun) {
    if (Test-Path $augmentPath) {
        try {
            # 1. 保护MCP配置文件
            $mcpConfig = $null
            if (Test-Path $mcpConfigPath) {
                try {
                    $mcpConfig = Get-Content $mcpConfigPath -Raw | ConvertFrom-Json
                    Write-Host "[PROTECT] MCP configuration backed up" -ForegroundColor Yellow
                }
                catch {
                    Write-Host "[WARNING] Failed to backup MCP config: $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }

            # 2. 删除Augment扩展数据
            Remove-Item -Path $augmentPath -Recurse -Force
            Write-Host "[SUCCESS] Augment extension data cleaned" -ForegroundColor Green

            # 3. 恢复MCP配置文件
            if ($mcpConfig) {
                $mcpConfigDir = Split-Path $mcpConfigPath -Parent
                if (-not (Test-Path $mcpConfigDir)) {
                    New-Item -Path $mcpConfigDir -ItemType Directory -Force | Out-Null
                }
                $mcpConfig | ConvertTo-Json -Depth 10 | Set-Content $mcpConfigPath -Encoding UTF8
                Write-Host "[RESTORE] MCP configuration restored" -ForegroundColor Green
            }
        }
        catch {
            Write-Host "[WARNING] Failed to clean Augment data: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[INFO] Augment extension data not found" -ForegroundColor Yellow
    }
} else {
    Write-Host "[PREVIEW] Would clean Augment extension data (preserving MCP config)" -ForegroundColor Cyan
}

# Update system registry (requires admin rights)
Write-Host "[STEP 5] Updating system registry..." -ForegroundColor Blue

$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isAdmin -and -not $isDryRun) {
    try {
        Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -Name "MachineGuid" -Value $newMachineId
        Write-Host "[SUCCESS] System MachineGuid updated" -ForegroundColor Green
    }
    catch {
        Write-Host "[WARNING] Registry update failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    if ($isDryRun) {
        Write-Host "[PREVIEW] Would update system MachineGuid" -ForegroundColor Cyan
    } else {
        Write-Host "[WARNING] Administrator rights required for registry update" -ForegroundColor Yellow
    }
}

Write-Host "[COMPLETE] PowerShell assisted cleanup completed!" -ForegroundColor Green
Write-Host "[RESULT] Device will be recognized as new user by extensions" -ForegroundColor Green
Write-Host "[PRESERVED] IDE login status and user settings remain intact" -ForegroundColor Green

# Output new device ID for verification
Write-Host ""
Write-Host "New Device ID: $newDeviceId" -ForegroundColor Blue

exit 0
