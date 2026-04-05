@echo off

rem 智能数据洞察助手 - 停止服务脚本
rem 版本: 4.0.0
rem 功能: 停止所有运行的服务

echo ===================================
echo 智能数据洞察助手 - 停止服务
 echo ===================================
echo.

echo 停止API服务...

rem 查找并终止Python进程
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq python.exe" /fo table /nh') do (
    taskkill /pid %%a /f >nul 2>&1
    if %errorlevel% equ 0 (
        echo 已停止Python进程: %%a
    )
)

echo.
echo 停止前端应用...

rem 查找并终止Node.js进程
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq node.exe" /fo table /nh') do (
    taskkill /pid %%a /f >nul 2>&1
    if %errorlevel% equ 0 (
        echo 已停止Node.js进程: %%a
    )
)

echo.
echo ===================================
echo 停止完成！
echo 所有服务已停止
 echo ===================================
echo.
echo 按任意键关闭此窗口...
pause >nul