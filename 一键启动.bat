@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo           智能数据分析助手 - 一键启动 (V5.0)
echo ============================================================
echo.

:: 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: 检查Python环境
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到Python环境，请先安装Python 3.8+
    pause
    exit /b 1
)
echo [OK] Python环境检查通过

:: ============================================================
:: 定义服务配置
:: ============================================================
set "SERVICES[0].name=意图识别API"
set "SERVICES[0].script=intent_api.py"
set "SERVICES[0].port=5001"
set "SERVICES[0].check_url=http://localhost:5001/api/health"

set "SERVICES[1].name=分析要素API"
set "SERVICES[1].script=analysis_api.py"
set "SERVICES[1].port=5002"
set "SERVICES[1].check_url=http://localhost:5002/api/health"

:: ============================================================
:: 检查端口占用情况
:: ============================================================
echo.
echo ----------------------------------------------------------
echo 检查端口占用情况...
echo ----------------------------------------------------------

set "OCCUPIED_PORTS="
set "AVAILABLE_PORTS="

for /L %%i in (0,1,1) do (
    set "idx=%%i"
    call set "port=%%SERVICES[%%i].port%%"
    call set "name=%%SERVICES[%%i].name%%"
    
    :: 检查端口是否被占用
    netstat -ano | findstr ":%port% " >nul
    if !errorlevel! equ 0 (
        echo [占用] 端口 !port! (!name!) - 可能已有服务运行
        set "OCCUPIED_PORTS=!OCCUPIED_PORTS! !port!"
    ) else (
        echo [可用] 端口 !port! (!name!)
        set "AVAILABLE_PORTS=!AVAILABLE_PORTS! !port!"
    )
)

:: ============================================================
:: 启动服务
:: ============================================================
echo.
echo ----------------------------------------------------------
echo 启动服务...
echo ----------------------------------------------------------

for /L %%i in (0,1,1) do (
    set "idx=%%i"
    call set "script=%%SERVICES[%%i].script%%"
    call set "port=%%SERVICES[%%i].port%%"
    call set "name=%%SERVICES[%%i].name%%"
    
    :: 检查端口是否已占用
    netstat -ano | findstr ":%port% " >nul
    if !errorlevel! equ 0 (
        echo [跳过] !name! (端口 !port!) 已在运行
    ) else (
        echo [启动] !name! (端口 !port!)...
        start "!name%!" cmd /k "cd /d "%SCRIPT_DIR%" && python !script!"
        
        :: 等待服务启动
        set "started=false"
        for /L %%j in (1,1,30) do (
            if "!started!"=="false" (
                ping -n 2 127.0.0.1 >nul
                netstat -ano | findstr ":%port% " >nul
                if !errorlevel! equ 0 (
                    echo [成功] !name! 已启动 (端口 !port!)
                    set "started=true"
                )
            )
        )
        
        if "!started!"=="false" (
            echo [警告] !name! 启动超时，但仍可能在后台启动中
        )
    )
)

:: ============================================================
:: 最终状态检查
:: ============================================================
echo.
echo ============================================================
echo 启动完成！服务状态：
echo ============================================================

for /L %%i in (0,1,1) do (
    call set "port=%%SERVICES[%%i].port%%"
    call set "name=%%SERVICES[%%i].name%%"
    
    netstat -ano | findstr ":%port% " >nul
    if !errorlevel! equ 0 (
        echo   [运行中] !name! - http://localhost:!port!
    ) else (
        echo   [未启动] !name!
    )
)

echo.
echo ============================================================
echo 使用说明：
echo   1. 打开浏览器访问: http://localhost:5001
echo   2. 如果需要停止服务，请在任务管理器中结束Python进程
echo ============================================================
echo.
pause
