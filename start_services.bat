@echo off
echo =========================================
echo 启动智能数据分析助手系统服务
echo =========================================

REM 检查端口是否已占用
echo 检查端口8080状态...
netstat -aon | findstr ":8080"
if %errorlevel% equ 0 (
    echo 端口8080已被占用，停止现有进程...
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080"') do (
        echo 停止进程PID: %%a
        taskkill /f /pid %%a
    )
)

REM 启动HTTP服务器
echo.
echo 启动HTTP服务器在端口8080...
start "智能数据分析助手 - HTTP服务器" python -m http.server 8080

REM 等待服务器启动
timeout /t 5 /nobreak >nul

REM 检查服务器状态
echo.
echo 检查服务状态...
echo =========================================
netstat -aon | findstr ":8080"
if %errorlevel% equ 0 (
    echo ✅ HTTP服务器启动成功！
    echo.
    echo 访问地址: http://localhost:8080
    echo 访问地址: http://127.0.0.1:8080
) else (
    echo ❌ HTTP服务器启动失败！
)

echo.
echo =========================================
echo 系统服务启动完成！
echo 请在浏览器中访问: http://localhost:8080
echo =========================================
echo.
pause