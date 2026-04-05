@echo off
echo ========================================
echo 启动Excel向量化服务
echo ========================================

REM 设置Python路径
set PYTHON_PATH=python

REM 检查端口5002是否被占用
netstat -ano | findstr :5002 > nul
if %errorlevel% == 0 (
    echo 端口5002已被占用，跳过服务启动
    timeout /t 1 /nobreak > nul
    goto :check_service
)

REM 启动向量化服务
echo 正在启动向量化服务...
start "Excel向量化服务" %PYTHON_PATH% backend\vectorization_app.py

REM 等待服务启动
echo 等待服务启动...
timeout /t 3 /nobreak > nul

:check_service
REM 测试服务健康状态
echo 测试服务健康状态...
curl -f http://localhost:5002/health -m 5
if %errorlevel% == 0 (
    echo.
    echo 向量化服务启动成功！
    echo 服务地址: http://localhost:5002
) else (
    echo.
    echo 向量化服务启动失败...
)

echo ========================================
echo 按任意键继续...
pause > nul