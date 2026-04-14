param()

$ErrorActionPreference = "Stop"
$bridgeCmd = Join-Path $PSScriptRoot "SocialBridge.cmd"
$defaultServer = "http://localhost:6273/api"
$defaultTenant = "MASTER"

$server = Read-Host "Server API [$defaultServer]"
if ([string]::IsNullOrWhiteSpace($server)) { $server = $defaultServer }

$tenant = Read-Host "Tenant [$defaultTenant]"
if ([string]::IsNullOrWhiteSpace($tenant)) { $tenant = $defaultTenant }

$sessionToken = Read-Host "Session token (bo trong neu dung pair code)"
$pairCode = ""
if ([string]::IsNullOrWhiteSpace($sessionToken)) {
  $pairCode = Read-Host "Pair code"
}

if ([string]::IsNullOrWhiteSpace($sessionToken) -and [string]::IsNullOrWhiteSpace($pairCode)) {
  Write-Host "Can session token hoac pair code." -ForegroundColor Red
  exit 1
}

$deviceName = Read-Host "Ten may (tuy chon)"

$arguments = @("link", "--server", $server, "--tenant", $tenant)
if (-not [string]::IsNullOrWhiteSpace($sessionToken)) {
  $arguments += @("--session-token", $sessionToken)
}
if (-not [string]::IsNullOrWhiteSpace($pairCode)) {
  $arguments += @("--pair-code", $pairCode)
}
if (-not [string]::IsNullOrWhiteSpace($deviceName)) {
  $arguments += @("--device-name", $deviceName)
}

& $bridgeCmd @arguments
Write-Host ""
Write-Host "Neu thay 'Lien ket desktop thanh cong' la xong." -ForegroundColor Green
Read-Host "Nhan Enter de dong"
