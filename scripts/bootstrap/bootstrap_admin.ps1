param(
    [string]$HostName = "localhost",
    [int]$Port = 5433,
    [string]$Database = "lendguard_staging",
    [string]$Username = "postgres",
    [string]$Password = "postgres",
    [Parameter(Mandatory=$true)]
    [string]$AdminEmail,
    [string]$AdminName = "Staging Enterprise Administrator",
    [Parameter(Mandatory=$true)]
    [string]$AdminPassword
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pyScript = Join-Path $scriptDir "bootstrap_admin.py"

# Use python from virtualenv if available
$venvPy = Join-Path $scriptDir "..\..\ai-service\venv\Scripts\python.exe"
if (Test-Path $venvPy) {
    & $venvPy $pyScript --host $HostName --port $Port --db $Database --user $Username --password $Password --email $AdminEmail --name $AdminName --admin-password $AdminPassword
} else {
    python $pyScript --host $HostName --port $Port --db $Database --user $Username --password $Password --email $AdminEmail --name $AdminName --admin-password $AdminPassword
}
