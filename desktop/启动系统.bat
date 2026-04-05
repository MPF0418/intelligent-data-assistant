@echo off

rem 智能数据洞察助手 - 一键启动脚本
rem 版本: 4.0.0
rem 功能: 启动所有必要的服务和应用

echo ===================================
echo 智能数据洞察助手 - 一键启动
 echo ===================================
echo.

rem 检查Python是否安装
echo 检查Python环境...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Python环境
    echo 请先安装Python 3.8或更高版本
    pause
    exit /b 1
)
echo Python环境正常

rem 启动API服务
echo.
echo 启动API服务...
start "意图识别API" python intent_api.py
start "分析要素API" python analysis_api.py

rem 等待API服务启动
echo 等待API服务启动...
timeout /t 3 /nobreak >nul

echo API服务启动完成

rem 启动前端应用
echo.
echo 启动前端应用...
start "智能数据洞察助手" npm start

echo.
echo ===================================
echo 启动完成！
echo 应用将在稍后打开
 echo ===================================
echo.
echo 按任意键关闭此窗口...
pause >nul