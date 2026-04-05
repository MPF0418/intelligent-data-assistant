@echo off
cd /d "e:\开发项目_codebuddy\智能数据分析助手\20260226"

echo ==========================================
echo    Data Analysis Assistant V4.0
echo ==========================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found
    pause
    exit /b 1
)

echo [1/3] Starting API Service (Background)...
start /min cmd /c "python intent_api.py >nul 2>&1"
timeout /t 3 /nobreak >nul

echo [2/3] Starting Web Server (Background)...
start /min cmd /c "python -m http.server 8080 >nul 2>&1"
timeout /t 2 /nobreak >nul

echo [3/3] Opening Browser...
start http://localhost:8080

echo.
echo ==========================================
echo    All Services Started Successfully!
echo    URL: http://localhost:8080
echo ==========================================
echo.
echo [IMPORTANT] Do NOT close this window!
echo             Services are running in background.
echo.
echo Press any key to hide this window (services will keep running)
pause >nul
