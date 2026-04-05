# -*- coding: utf-8 -*-
"""
详细测试API响应
产品意义：验证服务器是否能够正常响应API请求，并获取详细的错误信息
"""

import requests
import json

# 测试数据
test_data = {
    'headers': ['省份', '城市', '销售额', '产品类型', '日期'],
    'rows': [
        ['上海', '上海市', '15000', '高端产品', '2024-01-01'],
        ['江苏', '南京市', '8000', '中端产品', '2024-01-02'],
        ['浙江', '杭州市', '12000', '高端产品', '2024-01-03'],
        ['广东', '广州市', '20000', '高端产品', '2024-01-04'],
        ['北京', '北京市', '18000', '高端产品', '2024-01-05']
    ]
}

def test_api():
    """
    详细测试API响应
    """
    print("=== 详细测试API响应 ===")
    
    # 测试vectorization/collections端点
    print("\n测试vectorization/collections端点:")
    try:
        response = requests.get("http://localhost:5002/api/v1/vectorization/collections")
        print(f"状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        print(f"响应内容: {response.text}")
    except Exception as e:
        print(f"错误: {e}")
    
    # 测试vectorization/vectorize端点
    print("\n测试vectorization/vectorize端点:")
    try:
        payload = {
            'table_name': 'test_sales',
            'data': test_data
        }
        response = requests.post("http://localhost:5002/api/v1/vectorization/vectorize", json=payload)
        print(f"状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        print(f"响应内容: {response.text}")
    except Exception as e:
        print(f"错误: {e}")
    
    # 测试vectorization/query端点
    print("\n测试vectorization/query端点:")
    try:
        payload = {
            'query': '华东地区的高端产品',
            'table_name': 'test_sales',
            'top_k': 3
        }
        response = requests.post("http://localhost:5002/api/v1/vectorization/query", json=payload)
        print(f"状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        print(f"响应内容: {response.text}")
    except Exception as e:
        print(f"错误: {e}")

if __name__ == "__main__":
    test_api()
