# -*- coding: utf-8 -*-
"""
智能数据分析助手 - 自动化测试脚本
V3.3版本功能测试
"""

import sys
import io
# 修复Windows控制台编码
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import json
import torch
from transformers import BertTokenizer, BertForSequenceClassification
from datetime import datetime

# 测试结果存储
test_results = {
    "test_time": "",
    "total_cases": 0,
    "passed": 0,
    "failed": 0,
    "details": []
}

def load_model():
    """加载模型"""
    tokenizer = BertTokenizer.from_pretrained('./model')
    model = BertForSequenceClassification.from_pretrained('./model')
    model.eval()
    
    with open('./model/label_config.json', 'r', encoding='utf-8') as f:
        label_config = json.load(f)
    
    return tokenizer, model, label_config

def predict_intent(text, tokenizer, model, label_config):
    """预测意图"""
    inputs = tokenizer(
        text, padding='max_length', truncation=True,
        max_length=64, return_tensors='pt'
    )
    
    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.softmax(outputs.logits, dim=1)
        max_prob, pred_label = torch.max(probs, dim=1)
    
    intent = label_config['label_names'][str(pred_label.item())]
    confidence = max_prob.item()
    
    return intent, confidence

def run_test_case(case_id, test_input, expected_intent, tokenizer, model, label_config):
    """运行单个测试用例"""
    try:
        actual_intent, confidence = predict_intent(test_input, tokenizer, model, label_config)
        
        passed = actual_intent == expected_intent
        
        result = {
            "case_id": case_id,
            "input": test_input,
            "expected": expected_intent,
            "actual": actual_intent,
            "confidence": round(confidence, 4),
            "passed": passed,
            "error": None
        }
        
        return result
    except Exception as e:
        return {
            "case_id": case_id,
            "input": test_input,
            "expected": expected_intent,
            "actual": "ERROR",
            "confidence": 0,
            "passed": False,
            "error": str(e)
        }

def main():
    print("=" * 70)
    print("智能数据分析助手 V3.3 - 自动化测试")
    print("=" * 70)
    
    # 加载模型
    print("\n加载模型...")
    tokenizer, model, label_config = load_model()
    print(f"模型标签数量: {model.config.num_labels}")
    print(f"支持的意图: {list(label_config['labels'].keys())}")
    
    # 测试用例定义
    test_cases = [
        # 意图识别测试 - 查找类
        {"id": "TC-IR-001", "input": "哪个省公司的销售额最高", "expected": "QUERY_FIND"},
        {"id": "TC-IR-002", "input": "找出金额最低的记录", "expected": "QUERY_FIND"},
        {"id": "TC-IR-003", "input": "销售额前5名是哪些", "expected": "QUERY_FIND"},
        
        # 意图识别测试 - 统计类
        {"id": "TC-IR-004", "input": "统计销售额总和", "expected": "QUERY_AGGREGATE"},
        {"id": "TC-IR-005", "input": "计算平均销售额", "expected": "QUERY_AGGREGATE"},
        {"id": "TC-IR-006", "input": "统计记录数量", "expected": "QUERY_AGGREGATE"},
        {"id": "TC-IR-007", "input": "销售额的中位数是多少", "expected": "QUERY_AGGREGATE"},
        {"id": "TC-IR-008", "input": "数据的波动程度如何", "expected": "QUERY_AGGREGATE"},
        {"id": "TC-IR-009", "input": "第90百分位数是多少", "expected": "QUERY_AGGREGATE"},
        {"id": "TC-IR-010", "input": "计算方差", "expected": "QUERY_AGGREGATE"},
        
        # 意图识别测试 - 筛选类
        {"id": "TC-IR-011", "input": "筛选出金额大于1000的记录", "expected": "QUERY_FILTER"},
        {"id": "TC-IR-012", "input": "找出广东省的数据", "expected": "QUERY_FILTER"},
        
        # 意图识别测试 - 排序类
        {"id": "TC-IR-013", "input": "按销售额从小到大排序", "expected": "QUERY_SORT"},
        {"id": "TC-IR-014", "input": "按时间从新到旧排列", "expected": "QUERY_SORT"},
        
        # 意图识别测试 - 图表类
        {"id": "TC-IR-015", "input": "画一个柱状图展示各地区销售额", "expected": "CHART_BAR"},
        {"id": "TC-IR-016", "input": "绘制销售额趋势折线图", "expected": "CHART_LINE"},
        {"id": "TC-IR-017", "input": "用饼图展示各产品占比", "expected": "CHART_PIE"},
        {"id": "TC-IR-018", "input": "可视化一下数据", "expected": "CHART_GENERAL"},
        
        # 意图识别测试 - 数据透视表
        {"id": "TC-IR-019", "input": "按地区和产品交叉统计销售额", "expected": "PIVOT_TABLE"},
        {"id": "TC-IR-020", "input": "做一个透视表分析各省各产品的销售情况", "expected": "PIVOT_TABLE"},
        
        # 意图识别测试 - 数据清洗
        {"id": "TC-IR-021", "input": "删除重复数据", "expected": "DATA_CLEAN"},
        {"id": "TC-IR-022", "input": "把空值填充为平均值", "expected": "DATA_CLEAN"},
        {"id": "TC-IR-023", "input": "检测异常值", "expected": "DATA_CLEAN"},
        
        # 意图识别测试 - 组合图表
        {"id": "TC-IR-024", "input": "画一个柱状图显示销售额，折线图显示增长率", "expected": "CHART_COMBO"},
        {"id": "TC-IR-025", "input": "组合图展示销售额和利润", "expected": "CHART_COMBO"},
        
        # 意图识别测试 - 其他图表
        {"id": "TC-IR-026", "input": "画一个雷达图对比各部门指标", "expected": "CHART_RADAR"},
        {"id": "TC-IR-027", "input": "漏斗图分析转化率", "expected": "CHART_FUNNEL"},
        {"id": "TC-IR-028", "input": "生成热力图", "expected": "CHART_HEATMAP"},
        
        # 意图识别测试 - 数据导出
        {"id": "TC-IR-029", "input": "导出为Excel文件", "expected": "DATA_EXPORT"},
        {"id": "TC-IR-030", "input": "保存为CSV格式", "expected": "DATA_EXPORT"},
    ]
    
    # 运行测试
    print("\n" + "=" * 70)
    print("开始执行测试用例")
    print("=" * 70)
    
    test_results["test_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    test_results["total_cases"] = len(test_cases)
    
    passed_count = 0
    failed_count = 0
    
    print(f"\n{'用例ID':<12} {'输入':<35} {'预期':<18} {'实际':<18} {'置信度':<8} {'结果'}")
    print("-" * 100)
    
    for case in test_cases:
        result = run_test_case(
            case["id"], case["input"], case["expected"],
            tokenizer, model, label_config
        )
        test_results["details"].append(result)
        
        if result["passed"]:
            passed_count += 1
            status = "✓ 通过"
        else:
            failed_count += 1
            status = "✗ 失败"
        
        print(f"{case['id']:<12} {case['input'][:30]:<35} {case['expected']:<18} {result['actual']:<18} {result['confidence']:<8.4f} {status}")
    
    test_results["passed"] = passed_count
    test_results["failed"] = failed_count
    
    # 输出统计
    print("\n" + "=" * 70)
    print("测试结果统计")
    print("=" * 70)
    print(f"总用例数: {test_results['total_cases']}")
    print(f"通过数: {test_results['passed']}")
    print(f"失败数: {test_results['failed']}")
    print(f"通过率: {test_results['passed']/test_results['total_cases']*100:.2f}%")
    
    # 按意图分类统计
    print("\n按意图类型统计:")
    intent_stats = {}
    for detail in test_results["details"]:
        expected = detail["expected"]
        if expected not in intent_stats:
            intent_stats[expected] = {"total": 0, "passed": 0}
        intent_stats[expected]["total"] += 1
        if detail["passed"]:
            intent_stats[expected]["passed"] += 1
    
    for intent, stats in sorted(intent_stats.items()):
        rate = stats["passed"] / stats["total"] * 100
        print(f"  {intent}: {stats['passed']}/{stats['total']} ({rate:.0f}%)")
    
    # 保存测试结果
    with open('test_results.json', 'w', encoding='utf-8') as f:
        json.dump(test_results, f, ensure_ascii=False, indent=2)
    
    print("\n测试结果已保存到 test_results.json")
    
    return test_results

if __name__ == '__main__':
    main()
