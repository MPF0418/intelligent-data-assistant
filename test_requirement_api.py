# -*- coding: utf-8 -*-
"""测试需求分类API"""

import requests
import json

BASE_URL = "http://localhost:5001"

# 测试根路径
print("=" * 60)
print("测试根路径")
print("=" * 60)
try:
    response = requests.get(f"{BASE_URL}/", timeout=5)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"服务: {result.get('service')}")
    print(f"端点: {json.dumps(result.get('endpoints'), ensure_ascii=False, indent=2)}")
except Exception as e:
    print(f"错误: {e}")

# 测试需求分类
print("\n" + "=" * 60)
print("测试需求分类API")
print("=" * 60)

test_cases = [
    "今天下雨了没",
    "你好",
    "查找最大的险情确认时长",
    "统计各省份的平均值",
]

for text in test_cases:
    try:
        response = requests.post(
            f"{BASE_URL}/api/classify-requirement",
            json={"text": text},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            label = result.get('label', 'N/A')
            confidence = result.get('confidence', 0)
            is_data = result.get('is_data_analysis', False)
            status = "✓ 数据分析" if is_data else "✗ 无关输入"
            print(f"\n'{text}' -> {status} ({label}, {confidence:.1%})")
        else:
            print(f"\n'{text}' -> 错误 {response.status_code}: {response.text[:100]}")
            
    except Exception as e:
        print(f"\n'{text}' -> 异常: {e}")

print("\n测试完成")
