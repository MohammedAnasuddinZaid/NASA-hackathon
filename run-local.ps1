# Run FIRETRACE locally (evidence API + frontend)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$python = if (Test-Path "$root\backend\.venv\Scripts\python.exe") {
    "$root\backend\.venv\Scripts\python.exe"
} else {
    (Get-Command python).Source
}

Write-Host "Starting backend on http://127.0.0.1:8000 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$python' -m uvicorn api:app --host 127.0.0.1 --port 8000" -WorkingDirectory "$root\backend"

Start-Sleep -Seconds 2
Write-Host "Starting frontend on http://localhost:5173 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WorkingDirectory $root

Write-Host ""
Write-Host "Backend:  http://127.0.0.1:8000/health/live"
Write-Host "API docs: http://127.0.0.1:8000/api/docs"
Write-Host "Frontend: http://localhost:5173"
