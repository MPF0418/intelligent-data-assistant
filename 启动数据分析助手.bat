@echo off
chcp 65001 >nul
title 数据分析助手 V4.0
echo ==========================================
echo    数据分析助手 V4.0 - 启动中...
echo ==========================================
echo.

:: 设置工作目录
cd /d "e:\开发项目_codebuddy\智能数据分析助手\20260226"

:: 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到Python，请先安装Python
    pause
    exit /b 1
)

echo [1/3] 正在启动意图识别API服务...
start /min "意图识别API" cmd /c "cd /d e:\开发项目_codebuddy\智能数据分析助手\20260226 && python intent_api.py"

:: 等待API服务启动
timeout /t 3 /nobreak >nul

echo [2/3] 正在启动HTTP服务器...
start /min "HTTP服务器" cmd /c "cd /d e:\开发项目_codebuddy\智能数据分析助手\20260226 && python -m http.server 8080"

:: 等待HTTP服务器启动
timeout /t 2 /nobreak >nul

echo [3/3] 正在打开浏览器...
start http://localhost:8080

echo.
echo ==========================================
echo    服务已启动！
echo    - 意图识别API: http://localhost:5000
echo    - 系统页面: http://localhost:8080
echo ==========================================
echo.
echo 提示：关闭此窗口不会停止服务
pause
