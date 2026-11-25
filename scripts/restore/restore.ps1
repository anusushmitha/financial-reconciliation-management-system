param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$HostName = "localhost",
    [int]$Port = 5433,
    [string]$TargetDatabase = "lendguard_restore_test",
    [string]$Username = "app",
    [string]$TargetStorageDir = "storage_restored"
)

$ErrorActionPreference = "Stop"
$psqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"

if (-not (Test-Path $BackupFile)) {
    throw "Backup file not found: $BackupFile"
}

$tempExtractDir = Join-Path ([System.IO.Path]::GetDirectoryName($BackupFile)) "temp_restore_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$sqlFileToRestore = $BackupFile

if ($BackupFile.EndsWith(".zip", [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Host "1. Unpacking unified backup bundle: $BackupFile..."
    New-Item -ItemType Directory -Path $tempExtractDir -Force | Out-Null
    Expand-Archive -Path $BackupFile -DestinationPath $tempExtractDir -Force
    $sqlFileToRestore = Join-Path $tempExtractDir "database.sql"
    
    $restoredStorageSource = Join-Path $tempExtractDir "storage"
    if (Test-Path $restoredStorageSource) {
        Write-Host "2. Restoring persistent file storage to $TargetStorageDir..."
        if (Test-Path $TargetStorageDir) {
            Remove-Item -Path $TargetStorageDir -Recurse -Force
        }
        Copy-Item -Path $restoredStorageSource -Destination $TargetStorageDir -Recurse -Force
        Write-Host "   File storage restored successfully."
    }
}

Write-Host "3. Creating target restore database $TargetDatabase if not exists..."
& $psqlPath -h $HostName -p $Port -U $Username -d postgres -c "DROP DATABASE IF EXISTS $TargetDatabase;"
& $psqlPath -h $HostName -p $Port -U $Username -d postgres -c "CREATE DATABASE $TargetDatabase OWNER $Username;"

Write-Host "4. Restoring SQL schema and data into $TargetDatabase..."
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
& $psqlPath -h $HostName -p $Port -U $Username -d $TargetDatabase -f $sqlFileToRestore
$stopwatch.Stop()
Write-Host "   SQL restore completed in $($stopwatch.Elapsed.TotalSeconds)s."

# Clean up temp extraction folder if created
if (Test-Path $tempExtractDir) {
    Remove-Item -Path $tempExtractDir -Recurse -Force
}

Write-Host "Disaster recovery restore completed successfully."
