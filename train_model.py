# -*- coding: utf-8 -*-
"""
智能数据洞察助手 - 意图识别模型训练脚本
功能：训练BERT模型识别用户输入的意图（查询/筛选/统计/排序/绘图等）
"""

import json
import torch
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from transformers import (
    BertTokenizer,
    BertForSequenceClassification,
    TrainingArguments,
    Trainer,
    pipeline
)

def load_config(config_path='model_config.json'):
    """加载模型配置"""
    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_data(data_path):
    """加载训练数据"""
    with open(data_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def prepare_datasets(config):
    """准备训练、验证、测试数据集"""
    train_data = load_data('train_data.json')
    val_data = load_data('val_data.json')
    test_data = load_data('test_data.json')
    
    # 创建标签映射
    label_map = config['labels']
    
    # 转换数据格式
    def convert_data(data):
        texts = [item['text'] for item in data]
        labels = [label_map[item['intent']] for item in data]
        return {'text': texts, 'label': labels}
    
    train_dataset = convert_data(train_data)
    val_dataset = convert_data(val_data)
    test_dataset = convert_data(test_data)
    
    print(f"训练集大小: {len(train_dataset['text'])}")
    print(f"验证集大小: {len(val_dataset['text'])}")
    print(f"测试集大小: {len(test_dataset['text'])}")
    
    return train_dataset, val_dataset, test_dataset

class IntentDataset(torch.utils.data.Dataset):
    """意图识别数据集类"""
    def __init__(self, encodings, labels):
        self.encodings = encodings
        self.labels = labels
    
    def __getitem__(self, idx):
        item = {key: torch.tensor(val[idx]) for key, val in self.encodings.items()}
        item['labels'] = torch.tensor(self.labels[idx])
        return item
    
    def __len__(self):
        return len(self.labels)

def compute_metrics(pred):
    """计算评估指标"""
    labels = pred.label_ids
    preds = pred.predictions.argmax(-1)
    
    precision, recall, f1, _ = precision_recall_fscore_support(labels, preds, average='weighted')
    acc = accuracy_score(labels, preds)
    
    return {
        'accuracy': acc,
        'f1': f1,
        'precision': precision,
        'recall': recall
    }

def train_model():
    """训练模型主函数"""
    print("=" * 60)
    print("智能数据洞察助手 - 意图识别模型训练")
    print("=" * 60)
    
    # 加载配置
    config = load_config()
    print(f"\n模型配置: {config['model']}")
    print(f"训练配置: {config['training']}")
    
    # 准备数据
    print("\n正在准备数据集...")
    train_data, val_data, test_data = prepare_datasets(config)
    
    # 加载分词器和模型
    print(f"\n正在加载预训练模型: {config['model']['pretrained_model']}")
    tokenizer = BertTokenizer.from_pretrained(config['model']['pretrained_model'])
    model = BertForSequenceClassification.from_pretrained(
        config['model']['pretrained_model'],
        num_labels=config['model']['num_labels']
    )
    
    # 数据预处理
    print("\n正在进行数据预处理...")
    train_encodings = tokenizer(
        train_data['text'],
        truncation=True,
        padding=True,
        max_length=config['model']['max_seq_length']
    )
    val_encodings = tokenizer(
        val_data['text'],
        truncation=True,
        padding=True,
        max_length=config['model']['max_seq_length']
    )
    test_encodings = tokenizer(
        test_data['text'],
        truncation=True,
        padding=True,
        max_length=config['model']['max_seq_length']
    )
    
    # 创建数据集对象
    train_dataset = IntentDataset(train_encodings, train_data['label'])
    val_dataset = IntentDataset(val_encodings, val_data['label'])
    test_dataset = IntentDataset(test_encodings, test_data['label'])
    
    # 训练参数
    training_args = TrainingArguments(
        output_dir='./results',
        num_train_epochs=config['training']['epochs'],
        per_device_train_batch_size=config['training']['batch_size'],
        per_device_eval_batch_size=config['training']['batch_size'],
        learning_rate=config['training']['learning_rate'],
        warmup_ratio=config['training']['warmup_ratio'],
        weight_decay=config['training']['weight_decay'],
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        logging_dir='./logs',
        logging_steps=10,
        save_total_limit=2,
    )
    
    # 创建训练器
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        compute_metrics=compute_metrics,
    )
    
    # 开始训练
    print("\n开始训练...")
    print("-" * 60)
    trainer.train()
    
    # 评估模型
    print("\n在测试集上评估模型...")
    print("-" * 60)
    test_results = trainer.evaluate(test_dataset)
    print(f"测试结果: {test_results}")
    
    # 保存模型
    print("\n保存模型到 ./model 目录...")
    trainer.save_model('./model')
    tokenizer.save_pretrained('./model')
    
    # 保存标签映射
    with open('./model/label_config.json', 'w', encoding='utf-8') as f:
        json.dump({
            'labels': config['labels'],
            'label_names': config['label_names'],
            'label_descriptions': config['label_descriptions']
        }, f, ensure_ascii=False, indent=2)
    
    print("\n模型训练完成！")
    print("=" * 60)
    
    return trainer

def test_inference(text=None):
    """测试模型推理"""
    print("\n测试模型推理...")
    print("-" * 60)
    
    # 加载模型
    tokenizer = BertTokenizer.from_pretrained('./model')
    model = BertForSequenceClassification.from_pretrained('./model')
    model.eval()
    
    # 加载标签配置
    with open('./model/label_config.json', 'r', encoding='utf-8') as f:
        label_config = json.load(f)
    
    # 测试文本
    if text is None:
        test_texts = [
            "哪个省公司的销售额最高？",
            "按地区统计事件数量",
            "筛选出金额大于1000的记录",
            "按时间排序",
            "绘制柱状图展示各区域数据",
            "画一个折线图",
            "用饼图展示占比",
            "帮我可视化数据"
        ]
    else:
        test_texts = [text]
    
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
        print(f"意图: {intent} ({description})")
        print(f"置信度: {confidence:.4f}")

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == 'test':
            # 测试模式
            text = sys.argv[2] if len(sys.argv) > 2 else None
            test_inference(text)
        else:
            print("用法: python train_model.py [test] [文本]")
    else:
        # 训练模式
        train_model()
        # 训练完成后测试
        test_inference()
