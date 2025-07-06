# IDE Reset Tool - Simple Version for Node.js Integration
# UTF-8 Encoding
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Parameters
param(
    [string]$ConfigJson = "",
    [switch]$NonInteractive = $false
)

# Check admin rights
function Test-AdminRights {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Host "[PowerShell] Starting assisted cleanup..." -ForegroundColor Blue

# Parse Node.js config
if ($ConfigJson -and $NonInteractive) {
    Write-Host "[PowerShell] Parsing configuration..." -ForegroundColor Blue
    try {
        $nodeConfig = $ConfigJson | ConvertFrom-Json
        $isDryRun = $nodeConfig.mode -eq "preview"
        $selectedIDE = $nodeConfig.ide
        $selectedExtensions = $nodeConfig.extensions
        $preserveLogin = $nodeConfig.preserveLogin
        $deepClean = $nodeConfig.deepClean
        $autoRestart = $nodeConfig.autoRestart
        
        Write-Host "[SUCCESS] Config parsed: IDE=$selectedIDE, Extensions=$($selectedExtensions -join ','), Mode=$(if($isDryRun){'Preview'}else{'Execute'})" -ForegroundColor Green
    }
    catch {
        Write-Host "[ERROR] Config parsing failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[ERROR] Missing required configuration" -ForegroundColor Red
    exit 1
}

# Check admin rights
if (-not (Test-AdminRights)) {
    Write-Host "[WARNING] Not running as administrator, some operations may fail" -ForegroundColor Yellow
}

Write-Host "[STEP 1] Starting PowerShell assisted cleanup..." -ForegroundColor Blue

# 1. Close IDE processes
if ($selectedIDE -eq "Cursor") {
    $processNames = @('Cursor', 'cursor')
} else {
    $processNames = @('Code', 'code')
}

foreach ($processName in $processNames) {
    $process = Get-Process -Name $processName -ErrorAction SilentlyContinue
    if ($process) {
        if (-not $isDryRun) {
            Write-Host "[SUCCESS] Found $processName process, closing..." -ForegroundColor Yellow
            Stop-Process -Name $processName -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        } else {
            Write-Host "[PREVIEW] Will close $processName process" -ForegroundColor Cyan
        }
    }
}

# 2. Generate new device identifiers
Write-Host "[STEP 2] Generating new device identifiers..." -ForegroundColor Blue

$newIdentifiers = @{
    'machineId' = [System.Guid]::NewGuid().ToString()
    'macMachineId' = [System.Guid]::NewGuid().ToString()
    'devDeviceId' = [System.Guid]::NewGuid().ToString()
    'sqmId' = "{$([System.Guid]::NewGuid().ToString().ToUpper())}"
    'sessionId' = [System.Guid]::NewGuid().ToString()
}

Write-Host "[SUCCESS] New device identifiers generated" -ForegroundColor Green

# 3. Update IDE configuration
Write-Host "[STEP 3] Updating $selectedIDE device identifiers..." -ForegroundColor Blue

if ($selectedIDE -eq "Cursor") {
    $storageFile = "$env:APPDATA\Cursor\User\globalStorage\storage.json"
} else {
    $storageFile = "$env:APPDATA\Code\User\globalStorage\storage.json"
}

if (-not $isDryRun) {
    # Ensure directory exists
    $storageDir = Split-Path $storageFile -Parent
    if (-not (Test-Path $storageDir)) {
        New-Item -Path $storageDir -ItemType Directory -Force | Out-Null
    }

    # Create or update configuration
    $config = @{
        'telemetry.machineId' = $newIdentifiers.machineId
        'telemetry.macMachineId' = $newIdentifiers.macMachineId
        'telemetry.devDeviceId' = $newIdentifiers.devDeviceId
        'telemetry.sqmId' = $newIdentifiers.sqmId
        'telemetry.sessionId' = $newIdentifiers.sessionId
        'telemetry.firstSessionDate' = (Get-Date).ToUniversalTime().ToString("R")
        'telemetry.currentSessionDate' = (Get-Date).ToUniversalTime().ToString("R")
    }

    try {
        $configJson = $config | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText($storageFile, $configJson, [System.Text.Encoding]::UTF8)
        Write-Host "[SUCCESS] Device identifiers updated to $storageFile" -ForegroundColor Green
    }
    catch {
        Write-Host "[WARNING] Device identifier update failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "[PREVIEW] Will update device identifiers to $storageFile" -ForegroundColor Cyan
}

# 4. Update registry MachineGuid
Write-Host "[STEP 4] Updating system registry..." -ForegroundColor Blue

if (-not $isDryRun) {
    try {
        if (Test-AdminRights) {
            Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -Name "MachineGuid" -Value $newIdentifiers.macMachineId -ErrorAction Stop
            Write-Host "[SUCCESS] System MachineGuid updated" -ForegroundColor Green
        } else {
            Write-Host "[WARNING] Administrator rights required for registry update" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "[WARNING] Registry update failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "[PREVIEW] Will update registry MachineGuid" -ForegroundColor Cyan
}

# 5. Augment extension deep cleanup (with MCP protection)
if ('Augment' -in $selectedExtensions) {
    Write-Host "[STEP 5] Augment extension deep cleanup..." -ForegroundColor Blue

    if ($selectedIDE -eq "Cursor") {
        $augmentPath = "$env:APPDATA\Cursor\User\globalStorage\augment.vscode-augment"
        $mcpConfigPath = "$env:APPDATA\Cursor\User\globalStorage\augment.vscode-augment\augment-global-state\mcpServers.json"
    } else {
        $augmentPath = "$env:APPDATA\Code\User\globalStorage\augment.vscode-augment"
        $mcpConfigPath = "$env:APPDATA\Code\User\globalStorage\augment.vscode-augment\augment-global-state\mcpServers.json"
    }

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
                Remove-Item -Path $augmentPath -Recurse -Force -ErrorAction Stop
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
                Write-Host "[WARNING] Augment extension cleanup failed: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[SKIP] Augment extension data not found" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[PREVIEW] Will clean Augment extension data (with MCP protection)" -ForegroundColor Cyan
    }
}

Write-Host "[COMPLETE] PowerShell assisted cleanup completed" -ForegroundColor Green

# Display new identifier information
Write-Host "[NEW DEVICE IDENTIFIERS]" -ForegroundColor Blue
Write-Host "devDeviceId: $($newIdentifiers.devDeviceId)"
Write-Host "machineId: $($newIdentifiers.machineId)"
Write-Host "macMachineId: $($newIdentifiers.macMachineId)"

Write-Host "[RESULT] Device will be recognized as a new user" -ForegroundColor Green

exit 0
