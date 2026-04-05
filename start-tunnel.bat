@echo off
echo ========================================
echo   智能数据分析助手 - 公网部署脚本
echo ========================================
echo.
echo 正在启动 Cloudflare Tunnel...
echo 请保持此窗口打开，关闭后公网访问将中断
echo.
cloudflared tunnel --url http://localhost:8080
