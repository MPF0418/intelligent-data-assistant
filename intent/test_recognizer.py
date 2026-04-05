# -*- coding: utf-8 -*-
"""
测试统一意图识别器
"""

import sys
sys.path.insert(0, __file__.rsplit('/', 1)[0] or '.')

from unified_recognizer import get_recognizer

# 初始化
recognizer = get_recognizer()

# 测试用例
test_cases = [
    # 单意图测试
    {
        "query": "绘制柱状图",
        "columns": ["产品", "销售额", "利润", "地区"],
        "expected": "chart - 需要追问"
    },
    {
        "query": "绘制柱状图，产品销售额",
        "columns": ["产品", "销售额", "利润", "地区"],
        "expected": "chart - 部分明确"
    },
    {
        "query": "按销售额从大到小排序",
        "columns": ["产品", "销售额", "利润", "地区"],
        "expected": "sort - 明确"
    },
    {
        "query": "筛选男性的记录",
        "columns": ["姓名", "性别", "销售额", "地区"],
        "expected": "filter - 明确"
    },
    {
        "query": "计算销售额总和",
        "columns": ["产品", "销售额", "利润", "地区"],
        "expected": "aggregate - 部分明确"
    },
    
    # 多意图测试 - 这是重点！
    {
        "query": "绘制柱状图并按照由大到小排序",
        "columns": ["产品", "销售额", "利润", "地区"],
        "expected": "chart + sort - 重点测试！"
    },
    {
        "query": "筛选男性，按销售额排序",
        "columns": ["姓名", "性别", "销售额", "地区"],
        "expected": "filter + sort - 两个意图"
    },
    {
        "query": "筛选女性，计算销售额总和",
        "columns": ["姓名", "性别", "销售额", "地区"],
        "expected": "filter + aggregate"
    },
    {
        "query": "绘制折线图，筛选华东地区，按利润排序",
        "columns": ["产品", "销售额", "利润", "地区"],
        "expected": "chart + filter + sort - 三个意图"
    },
    
    # 极值查询
    {
        "query": "销售额最高的产品",
        "columns": ["产品", "销售额", "利润", "地区"],
        "expected": "extreme - 明确"
    },
    
    # 拒识测试
    {
        "query": "今天天气怎么样",
        "columns": ["产品", "销售额", "利润", "地区"],
        "expected": "无意图 - 应该拒识"
    }
]

print("=" * 60)
print("统一意图识别器测试")
print("=" * 60)

for i, test in enumerate(test_cases, 1):
    print(f"\n【测试 {i}】{test['expected']}")
    print(f"输入: {test['query']}")
    print(f"列: {test['columns']}")
    
    result = recognizer.recognize(test['query'], test['columns'])
    
    print(f"识别意图数: {result.get('intent_count')}")
    for intent in result.get('intents', []):
        print(f"  - {intent['name']}: {intent['entities']}, 明确={intent['is_clear']}")
    
    if result.get('clarifications_needed'):
        print(f"需要追问: {len(result['clarifications_needed'])}项")
        for cl in result['clarifications_needed']:
            print(f"  - {cl['question']}")
    
    print(f"全部明确: {result['all_clear']}")

print("\n" + "=" * 60)
print("测试完成")
print("=" * 60)
