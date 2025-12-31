Param(
  [int]$BackendPort = 8081,
  [int]$FrontendPort = 3000,
  [switch]$NoInstall,
  [switch]$NoKill,
  [switch]$StopOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ------------------------------------------------------------
# Resolve project root (go up from /scripts to project root)
# ------------------------------------------------------------
$scriptPath = $MyInvocation.MyCommand.Definition
$scriptDir  = Split-Path -Parent $scriptPath
$projectRoot = Split-Path -Parent $scriptDir

Write-Host "[start-dev] Project root: $projectRoot"

# ------------------------------------------------------------
# Helper functions
# ------------------------------------------------------------
function Get-PidsUsingPort($port) {
  try {
    (Get-NetTCPConnection -LocalPort $port -ErrorAction Stop).OwningProcess |
      Sort-Object -Unique
  } catch {
    netstat -ano | Select-String ":$port " |
      ForEach-Object { ($_ -split '\s+')[-1] } |
      Where-Object { $_ -match '^\d+$' } |
      Sort-Object -Unique
  }
}

function Kill-Pids($pids) {
  foreach ($pid in $pids) {
    try {
      Write-Host "[start-dev] Killing PID $pid"
      Stop-Process -Id $pid -Force
    } catch {
      Write-Warning "[start-dev] Failed to kill PID ${pid}: $($_.Exception.Message)"
    }
  }
}

# ------------------------------------------------------------
# Kill processes using ports (optional)
# ------------------------------------------------------------
$backendPids  = Get-PidsUsingPort $BackendPort
$frontendPids = Get-PidsUsingPort $FrontendPort

if (-not $NoKill) {
  if ($backendPids)  { Kill-Pids $backendPids }
  if ($frontendPids) { Kill-Pids $frontendPids }
}

if ($StopOnly) {
  Write-Host "[start-dev] Stop-only mode complete."
  exit 0
}

# ------------------------------------------------------------
# Backend setup
# ------------------------------------------------------------
$backendDir = Join-Path $projectRoot "backend"
$venvDir    = Join-Path $backendDir ".venv"
$pythonExe  = Join-Path $venvDir "Scripts\python.exe"
$reqFile    = Join-Path $backendDir "requirements.txt"

if (-not (Test-Path $backendDir)) {
  throw "Backend directory not found: $backendDir"
}

if (-not $NoInstall) {
  if (-not (Test-Path $venvDir)) {
    Write-Host "[start-dev] Creating Python virtual environment..."
    python -m venv $venvDir
  }

  if (-not (Test-Path $pythonExe)) {
    throw "Python executable not found in venv"
  }

  if (-not (Test-Path $reqFile)) {
    throw "requirements.txt not found at $reqFile"
  }

  Write-Host "[start-dev] Installing backend dependencies..."
  & $pythonExe -m pip install --upgrade pip setuptools wheel
  & $pythonExe -m pip install -r $reqFile
}

Write-Host "[start-dev] Starting backend on port $BackendPort..."

Start-Process powershell `
  -ArgumentList "-NoExit", "-Command",
  "cd '$backendDir'; . .\.venv\Scripts\Activate.ps1; uvicorn server:app --reload --host 0.0.0.0 --port $BackendPort"

# ------------------------------------------------------------
# Frontend setup
# ------------------------------------------------------------
$frontendDir = Join-Path $projectRoot "frontend"
$nodeModules = Join-Path $frontendDir "node_modules"

if (-not (Test-Path $frontendDir)) {
  throw "Frontend directory not found: $frontendDir"
}

if (-not $NoInstall -and -not (Test-Path $nodeModules)) {
  Write-Host "[start-dev] Installing frontend dependencies..."
  Push-Location $frontendDir
  npm install --legacy-peer-deps
  Pop-Location
}

Write-Host "[start-dev] Starting frontend on port $FrontendPort..."

Start-Process powershell `
  -ArgumentList "-NoExit", "-Command",
  "cd '$frontendDir'; `$env:REACT_APP_BACKEND_URL='http://localhost:$BackendPort'; `$env:PORT=$FrontendPort; npm start"

Write-Host "[start-dev] Done. Backend and frontend are running in separate windows."