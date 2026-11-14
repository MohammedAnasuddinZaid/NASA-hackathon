@echo off
setlocal
cd /d "%~dp0"

if exist "%~dp0backend\.venv\Scripts\python.exe" (
    set "PATH=%~dp0backend\.venv\Scripts;%PATH%"
)

echo Starting FIRETRACE evidence API...
start "FIRETRACE Backend" /D "%~dp0backend" cmd /k "python -m uvicorn api:app --host 127.0.0.1 --port 8000"

echo Starting FIRETRACE frontend...
start "FIRETRACE Frontend" /D "%~dp0" cmd /k "npm run dev"

echo.
echo Backend:  http://127.0.0.1:8000/health/live
echo API docs: http://127.0.0.1:8000/api/docs
echo Frontend: http://localhost:5173
echo.
pause
