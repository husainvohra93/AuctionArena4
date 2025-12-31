<#
Start Dev Environment Script

Usage examples:
  - Start both services with defaults:
      ./scripts/start-dev.ps1

  - Start with specific ports and skip installs:
      ./scripts/start-dev.ps1 -BackendPort 8081 -FrontendPort 3000 -NoInstall

  - Only stop processes using the configured ports:
      ./scripts/start-dev.ps1 -StopOnly

Flags:
  -BackendPort <int>   Port to start backend on (default: 8081)
  -FrontendPort <int>  Port to start frontend on (default: 3000)
  -NoInstall           Skip installing missing dependencies
  -NoKill              Don't kill processes already using the ports
  -StopOnly            Kill processes using ports and exit
#>

Param(
  [int]$BackendPort = 8081,
  [int]$FrontendPort = 3000,
  [switch]$NoInstall,
  [switch]$NoKill,
  [switch]$StopOnly
)

Set-StrictMode -Version Latest
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Write-Host "[start-dev] script root: $scriptRoot"

function Get-PidsUsingPort($port) {
  $pids = @()
  try {
    $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction Stop
    foreach ($c in $conns) { if ($c.OwningProcess) { $pids += $c.OwningProcess } }
  } catch {
    # Fallback to parsing netstat output
    $lines = netstat -ano 2>$null | Select-String ":[0-9]+:$port\b"
    foreach ($l in $lines) {
      $parts = ($l -replace '\s+', ' ').Trim() -split ' '
      $pid = $parts[-1]
      if ($pid -match '^[0-9]+$') { $pids += [int]$pid }
    }
  }
  return $pids | Sort-Object -Unique
}

function Kill-Pids($pids) {
  foreach ($pid in $pids) {
    try {
      Write-Host "[start-dev] Killing PID $pid..."
      Stop-Process -Id $pid -Force -ErrorAction Stop
      Write-Host "[start-dev] Killed PID $pid"
    } catch {
      Write-Warning "[start-dev] Failed to kill PID $pid: $_"
    }
  }
}

# Check ports and optionally kill
$backendPids = Get-PidsUsingPort -port $BackendPort
$frontendPids = Get-PidsUsingPort -port $FrontendPort

if ($backendPids.Count -gt 0) {
  Write-Host "[start-dev] Backend port $BackendPort in use by PIDs: $($backendPids -join ', ')"
  if ($StopOnly) { Kill-Pids $backendPids }
  elseif (-not $NoKill) { Kill-Pids $backendPids }
}

if ($frontendPids.Count -gt 0) {
  Write-Host "[start-dev] Frontend port $FrontendPort in use by PIDs: $($frontendPids -join ', ')"
  if ($StopOnly) { Kill-Pids $frontendPids }
  elseif (-not $NoKill) { Kill-Pids $frontendPids }
}

if ($StopOnly) {
  Write-Host "[start-dev] Stop-only complete. Exiting."
  exit 0
}

# Ensure backend venv and dependencies
$backendVenv = Join-Path $scriptRoot 'backend' '.venv'
$backendReq = Join-Path $scriptRoot 'backend' 'requirements.txt'
if (-not $NoInstall) {
  if (-not (Test-Path $backendVenv)) {
    Write-Host "[start-dev] Creating Python venv for backend..."
    python -m venv "$backendVenv"
  }

  $pythonExe = Join-Path $backendVenv 'Scripts\python.exe'
  if (-not (Test-Path $pythonExe)) { $pythonExe = 'python' }

  if (Test-Path $backendReq) {
    Write-Host "[start-dev] Installing backend Python requirements..."
    & $pythonExe -m pip install --upgrade pip setuptools wheel | Out-Null
    & $pythonExe -m pip install -r "$backendReq"
  } else {
    Write-Warning "[start-dev] requirements.txt not found at $backendReq"
  }

  # Ensure frontend node modules
  $frontendNodeModules = Join-Path $scriptRoot 'frontend' 'node_modules'
  if (-not (Test-Path $frontendNodeModules)) {
    Write-Host "[start-dev] Installing frontend NPM dependencies (this may take a while)..."
    Push-Location (Join-Path $scriptRoot 'frontend')
    npm install --legacy-peer-deps
    Pop-Location
  }
}

# Start backend in its own PowerShell window
$backendCmd = "Set-Location -Path '$scriptRoot\backend'; ``. .\.venv\Scripts\Activate.ps1; uvicorn server:app --host 0.0.0.0 --port $BackendPort --reload"
Write-Host "[start-dev] Starting backend on port $BackendPort..."
Start-Process -FilePath 'powershell' -ArgumentList '-NoExit','-Command',$backendCmd -WorkingDirectory (Join-Path $scriptRoot 'backend')

# Start frontend in its own PowerShell window
$frontendCmd = "Set-Location -Path '$scriptRoot\frontend'; `$env:REACT_APP_BACKEND_URL='http://localhost:$BackendPort'; `$env:PORT='$FrontendPort'; npm start"
Write-Host "[start-dev] Starting frontend on port $FrontendPort (REACT_APP_BACKEND_URL=http://localhost:$BackendPort)..."
Start-Process -FilePath 'powershell' -ArgumentList '-NoExit','-Command',$frontendCmd -WorkingDirectory (Join-Path $scriptRoot 'frontend')

# Wait for backend health endpoint
$healthUrl = "http://localhost:$BackendPort/api"
Write-Host "[start-dev] Waiting for backend to become available at $healthUrl..."
$maxAttempts = 30
for ($i = 1; $i -le $maxAttempts; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    if ($resp.StatusCode -eq 200) {
      Write-Host "[start-dev] Backend is up (HTTP 200)."
      break
    }
  } catch {
    Start-Sleep -Seconds 1
  }
  if ($i -eq $maxAttempts) { Write-Warning "[start-dev] Backend did not respond within timeout." }
}

Write-Host "[start-dev] Done. Backend and frontend should be running in separate PowerShell windows."
Write-Host "[start-dev] Tips: Use './scripts/start-dev.ps1 -StopOnly' to kill processes using ports, or pass -NoInstall to skip dependency installs."