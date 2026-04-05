# -*- coding: utf-8 -*-
"""
数据分析要素模型训练脚本 - 修复版
训练两个独立的BERT分类模型：
1. 聚合函数识别模型（14个标签）
2. 输出目标识别模型（9个标签）
"""

import json
import torch
import os
import shutil
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from transformers import (
    BertTokenizer,
    BertForSequenceClassification,
    BertConfig,
    TrainingArguments,
    Trainer
)

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

class AnalysisDataset(torch.utils.data.Dataset):
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

def prepare_aggregate_data(raw_data, config):
    texts = []
    labels = []
    agg_labels = config['aggregate_labels']
    
    for item in raw_data:
        if 'aggregate_function' in item and item['aggregate_function'] != 'N/A':
            text = item['text']
            agg_func = item['aggregate_function']
            if agg_func in agg_labels:
                texts.append(text)
                labels.append(agg_labels[agg_func])
    
    print(f"聚合函数数据: {len(texts)} 条")
    return texts, labels

def prepare_output_data(raw_data, config):
    texts = []
    labels = []
    out_labels = config['output_labels']
    
    for item in raw_data:
        if 'output_type' in item and item['output_type'] != 'N/A':
            text = item['text']
            out_type = item['output_type']
            if out_type in out_labels:
                texts.append(text)
                labels.append(out_labels[out_type])
    
    print(f"输出目标数据: {len(texts)} 条")
    return texts, labels

def train_model(texts, labels, config, model_type, output_dir, num_labels):
    print(f"\n{'='*60}")
    print(f"训练{model_type}模型 ({num_labels}个标签)")
    print(f"{'='*60}")
    
    X_train, X_temp, y_train, y_temp = train_test_split(
        texts, labels, test_size=0.3, random_state=42, stratify=labels
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp
    )
    
    print(f"训练集: {len(X_train)} 条")
    print(f"验证集: {len(X_val)} 条")
    print(f"测试集: {len(X_test)} 条")
    
    tokenizer = BertTokenizer.from_pretrained(config['model']['pretrained_model'])
    
    bert_config = BertConfig.from_pretrained(
        config['model']['pretrained_model'],
        num_labels=num_labels
    )
    
    model = BertForSequenceClassification.from_pretrained(
        config['model']['pretrained_model'],
        config=bert_config,
        ignore_mismatched_sizes=True
    )
    
    train_encodings = tokenizer(
        X_train, truncation=True, padding=True,
        max_length=config['model']['max_seq_length']
    )
    val_encodings = tokenizer(
        X_val, truncation=True, padding=True,
        max_length=config['model']['max_seq_length']
    )
    test_encodings = tokenizer(
        X_test, truncation=True, padding=True,
        max_length=config['model']['max_seq_length']
    )
    
    train_dataset = AnalysisDataset(train_encodings, y_train)
    val_dataset = AnalysisDataset(val_encodings, y_val)
    test_dataset = AnalysisDataset(test_encodings, y_test)
    
    os.makedirs(output_dir, exist_ok=True)
    
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
    
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        compute_metrics=compute_metrics,
    )
    
    print("\n开始训练...")
    trainer.train()
    
    print("\n评估模型...")
    test_results = trainer.evaluate(test_dataset)
    print(f"测试结果: {test_results}")
    
    return trainer, tokenizer, test_dataset, model

def main():
    print("=" * 60)
    print("数据分析要素模型训练 - 修复版")
    print("=" * 60)
    
    config = load_json('analysis_model_config.json')
    raw_data = load_json('analysis_training_data.json')
    
    print(f"\n总训练数据: {len(raw_data)} 条")
    
    agg_texts, agg_labels = prepare_aggregate_data(raw_data, config)
    out_texts, out_labels = prepare_output_data(raw_data, config)
    
    print("\n" + "=" * 60)
    print("第一部分：训练聚合函数识别模型")
    print("=" * 60)
    
    num_agg_labels = len(config['aggregate_labels'])
    agg_trainer, agg_tokenizer, agg_test_dataset, agg_model = train_model(
        agg_texts, agg_labels, config, 
        "聚合函数", 
        "./analysis_model_aggregate",
        num_labels=num_agg_labels
    )
    
    agg_save_dir = './analysis_model/aggregate'
    os.makedirs(agg_save_dir, exist_ok=True)
    
    print(f"\n保存聚合函数模型到 {agg_save_dir}...")
    agg_model.save_pretrained(agg_save_dir)
    agg_tokenizer.save_pretrained(agg_save_dir)
    
    save_json(f'{agg_save_dir}/label_config.json', {
        'model_type': 'aggregate',
        'num_labels': num_agg_labels,
        'labels': config['aggregate_labels'],
        'label_names': config['aggregate_names'],
        'label_descriptions': config['aggregate_descriptions']
    })
    
    print("\n" + "=" * 60)
    print("第二部分：训练输出目标识别模型")
    print("=" * 60)
    
    num_out_labels = len(config['output_labels'])
    out_trainer, out_tokenizer, out_test_dataset, out_model = train_model(
        out_texts, out_labels, config,
        "输出目标",
        "./analysis_model_output",
        num_labels=num_out_labels
    )
    
    out_save_dir = './analysis_model/output'
    os.makedirs(out_save_dir, exist_ok=True)
    
    print(f"\n保存输出目标模型到 {out_save_dir}...")
    out_model.save_pretrained(out_save_dir)
    out_tokenizer.save_pretrained(out_save_dir)
    
    save_json(f'{out_save_dir}/label_config.json', {
        'model_type': 'output',
        'num_labels': num_out_labels,
        'labels': config['output_labels'],
        'label_names': config['output_names'],
        'label_descriptions': config['output_descriptions']
    })
    
    print("\n" + "=" * 60)
    print("模型训练完成！")
    print("=" * 60)
    
    print("\n测试聚合函数模型...")
    test_texts_agg = [
        "销售额的总和是多少",
        "按省份统计销售额的平均值",
        "找出利润最高的记录",
        "统计订单数量",
        "销售额的中位数",
        "与去年同期相比的同比"
    ]
    
    agg_model.eval()
    for text in test_texts_agg:
        inputs = agg_tokenizer(
            text, padding='max_length', truncation=True,
            max_length=64, return_tensors='pt'
        )
        with torch.no_grad():
            outputs = agg_model(**inputs)
            probs = torch.softmax(outputs.logits, dim=1)
            max_prob, pred_label = torch.max(probs, dim=1)
        
        label_name = config['aggregate_names'][str(pred_label.item())]
        print(f"  {text} -> {label_name} ({max_prob.item():.4f})")
    
    print("\n测试输出目标模型...")
    test_texts_out = [
        "绘制销售额的柱状图",
        "画一个折线图显示趋势",
        "用饼图展示占比",
        "销售额是多少",
        "列出所有订单",
        "显示销售额表格"
    ]
    
    out_model.eval()
    for text in test_texts_out:
        inputs = out_tokenizer(
            text, padding='max_length', truncation=True,
            max_length=64, return_tensors='pt'
        )
        with torch.no_grad():
            outputs = out_model(**inputs)
            probs = torch.softmax(outputs.logits, dim=1)
            max_prob, pred_label = torch.max(probs, dim=1)
        
        label_name = config['output_names'][str(pred_label.item())]
        print(f"  {text} -> {label_name} ({max_prob.item():.4f})")
    
    print("\n" + "=" * 60)
    print("所有模型已保存到 ./analysis_model/ 目录")
    print("=" * 60)

if __name__ == '__main__':
    main()
