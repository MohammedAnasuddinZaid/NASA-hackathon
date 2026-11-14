@echo off
setlocal
cd /d "%~dp0"

echo Starting FIRETRACE backend...
start "FIRETRACE Backend" cmd /k "cd /d %~dp0backend && .venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"

echo Starting FIRETRACE frontend...
start "FIRETRACE Frontend" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo Backend:  http://127.0.0.1:8000/api/health
echo Frontend: http://localhost:5173
echo.
echo Close the two opened windows to stop.
pause