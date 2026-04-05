# -*- coding: utf-8 -*-
"""
测试测试端点
产品意义：验证测试端点是否能够正常工作
"""

import requests

def test_test_endpoint():
    """
    测试测试端点
    """
    print("=== 测试测试端点 ===")
    
    # 测试test/hello端点
    print("测试test/hello端点:")
    try:
        response = requests.get("http://localhost:5001/api/v1/test/hello")
        print(f"状态码: {response.status_code}")
        print(f"响应内容: {response.text}")
    except Exception as e:
        print(f"错误: {e}")

if __name__ == "__main__":
    test_test_endpoint()
