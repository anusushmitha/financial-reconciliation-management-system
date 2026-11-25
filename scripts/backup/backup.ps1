param(
    [string]$HostName = "localhost",
    [int]$Port = 5433,
    [string]$Database = "lendguard",
    [string]$Username = "app",
    [string]$StorageDir = "storage",
    [string]$BackupDir = "database/backups"
)

$ErrorActionPreference = "Stop"
$pgDumpPath = "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$tempBackupFolder = Join-Path $BackupDir "temp_$timestamp"
New-Item -ItemType Directory -Path $tempBackupFolder -Force | Out-Null

$sqlFile = Join-Path $tempBackupFolder "database.sql"

Write-Host "1. Initiating PostgreSQL backup for $Database on port $Port..."
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
& $pgDumpPath -h $HostName -p $Port -U $Username -F p -b -v -f $sqlFile $Database
$stopwatch.Stop()
Write-Host "   PostgreSQL dump completed in $($stopwatch.Elapsed.TotalSeconds)s."

# Copy storage directory if exists
if (Test-Path $StorageDir) {
    Write-Host "2. Archiving persistent file storage from $StorageDir..."
    $destStorage = Join-Path $tempBackupFolder "storage"
    Copy-Item -Path $StorageDir -Destination $destStorage -Recurse -Force
}

# Create unified zip archive
$bundleFile = Join-Path $BackupDir "lendguard_backup_$timestamp.zip"
Write-Host "3. Creating unified disaster recovery bundle: $bundleFile..."
Compress-Archive -Path "$tempBackupFolder\*" -DestinationPath $bundleFile -Force

# Clean up temp folder
Remove-Item -Path $tempBackupFolder -Recurse -Force

$size = (Get-Item $bundleFile).Length
Write-Host "Backup bundle created successfully: $bundleFile ($([Math]::Round($size / 1KB, 2)) KB)"
return $bundleFile
