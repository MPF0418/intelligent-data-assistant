# -*- coding: utf-8 -*-
"""
V4.1新增：统一启动所有本地模型服务
功能：一键启动所有3个Python Flask服务
产品意义：解决服务启动繁琐、容易遗漏的问题

启动的服务：
- 意图识别API (端口5001)
- 分析要素API (端口5002)
"""

import subprocess
import sys
import time
import socket
import os

# 服务配置
SERVICES = [
    {
        'name': '意图识别API',
        'script': 'intent_api.py',
        'port': 5001,
        'url': 'http://localhost:5001/api/health'
    },
    {
        'name': '分析要素API',
        'script': 'analysis_api.py',
        'port': 5002,
        'url': 'http://localhost:5002/api/health'
    }
]

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

def wait_for_service(port, timeout=30):
    """等待服务启动"""
    start_time = time.time()
    while time.time() - start_time < timeout:
        if not check_port_available(port):
            return True
        time.sleep(0.5)
    return False

def print_banner():
    """打印启动横幅"""
    print("=" * 70)
    print("  智能数据分析助手 - 本地模型服务启动器 (V4.1)")
    print("=" * 70)
    print()
    print("将启动以下服务：")
    for service in SERVICES:
        status = "[可用]" if check_port_available(service['port']) else "[被占用]"
        print(f"  {service['name']}: 端口 {service['port']} {status}")
    print()
    print("=" * 70)
    print()

def main():
    """主函数"""
    print_banner()
    
    # 检查端口占用情况
    occupied_ports = []
    for service in SERVICES:
        if not check_port_available(service['port']):
            occupied_ports.append(service['port'])
    
    if occupied_ports:
        print(f"[警告] 端口 {occupied_ports} 已被占用")
        print("   可能服务已经在运行，或需要关闭占用程序")
        print()
        response = input("是否继续尝试启动？(y/n): ")
        if response.lower() != 'y':
            print("已取消启动")
            return
        print()
    
    processes = []
    
    try:
        # 启动每个服务
        for i, service in enumerate(SERVICES):
            print(f"[{i+1}/{len(SERVICES)}] 启动 {service['name']}...")
            print(f"      脚本: {service['script']}")
            print(f"      端口: {service['port']}")
            
            # 使用subprocess启动服务
            # 使用creationflags让服务在后台运行(Windows)
            if sys.platform == 'win32':
                process = subprocess.Popen(
                    [sys.executable, service['script']],
                    creationflags=subprocess.CREATE_NEW_CONSOLE,
                    cwd=os.path.dirname(os.path.abspath(__file__))
                )
            else:
                process = subprocess.Popen(
                    [sys.executable, service['script']],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    cwd=os.path.dirname(os.path.abspath(__file__))
                )
            
            processes.append({
                'process': process,
                'service': service
            })
            
            # 等待服务启动
            print(f"      等待服务启动...", end='')
            if wait_for_service(service['port'], timeout=30):
                print(f" [成功]")
            else:
                print(f" [超时，但服务可能仍在启动中]")
            
            print()
            
            # 服务之间稍微延迟，避免资源冲突
            if i < len(SERVICES) - 1:
                time.sleep(2)
        
        print("=" * 70)
        print("所有服务已启动！")
        print()
        print("服务状态：")
        for item in processes:
            service = item['service']
            pid = item['process'].pid
            status = "运行中" if not check_port_available(service['port']) else "启动中/异常"
            print(f"  • {service['name']} (PID: {pid}): {status}")
            print(f"    地址: http://localhost:{service['port']}")
        print()
        print("按 Ctrl+C 停止所有服务")
        print("=" * 70)
        
        # 保持运行状态
        try:
            while True:
                time.sleep(1)
                # 检查进程是否还在运行
                for item in processes:
                    if item['process'].poll() is not None:
                        print(f"\n[警告] {item['service']['name']} 已退出")
        except KeyboardInterrupt:
            print("\n\n正在停止所有服务...")
            for item in processes:
                try:
                    item['process'].terminate()
                    item['process'].wait(timeout=5)
                    print(f"  [完成] {item['service']['name']} 已停止")
                except:
                    item['process'].kill()
                    print(f"  [完成] {item['service']['name']} 已强制停止")
            print("\n所有服务已停止")
            
    except Exception as e:
        print(f"\n[错误] 启动失败: {e}")
        # 清理已启动的进程
        for item in processes:
            try:
                item['process'].terminate()
            except:
                pass
        sys.exit(1)

if __name__ == '__main__':
    main()
