# Run FIRETRACE locally (backend + frontend)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "Starting backend on http://127.0.0.1:8000 ..."
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$root\backend'; .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"

Start-Sleep -Seconds 2
Write-Host "Starting frontend on http://localhost:5173 ..."
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$root'; npm run dev"

Write-Host ""
Write-Host "Backend health: http://127.0.0.1:8000/api/health"
Write-Host "Frontend:       http://localhost:5173"
