param()

$ErrorActionPreference = "Stop"
$bridgeCmd = Join-Path $PSScriptRoot "SocialBridge.cmd"
$defaultInterval = "45"

$interval = Read-Host "Heartbeat moi bao nhieu giay? [$defaultInterval]"
if ([string]::IsNullOrWhiteSpace($interval)) { $interval = $defaultInterval }

& $bridgeCmd run --interval $interval
