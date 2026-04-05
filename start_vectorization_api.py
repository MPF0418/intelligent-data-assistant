# -*- coding: utf-8 -*-
"""
启动向量化API服务
端口：5002
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
        return result != 0  # 0表示端口被占用
    except:
        return False

def print_banner():
    """打印启动横幅"""
    print("=" * 70)
    print("  智能数据分析助手 - 向量化API服务启动器")
    print("=" * 70)
    print()
    print("服务信息：")
    print("  服务名称: Excel向量化API")
    print("  端口: 5002")
    print("  脚本: vectorization_app.py")
    print()
    print("=" * 70)
    print()

def main():
    """主函数"""
    print_banner()
    
    # 检查端口占用情况
    if not check_port_available(5002):
        print("[警告] 端口 5002 已被占用")
        print("   可能向量化API已经在运行")
        return
    
    try:
        print("启动 Excel向量化API...")
        
        # 切换到backend目录
        os.chdir('backend')
        
        # 启动向量化API
        script_path = 'vectorization_app.py'
        if sys.platform == 'win32':
            # Windows平台使用隐藏窗口
            process = subprocess.Popen(
                ['python', script_path],
                creationflags=subprocess.CREATE_NO_WINDOW
            )
        else:
            # Linux/Mac平台
            process = subprocess.Popen(
                ['python3', script_path]
            )
        
        # 等待几秒让服务启动
        time.sleep(3)
        
        # 再次检查端口
        if not check_port_available(5002):
            print(f"[成功] 向量化API已启动，监听端口: 5002")
            print(f"      可以在浏览器中访问: http://localhost:5002/")
            print(f"      健康检查: http://localhost:5002/health")
            print()
            print("注意: 不要关闭此命令行窗口，否则服务将停止运行")
            print("如需停止服务，请按 Ctrl+C")
            
            try:
                # 保持进程运行
                process.wait()
            except KeyboardInterrupt:
                print("\n正在停止向量化API...")
                process.terminate()
                process.wait()
                print("向量化API已停止")
        else:
            print("[错误] 向量化API启动失败，端口5002仍未监听")
            process.terminate()
            
    except Exception as e:
        print(f"[错误] 启动失败: {e}")
        return

if __name__ == '__main__':
    main()