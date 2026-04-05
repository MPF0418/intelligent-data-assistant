# -*- coding: utf-8 -*-
"""
V4.2统一API服务启动脚本
功能：启动合并后的单一API服务
产品意义：简化启动流程，只需一个命令

特性：
- 单端口服务 (5001)
- 自动检测端口占用
- 支持热更新
"""

import subprocess
import sys
import time
import socket
import os

def check_port_available(port):
    """检查端口是否可用"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex(('localhost', port))
        sock.close()
        return result != 0
    except:
        return False

def print_banner():
    """打印启动横幅"""
    print("=" * 70)
    print("  智能数据分析助手 - 统一API服务启动器 (V4.2)")
    print("=" * 70)
    print()
    print("服务信息:")
    print("  • 端口: 5001")
    print("  • 功能: 意图识别 + 分析要素识别 + 需求分类 + 配置生成")
    print("  • 特性: 模型热更新")
    print()
    
    # 检查端口状态
    if check_port_available(5001):
        print("  端口状态: ✓ 可用")
    else:
        print("  端口状态: ✗ 被占用 (服务可能已在运行)")
    print()
    print("=" * 70)
    print()

def main():
    """主函数"""
    print_banner()
    
    # 检查依赖
    try:
        import watchdog
    except ImportError:
        print("⚠️  缺少watchdog库，正在安装...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "watchdog", "-q"])
        print("✓ watchdog安装完成")
        print()
    
    # 检查端口
    if not check_port_available(5001):
        print("⚠️  端口5001已被占用")
        response = input("   是否尝试重启服务？(y/n): ")
        if response.lower() != 'y':
            print("已取消启动")
            return
        print()
    
    try:
        print("正在启动统一API服务...")
        print("  脚本: unified_api.py")
        print("  端口: 5001")
        print()
        
        # 启动统一API服务
        if sys.platform == 'win32':
            process = subprocess.Popen(
                [sys.executable, 'unified_api.py'],
                creationflags=subprocess.CREATE_NEW_CONSOLE,
                cwd=os.path.dirname(os.path.abspath(__file__))
            )
        else:
            process = subprocess.Popen(
                [sys.executable, 'unified_api.py'],
                cwd=os.path.dirname(os.path.abspath(__file__))
            )
        
        # 等待服务启动
        print("等待服务启动...", end='')
        max_wait = 30
        for i in range(max_wait):
            if not check_port_available(5001):
                print(" ✓ 成功")
                print()
                break
            time.sleep(1)
            print(".", end='', flush=True)
        else:
            print(" ⚠ 超时")
            print()
        
        print("=" * 70)
        print("统一API服务已启动！")
        print()
        print("访问地址:")
        print("  • API文档: http://localhost:5001/")
        print("  • 健康检查: http://localhost:5001/api/health")
        print("  • 模型信息: http://localhost:5001/api/model-info")
        print()
        print("可用接口:")
        print("  POST /api/identify-intent      - 意图识别")
        print("  POST /api/analyze-elements     - 分析要素识别")
        print("  POST /api/classify-requirement - 需求分类")
        print("  POST /api/generate-config      - 配置生成")
        print("  GET  /api/model-info           - 模型信息")
        print("  POST /api/reload-model         - 手动重载模型")
        print()
        print("热更新:")
        print("  模型文件修改后自动重载（5秒冷却时间）")
        print("  或调用 POST /api/reload-model 手动重载")
        print()
        print("按 Ctrl+C 停止服务")
        print("=" * 70)
        
        # 保持运行
        try:
            while True:
                time.sleep(1)
                if process.poll() is not None:
                    print("\n⚠️  服务已退出")
                    break
        except KeyboardInterrupt:
            print("\n\n正在停止服务...")
            process.terminate()
            process.wait(timeout=5)
            print("✓ 服务已停止")
            
    except Exception as e:
        print(f"\n❌ 启动失败: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
