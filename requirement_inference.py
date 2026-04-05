# -*- coding: utf-8 -*-
"""
需求分类推理模块
功能：使用训练好的BERT模型判断用户输入是否为数据分析需求
产品意义：替代规则匹配，提高分类准确率，减少误判
"""

import torch
from transformers import BertTokenizer, BertForSequenceClassification
import os

class RequirementClassifier:
    """需求分类器 - 判断输入是否为数据分析需求"""
    
    def __init__(self, model_path='./requirement_model'):
        self.model_path = model_path
        self.tokenizer = None
        self.model = None
        self.label_map = {0: 'DATA_ANALYSIS', 1: 'IRRELEVANT'}
        self.reverse_label_map = {'DATA_ANALYSIS': 0, 'IRRELEVANT': 1}
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        self._load_model()
    
    def _load_model(self):
        """加载训练好的模型"""
        if not os.path.exists(self.model_path):
            print(f"[RequirementClassifier] 模型路径不存在: {self.model_path}")
            print("[RequirementClassifier] 请先运行 train_requirement_model.py 训练模型")
            return
        
        print(f"[RequirementClassifier] 加载模型: {self.model_path}")
        
        # 加载tokenizer
        self.tokenizer = BertTokenizer.from_pretrained(self.model_path)
        
        # 加载模型
        self.model = BertForSequenceClassification.from_pretrained(self.model_path)
        self.model.to(self.device)
        self.model.eval()
        
        print(f"[RequirementClassifier] 模型加载完成，设备: {self.device}")
    
    def predict(self, text):
        """
        预测输入文本的类别
        
        Args:
            text: 用户输入文本
            
        Returns:
            dict: {
                'label': 'DATA_ANALYSIS' 或 'IRRELEVANT',
                'confidence': 置信度,
                'is_data_analysis': True/False
            }
        """
        if self.model is None:
            # 模型未加载，返回默认值
            return {
                'label': 'DATA_ANALYSIS',
                'confidence': 0.5,
                'is_data_analysis': True,
                'error': '模型未加载'
            }
        
        # 对输入文本进行编码
        inputs = self.tokenizer(
            text,
            padding=True,
            truncation=True,
            max_length=64,
            return_tensors='pt'
        )
        
        # 将输入移到设备上
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        # 预测
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits
            probs = torch.softmax(logits, dim=-1)
            
            # 获取预测结果
            pred_idx = torch.argmax(probs, dim=-1).item()
            confidence = probs[0][pred_idx].item()
            label = self.label_map[pred_idx]
        
        return {
            'label': label,
            'confidence': confidence,
            'is_data_analysis': label == 'DATA_ANALYSIS',
            'probabilities': {
                'DATA_ANALYSIS': probs[0][0].item(),
                'IRRELEVANT': probs[0][1].item()
            }
        }
    
    def batch_predict(self, texts):
        """批量预测"""
        return [self.predict(text) for text in texts]


# 全局分类器实例
_requirement_classifier = None

def get_requirement_classifier():
    """获取需求分类器实例（懒加载）"""
    global _requirement_classifier
    if _requirement_classifier is None:
        _requirement_classifier = RequirementClassifier()
    return _requirement_classifier
