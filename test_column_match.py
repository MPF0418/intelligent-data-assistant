# -*- coding: utf-8 -*-
"""测试列名匹配API - 验证完整词优先匹配"""

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

print("=" * 70)
print("列名匹配API测试 - 验证完整词优先匹配逻辑")
print("=" * 70)

test_cases = [
    # 测试完整词优先匹配
    ("查找最大的险情确认时长", "险情确认时长", "完整词'险情确认时长'应优先匹配"),
    ("按省公司名称分组统计", "省公司名称", "完整词'省公司名称'应完全匹配"),
    ("显示所有站点名称", "站点名称", "完整词'站点名称'应完全匹配"),
    
    # 测试部分匹配（优先名称列）
    ("请按照所有省公司的事件数量排序并绘制柱状图", "省公司名称", "'省公司'应匹配'省公司名称'而非'省公司编码'"),
    ("按公司描述分组统计", "公司描述", "'公司描述'应完全匹配"),
    
    # 测试无匹配情况
    ("统计各省份的平均值", None, "'省份'与列名不匹配，应返回None"),
]

for text, expected_col, description in test_cases:
    try:
        response = requests.post(
            f"{BASE_URL}/api/match-column",
            json={"text": text, "columns": columns, "use_llm_fallback": False},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            actual_col = result.get('column')
            entities = result.get('entities', [])
            
            # 判断测试结果
            status = "✓" if actual_col == expected_col else "✗"
            
            print(f"\n{status} 测试: {text}")
            print(f"   说明: {description}")
            print(f"   期望: {expected_col}")
            print(f"   实际: {actual_col}")
            print(f"   实体词: {entities[:5]}...")  # 只显示前5个
            print(f"   方法: {result.get('method')}, 置信度: {result.get('confidence', 0):.2f}")
        else:
            print(f"\n✗ 测试: {text}")
            print(f"   错误: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"\n✗ 测试: {text}")
        print(f"   异常: {e}")

print("\n" + "=" * 70)
print("测试完成")
print("=" * 70)
