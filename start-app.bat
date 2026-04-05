@echo off
chcp 65001

echo 正在启动智能数据洞察助手...
echo ================================================
echo 1. 检查Python环境...
python --version
if %errorlevel% neq 0 (
    echo 错误：未找到Python环境
    echo 请安装Python 3.8或更高版本
    pause
    exit /b 1
)
echo Python环境检查通过

echo 2. 启动API服务...
start "意图识别API" python intent_api.py
start "分析要素API" python analysis_api.py

echo 3. 等待服务启动...
timeout /t 5

echo 4. 启动前端应用...
if exist "node_modules" (
    echo 使用本地Node.js环境
    npm start
) else (
    echo 未找到Node.js环境，尝试使用已打包的应用
    if exist "dist\win-unpacked\智能数据洞察助手.exe" (
        start "智能数据洞察助手" "dist\win-unpacked\智能数据洞察助手.exe"
    ) else (
        echo 错误：未找到应用程序
        pause
        exit /b 1
    )
)

echo 启动完成！
echo ================================================
