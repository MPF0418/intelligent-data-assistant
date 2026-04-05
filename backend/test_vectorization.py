# -*- coding: utf-8 -*-
"""
Excel向量化功能测试
产品意义：验证Excel向量化功能是否正常工作
"""

import pandas as pd
import json
import requests

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

def test_vectorization():
    """
    测试向量化功能
    """
    print("=== 测试Excel向量化功能 ===")
    
    # 向量化API地址
    vectorize_url = "http://localhost:5001/api/v1/vectorization/vectorize"
    
    # 测试数据
    payload = {
        'table_name': 'test_sales',
        'data': test_data
    }
    
    # 发送请求
    response = requests.post(vectorize_url, json=payload)
    result = response.json()
    
    print(f"向量化结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    
    if result['success']:
        print("✅ 向量化测试成功")
    else:
        print("❌ 向量化测试失败")
    
    return result['success']

def test_query():
    """
    测试查询功能
    """
    print("\n=== 测试语义查询功能 ===")
    
    # 查询API地址
    query_url = "http://localhost:5001/api/v1/vectorization/query"
    
    # 测试查询
    test_queries = [
        "华东地区的高端产品",
        "销售额大于10000的产品",
        "Q1的销售数据"
    ]
    
    for query in test_queries:
        payload = {
            'query': query,
            'table_name': 'test_sales',
            'top_k': 3
        }
        
        # 发送请求
        response = requests.post(query_url, json=payload)
        result = response.json()
        
        print(f"\n查询: {query}")
        print(f"结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
        
        if result['success']:
            print(f"✅ 查询 '{query}' 成功")
        else:
            print(f"❌ 查询 '{query}' 失败")

def test_get_collections():
    """
    测试获取集合功能
    """
    print("\n=== 测试获取集合功能 ===")
    
    # API地址
    collections_url = "http://localhost:5001/api/v1/vectorization/collections"
    
    # 发送请求
    response = requests.get(collections_url)
    result = response.json()
    
    print(f"集合列表: {json.dumps(result, ensure_ascii=False, indent=2)}")
    
    if result['success']:
        print("✅ 获取集合测试成功")
    else:
        print("❌ 获取集合测试失败")

def test_delete_collection():
    """
    测试删除集合功能
    """
    print("\n=== 测试删除集合功能 ===")
    
    # API地址
    delete_url = "http://localhost:5001/api/v1/vectorization/collections/test_sales"
    
    # 发送请求
    response = requests.delete(delete_url)
    result = response.json()
    
    print(f"删除结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    
    if result['success']:
        print("✅ 删除集合测试成功")
    else:
        print("❌ 删除集合测试失败")

if __name__ == "__main__":
    # 运行测试
    vectorize_success = test_vectorization()
    
    if vectorize_success:
        test_query()
        test_get_collections()
        test_delete_collection()
    
    print("\n=== 测试完成 ===")
