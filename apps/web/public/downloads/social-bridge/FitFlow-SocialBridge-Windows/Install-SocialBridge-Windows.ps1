param(
  [string]$SourceRoot = "",
  [string]$InstallRoot = "",
  [switch]$NoLaunch
)

$ErrorActionPreference = "Stop"

if (-not $SourceRoot) {
  $SourceRoot = $PSScriptRoot
}
if (-not $InstallRoot) {
  $InstallRoot = Join-Path $env:LOCALAPPDATA "FitFlowSocialBridge"
}

$SourceRoot = (Resolve-Path $SourceRoot).Path
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
Copy-Item -Path (Join-Path $SourceRoot "*") -Destination $InstallRoot -Recurse -Force

$desktopPath = [Environment]::GetFolderPath("Desktop")
$wsh = New-Object -ComObject WScript.Shell

$shortcutSpecs = @(
  @{
    Name = "Social Bridge Console.lnk"
    TargetPath = "$env:ComSpec"
    Arguments = "/k `"$InstallRoot\SocialBridge.cmd`" help"
  },
  @{
    Name = "Lien ket Social Bridge.lnk"
    TargetPath = "powershell.exe"
    Arguments = "-NoExit -ExecutionPolicy Bypass -File `"$InstallRoot\Link-SocialBridge.ps1`""
  },
  @{
    Name = "Chay Heartbeat Social Bridge.lnk"
    TargetPath = "powershell.exe"
    Arguments = "-NoExit -ExecutionPolicy Bypass -File `"$InstallRoot\Run-SocialBridge.ps1`""
  },
  @{
    Name = "Cai Browser Extension.lnk"
    TargetPath = "$env:ComSpec"
    Arguments = "/c `"$InstallRoot\Install-Browser-Extension.cmd`""
  }
)

foreach ($spec in $shortcutSpecs) {
  $shortcutPath = Join-Path $desktopPath $spec.Name
  $shortcut = $wsh.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $spec.TargetPath
  $shortcut.Arguments = $spec.Arguments
  $shortcut.WorkingDirectory = $InstallRoot
  $shortcut.Save()
}

Write-Host "Da cai Social Bridge vao: $InstallRoot" -ForegroundColor Green
Write-Host "Da tao shortcut tren Desktop." -ForegroundColor Green

if (-not $NoLaunch) {
  Start-Process explorer.exe $InstallRoot
}
