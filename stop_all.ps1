<#
.SYNOPSIS
    LendGuard AI — One-Click Automated Shutdown Script
.DESCRIPTION
    Gracefully stops all 5 LendGuard AI services:
    - React Frontend (Port 5173)
    - Backend Web API (Port 5000)
    - C# Background Worker
    - Python AI Service (Port 8000)
    - PostgreSQL 16 (Port 5433)
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$LogDir = Join-Path $ScriptDir "logs"
$PidFile = Join-Path $LogDir "pids.json"

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "                   LENDGUARD AI — SHUTTING DOWN SERVICES                  " -ForegroundColor White -BackgroundColor DarkRed
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Kill recorded PIDs
if (Test-Path $PidFile) {
    try {
        $pidsDict = Get-Content $PidFile -Raw | ConvertFrom-Json -AsHashtable
        foreach ($key in $pidsDict.Keys) {
            $pidToKill = $pidsDict[$key]
            try {
                $proc = Get-Process -Id $pidToKill -ErrorAction SilentlyContinue
                if ($null -ne $proc -and -not $proc.HasExited) {
                    Write-Host "  Stopping service '$key' (PID: $pidToKill)..." -ForegroundColor Yellow
                    Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                }
            } catch {}
        }
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    } catch {}
}

# 2. Port-based cleanup for 5000, 5173, 5433, 8000
$ports = @(5000, 5173, 5433, 8000)
foreach ($p in $ports) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
        foreach ($c in $conns) {
            $owner = $c.OwningProcess
            if ($owner -gt 0) {
                Write-Host "  Terminating process on port $p (PID: $owner)..." -ForegroundColor Yellow
                Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {}
}

# 3. Clean up temporary scripts
$tempFiles = @(
    (Join-Path $LogDir "run_api_temp.ps1"),
    (Join-Path $LogDir "run_worker_temp.ps1")
)
foreach ($f in $tempFiles) {
    if (Test-Path $f) {
        Remove-Item -Path $f -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 1

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "                ALL LENDGUARD AI SERVICES ARE NOW STOPPED.               " -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "To restart at any time, run '.\start_all.ps1' or double-click 'start_all.bat'." -ForegroundColor Gray
Write-Host ""
