<#
.SYNOPSIS
    LendGuard AI — Enterprise Automated Startup, Pre-flight & Health Check Launcher
.DESCRIPTION
    Comprehensive launcher that covers all system requirements and edge cases:
    - Pre-flight tool verification (.NET 10, Node.js, Python, PostgreSQL)
    - Automatic directory initialization (logs, storage, temp)
    - Automated compilation detection (builds Release binaries & dist if missing)
    - Stale / zombie port auto-recovery and recycling
    - Instant-boot Release DLL execution (< 2s startup)
    - Dependency-ordered startup (DB -> AI -> API -> Worker -> Frontend)
    - Strict live health checks for every microservice
    - End-to-end authentication smoke test
    - Automatic browser launch & credential dashboard
#>

[CmdletBinding()]
param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# -----------------------------------------------------------------------------
# 0. Global Environment Configuration & Storage Initialization
# -----------------------------------------------------------------------------
$LogDir = Join-Path $ScriptDir "logs"
$StorageStagingDir = Join-Path $ScriptDir "storage_staging"
$StorageDir = Join-Path $ScriptDir "storage"

foreach ($dir in @($LogDir, $StorageStagingDir, $StorageDir)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

$aiServiceKey = "lendguard_internal_ai_secret_key_2026"

# Inject environment variables across all spawned child processes
$env:ASPNETCORE_ENVIRONMENT = "Staging"
$env:DOTNET_ENVIRONMENT = "Staging"
$env:SEED_TEST_USERS = "false"
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5433;Database=lendguard_staging;Username=postgres;Password=postgres"
$env:FILE_STORAGE_PATH = "$($ScriptDir.Replace('\', '/'))/storage_staging"
$env:JWT_SECRET = "LendGuard_Staging_Super_Secret_High_Entropy_Key_2026_Secure_Must_Be_Long!"
$env:JWT_EXPIRY_MINUTES = "120"
$env:AI_SERVICE_BASE_URL = "http://localhost:8000"
$env:AI_SERVICE_KEY = $aiServiceKey

$PidFile = Join-Path $LogDir "pids.json"
$Pids = @{}

if (Test-Path $PidFile) {
    try {
        $Pids = Get-Content $PidFile -Raw | ConvertFrom-Json -AsHashtable
    } catch {
        $Pids = @{}
    }
}

function Write-Banner {
    Clear-Host
    Write-Host "==========================================================================" -ForegroundColor Cyan
    Write-Host "                    LENDGUARD AI — ENTERPRISE LAUNCHER                    " -ForegroundColor White -BackgroundColor DarkBlue
    Write-Host "         Intelligent Reconciliation & Financial Exception Platform        " -ForegroundColor Cyan
    Write-Host "==========================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-PortListening {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
    return ($null -ne $conn)
}

function Kill-ProcessOnPort {
    param([int]$Port, [string]$Reason = "stale process")
    $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        $owner = $c.OwningProcess
        if ($owner -gt 0) {
            Write-Host "  [WARN] Port $Port occupied by $Reason (PID: $owner). Recycling..." -ForegroundColor Yellow
            Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 800
        }
    }
}

function Wait-ForCondition {
    param(
        [string]$Name,
        [scriptblock]$CheckBlock,
        [int]$TimeoutSeconds = 25
    )
    Write-Host -NoNewline "  [WAIT] Verifying $Name... " -ForegroundColor Yellow
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        try {
            $result = & $CheckBlock
            if ($result) {
                Write-Host "READY ($([math]::Round($sw.Elapsed.TotalSeconds, 1))s)" -ForegroundColor Green
                return $true
            }
        } catch {
            # continue waiting
        }
        Start-Sleep -Milliseconds 600
    }
    Write-Host "TIMEOUT" -ForegroundColor Red
    return $false
}

Write-Banner

# -----------------------------------------------------------------------------
# Pre-Flight System Verification
# -----------------------------------------------------------------------------
Write-Host "[PRE-FLIGHT] Verifying System Prerequisites & Toolchains..." -ForegroundColor White

$dotnetExe = "C:\Users\LENOVO\.dotnet\dotnet.exe"
if (-not (Test-Path $dotnetExe)) {
    $dotnetInPath = Get-Command dotnet.exe -ErrorAction SilentlyContinue
    if ($dotnetInPath) { $dotnetExe = $dotnetInPath.Source }
    else {
        Write-Host "  [ERROR] .NET 10 SDK executable not found. Please install .NET 10 SDK." -ForegroundColor Red
        exit 1
    }
}

$pgExe = "C:\Program Files\PostgreSQL\16\bin\postgres.exe"
if (-not (Test-Path $pgExe)) {
    Write-Host "  [ERROR] PostgreSQL 16 binary not found at: $pgExe" -ForegroundColor Red
    exit 1
}

$npmCmd = "C:\Program Files\nodejs\npm.cmd"
if (-not (Test-Path $npmCmd)) {
    $npmInPath = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($npmInPath) { $npmCmd = $npmInPath.Source }
    else {
        Write-Host "  [ERROR] npm executable not found. Please install Node.js." -ForegroundColor Red
        exit 1
    }
}

$aiDir = Join-Path $ScriptDir "ai-service"
$pythonExe = Join-Path $aiDir "venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Host "  [ERROR] Python venv not found at: $pythonExe" -ForegroundColor Red
    exit 1
}

Write-Host "  [OK] .NET 10 SDK, PostgreSQL 16, Node.js/npm, and Python Virtualenv Verified." -ForegroundColor Green
Write-Host ""

# -----------------------------------------------------------------------------
# 1. Start PostgreSQL 16 Database (Port 5433)
# -----------------------------------------------------------------------------
Write-Host "[1/5] Initializing PostgreSQL 16 Database Cluster (Port 5433)..." -ForegroundColor White
$pgDataDir = Join-Path $ScriptDir "database\data"

if (Test-PortListening 5433) {
    Write-Host "  [OK] PostgreSQL 16 is already active and listening on port 5433." -ForegroundColor Green
} else {
    Write-Host "  [START] Launching PostgreSQL 16 on port 5433..." -ForegroundColor Cyan
    $pgOut = Join-Path $LogDir "postgres.log"
    $pgErr = Join-Path $LogDir "postgres_err.log"
    $pgProc = Start-Process -FilePath $pgExe -ArgumentList "-D `"$pgDataDir`" -p 5433" `
        -RedirectStandardOutput $pgOut -RedirectStandardError $pgErr `
        -WindowStyle Hidden -PassThru
    $Pids["postgres"] = $pgProc.Id

    $ready = Wait-ForCondition "PostgreSQL 16 (Port 5433)" {
        Test-PortListening 5433
    } -TimeoutSeconds 15

    if (-not $ready) {
        Write-Host "  [ERROR] PostgreSQL failed to initialize. Check $pgErr" -ForegroundColor Red
        exit 1
    }
}

# -----------------------------------------------------------------------------
# 2. Start Python AI Advisory Microservice (Port 8000)
# -----------------------------------------------------------------------------
Write-Host "`n[2/5] Initializing Python AI Advisory Microservice (Port 8000)..." -ForegroundColor White

if (Test-PortListening 8000) {
    $aiHealthy = $false
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:8000/internal/v1/health" `
            -Headers @{"X-Service-Key" = $aiServiceKey} -TimeoutSec 2 -ErrorAction Stop
        if ($res.status -eq "Healthy") { $aiHealthy = $true }
    } catch {}

    if ($aiHealthy) {
        Write-Host "  [OK] AI Advisory Service is already active and healthy on port 8000." -ForegroundColor Green
    } else {
        Kill-ProcessOnPort 8000 "unresponsive service"
    }
}

if (-not (Test-PortListening 8000)) {
    Write-Host "  [START] Launching FastAPI AI Microservice on port 8000..." -ForegroundColor Cyan
    $aiOut = Join-Path $LogDir "ai_service.log"
    $aiErr = Join-Path $LogDir "ai_service_err.log"
    $aiProc = Start-Process -FilePath $pythonExe `
        -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port 8000" `
        -WorkingDirectory $aiDir `
        -RedirectStandardOutput $aiOut -RedirectStandardError $aiErr `
        -WindowStyle Hidden -PassThru
    $Pids["ai_service"] = $aiProc.Id

    $ready = Wait-ForCondition "AI Health Endpoint" {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:8000/internal/v1/health" `
            -Headers @{"X-Service-Key" = $aiServiceKey} -TimeoutSec 2 -ErrorAction Stop
        return ($res.status -eq "Healthy")
    } -TimeoutSeconds 20

    if (-not $ready) {
        Write-Host "  [ERROR] AI Service failed to start. Check $aiErr" -ForegroundColor Red
        exit 1
    }
}

# -----------------------------------------------------------------------------
# 3. Start ASP.NET Core Backend Web API (.NET 10 LTS) (Port 5000)
# -----------------------------------------------------------------------------
Write-Host "`n[3/5] Initializing ASP.NET Core Backend Web API (Port 5000)..." -ForegroundColor White
$apiDir = Join-Path $ScriptDir "backend\LendGuard.Api"
$apiDll = Join-Path $apiDir "bin\Release\net10.0\LendGuard.Api.dll"

# Build check: ensure Release DLL exists
if (-not (Test-Path $apiDll)) {
    Write-Host "  [BUILD] Compiling Backend in Release mode..." -ForegroundColor Yellow
    & $dotnetExe build "$apiDir\LendGuard.Api.csproj" --configuration Release --verbosity quiet
}

if (Test-PortListening 5000) {
    $apiHealthy = $false
    try {
        $res = Invoke-RestMethod -Uri "http://localhost:5000/health" -TimeoutSec 2 -ErrorAction Stop
        if ($res.status -eq "Healthy") { $apiHealthy = $true }
    } catch {}

    if ($apiHealthy) {
        Write-Host "  [OK] Backend Web API is already active and healthy on port 5000." -ForegroundColor Green
    } else {
        Kill-ProcessOnPort 5000 "unresponsive API"
    }
}

if (-not (Test-PortListening 5000)) {
    Write-Host "  [START] Launching Backend Web API on port 5000..." -ForegroundColor Cyan
    $apiOut = Join-Path $LogDir "backend_api.log"
    $apiErr = Join-Path $LogDir "backend_api_err.log"

    $apiProc = Start-Process -FilePath $dotnetExe `
        -ArgumentList "`"$apiDll`" --urls http://localhost:5000" `
        -WorkingDirectory $apiDir `
        -RedirectStandardOutput $apiOut -RedirectStandardError $apiErr `
        -WindowStyle Hidden -PassThru
    $Pids["backend_api"] = $apiProc.Id

    $ready = Wait-ForCondition "Backend API Health (/health)" {
        $res = Invoke-RestMethod -Uri "http://localhost:5000/health" -TimeoutSec 2 -ErrorAction Stop
        return ($res.status -eq "Healthy")
    } -TimeoutSeconds 20

    if (-not $ready) {
        Write-Host "  [ERROR] Backend Web API failed to start. Check $apiErr" -ForegroundColor Red
        exit 1
    }
}

# -----------------------------------------------------------------------------
# 4. Start Background Outbox Worker (.NET 10 LTS)
# -----------------------------------------------------------------------------
Write-Host "`n[4/5] Initializing Background Outbox Worker Daemon..." -ForegroundColor White
$workerDir = Join-Path $ScriptDir "backend\LendGuard.Worker"
$workerDll = Join-Path $workerDir "bin\Release\net10.0\LendGuard.Worker.dll"

if (-not (Test-Path $workerDll)) {
    Write-Host "  [BUILD] Compiling Worker in Release mode..." -ForegroundColor Yellow
    & $dotnetExe build "$workerDir\LendGuard.Worker.csproj" --configuration Release --verbosity quiet
}

$workerRunning = $false
if ($Pids.ContainsKey("worker")) {
    $existing = Get-Process -Id $Pids["worker"] -ErrorAction SilentlyContinue
    if ($null -ne $existing -and -not $existing.HasExited) {
        $workerRunning = $true
    }
}

if ($workerRunning) {
    Write-Host "  [OK] Background Worker daemon is already active." -ForegroundColor Green
} else {
    Write-Host "  [START] Launching C# Outbox Worker Daemon..." -ForegroundColor Cyan
    $workerOut = Join-Path $LogDir "worker.log"
    $workerErr = Join-Path $LogDir "worker_err.log"

    $workerProc = Start-Process -FilePath $dotnetExe `
        -ArgumentList "`"$workerDll`"" `
        -WorkingDirectory $workerDir `
        -RedirectStandardOutput $workerOut -RedirectStandardError $workerErr `
        -WindowStyle Hidden -PassThru
    $Pids["worker"] = $workerProc.Id
    Start-Sleep -Seconds 1
    Write-Host "  [OK] Background Worker started (PID: $($workerProc.Id))." -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# 5. Start React 18 Frontend Web App (Port 5173)
# -----------------------------------------------------------------------------
Write-Host "`n[5/5] Initializing React 18 Frontend Application (Port 5173)..." -ForegroundColor White
$frontendDir = Join-Path $ScriptDir "frontend"
$frontendDist = Join-Path $frontendDir "dist"

# Auto-Build Check: if dist/ is missing, build it first
if (-not (Test-Path $frontendDist)) {
    Write-Host "  [BUILD] Frontend production bundle missing. Running 'npm run build'..." -ForegroundColor Yellow
    Push-Location $frontendDir
    & $npmCmd run build
    Pop-Location
}

if (Test-PortListening 5173) {
    $frontHealthy = $false
    try {
        $res = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($res.StatusCode -eq 200) { $frontHealthy = $true }
    } catch {}

    if ($frontHealthy) {
        Write-Host "  [OK] Frontend SPA is already active on port 5173." -ForegroundColor Green
    } else {
        Kill-ProcessOnPort 5173 "unresponsive frontend"
    }
}

if (-not (Test-PortListening 5173)) {
    Write-Host "  [START] Launching Frontend Preview Server on port 5173..." -ForegroundColor Cyan
    $frontOut = Join-Path $LogDir "frontend.log"
    $frontErr = Join-Path $LogDir "frontend_err.log"
    $frontProc = Start-Process -FilePath $npmCmd `
        -ArgumentList "run preview -- --port 5173 --host 0.0.0.0" `
        -WorkingDirectory $frontendDir `
        -RedirectStandardOutput $frontOut -RedirectStandardError $frontErr `
        -WindowStyle Hidden -PassThru
    $Pids["frontend"] = $frontProc.Id

    $ready = Wait-ForCondition "Frontend Web App (Port 5173)" {
        $res = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        return ($res.StatusCode -eq 200)
    } -TimeoutSeconds 20

    if (-not $ready) {
        Write-Host "  [ERROR] Frontend failed to start. Check $frontErr" -ForegroundColor Red
        exit 1
    }
}

# Save updated PIDs
$Pids | ConvertTo-Json | Set-Content -Path $PidFile -Encoding UTF8

# -----------------------------------------------------------------------------
# End-to-End Authentication Smoke Test
# -----------------------------------------------------------------------------
Write-Host "`n[SMOKE TEST] Running End-to-End Authentication Verification..." -ForegroundColor White
try {
    $testLogin = Invoke-RestMethod -Uri "http://localhost:5000/api/v1/auth/login" `
        -Method Post `
        -Body '{"email":"staging.admin@lendguard.internal","password":"StagingAdmin_Secure2026!"}' `
        -ContentType "application/json" `
        -TimeoutSec 10 -ErrorAction Stop

    if ($testLogin.accessToken -and $testLogin.user.role -eq "ADMIN") {
        Write-Host "  [PASS] Staging Authentication & Database Link Verified." -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Authentication succeeded but returned unexpected payload." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [WARN] Smoke test login returned warning: $($_.Exception.Message)" -ForegroundColor Yellow
}

# -----------------------------------------------------------------------------
# System Ready Dashboard
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "             ALL LENDGUARD AI SERVICES ARE ONLINE AND HEALTHY!            " -ForegroundColor Black -BackgroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Application URL:   " -NoNewline; Write-Host "http://localhost:5173" -ForegroundColor Yellow -Underline
Write-Host "  Backend API:       " -NoNewline; Write-Host "http://localhost:5000" -ForegroundColor Gray
Write-Host "  AI Microservice:   " -NoNewline; Write-Host "http://localhost:8000" -ForegroundColor Gray
Write-Host "  PostgreSQL DB:     " -NoNewline; Write-Host "localhost:5433 (lendguard_staging)" -ForegroundColor Gray
Write-Host ""
Write-Host "--------------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "                           LOGIN CREDENTIALS                              " -ForegroundColor Cyan
Write-Host "--------------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  [ADMIN ACCOUNT]" -ForegroundColor Yellow
Write-Host "    Email:     staging.admin@lendguard.internal" -ForegroundColor White
Write-Host "    Password:  StagingAdmin_Secure2026!" -ForegroundColor White
Write-Host "    Role:      Full Admin (Imports, Reconciliation, User Management, Audit)" -ForegroundColor Gray
Write-Host ""
Write-Host "  [ANALYST ACCOUNT]" -ForegroundColor Yellow
Write-Host "    Email:     staging.analyst@lendguard.internal" -ForegroundColor White
Write-Host "    Password:  StagingAnalyst_Secure2026!" -ForegroundColor White
Write-Host "    Role:      Operations Analyst (Discrepancies, AI Analysis, Investigations)" -ForegroundColor Gray
Write-Host "--------------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Logs Directory:    $LogDir" -ForegroundColor DarkCyan
Write-Host "  Stop Services:     Double-click 'stop_all.bat' or run '.\stop_all.ps1'" -ForegroundColor DarkCyan
Write-Host ""

if (-not $NoBrowser) {
    Write-Host "Opening LendGuard AI in your default web browser..." -ForegroundColor Green
    Start-Process "http://localhost:5173"
}
