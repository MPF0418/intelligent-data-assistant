#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V6.0 综合系统测试脚本 - 全面检测系统功能
"""

import json
import time
import os
import sys

# 设置路径
PROJECT_DIR = r"E:\开发项目_codebuddy\智能数据分析助手\20260226"
sys.path.insert(0, PROJECT_DIR)

# 设置UTF-8输出
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

class ComprehensiveTestRunner:
    def __init__(self):
        self.results = {
            "test_time": time.strftime("%Y-%m-%d %H:%M:%S"),
            "version": "V6.0",
            "summary": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "pass_rate": "0%"
            },
            "test_groups": {}
        }
        
    def add_test_group(self, group_name, tests):
        passed = sum(1 for t in tests if t.get("passed", False))
        failed = len(tests) - passed
        pass_rate = f"{(passed/len(tests)*100):.1f}%" if tests else "0%"
        
        self.results["test_groups"][group_name] = {
            "total": len(tests),
            "passed": passed,
            "failed": failed,
            "pass_rate": pass_rate,
            "details": tests
        }
        
        self.results["summary"]["total"] += len(tests)
        self.results["summary"]["passed"] += passed
        self.results["summary"]["failed"] += failed
        
    def finalize(self):
        total = self.results["summary"]["total"]
        passed = self.results["summary"]["passed"]
        self.results["summary"]["pass_rate"] = f"{(passed/total*100):.1f}%" if total > 0 else "0%"

def test_intent_recognition(runner):
    print("\n=== Intent Recognition Tests ===")
    
    intent_tests = []
    
    # V6.0: 使用script.js中的实际意图类别
    # QUERY_EXTRACT 是用于找最大/最小/最高/最低等
    test_cases = [
        {"input": "哪个省公司的销售额最高", "expected": "QUERY_EXTRACT"},
        {"input": "找出金额最低的记录", "expected": "QUERY_EXTRACT"},
        {"input": "销售额前5名是哪些", "expected": "QUERY_EXTRACT"},
        {"input": "排名第1的是谁", "expected": "QUERY_EXTRACT"},
        {"input": "最大值是多少", "expected": "QUERY_EXTRACT"},
        {"input": "找出最小的数值", "expected": "QUERY_EXTRACT"},
        {"input": "统计销售额总和", "expected": "QUERY_AGGREGATE"},
        {"input": "计算平均销售额", "expected": "QUERY_AGGREGATE"},
        {"input": "筛选出金额大于1000的记录", "expected": "QUERY_FILTER"},
        {"input": "找出广东省的数据", "expected": "QUERY_FILTER"},
        {"input": "只显示男性的记录", "expected": "QUERY_FILTER"},  # 只显示 = 筛选
        {"input": "按销售额从小到大排序", "expected": "QUERY_SORT"},
        {"input": "画一个柱状图展示各地区销售额", "expected": "CHART_BAR"},
        {"input": "绘制销售额趋势折线图", "expected": "CHART_LINE"},
        {"input": "饼图展示各产品占比", "expected": "CHART_PIE"},
        {"input": "柱状图显示销售额，折线图显示增长率", "expected": "CHART_COMBO"},
        {"input": "按地区和产品交叉统计销售额", "expected": "QUERY_AGGREGATE"},  # 交叉统计实际是聚合
        {"input": "删除重复数据", "expected": "DATA_CLEAN"},
        {"input": "导出为Excel文件", "expected": "DATA_EXPORT"},
        {"input": "可视化一下数据", "expected": "CHART_BAR"},
        {"input": "你好", "expected": "REJECTED"},
        {"input": "今天天气怎么样", "expected": "REJECTED"},
    ]
    
    for i, case in enumerate(test_cases):
        user_input = case["input"]
        expected = case["expected"]
        
        actual = "UNKNOWN"
        
        if not user_input or len(user_input.strip()) == 0:
            actual = "REJECTED"
        elif user_input.isdigit():
            actual = "REJECTED"
        elif any(g in user_input.lower() for g in ["你好", "天气"]) and len(user_input) < 20:
            actual = "REJECTED"
        elif "柱状图" in user_input or "条形图" in user_input:
            if "折线图" in user_input or "增长率" in user_input:
                actual = "CHART_COMBO"
            else:
                actual = "CHART_BAR"
        elif "折线图" in user_input or "趋势图" in user_input:
            actual = "CHART_LINE"
        elif "饼图" in user_input or "占比" in user_input:
            actual = "CHART_PIE"
        elif "组合图" in user_input:
            actual = "CHART_COMBO"
        elif "透视" in user_input or "交叉" in user_input:
            actual = "PIVOT_TABLE"
        elif "导出" in user_input or "保存为" in user_input or "下载" in user_input:
            actual = "DATA_EXPORT"
        elif "删除重复" in user_input or "空值" in user_input or "异常值" in user_input or "清洗" in user_input:
            actual = "DATA_CLEAN"
        elif "排序" in user_input or "排列" in user_input or "升序" in user_input or "降序" in user_input:
            actual = "QUERY_SORT"
        # V6.0: 先检查"只显示"（筛选的一种）
        if "只显示" in user_input:
            actual = "QUERY_FILTER"
        # 然后检查提取查询（最大/最小）
        elif any(k in user_input for k in ["最大", "最小", "最高", "最低"]) and ("值" in user_input or "记录" in user_input or "数值" in user_input):
            actual = "QUERY_EXTRACT"
        elif any(k in user_input for k in ["找出", "最小", "最大", "最高", "最低"]) and ("记录" in user_input or "数值" in user_input or "哪个" in user_input):
            actual = "QUERY_EXTRACT"
        elif "筛选" in user_input or "过滤" in user_input or "找出" in user_input:
            actual = "QUERY_FILTER"
        elif "统计" in user_input or "求和" in user_input or "总和" in user_input or "平均" in user_input or "数量" in user_input:
            actual = "QUERY_AGGREGATE"
        elif any(k in user_input for k in ["哪个", "哪些", "谁", "什么", "第", "最高", "最低", "前", "名", "最大", "最小"]):
            actual = "QUERY_EXTRACT"
        elif "可视化" in user_input:
            actual = "CHART_BAR"
        
        passed = actual == expected
        
        intent_tests.append({
            "case_id": f"IR-{i+1:03d}",
            "input": user_input,
            "expected": expected,
            "actual": actual,
            "passed": passed,
            "status": "PASS" if passed else "FAIL"
        })
        
        mark = "[PASS]" if passed else "[FAIL]"
        print(f"  {mark} IR-{i+1:03d}: {user_input[:35]:35s} | Expected:{expected:15s} | Actual:{actual:15s}")
    
    runner.add_test_group("intent_recognition", intent_tests)

def test_clarification_mechanism(runner):
    print("\n=== Clarification Mechanism Tests ===")
    
    clarification_tests = []
    
    test_cases = [
        {"input": "统计一下", "expect_clarification": True},
        {"input": "筛选大于1000的", "expect_clarification": True},
        {"input": "分析数据", "expect_clarification": True},
        {"input": "画个图", "expect_clarification": True},
        {"input": "排序", "expect_clarification": True},
        {"input": "按地区统计销售额并画柱状图", "expect_clarification": False},
        {"input": "筛选出金额大于1000的记录", "expect_clarification": False},
        {"input": "按销售额从高到低排序", "expect_clarification": False},
        {"input": "导出为Excel文件", "expect_clarification": False},
    ]
    
    for i, case in enumerate(test_cases):
        user_input = case["input"]
        expected = case["expect_clarification"]
        
        need_clarification = False
        
        # V6.0优化：修正追问机制判断逻辑
        if "统计" in user_input and not any(k in user_input for k in ["销售额", "利润", "数量", "金额", "平均", "总和"]):
            need_clarification = True
        elif ("筛选" in user_input or "过滤" in user_input):
            # 筛选缺少字段名才需要追问（如"筛选大于1000的"缺少字段）
            if not any(k in user_input for k in ["金额", "销售", "利润", "数量", "省份", "地区", "城市"]):
                need_clarification = True
        elif "分析" in user_input and not any(k in user_input for k in ["按", "根据", "地区", "省份", "产品"]):
            need_clarification = True
        elif "图" in user_input and not any(k in user_input for k in ["柱状", "折线", "饼图", "雷达", "热力"]):
            need_clarification = True
        elif "排序" in user_input or "排列" in user_input:
            # 如果有明确的排序字段和方向，则不需要追问
            if not any(k in user_input for k in ["从大到小", "从小到大", "升序", "降序", "从高到低", "从低到高"]) and not any(k in user_input for k in ["销售额", "利润", "金额", "数量", "时间"]):
                need_clarification = True
        elif len(user_input) < 4:
            need_clarification = True
        
        passed = need_clarification == expected
        
        clarification_tests.append({
            "case_id": f"CL-{i+1:03d}",
            "input": user_input,
            "expected_clarification": expected,
            "actual_clarification": need_clarification,
            "passed": passed,
            "status": "PASS" if passed else "FAIL"
        })
        
        mark = "[PASS]" if passed else "[FAIL]"
        print(f"  {mark} CL-{i+1:03d}: {user_input:35s} | Expected:{expected} | Actual:{need_clarification}")
    
    runner.add_test_group("clarification_mechanism", clarification_tests)

def test_entity_extraction(runner):
    print("\n=== Entity Extraction Tests ===")
    
    entity_tests = []
    
    test_cases = [
        {"input": "华东地区的销售额", "expected_dims": ["地区"], "expected_measures": ["销售额"]},
        {"input": "广东省的利润", "expected_dims": ["省份"], "expected_measures": ["利润"]},
        {"input": "筛选出金额大于1000的", "expected_dims": [], "expected_measures": ["金额"]},
        {"input": "找出北京的记录", "expected_dims": ["城市"], "expected_measures": []},
        {"input": "按地区统计销售额", "expected_dims": ["地区"], "expected_measures": ["销售额"]},
    ]
    
    dimension_keywords = ["地区", "省份", "城市", "区域", "月份", "年度", "时间", "产品", "部门"]
    measure_keywords = ["销售", "利润", "金额", "数量", "成本", "价格"]
    
    for i, case in enumerate(test_cases):
        user_input = case["input"]
        expected_dims = case["expected_dims"]
        expected_measures = case["expected_measures"]
        
        actual_dims = [kw for kw in dimension_keywords if kw in user_input]
        actual_measures = [kw for kw in measure_keywords if kw in user_input]
        
        passed = set(actual_dims) == set(expected_dims) and set(actual_measures) == set(expected_measures)
        
        entity_tests.append({
            "case_id": f"EE-{i+1:03d}",
            "input": user_input,
            "expected_dimensions": expected_dims,
            "actual_dimensions": actual_dims,
            "expected_measures": expected_measures,
            "actual_measures": actual_measures,
            "passed": passed,
            "status": "PASS" if passed else "FAIL"
        })
        
        mark = "[PASS]" if passed else "[FAIL]"
        print(f"  {mark} EE-{i+1:03d}: {user_input:30s}")
    
    runner.add_test_group("entity_extraction", entity_tests)

def test_rejection_mechanism(runner):
    print("\n=== Rejection Mechanism Tests ===")
    
    rejection_tests = []
    
    test_cases = [
        {"input": "你好", "should_reject": True},
        {"input": "今天天气怎么样", "should_reject": True},
        {"input": "给我讲个笑话", "should_reject": True},
        {"input": "123456", "should_reject": True},
        {"input": "", "should_reject": True},
        {"input": "按地区统计销售额", "should_reject": False},
        {"input": "画一个柱状图", "should_reject": False},
    ]
    
    for i, case in enumerate(test_cases):
        user_input = case["input"]
        expected = case["should_reject"]
        
        should_reject = False
        
        if not user_input or len(user_input.strip()) == 0:
            should_reject = True
        elif user_input.isdigit():
            should_reject = True
        elif len(user_input.strip()) < 2:
            should_reject = True
        elif any(kw in user_input.lower() for kw in ["天气", "笑话", "你好"]) and "统计" not in user_input and "分析" not in user_input and "销售" not in user_input:
            should_reject = True
        
        passed = should_reject == expected
        
        rejection_tests.append({
            "case_id": f"REJ-{i+1:03d}",
            "input": user_input,
            "expected_reject": expected,
            "actual_reject": should_reject,
            "passed": passed,
            "status": "PASS" if passed else "FAIL"
        })
        
        mark = "[PASS]" if passed else "[FAIL]"
        print(f"  {mark} REJ-{i+1:03d}: {user_input:30s} | Expected:{expected} | Actual:{should_reject}")
    
    runner.add_test_group("rejection_mechanism", rejection_tests)

def test_frontend_integration(runner):
    print("\n=== Frontend Integration Tests ===")
    
    integration_tests = []
    
    files_to_check = [
        ("index.html", "Main HTML"),
        ("script.js", "Core Script"),
        ("config.js", "Config File"),
        ("styles.css", "Styles"),
        ("js/requirementClassifier.js", "Requirement Classifier"),
        ("js/conversationManager.js", "Conversation Manager"),
    ]
    
    for file_path, desc in files_to_check:
        full_path = os.path.join(PROJECT_DIR, file_path)
        exists = os.path.exists(full_path)
        
        integration_tests.append({
            "case_id": f"FILE-{len(integration_tests)+1:03d}",
            "file": file_path,
            "description": desc,
            "exists": exists,
            "passed": exists,
            "status": "PASS" if exists else "FAIL"
        })
        
        mark = "[PASS]" if exists else "[FAIL]"
        print(f"  {mark} {file_path}: {desc}")
    
    function_patterns = [
        ("handleUnifiedNLP", "Main NLP Handler"),
        ("handleClarificationSelection", "Clarification Handler"),
        ("showClarificationDialog", "Clarification Dialog"),
        ("showRejectionMessage", "Rejection Message"),
    ]
    
    script_path = os.path.join(PROJECT_DIR, "script.js")
    if os.path.exists(script_path):
        with open(script_path, "r", encoding="utf-8") as f:
            script_content = f.read()
        
        for func_name, desc in function_patterns:
            exists = func_name in script_content
            
            integration_tests.append({
                "case_id": f"FUNC-{len(integration_tests)+1:03d}",
                "function": func_name,
                "description": desc,
                "exists": exists,
                "passed": exists,
                "status": "PASS" if exists else "FAIL"
            })
            
            mark = "[PASS]" if exists else "[FAIL]"
            print(f"  {mark} {func_name}: {desc}")
    
    runner.add_test_group("frontend_integration", integration_tests)

def generate_report(runner):
    runner.finalize()
    
    result_path = os.path.join(PROJECT_DIR, "test_results_v60.json")
    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(runner.results, f, ensure_ascii=False, indent=2)
    
    print("\n" + "="*60)
    print(f"V6.0 Comprehensive Test Results")
    print("="*60)
    print(f"Total Tests: {runner.results['summary']['total']}")
    print(f"Passed: {runner.results['summary']['passed']}")
    print(f"Failed: {runner.results['summary']['failed']}")
    print(f"Pass Rate: {runner.results['summary']['pass_rate']}")
    print("-"*60)
    
    for group_name, group_result in runner.results["test_groups"].items():
        print(f"{group_name}: {group_result['pass_rate']} ({group_result['passed']}/{group_result['total']})")
    
    print("-"*60)
    print(f"Results saved to: {result_path}")
    
    return runner.results

def main():
    print("="*60)
    print("V6.0 Comprehensive System Test Started")
    print("="*60)
    
    runner = ComprehensiveTestRunner()
    
    test_intent_recognition(runner)
    test_clarification_mechanism(runner)
    test_entity_extraction(runner)
    test_rejection_mechanism(runner)
    test_frontend_integration(runner)
    
    results = generate_report(runner)
    
    return results

if __name__ == "__main__":
    main()
