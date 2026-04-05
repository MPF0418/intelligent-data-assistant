# -*- coding: utf-8 -*-
"""
智能数据分析助手 - 一键启动脚本 (V5.0)
功能：自动检测端口占用，一键启动所有服务
"""

import subprocess
import sys
import time
import socket
import os
import signal
from datetime import datetime

# ==================== 服务配置 ====================
SERVICES = [
    {
        'name': '意图识别API',
        'script': 'intent_api.py',
        'port': 5001,
        'health_url': 'http://localhost:5001/api/health',
        'required': True
    },
    {
        'name': '分析要素API',
        'script': 'analysis_api.py',
        'port': 5002,
        'health_url': 'http://localhost:5002/api/health',
        'required': True
    }
]

# ==================== 工具函数 ====================
def check_port_in_use(port):
    """检查端口是否被占用"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def kill_port_process(port):
    """尝试杀死占用端口的进程"""
    try:
        result = subprocess.run(
            f'netstat -ano | findstr :{port}',
            shell=True, capture_output=True, text=True
        )
        if result.stdout:
            for line in result.stdout.strip().split('\n'):
                if f':{port}' in line:
                    parts = line.split()
                    if len(parts) >= 5:
                        pid = parts[-1]
                        try:
                            subprocess.run(f'taskkill /PID {pid} /F', shell=True)
                            print(f"    [已] 释放端口 {port} (PID: {pid})")
                            time.sleep(1)
                            return True
                        except:
                            pass
    except:
        pass
    return False

def check_service_health(port, timeout=10):
    """检查服务健康状态"""
    import urllib.request
    import urllib.error
    
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(f'http://localhost:{port}/')
            with urllib.request.urlopen(req, timeout=2) as response:
                if response.status == 200:
                    return True
        except:
            pass
        time.sleep(0.5)
    return False

def print_banner():
    """打印启动横幅"""
    print("=" * 60)
    print("  智能数据分析助手 - 一键启动 V5.0")
    print("=" * 60)
    print(f"  启动时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()

def print_service_status():
    """打印服务状态"""
    print("\n服务状态检查:")
    print("-" * 50)
    
    all_running = True
    for svc in SERVICES:
        port = svc['port']
        name = svc['name']
        
        if check_port_in_use(port):
            status = "✓ 运行中"
            color = ""
        else:
            status = "✗ 未启动"
            color = ""
            all_running = False
        
        print(f"  {name:12} 端口 {port}: {status}")
    
    print("-" * 50)
    return all_running

# ==================== 主函数 ====================
def main():
    print_banner()
    
    # 获取脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    # 检查Python环境
    print("[1/4] 检查Python环境...")
    try:
        subprocess.run([sys.executable, '--version'], 
                      capture_output=True, check=True)
        print(f"      Python版本: {sys.version.split()[0]}")
    except:
        print("      [错误] 未找到Python环境，请先安装Python 3.8+")
        input("\n按回车键退出...")
        return
    
    # 检查端口占用
    print("\n[2/4] 检查端口占用...")
    occupied = []
    available = []
    
    for svc in SERVICES:
        port = svc['port']
        name = svc['name']
        
        if check_port_in_use(port):
            print(f"      [占用] {name} 端口 {port} - 已有服务运行")
            occupied.append(svc)
        else:
            print(f"      [可用] {name} 端口 {port}")
            available.append(svc)
    
    # 询问是否需要释放占用的端口
    if occupied:
        print()
        response = input("是否强制释放占用端口并重启服务? (y/n): ").strip().lower()
        if response == 'y':
            print("\n      释放端口...")
            for svc in occupied:
                kill_port_process(svc['port'])
            print("      端口已释放")
        else:
            print("      保留现有服务，仅启动可用端口")
    
    # 启动服务
    print("\n[3/4] 启动服务...")
    print("-" * 50)
    
    processes = []
    
    for svc in SERVICES:
        port = svc['port']
        name = svc['name']
        script = svc['script']
        
        if check_port_in_use(port):
            print(f"  [跳过] {name} 已在运行")
            continue
        
        print(f"  [启动] {name} (端口 {port})...")
        
        try:
            # Windows下创建新窗口启动
            if sys.platform == 'win32':
                proc = subprocess.Popen(
                    [sys.executable, script],
                    creationflags=subprocess.CREATE_NEW_CONSOLE,
                    cwd=script_dir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
            else:
                proc = subprocess.Popen(
                    [sys.executable, script],
                    cwd=script_dir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
            
            processes.append({
                'process': proc,
                'service': svc
            })
            
            # 等待端口启用
            for _ in range(30):
                time.sleep(0.5)
                if check_port_in_use(port):
                    print(f"        ✓ {name} 启动成功")
                    break
            else:
                print(f"        ! {name} 启动超时")
                
        except Exception as e:
            print(f"        ✗ {name} 启动失败: {e}")
    
    # 最终状态
    print("\n[4/4] 最终状态:")
    print("=" * 60)
    
    all_ok = print_service_status()
    
    print()
    if all_ok:
        print("=" * 60)
        print("  ✓ 所有服务已成功启动！")
        print("=" * 60)
        print()
        print("  访问地址:")
        print(f"    - 主界面: http://localhost:5001")
        print(f"    - 向量化: http://localhost:5002")
        print()
        print("  按 Ctrl+C 停止所有服务")
    else:
        print("=" * 60)
        print("  ⚠ 部分服务未能启动，请检查日志")
        print("=" * 60)
    
    # 保持运行
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n正在停止所有服务...")
        for item in processes:
            try:
                item['process'].terminate()
                print(f"  [完成] {item['service']['name']} 已停止")
            except:
                pass
        print("\n所有服务已停止")

if __name__ == '__main__':
    main()
