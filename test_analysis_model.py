# -*- coding: utf-8 -*-
"""
数据分析要素模型测试脚本
测试聚合函数识别和输出目标识别两个模型
"""

import json
import torch
from transformers import BertTokenizer, BertForSequenceClassification

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def test_models():
    print("=" * 60)
    print("数据分析要素模型测试")
    print("=" * 60)
    
    agg_config = load_json('./analysis_model/aggregate/label_config.json')
    out_config = load_json('./analysis_model/output/label_config.json')
    
    print("\n加载聚合函数模型...")
    agg_tokenizer = BertTokenizer.from_pretrained('./analysis_model/aggregate')
    agg_model = BertForSequenceClassification.from_pretrained('./analysis_model/aggregate')
    agg_model.eval()
    print(f"聚合函数标签: {list(agg_config['labels'].keys())}")
    
    print("\n加载输出目标模型...")
    out_tokenizer = BertTokenizer.from_pretrained('./analysis_model/output')
    out_model = BertForSequenceClassification.from_pretrained('./analysis_model/output')
    out_model.eval()
    print(f"输出目标标签: {list(out_config['labels'].keys())}")
    
    test_cases = [
        "按照省份绘制销售额的柱状图",
        "销售额的总和是多少",
        "各地区的平均工资",
        "找出利润最高的省份",
        "统计订单数量",
        "画一个折线图显示趋势",
        "用饼图展示各产品的占比",
        "销售额的中位数",
        "计算增长率",
        "与去年同期相比的同比变化",
        "按部门统计销售额的总和，用柱状图展示",
        "各省份的销售额平均是多少",
        "显示销售额表格",
        "只需要销售额的数值",
    ]
    
    print("\n" + "=" * 60)
    print("测试结果")
    print("=" * 60)
    
    for text in test_cases:
        print(f"\n输入: {text}")
        
        agg_inputs = agg_tokenizer(
            text, padding='max_length', truncation=True,
            max_length=64, return_tensors='pt'
        )
        with torch.no_grad():
            agg_outputs = agg_model(**agg_inputs)
            agg_probs = torch.softmax(agg_outputs.logits, dim=1)
            agg_max_prob, agg_pred = torch.max(agg_probs, dim=1)
        
        agg_label = agg_config['label_names'][str(agg_pred.item())]
        agg_desc = agg_config['label_descriptions'].get(agg_label, '')
        print(f"  聚合函数: {agg_label} ({agg_desc}) [置信度: {agg_max_prob.item():.4f}]")
        
        out_inputs = out_tokenizer(
            text, padding='max_length', truncation=True,
            max_length=64, return_tensors='pt'
        )
        with torch.no_grad():
            out_outputs = out_model(**out_inputs)
            out_probs = torch.softmax(out_outputs.logits, dim=1)
            out_max_prob, out_pred = torch.max(out_probs, dim=1)
        
        out_label = out_config['label_names'][str(out_pred.item())]
        out_desc = out_config['label_descriptions'].get(out_label, '')
        print(f"  输出目标: {out_label} ({out_desc}) [置信度: {out_max_prob.item():.4f}]")
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)

if __name__ == '__main__':
    test_models()
