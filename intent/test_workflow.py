# -*- coding: utf-8 -*-
"""
统一工作流测试脚本
测试所有P0-P3优化功能
"""

import sys
import os
import json

# 添加当前目录到路径
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# 导入模块
from unified_recognizer import get_recognizer
from workflow_manager import UnifiedWorkflowManager
from llm_client import MockLLMClient


def test_local_recognition():
    """测试本地模型意图识别"""
    print("\n" + "="*60)
    print("测试1: 本地模型意图识别")
    print("="*60)
    
    recognizer = get_recognizer()
    
    test_cases = [
        {
            "query": "绘制柱状图并按照由大到小排序",
            "columns": ["地区", "销售额", "利润", "产品"],
            "expected_intents": 2  # chart + sort
        },
        {
            "query": "筛选男性，按销售额排序",
            "columns": ["性别", "销售额", "地区"],
            "expected_intents": 2  # filter + sort
        },
        {
            "query": "筛选女性，计算销售额总和",
            "columns": ["性别", "销售额", "地区"],
            "expected_intents": 2  # filter + aggregate
        },
        {
            "query": "绘制折线图，筛选华东地区，按利润排序",
            "columns": ["地区", "销售额", "利润", "产品"],
            "expected_intents": 3  # chart + filter + sort
        },
        {
            "query": "今天天气怎么样",
            "columns": ["地区", "销售额", "利润"],
            "expected_intents": 0  # 拒识
        }
    ]
    
    passed = 0
    failed = 0
    
    for i, case in enumerate(test_cases, 1):
        print(f"\n测试用例 {i}: {case['query']}")
        result = recognizer.recognize(case['query'], case['columns'])
        
        intent_count = len(result.get('intents', []))
        expected = case['expected_intents']
        
        print(f"  识别意图数: {intent_count} (期望: {expected})")
        
        if intent_count == expected:
            print(f"  [PASS] 通过")
            passed += 1
        else:
            print(f"  [FAIL] 失败")
            print(f"  识别结果: {json.dumps(result, ensure_ascii=False)}")
            failed += 1
    
    print("\n本地模型意图识别测试结果: %d/%d 通过" % (passed, passed+failed))
    return passed, failed


def test_workflow_rejection():
    """测试工作流拒识机制"""
    print("\n" + "="*60)
    print("测试2: 拒识机制 - 小模型无法识别任何意图时直接拒识")
    print("="*60)
    
    recognizer = get_recognizer()
    llm_client = MockLLMClient()
    workflow = UnifiedWorkflowManager(recognizer, llm_client)
    
    # 测试1: 完全不相关的输入
    print("\n测试2.1: 完全不相关的输入")
    result = workflow.process(
        "今天天气怎么样",
        ["地区", "销售额", "利润"],
        []
    )
    
    print("  输入: 今天天气怎么样")
    print("  结果: %s, %s" % (result.get('status'), result.get('action')))
    
    if result.get('status') == 'rejected' and result.get('branch') == 'local':
        print("  [PASS] 小模型直接拒识（符合预期）")
    else:
        print("  [FAIL] 失败（期望: rejected + local）")
    
    # 测试2: 有数据分析意图
    print("\n测试2.2: 有数据分析意图")
    result = workflow.process(
        "绘制销售额柱状图",
        ["地区", "销售额", "利润"],
        [{"地区": "北京", "销售额": 100, "利润": 20}]
    )
    
    print("  输入: 绘制销售额柱状图")
    print("  结果: %s, %s" % (result.get('status'), result.get('action')))
    
    if result.get('status') in ['ready', 'clarification_needed']:
        print("  [PASS] 进入后续流程（符合预期）")
    else:
        print("  [FAIL] 失败")


def test_workflow_rejection():
    """测试工作流拒识机制"""
    print("\n" + "="*60)
    print("测试2: 拒识机制 - 小模型无法识别任何意图时直接拒识")
    print("="*60)
    
    recognizer = get_recognizer()
    llm_client = MockLLMClient()
    workflow = UnifiedWorkflowManager(recognizer, llm_client)
    
    # 测试1: 完全不相关的输入
    print("\n测试2.1: 完全不相关的输入")
    result = workflow.process(
        "今天天气怎么样",
        ["地区", "销售额", "利润"],
        []
    )
    
    print(f"  输入: 今天天气怎么样")
    print(f"  结果: {result.get('status')}, {result.get('action')}")
    
    if result.get('status') == 'rejected' and result.get('branch') == 'local':
        print(f"  ✓ 小模型直接拒识（符合预期）")
    else:
        print(f"  ✗ 失败（期望: rejected + local）")
    
    # 测试2: 有数据分析意图
    print("\n测试2.2: 有数据分析意图")
    result = workflow.process(
        "绘制销售额柱状图",
        ["地区", "销售额", "利润"],
        [{"地区": "北京", "销售额": 100, "利润": 20}]
    )
    
    print(f"  输入: 绘制销售额柱状图")
    print(f"  结果: {result.get('status')}, {result.get('action')}")
    
    if result.get('status') in ['ready', 'clarification_needed']:
        print(f"  ✓ 进入后续流程（符合预期）")
    else:
        print(f"  ✗ 失败")


def test_workflow_multiple_intents():
    """测试工作流多意图处理"""
    print("\n" + "="*60)
    print("测试3: 多意图处理 - 识别并执行所有意图")
    print("="*60)
    
    recognizer = get_recognizer()
    llm_client = MockLLMClient()
    workflow = UnifiedWorkflowManager(recognizer, llm_client)
    
    test_cases = [
        {
            "query": "绘制柱状图并按照由大到小排序",
            "columns": ["地区", "销售额", "利润"],
            "expected": 2
        },
        {
            "query": "筛选男性，按销售额排序",
            "columns": ["性别", "销售额", "地区"],
            "expected": 2
        }
    ]
    
    for i, case in enumerate(test_cases, 1):
        print(f"\n测试3.{i}: {case['query']}")
        result = workflow.process(
            case['query'],
            case['columns'],
            []
        )
        
        intents = result.get('intents', [])
        print(f"  识别意图数: {len(intents)} (期望: {case['expected']})")
        
        if len(intents) >= case['expected']:
            print("  [PASS] 通过")
            for intent in intents:
                print("    - %s: %s" % (intent.get('name'), intent.get('type')))
        else:
            print("  [FAIL] 失败")


def test_workflow_clarification():
    """测试追问机制"""
    print("\n" + "="*60)
    print("测试4: 追问机制 - 需求不明确时生成追问")
    print("="*60)
    
    recognizer = get_recognizer()
    llm_client = MockLLMClient()
    workflow = UnifiedWorkflowManager(recognizer, llm_client)
    
    # 测试: 缺少关键信息
    print("\n测试4.1: 缺少关键信息 - 绘制柱状图")
    result = workflow.process(
        "绘制柱状图",
        ["地区", "销售额", "利润"],
        [{"地区": "北京", "销售额": 100, "利润": 20}]
    )
    
    print(f"  输入: 绘制柱状图")
    print(f"  结果: {result.get('status')}, {result.get('action')}")
    
    if result.get('action') == 'clarify':
        print("  [PASS] 触发追问（符合预期）")
        questions = result.get('questions', [])
        print("  追问问题数: %d" % len(questions))
        for q in questions[:2]:
            print("    - %s" % q.get('question'))
        
        # 测试追问选项包含"意图识别有误"
        if questions:
            options = questions[0].get('options', [])
            has_error_option = any(o.get('value') == 'reask' for o in options)
            if has_error_option:
                print("  [PASS] 包含'意图识别有误'选项")
            else:
                print("  [FAIL] 缺少'意图识别有误'选项")
    else:
        print("  状态: %s" % result.get('status'))


def test_workflow_followup_limit():
    """测试追问上限"""
    print("\n" + "="*60)
    print("测试5: 追问上限 - 3轮后转向大模型")
    print("="*60)
    
    recognizer = get_recognizer()
    llm_client = MockLLMClient()
    workflow = UnifiedWorkflowManager(recognizer, llm_client)
    
    # 先触发追问
    result = workflow.process(
        "绘制柱状图",
        ["地区", "销售额", "利润"],
        []
    )
    
    print(f"  初始状态: {result.get('status')}, 追问轮次: {workflow.context.followup_round}")
    
    # 模拟用户多次选择（3轮）
    for i in range(3):
        result = workflow.process_user_response("reask")
        print(f"  第{i+1}轮: {result.get('status')}, action={result.get('action')}, branch={result.get('branch')}")
    
    # 第4轮应该转向大模型
    if workflow.context.followup_round >= 3:
        print("  [PASS] 追问轮次达到上限: %d" % workflow.context.followup_round)


def test_llm_escalation():
    """测试转向大模型"""
    print("\n" + "="*60)
    print("测试6: 转向大模型 - 用户选择'意图识别有误'")
    print("="*60)
    
    recognizer = get_recognizer()
    llm_client = MockLLMClient()
    workflow = UnifiedWorkflowManager(recognizer, llm_client)
    
    # 先触发追问
    result = workflow.process(
        "绘制柱状图",
        ["地区", "销售额", "利润"],
        []
    )
    
    # 用户选择"意图识别有误"
    result = workflow.process_user_response("reask")
    
    print(f"  用户选择: 意图识别有误")
    print(f"  结果: branch={result.get('branch')}")
    
    # 注意：由于使用模拟客户端，可能返回不同结果
    print("  [INFO] 测试完成（实际转向逻辑依赖大模型客户端）")


def test_context_management():
    """测试上下文管理"""
    print("\n" + "="*60)
    print("测试7: 上下文管理 - 完整上下文传递")
    print("="*60)
    
    recognizer = get_recognizer()
    llm_client = MockLLMClient()
    workflow = UnifiedWorkflowManager(recognizer, llm_client)
    
    # 处理一个查询
    result = workflow.process(
        "绘制柱状图并排序",
        ["地区", "销售额"],
        [{"地区": "北京", "销售额": 100}]
    )
    
    # 检查上下文
    ctx = workflow.context
    
    print(f"  原始输入: {ctx.user_query}")
    print(f"  分支: {ctx.branch}")
    print(f"  意图数: {len(ctx.intents)}")
    print(f"  历史记录数: {len(ctx.history)}")
    
    if ctx.user_query and ctx.branch and ctx.history:
        print("  [PASS] 上下文管理正常")
    else:
        print("  [FAIL] 上下文管理有问题")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "="*60)
    print("开始测试统一工作流 - P0/P1/P2/P3优化项")
    print("="*60)
    
    # 测试1: 本地模型意图识别
    p, f = test_local_recognition()
    
    # 测试2: 拒识机制
    test_workflow_rejection()
    
    # 测试3: 多意图处理
    test_workflow_multiple_intents()
    
    # 测试4: 追问机制
    test_workflow_clarification()
    
    # 测试5: 追问上限
    test_workflow_followup_limit()
    
    # 测试6: 转向大模型
    test_llm_escalation()
    
    # 测试7: 上下文管理
    test_context_management()
    
    print("\n" + "="*60)
    print("所有测试完成!")
    print("="*60)


if __name__ == '__main__':
    run_all_tests()
