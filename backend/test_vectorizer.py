# -*- coding: utf-8 -*-
"""
测试ExcelVectorizer类
产品意义：验证ExcelVectorizer类是否能够正常工作
"""

import pandas as pd
from app.utils.excel_vectorizer import ExcelVectorizer

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

def test_vectorizer():
    """
    测试ExcelVectorizer类
    """
    print("=== 测试ExcelVectorizer类 ===")
    
    # 创建ExcelVectorizer实例
    vectorizer = ExcelVectorizer()
    print("✅ ExcelVectorizer实例创建成功")
    
    # 转换数据为DataFrame
    df = pd.DataFrame(test_data['rows'], columns=test_data['headers'])
    print("✅ 数据转换为DataFrame成功")
    
    # 测试vectorize方法
    print("\n测试vectorize方法:")
    result = vectorizer.vectorize(df, 'test_sales')
    print(f"结果: {result}")
    
    # 测试get_collections方法
    print("\n测试get_collections方法:")
    collections = vectorizer.get_collections()
    print(f"集合列表: {collections}")
    
    # 测试delete_collection方法
    print("\n测试delete_collection方法:")
    delete_result = vectorizer.delete_collection('test_sales')
    print(f"删除结果: {delete_result}")
    
    # 再次测试get_collections方法
    print("\n再次测试get_collections方法:")
    collections = vectorizer.get_collections()
    print(f"集合列表: {collections}")

if __name__ == "__main__":
    test_vectorizer()
