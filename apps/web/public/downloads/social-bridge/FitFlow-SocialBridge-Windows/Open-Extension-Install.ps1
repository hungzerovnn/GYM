param(
  [string]$ExtensionFolder = ""
)

$ErrorActionPreference = "Stop"

if (-not $ExtensionFolder) {
  $ExtensionFolder = Join-Path $PSScriptRoot "browser-extension"
}

$ExtensionFolder = (Resolve-Path $ExtensionFolder).Path

function Open-WithBrowser {
  param(
    [string]$CommandName,
    [string]$Uri
  )

  $candidatePaths = @()

  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($command) {
    $candidatePaths += $command.Source
  }

  $registryPaths = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\$CommandName",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\$CommandName"
  )
  foreach ($registryPath in $registryPaths) {
    try {
      $item = Get-ItemProperty -Path $registryPath -ErrorAction Stop
      if ($item.'(default)') {
        $candidatePaths += [string]$item.'(default)'
      }
    } catch {}
  }

  if ($CommandName -ieq "chrome.exe") {
    $candidatePaths += @(
      "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
      "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
      "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
    )
  }

  if ($CommandName -ieq "msedge.exe") {
    $candidatePaths += @(
      "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
      "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
      "$env:LocalAppData\Microsoft\Edge\Application\msedge.exe"
    )
  }

  if ($CommandName -ieq "brave.exe") {
    $candidatePaths += @(
      "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
      "$env:ProgramFiles(x86)\BraveSoftware\Brave-Browser\Application\brave.exe",
      "$env:LocalAppData\BraveSoftware\Brave-Browser\Application\brave.exe"
    )
  }

  if ($CommandName -ieq "opera.exe") {
    $candidatePaths += @(
      "$env:LocalAppData\Programs\Opera\opera.exe",
      "$env:ProgramFiles\Opera\opera.exe",
      "$env:ProgramFiles(x86)\Opera\opera.exe"
    )
  }

  $executable = $candidatePaths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if (-not $executable) {
    return $false
  }

  Start-Process -FilePath $executable -ArgumentList @($Uri) | Out-Null
  return $true
}

function Open-DefaultBrowserExtensionsPage {
  $userChoice = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice" -ErrorAction SilentlyContinue
  $progId = [string]($userChoice.ProgId)

  if ($progId -match "ChromeHTML") {
    return Open-WithBrowser -CommandName "chrome.exe" -Uri "chrome://extensions/"
  }

  if ($progId -match "MSEdgeHTM") {
    return Open-WithBrowser -CommandName "msedge.exe" -Uri "edge://extensions/"
  }

  if ($progId -match "BraveHTML") {
    return Open-WithBrowser -CommandName "brave.exe" -Uri "brave://extensions/"
  }

  if ($progId -match "OperaStable") {
    return Open-WithBrowser -CommandName "opera.exe" -Uri "opera://extensions/"
  }

  return $false
}

Start-Process explorer.exe $ExtensionFolder | Out-Null

$opened =
  (Open-WithBrowser -CommandName "chrome.exe" -Uri "chrome://extensions/") -or
  (Open-WithBrowser -CommandName "msedge.exe" -Uri "edge://extensions/") -or
  (Open-WithBrowser -CommandName "brave.exe" -Uri "brave://extensions/")

if (-not $opened) {
  $opened = Open-DefaultBrowserExtensionsPage
}

if (-not $opened) {
  Write-Host "Khong mo duoc trang Extensions tu trinh duyet mac dinh." -ForegroundColor Yellow
  Write-Host "Hay mo Chrome / Edge roi vao trang Extensions thu cong." -ForegroundColor Yellow
} else {
  Write-Host "Da mo trang Extensions theo trinh duyet phu hop." -ForegroundColor Green
}

Write-Host "Thu muc extension da mo san: $ExtensionFolder" -ForegroundColor Green
Write-Host "Chi can bat Developer mode > Load unpacked > chon folder browser-extension." -ForegroundColor Green
Read-Host "Nhan Enter de dong"
