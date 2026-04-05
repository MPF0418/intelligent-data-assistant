# -*- coding: utf-8 -*-
"""
快速测试脚本 - 测试V3.3模型推理效果
"""

import json
import torch
from transformers import BertTokenizer, BertForSequenceClassification

def test_model():
    print("=" * 60)
    print("V3.3模型推理测试")
    print("=" * 60)
    
    # 加载模型
    print("\n加载模型...")
    tokenizer = BertTokenizer.from_pretrained('./model')
    model = BertForSequenceClassification.from_pretrained('./model')
    model.eval()
    
    # 加载标签配置
    with open('./model/label_config.json', 'r', encoding='utf-8') as f:
        label_config = json.load(f)
    
    # 测试文本列表
    test_texts = [
        # 原有意图测试
        "哪个省公司的销售额最高？",
        "按地区统计事件数量",
        "筛选出金额大于1000的记录",
        "按时间排序",
        "绘制柱状图展示各区域数据",
        "画一个折线图",
        "用饼图展示占比",
        
        # V3.3新增意图测试
        "销售额的中位数是多少",
        "计算一下工资的中位数",
        "数据的波动程度如何",
        "计算方差",
        "第90百分位数是多少",
        "按地区和产品交叉统计销售额",
        "做一个透视表分析",
        "删除重复数据",
        "把空值填充为平均值",
        "检测异常值",
        "画一个柱状图显示销售额，折线图显示增长率",
        "组合图展示销售额和利润",
        "画一个雷达图对比各部门指标",
        "漏斗图分析转化率",
        "生成热力图",
        "导出为Excel文件",
        "保存为CSV格式"
    ]
    
    print("\n测试结果:")
    print("-" * 60)
    
    correct = 0
    total = len(test_texts)
    
    for test_text in test_texts:
        # 分词
        inputs = tokenizer(
            test_text,
            padding='max_length',
            truncation=True,
            max_length=64,
            return_tensors='pt'
        )
        
        # 推理
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
            probabilities = torch.softmax(logits, dim=1)
            max_prob, predicted_label = torch.max(probabilities, dim=1)
        
        # 获取结果
        intent = label_config['label_names'][str(predicted_label.item())]
        confidence = max_prob.item()
        description = label_config['label_descriptions'][intent]
        
        print(f"\n输入: {test_text}")
        print(f"意图: {intent} - {description}")
        print(f"置信度: {confidence:.4f}")
    
    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)

if __name__ == '__main__':
    test_model()
