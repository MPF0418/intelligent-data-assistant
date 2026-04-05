# -*- coding: utf-8 -*-
"""测试"省公司"匹配"""

import requests
import json

BASE_URL = "http://localhost:5001"

# 模拟数据列名
columns = [
    "主键", "新奥能源编码", "新奥能源描述", "省公司编码", "省公司名称",
    "管理实体代码", "管理实体描述", "公司代码", "公司描述", "事件名称",
    "事件编号", "事发时间", "事件地点", "经度", "纬度", "事发公司",
    "事发公司编码", "站点id", "站点名称", "所属区域编号", "所属区域名称",
    "事件类型", "险情分类", "上报人姓名", "上报人账号", "事件状态",
    "接警时间", "到达现场时间", "现场确认时间", "险情确认时长"
]

print("=" * 60)
print("测试'省公司'匹配")
print("=" * 60)

test_cases = [
    "表中涉及到多少个省公司",
    "省公司数量",
    "有多少个省公司",
    "省公司",
]

for text in test_cases:
    try:
        response = requests.post(
            f"{BASE_URL}/api/match-column",
            json={"text": text, "columns": columns, "use_llm_fallback": False},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n输入: {text}")
            print(f"  匹配列: {result.get('column')}")
            print(f"  置信度: {result.get('confidence', 0):.2f}")
            print(f"  方法: {result.get('method')}")
            print(f"  说明: {result.get('reason')}")
        else:
            print(f"\n输入: {text}")
            print(f"  错误: {response.status_code}")
            
    except Exception as e:
        print(f"\n输入: {text}")
        print(f"  异常: {e}")

print("\n" + "=" * 60)
print("测试完成")
