# -*- coding: utf-8 -*-
"""
BERT模型训练脚本
产品意义：训练本地BERT模型对需求类型进行分类
"""

import json
import os
from sklearn.model_selection import train_test_split
from transformers import BertTokenizer, BertForSequenceClassification, Trainer, TrainingArguments
import torch
from datasets import Dataset

# 加载数据集
def load_dataset():
    """
    加载需求分类数据集
    """
    with open('app/data/requirement_classification_dataset.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    texts = [item['text'] for item in data['data']]
    labels = [item['label'] for item in data['data']]
    
    # 标签映射
    label2id = {'filter': 0, 'aggregate': 1, 'chart': 2, 'sort': 3, 'trend': 4}
    id2label = {0: 'filter', 1: 'aggregate', 2: 'chart', 3: 'sort', 4: 'trend'}
    
    # 转换标签
    labels = [label2id[label] for label in labels]
    
    # 拆分数据集
    train_texts, test_texts, train_labels, test_labels = train_test_split(
        texts, labels, test_size=0.2, random_state=42
    )
    
    return train_texts, test_texts, train_labels, test_labels, label2id, id2label

# 创建数据集
def create_dataset(texts, labels, tokenizer):
    """
    创建Hugging Face数据集
    """
    encodings = tokenizer(texts, truncation=True, padding=True, max_length=128)
    dataset = Dataset.from_dict({
        'input_ids': encodings['input_ids'],
        'attention_mask': encodings['attention_mask'],
        'labels': labels
    })
    return dataset

# 主训练函数
def train_model():
    """
    训练BERT模型
    """
    # 加载数据集
    train_texts, test_texts, train_labels, test_labels, label2id, id2label = load_dataset()
    
    # 加载预训练模型和分词器
    model_name = 'bert-base-chinese'
    tokenizer = BertTokenizer.from_pretrained(model_name)
    model = BertForSequenceClassification.from_pretrained(
        model_name,
        num_labels=len(label2id),
        id2label=id2label,
        label2id=label2id
    )
    
    # 创建数据集
    train_dataset = create_dataset(train_texts, train_labels, tokenizer)
    test_dataset = create_dataset(test_texts, test_labels, tokenizer)
    
    # 训练参数
    training_args = TrainingArguments(
        output_dir='./results',
        num_train_epochs=3,
        per_device_train_batch_size=8,
        per_device_eval_batch_size=8,
        warmup_steps=500,
        weight_decay=0.01,
        logging_dir='./logs',
        logging_steps=100,
        evaluation_strategy='epoch',
        save_strategy='epoch',
        load_best_model_at_end=True
    )
    
    # 创建训练器
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=test_dataset,
        tokenizer=tokenizer
    )
    
    # 开始训练
    print("开始训练BERT模型...")
    trainer.train()
    
    # 评估模型
    print("评估模型...")
    eval_result = trainer.evaluate()
    print(f"评估结果: {eval_result}")
    
    # 保存模型
    print("保存模型...")
    model.save_pretrained('./app/models/bert_requirement_classifier')
    tokenizer.save_pretrained('./app/models/bert_requirement_classifier')
    
    print("模型训练完成!")

if __name__ == '__main__':
    # 创建模型目录
    os.makedirs('./app/models/bert_requirement_classifier', exist_ok=True)
    
    # 训练模型
    train_model()
