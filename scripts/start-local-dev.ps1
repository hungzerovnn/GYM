$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $root ".runtime"
$postgresDir = Join-Path $runtimeDir "postgres"
$postgresData = Join-Path $postgresDir "data"
$postgresLog = Join-Path $postgresDir "postgres.log"
$projectDb = "fitness_management"
$projectPort = 5432
$apiPort = 6273
$webPort = 6173

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Green
}

function Get-EnvFileValue {
  param(
    [string]$Path,
    [string]$Key
  )

  if (-not (Test-Path $Path)) {
    return $null
  }

  foreach ($line in Get-Content $Path) {
    if ($line -match "^\s*$Key=(.*)$") {
      return $matches[1].Trim()
    }
  }

  return $null
}

function Get-DatabasePortFromUrl {
  param(
    [string]$DatabaseUrl,
    [int]$FallbackPort
  )

  if (-not $DatabaseUrl) {
    return $FallbackPort
  }

  if ($DatabaseUrl -match ":(\d+)/") {
    return [int]$matches[1]
  }

  return $FallbackPort
}

function Get-DatabaseNameFromUrl {
  param([string]$DatabaseUrl)

  if (-not $DatabaseUrl) {
    return $null
  }

  if ($DatabaseUrl -match "/([^/?]+)(\?|$)") {
    return $matches[1]
  }

  return $null
}

function Find-PostgresBin {
  $base = "C:\Program Files\PostgreSQL"
  if (-not (Test-Path $base)) {
    return $null
  }

  $candidates = Get-ChildItem $base -Directory | Sort-Object Name -Descending
  foreach ($candidate in $candidates) {
    $binPath = Join-Path $candidate.FullName "bin"
    if (Test-Path (Join-Path $binPath "initdb.exe")) {
      return $binPath
    }
  }

  return $null
}

function Test-PortListening {
  param([int]$Port)
  try {
    $result = Test-NetConnection localhost -Port $Port -WarningAction SilentlyContinue
    return [bool]$result.TcpTestSucceeded
  } catch {
    return $false
  }
}

function Ensure-Database {
  param(
    [string]$BinPath,
    [string]$DatabaseName,
    [int]$Port
  )

  $psql = Join-Path $BinPath "psql.exe"
  $createdb = Join-Path $BinPath "createdb.exe"
  $exists = & $psql -h localhost -p $Port -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName'"
  if ($LASTEXITCODE -ne 0) {
    throw "Cannot query PostgreSQL to verify database '$DatabaseName'."
  }

  if ($exists.Trim() -ne "1") {
    Write-Step "Creating database $DatabaseName"
    & $createdb -h localhost -p $Port -U postgres $DatabaseName
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to create database '$DatabaseName'."
    }
  }
}

function Get-UserCount {
  param(
    [string]$BinPath,
    [int]$Port
  )

  $psql = Join-Path $BinPath "psql.exe"
  $tableExists = & $psql -h localhost -p $Port -U postgres -d $projectDb -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')"
  if ($LASTEXITCODE -ne 0) {
    throw "Cannot verify users table in database '$projectDb'."
  }

  if ($tableExists.Trim() -ne "t") {
    return 0
  }

  $count = & $psql -h localhost -p $Port -U postgres -d $projectDb -tAc "SELECT COUNT(*) FROM public.users"
  if ($LASTEXITCODE -ne 0) {
    throw "Cannot count users in database '$projectDb'."
  }

  return [int]($count.Trim())
}

function Start-DevWindow {
  param(
    [string]$Title,
    [string]$Command
  )

  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command", "Set-Location '$root'; $Command"
  ) -WindowStyle Normal | Out-Null
}

$envFile = Join-Path $root ".env"
$databaseUrl = Get-EnvFileValue -Path $envFile -Key "DATABASE_URL"
$configuredApiPort = Get-EnvFileValue -Path $envFile -Key "PORT"
$configuredAppUrl = Get-EnvFileValue -Path $envFile -Key "APP_URL"

$projectPort = Get-DatabasePortFromUrl -DatabaseUrl $databaseUrl -FallbackPort $projectPort
$configuredDatabase = Get-DatabaseNameFromUrl -DatabaseUrl $databaseUrl
if ($configuredDatabase) {
  $projectDb = $configuredDatabase
}

if ($configuredApiPort -match "^\d+$") {
  $apiPort = [int]$configuredApiPort
}

if ($configuredAppUrl -match ":(\d+)(/|$)") {
  $webPort = [int]$matches[1]
}

$postgresBin = Find-PostgresBin
if (-not $postgresBin) {
  throw "Cannot find PostgreSQL binaries under 'C:\Program Files\PostgreSQL'. Install PostgreSQL first."
}

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
New-Item -ItemType Directory -Force -Path $postgresDir | Out-Null

if (-not (Test-Path (Join-Path $postgresData "PG_VERSION"))) {
  Write-Step "Initializing local PostgreSQL cluster in .runtime\postgres\data"
  & (Join-Path $postgresBin "initdb.exe") -D $postgresData -U postgres -A trust -E UTF8
  if ($LASTEXITCODE -ne 0) {
    throw "initdb failed."
  }
}

if (-not (Test-PortListening -Port $projectPort)) {
  Write-Step "Starting local PostgreSQL on port $projectPort"
  & (Join-Path $postgresBin "pg_ctl.exe") -D $postgresData -l $postgresLog -o " -p $projectPort" -w start
  if ($LASTEXITCODE -ne 0) {
    throw "pg_ctl start failed."
  }
} else {
  Write-Step "PostgreSQL already listening on port $projectPort"
}

Ensure-Database -BinPath $postgresBin -DatabaseName $projectDb -Port $projectPort

  Write-Step "Running Prisma migrate"
  Push-Location $root
  try {
    npm run db:migrate
    if ($LASTEXITCODE -ne 0) {
      throw "npm run db:migrate failed."
    }

    $userCount = Get-UserCount -BinPath $postgresBin -Port $projectPort
    if ($userCount -eq 0) {
      Write-Step "Running Prisma seed"
      npm run db:seed
      if ($LASTEXITCODE -ne 0) {
        throw "npm run db:seed failed."
      }
    } else {
      Write-Step "Database already has data, skipping seed"
    }
  } finally {
    Pop-Location
  }

if (-not (Test-PortListening -Port $apiPort)) {
  Write-Step "Launching API on http://localhost:$apiPort"
  Start-DevWindow -Title "FitFlow API" -Command "npm run dev:api"
} else {
  Write-Step "Port $apiPort already in use, skipping API launch"
}

if (-not (Test-PortListening -Port $webPort)) {
  Write-Step "Launching Web on http://localhost:$webPort"
  Start-DevWindow -Title "FitFlow Web" -Command "npm run dev:web"
} else {
  Write-Step "Port $webPort already in use, skipping Web launch"
}

Write-Host ""
Write-Host "FitFlow is starting." -ForegroundColor Cyan
Write-Host "Web: http://localhost:$webPort"
Write-Host "API: http://localhost:$apiPort/api"
Write-Host "Swagger: http://localhost:$apiPort/docs"
