Param(
  [switch]$NoFrontend
)

$repoRoot = Resolve-Path "$PSScriptRoot/.."

function Start-Window($title, $command, $workingDir) {
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location `"$workingDir`"; $command"
  ) -WindowStyle Normal -WorkingDirectory $workingDir -Verb RunAs -ErrorAction SilentlyContinue
}

# Detect Docker for judge runner
try {
  docker info *> $null
} catch {
  Write-Warning "Docker is not available. Judge jobs will fail until Docker Desktop is running."
}

# ML service (prefers venv python if present)
$mlDir = Join-Path $repoRoot "ml-service"
$mlPython = Join-Path $mlDir "venv/Scripts/python.exe"
if (-not (Test-Path $mlPython)) { $mlPython = "python" }
Start-Window "ML Service" "`"$mlPython`" -m uvicorn app:app --host 0.0.0.0 --port 5000" $mlDir

# Backend API
$backendDir = Join-Path $repoRoot "backend"
Start-Window "Backend API" "npm run start" $backendDir

# Judge worker
Start-Window "Judge Worker" "npm run worker" $backendDir

# Frontend
if (-not $NoFrontend) {
  $frontendDir = Join-Path $repoRoot "frontend"
  Start-Window "Frontend" "npm run dev" $frontendDir
}

Write-Host "Started: ML service, backend API, judge worker, frontend (unless -NoFrontend was passed)." -ForegroundColor Green
