# -*- coding: utf-8 -*-
# 测试脚本 - P0/P1/P2/P3优化项
import sys
import os
import json
import codecs

# 添加当前目录到路径
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# 设置输出编码
sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer)

# 导入模块
from unified_recognizer import get_recognizer
from workflow_manager import UnifiedWorkflowManager
from llm_client import MockLLMClient


def test_local_recognition():
    """测试本地模型意图识别"""
    print("\n" + "="*60)
    print("Test 1: Local Model Intent Recognition")
    print("="*60)
    
    recognizer = get_recognizer()
    
    test_cases = [
        ("draw bar chart and sort descending", ["Region", "Sales", "Profit"], 2),
        ("filter male, sort by sales", ["Gender", "Sales"], 2),
        ("filter female, calculate sales sum", ["Gender", "Sales"], 2),
        ("draw line chart, filter East China, sort by profit", ["Region", "Sales", "Profit"], 3),
        ("how is the weather today", ["Region", "Sales"], 0)
    ]
    
    passed = 0
    failed = 0
    
    for i, (query, cols, expected) in enumerate(test_cases, 1):
        print("\nTest case %d: %s" % (i, query))
        result = recognizer.recognize(query, cols)
        intent_count = len(result.get('intents', []))
        
        print("  Intent count: %d (expected: %d)" % (intent_count, expected))
        
        if intent_count == expected:
            print("  [PASS]")
            passed += 1
        else:
            print("  [FAIL]")
            print("  Result: %s" % json.dumps(result, ensure_ascii=False))
            failed += 1
    
    print("\nLocal recognition: %d/%d passed" % (passed, passed+failed))
    return passed, failed


def test_workflow_rejection():
    """测试工作流拒识机制"""
    print("\n" + "="*60)
    print("Test 2: Rejection Mechanism")
    print("="*60)
    
    recognizer = get_recognizer()
    llm_client = MockLLMClient()
    workflow = UnifiedWorkflowManager(recognizer, llm_client)
    
    # 测试不相关输入
    print("\nTest 2.1: Non-data analysis input")
    result = workflow.process("how is the weather", ["Region", "Sales"], [])
    print("  Input: how is the weather")
    print("  Result: %s, %s" % (result.get('status'), result.get('action')))
    
    if result.get('status') == 'rejected' and result.get('branch') == 'local':
        print("  [PASS] Local model rejects correctly")
    else:
        print("  [FAIL]")
    
    # 测试相关输入
    print("\nTest 2.2: Data analysis input")
    result = workflow.process("draw sales chart", ["Region", "Sales"], [{"Region": "Beijing", "Sales": 100}])
    print("  Input: draw sales chart")
    print("  Result: %s, %s" % (result.get('status'), result.get('action')))
    
    if result.get('status') in ['ready', 'clarification_needed']:
        print("  [PASS] Enter subsequent flow")
    else:
        print("  [INFO] Status: %s" % result.get('status'))


def test_workflow_multiple_intents():
    """测试多意图处理"""
    print("\n" + "="*60)
    print("Test 3: Multiple Intent Processing")
    print("="*60)
    
    recognizer = get_recognizer()
    llm_client = MockLLMClient()
    workflow = UnifiedWorkflowManager(recognizer, llm_client)
    
    test_cases = [
        ("draw chart and sort", ["Region", "Sales"], 2),
        ("filter male, sort by sales", ["Gender", "Sales"], 2)
    ]
    
    for i, (query, cols, expected) in enumerate(test_cases, 1):
        print("\nTest 3.%d: %s" % (i, query))
        result = workflow.process(query, cols, [])
        intents = result.get('intents', [])
        print("  Intent count: %d (expected: %d)" % (len(intents), expected))
        
        if len(intents) >= expected:
            print("  [PASS]")
            for intent in intents:
                print("    - %s: %s" % (intent.get('name'), intent.get('type')))
        else:
            print("  [FAIL]")


def test_workflow_clarification():
    """测试追问机制"""
    print("\n" + "="*60)
    print("Test 4: Clarification Mechanism")
    print("="*60)
    
    recognizer = get_recognizer()
    llm_client = MockLLMClient()
    workflow = UnifiedWorkflowManager(recognizer, llm_client)
    
    print("\nTest 4.1: Missing key info - draw chart")
    result = workflow.process("draw chart", ["Region", "Sales", "Profit"], [{"Region": "Beijing", "Sales": 100}])
    print("  Input: draw chart")
    print("  Result: %s, %s" % (result.get('status'), result.get('action')))
    
    if result.get('action') == 'clarify':
        print("  [PASS] Trigger clarification")
        questions = result.get('questions', [])
        print("  Question count: %d" % len(questions))
        
        # Check for "intent error" option
        if questions:
            options = questions[0].get('options', [])
            has_error_option = any(o.get('value') == 'reask' for o in options)
            if has_error_option:
                print("  [PASS] Contains 'intent error' option")
            else:
                print("  [FAIL] Missing 'intent error' option")
    else:
        print("  Status: %s" % result.get('status'))


def test_workflow_followup_limit():
    """测试追问上限"""
    print("\n" + "="*60)
    print("Test 5: Follow-up Limit")
    print("="*60)
    
    recognizer = get_recognizer()
    llm_client = MockLLMClient()
    workflow = UnifiedWorkflowManager(recognizer, llm_client)
    
    result = workflow.process("draw chart", ["Region", "Sales"], [])
    print("  Initial: %s, round: %d" % (result.get('status'), workflow.context.followup_round))
    
    for i in range(3):
        result = workflow.process_user_response("reask")
        print("  Round %d: %s, action=%s, branch=%s" % (i+1, result.get('status'), result.get('action'), result.get('branch')))
    
    if workflow.context.followup_round >= 3:
        print("  [PASS] Follow-up limit reached: %d" % workflow.context.followup_round)


def test_llm_escalation():
    """测试转向大模型"""
    print("\n" + "="*60)
    print("Test 6: LLM Escalation")
    print("="*60)
    
    recognizer = get_recognizer()
    llm_client = MockLLMClient()
    workflow = UnifiedWorkflowManager(recognizer, llm_client)
    
    result = workflow.process("draw chart", ["Region", "Sales"], [])
    result = workflow.process_user_response("reask")
    
    print("  User selects: intent error")
    print("  Result: branch=%s" % result.get('branch'))
    print("  [INFO] Test complete (actual logic depends on LLM client)")


def test_context_management():
    """测试上下文管理"""
    print("\n" + "="*60)
    print("Test 7: Context Management")
    print("="*60)
    
    recognizer = get_recognizer()
    llm_client = MockLLMClient()
    workflow = UnifiedWorkflowManager(recognizer, llm_client)
    
    result = workflow.process("draw chart and sort", ["Region", "Sales"], [{"Region": "Beijing", "Sales": 100}])
    
    ctx = workflow.context
    
    print("  Original query: %s" % ctx.user_query)
    print("  Branch: %s" % ctx.branch)
    print("  Intent count: %d" % len(ctx.intents))
    print("  History count: %d" % len(ctx.history))
    
    if ctx.user_query and ctx.branch and ctx.history:
        print("  [PASS] Context management OK")
    else:
        print("  [FAIL] Context management issue")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "="*60)
    print("Running All Tests - P0/P1/P2/P3 Optimizations")
    print("="*60)
    
    test_local_recognition()
    test_workflow_rejection()
    test_workflow_multiple_intents()
    test_workflow_clarification()
    test_workflow_followup_limit()
    test_llm_escalation()
    test_context_management()
    
    print("\n" + "="*60)
    print("All Tests Complete!")
    print("="*60)


if __name__ == '__main__':
    run_all_tests()
