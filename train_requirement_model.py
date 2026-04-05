# -*- coding: utf-8 -*-
"""
智能数据分析助手 - 需求分类模型训练脚本
功能：训练二分类模型（数据分析需求 vs 无关需求）
"""

import json
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import BertTokenizer, BertForSequenceClassification
from torch.optim import AdamW
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from tqdm import tqdm
import numpy as np
import os

class RequirementDataset(Dataset):
    """需求分类数据集"""
    
    def __init__(self, data_path, tokenizer, max_length=64):
        self.tokenizer = tokenizer
        self.max_length = max_length
        
        # 加载数据
        with open(data_path, 'r', encoding='utf-8') as f:
            self.data = json.load(f)
        
        # 标签映射
        self.label_map = {
            'DATA_ANALYSIS': 0,
            'IRRELEVANT': 1
        }
        
        print(f"加载数据: {len(self.data)} 条")
        
    def __len__(self):
        return len(self.data)
    
    def __getitem__(self, idx):
        item = self.data[idx]
        text = item['text']
        label = self.label_map[item['label']]
        
        # Tokenize
        encoding = self.tokenizer(
            text,
            max_length=self.max_length,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )
        
        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.tensor(label, dtype=torch.long)
        }

def train_model():
    """训练需求分类模型"""
    print("=" * 60)
    print("需求分类模型训练")
    print("=" * 60)
    
    # 配置
    model_name = 'bert-base-chinese'
    batch_size = 16
    epochs = 5
    learning_rate = 2e-5
    max_length = 64
    
    # 设备
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"\n使用设备: {device}")
    
    # 加载tokenizer
    print(f"\n加载tokenizer: {model_name}")
    tokenizer = BertTokenizer.from_pretrained(model_name)
    
    # 加载数据集
    print("\n加载数据集...")
    train_dataset = RequirementDataset('requirement_train.json', tokenizer, max_length)
    val_dataset = RequirementDataset('requirement_val.json', tokenizer, max_length)
    test_dataset = RequirementDataset('requirement_test.json', tokenizer, max_length)
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size)
    test_loader = DataLoader(test_dataset, batch_size=batch_size)
    
    # 加载模型
    print(f"\n加载模型: {model_name}")
    model = BertForSequenceClassification.from_pretrained(
        model_name,
        num_labels=2,
        problem_type='single_label_classification'
    )
    model.to(device)
    
    # 优化器
    optimizer = AdamW(model.parameters(), lr=learning_rate)
    
    # 训练循环
    print(f"\n开始训练 (epochs={epochs}, batch_size={batch_size})...")
    print("-" * 60)
    
    best_accuracy = 0
    
    for epoch in range(epochs):
        # 训练阶段
        model.train()
        total_loss = 0
        
        progress_bar = tqdm(train_loader, desc=f'Epoch {epoch+1}/{epochs}')
        for batch in progress_bar:
            optimizer.zero_grad()
            
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            labels = batch['labels'].to(device)
            
            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels
            )
            
            loss = outputs.loss
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            progress_bar.set_postfix({'loss': f'{loss.item():.4f}'})
        
        avg_loss = total_loss / len(train_loader)
        
        # 验证阶段
        model.eval()
        val_preds = []
        val_labels = []
        
        with torch.no_grad():
            for batch in val_loader:
                input_ids = batch['input_ids'].to(device)
                attention_mask = batch['attention_mask'].to(device)
                labels = batch['labels'].to(device)
                
                outputs = model(
                    input_ids=input_ids,
                    attention_mask=attention_mask
                )
                
                preds = torch.argmax(outputs.logits, dim=1)
                val_preds.extend(preds.cpu().numpy())
                val_labels.extend(labels.cpu().numpy())
        
        # 计算指标
        accuracy = accuracy_score(val_labels, val_preds)
        precision, recall, f1, _ = precision_recall_fscore_support(
            val_labels, val_preds, average='binary'
        )
        
        print(f"\nEpoch {epoch+1}/{epochs}:")
        print(f"  训练损失: {avg_loss:.4f}")
        print(f"  验证准确率: {accuracy:.4f}")
        print(f"  验证F1: {f1:.4f}")
        
        # 保存最佳模型
        if accuracy > best_accuracy:
            best_accuracy = accuracy
            model.save_pretrained('./requirement_model')
            tokenizer.save_pretrained('./requirement_model')
            print(f"  ✓ 保存最佳模型 (准确率: {accuracy:.4f})")
    
    # 测试阶段
    print("\n" + "=" * 60)
    print("测试模型...")
    print("-" * 60)
    
    model.eval()
    test_preds = []
    test_labels = []
    
    with torch.no_grad():
        for batch in test_loader:
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            labels = batch['labels'].to(device)
            
            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask
            )
            
            preds = torch.argmax(outputs.logits, dim=1)
            test_preds.extend(preds.cpu().numpy())
            test_labels.extend(labels.cpu().numpy())
    
    # 计算测试指标
    test_accuracy = accuracy_score(test_labels, test_preds)
    test_precision, test_recall, test_f1, _ = precision_recall_fscore_support(
        test_labels, test_preds, average='binary'
    )
    
    print(f"\n测试结果:")
    print(f"  准确率: {test_accuracy:.4f}")
    print(f"  精确率: {test_precision:.4f}")
    print(f"  召回率: {test_recall:.4f}")
    print(f"  F1分数: {test_f1:.4f}")
    
    # 测试推理
    print("\n" + "=" * 60)
    print("测试推理...")
    print("-" * 60)
    
    test_texts = [
        "查找最大的险情确认时长",
        "你好",
        "今天天气怎么样",
        "统计各省份的平均值",
        "绘制柱状图",
        "帮我写代码",
        "按地区统计数量",
        "你是谁"
    ]
    
    label_names = ['DATA_ANALYSIS', 'IRRELEVANT']
    
    model.eval()
    for text in test_texts:
        encoding = tokenizer(
            text,
            max_length=max_length,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )
        
        input_ids = encoding['input_ids'].to(device)
        attention_mask = encoding['attention_mask'].to(device)
        
        with torch.no_grad():
            outputs = model(input_ids=input_ids, attention_mask=attention_mask)
            probs = torch.softmax(outputs.logits, dim=1)
            pred = torch.argmax(probs, dim=1)
            confidence = probs[0][pred].item()
        
        print(f"\n输入: {text}")
        print(f"预测: {label_names[pred.item()]} (置信度: {confidence:.2%})")
    
    print("\n" + "=" * 60)
    print("训练完成！")
    print(f"模型已保存到 ./requirement_model")
    print("=" * 60)

if __name__ == '__main__':
    train_model()
