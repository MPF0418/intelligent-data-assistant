# -*- coding: utf-8 -*-
"""
V3.3模型训练脚本 - 修复版
确保正确保存15个标签的模型
"""

import json
import torch
import os
from transformers import (
    BertTokenizer,
    BertForSequenceClassification,
    TrainingArguments,
    Trainer
)
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

class IntentDataset(torch.utils.data.Dataset):
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
    labels = pred.label_ids
    preds = pred.predictions.argmax(-1)
    precision, recall, f1, _ = precision_recall_fscore_support(labels, preds, average='weighted')
    acc = accuracy_score(labels, preds)
    return {'accuracy': acc, 'f1': f1, 'precision': precision, 'recall': recall}

def main():
    print("=" * 60)
    print("V3.3模型训练开始 (15个标签)")
    print("=" * 60)
    
    # 加载配置
    config = load_json('model_config.json')
    num_labels = config['model']['num_labels']
    print(f"\n标签数量: {num_labels}")
    print(f"标签列表: {list(config['labels'].keys())}")
    
    # 加载数据
    print("\n加载训练数据...")
    train_data = load_json('train_data.json')
    val_data = load_json('val_data.json')
    test_data = load_json('test_data.json')
    
    print(f"训练集: {len(train_data)} 条")
    print(f"验证集: {len(val_data)} 条")
    print(f"测试集: {len(test_data)} 条")
    
    # 创建标签映射
    label_map = config['labels']
    
    # 转换数据
    train_texts = [item['text'] for item in train_data]
    train_labels = [label_map[item['intent']] for item in train_data]
    
    val_texts = [item['text'] for item in val_data]
    val_labels = [label_map[item['intent']] for item in val_data]
    
    test_texts = [item['text'] for item in test_data]
    test_labels = [label_map[item['intent']] for item in test_data]
    
    # 加载分词器
    print(f"\n加载预训练模型...")
    tokenizer = BertTokenizer.from_pretrained(config['model']['pretrained_model'])
    
    # 创建新模型（15个标签）
    print(f"创建模型，标签数量: {num_labels}")
    model = BertForSequenceClassification.from_pretrained(
        config['model']['pretrained_model'],
        num_labels=num_labels,
        ignore_mismatched_sizes=True  # 允许标签数量不匹配
    )
    
    print(f"模型实际标签数量: {model.config.num_labels}")
    
    # 数据预处理
    print("\n数据预处理...")
    train_encodings = tokenizer(
        train_texts, truncation=True, padding=True, 
        max_length=config['model']['max_seq_length']
    )
    val_encodings = tokenizer(
        val_texts, truncation=True, padding=True,
        max_length=config['model']['max_seq_length']
    )
    test_encodings = tokenizer(
        test_texts, truncation=True, padding=True,
        max_length=config['model']['max_seq_length']
    )
    
    # 创建数据集
    train_dataset = IntentDataset(train_encodings, train_labels)
    val_dataset = IntentDataset(val_encodings, val_labels)
    test_dataset = IntentDataset(test_encodings, test_labels)
    
    # 创建输出目录
    output_dir = './model_v33'
    os.makedirs(output_dir, exist_ok=True)
    
    # 训练参数
    training_args = TrainingArguments(
        output_dir=output_dir,
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
        logging_dir=f'{output_dir}/logs',
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
    
    # 评估
    print("\n评估模型...")
    test_results = trainer.evaluate(test_dataset)
    print(f"测试结果: {test_results}")
    
    # 保存模型到model目录
    print("\n保存模型到 ./model 目录...")
    
    # 先备份旧模型
    import shutil
    if os.path.exists('./model_backup'):
        shutil.rmtree('./model_backup')
    if os.path.exists('./model'):
        shutil.copytree('./model', './model_backup')
    
    # 保存新模型
    trainer.save_model('./model')
    tokenizer.save_pretrained('./model')
    
    # 保存标签配置
    save_json('./model/label_config.json', {
        'labels': config['labels'],
        'label_names': config['label_names'],
        'label_descriptions': config['label_descriptions']
    })
    
    print("\n模型训练完成！")
    print("=" * 60)
    
    # 验证保存的模型
    print("\n验证保存的模型...")
    model2 = BertForSequenceClassification.from_pretrained('./model')
    print(f"保存后的模型标签数量: {model2.config.num_labels}")
    
    # 测试推理
    print("\n测试推理...")
    test_texts = [
        "销售额的中位数是多少",
        "按地区和产品交叉统计销售额",
        "删除重复数据",
        "画一个柱状图显示销售额，折线图显示增长率",
        "导出为Excel文件"
    ]
    
    model2.eval()
    
    for text in test_texts:
        inputs = tokenizer(
            text, padding='max_length', truncation=True,
            max_length=64, return_tensors='pt'
        )
        
        with torch.no_grad():
            outputs = model2(**inputs)
            probs = torch.softmax(outputs.logits, dim=1)
            max_prob, pred_label = torch.max(probs, dim=1)
        
        intent = config['label_names'][str(pred_label.item())]
        print(f"\n输入: {text}")
        print(f"意图: {intent}")
        print(f"置信度: {max_prob.item():.4f}")

if __name__ == '__main__':
    main()
