# -*- coding: utf-8 -*-
"""测试用户实际输入"""

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
print("测试用户实际输入")
print("=" * 70)

# 用户实际输入
user_input = "按省份统计事件数量并绘制散点图和饼图"

print(f"用户输入: {user_input}")

# 调用API
try:
    response = requests.post(
        f"{BASE_URL}/api/match-column",
        json={"text": user_input, "columns": columns, "use_llm_fallback": True},
        timeout=30
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"\nAPI响应:")
        print(f"  匹配列: {result.get('column')}")
        print(f"  置信度: {result.get('confidence', 0):.2f}")
        print(f"  方法: {result.get('method')}")
        print(f"  说明: {result.get('reason')}")
        print(f"  实体词: {result.get('entities')}")
    else:
        print(f"\n错误: HTTP {response.status_code}")
        print(f"  响应: {response.text}")
        
except Exception as e:
    print(f"\n异常: {e}")

print("\n" + "=" * 70)
print("测试完成")
