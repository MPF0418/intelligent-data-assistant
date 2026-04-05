# -*- coding: utf-8 -*-
"""
简单测试脚本 - 验证模型是否正确加载
"""

import json
import torch
from transformers import BertTokenizer, BertForSequenceClassification

print("=" * 60)
print("模型测试")
print("=" * 60)

# 加载配置
with open('model_config.json', 'r', encoding='utf-8') as f:
    config = json.load(f)

print(f"\n配置中的标签数量: {config['model']['num_labels']}")
print(f"配置中的标签: {list(config['labels'].keys())}")

# 加载模型
print("\n加载模型...")
try:
    tokenizer = BertTokenizer.from_pretrained('./model')
    model = BertForSequenceClassification.from_pretrained('./model')
    
    print(f"模型标签数量: {model.config.num_labels}")
    
    # 测试推理
    test_text = "销售额的中位数是多少"
    inputs = tokenizer(
        test_text, padding='max_length', truncation=True,
        max_length=64, return_tensors='pt'
    )
    
    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.softmax(outputs.logits, dim=1)
        max_prob, pred_label = torch.max(probs, dim=1)
    
    print(f"\n测试输入: {test_text}")
    print(f"预测标签ID: {pred_label.item()}")
    print(f"置信度: {max_prob.item():.4f}")
    
    # 加载标签配置
    with open('./model/label_config.json', 'r', encoding='utf-8') as f:
        label_config = json.load(f)
    
    intent = label_config['label_names'].get(str(pred_label.item()), 'UNKNOWN')
    print(f"预测意图: {intent}")
    
except Exception as e:
    print(f"错误: {e}")
    import traceback
    traceback.print_exc()
