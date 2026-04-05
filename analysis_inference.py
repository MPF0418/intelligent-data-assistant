# -*- coding: utf-8 -*-
"""
数据分析要素识别模块
V4.0新增：识别聚合函数和输出目标
"""

import json
import torch
import logging
from pathlib import Path
from transformers import BertTokenizer, BertForSequenceClassification

logger = logging.getLogger(__name__)

class AnalysisElementClassifier:
    """数据分析要素分类器"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self.aggregate_model = None
        self.aggregate_tokenizer = None
        self.aggregate_config = None
        self.output_model = None
        self.output_tokenizer = None
        self.output_config = None
        
        self._load_models()
        self._initialized = True
    
    def _load_models(self):
        """加载模型"""
        base_path = Path(__file__).parent
        
        agg_model_path = base_path / 'analysis_model' / 'aggregate'
        out_model_path = base_path / 'analysis_model' / 'output'
        
        if agg_model_path.exists():
            logger.info("加载聚合函数识别模型...")
            try:
                self.aggregate_tokenizer = BertTokenizer.from_pretrained(str(agg_model_path))
                self.aggregate_model = BertForSequenceClassification.from_pretrained(str(agg_model_path))
                self.aggregate_model.eval()
                
                config_path = agg_model_path / 'label_config.json'
                if config_path.exists():
                    with open(config_path, 'r', encoding='utf-8') as f:
                        self.aggregate_config = json.load(f)
                logger.info("聚合函数识别模型加载成功")
            except Exception as e:
                logger.error(f"加载聚合函数模型失败: {e}")
        else:
            logger.warning(f"聚合函数模型路径不存在: {agg_model_path}")
        
        if out_model_path.exists():
            logger.info("加载输出目标识别模型...")
            try:
                self.output_tokenizer = BertTokenizer.from_pretrained(str(out_model_path))
                self.output_model = BertForSequenceClassification.from_pretrained(str(out_model_path))
                self.output_model.eval()
                
                config_path = out_model_path / 'label_config.json'
                if config_path.exists():
                    with open(config_path, 'r', encoding='utf-8') as f:
                        self.output_config = json.load(f)
                logger.info("输出目标识别模型加载成功")
            except Exception as e:
                logger.error(f"加载输出目标模型失败: {e}")
        else:
            logger.warning(f"输出目标模型路径不存在: {out_model_path}")
    
    def predict_aggregate(self, text):
        """
        预测聚合函数类型
        
        Args:
            text: 用户输入文本
            
        Returns:
            dict: {
                'aggregate_function': 'sum/avg/max/min/count/...',
                'confidence': 0.95,
                'probabilities': {...}
            }
        """
        if not self.aggregate_model or not self.aggregate_config:
            return {
                'aggregate_function': 'none',
                'confidence': 0.0,
                'error': '聚合函数模型未加载'
            }
        
        try:
            inputs = self.aggregate_tokenizer(
                text, padding='max_length', truncation=True,
                max_length=64, return_tensors='pt'
            )
            
            with torch.no_grad():
                outputs = self.aggregate_model(**inputs)
                probs = torch.softmax(outputs.logits, dim=1)
                max_prob, pred_label = torch.max(probs, dim=1)
            
            label_name = self.aggregate_config['label_names'][str(pred_label.item())]
            confidence = max_prob.item()
            
            probabilities = {}
            for i, prob in enumerate(probs[0].tolist()):
                label = self.aggregate_config['label_names'].get(str(i), f'label_{i}')
                probabilities[label] = round(prob, 4)
            
            return {
                'aggregate_function': label_name,
                'confidence': round(confidence, 4),
                'probabilities': probabilities,
                'description': self.aggregate_config['label_descriptions'].get(label_name, '')
            }
        
        except Exception as e:
            logger.error(f"聚合函数预测失败: {e}")
            return {
                'aggregate_function': 'none',
                'confidence': 0.0,
                'error': str(e)
            }
    
    def predict_output(self, text):
        """
        预测输出目标类型
        
        Args:
            text: 用户输入文本
            
        Returns:
            dict: {
                'output_type': 'chart_bar/chart_line/chart_pie/value/table/...',
                'confidence': 0.95,
                'probabilities': {...}
            }
        """
        if not self.output_model or not self.output_config:
            return {
                'output_type': 'none',
                'confidence': 0.0,
                'error': '输出目标模型未加载'
            }
        
        try:
            inputs = self.output_tokenizer(
                text, padding='max_length', truncation=True,
                max_length=64, return_tensors='pt'
            )
            
            with torch.no_grad():
                outputs = self.output_model(**inputs)
                probs = torch.softmax(outputs.logits, dim=1)
                max_prob, pred_label = torch.max(probs, dim=1)
            
            label_name = self.output_config['label_names'][str(pred_label.item())]
            confidence = max_prob.item()
            
            probabilities = {}
            for i, prob in enumerate(probs[0].tolist()):
                label = self.output_config['label_names'].get(str(i), f'label_{i}')
                probabilities[label] = round(prob, 4)
            
            return {
                'output_type': label_name,
                'confidence': round(confidence, 4),
                'probabilities': probabilities,
                'description': self.output_config['label_descriptions'].get(label_name, '')
            }
        
        except Exception as e:
            logger.error(f"输出目标预测失败: {e}")
            return {
                'output_type': 'none',
                'confidence': 0.0,
                'error': str(e)
            }
    
    def predict(self, text):
        """
        综合预测聚合函数和输出目标
        
        Args:
            text: 用户输入文本
            
        Returns:
            dict: {
                'aggregate_function': 'sum',
                'aggregate_confidence': 0.95,
                'output_type': 'chart_bar',
                'output_confidence': 0.98,
                'probabilities': {...}
            }
        """
        agg_result = self.predict_aggregate(text)
        out_result = self.predict_output(text)
        
        return {
            'text': text,
            'aggregate_function': agg_result.get('aggregate_function', 'none'),
            'aggregate_confidence': agg_result.get('confidence', 0.0),
            'aggregate_description': agg_result.get('description', ''),
            'output_type': out_result.get('output_type', 'none'),
            'output_confidence': out_result.get('confidence', 0.0),
            'output_description': out_result.get('description', ''),
            'aggregate_probabilities': agg_result.get('probabilities', {}),
            'output_probabilities': out_result.get('probabilities', {})
        }


_analysis_classifier = None

def get_analysis_classifier():
    """获取分析要素分类器实例（懒加载）"""
    global _analysis_classifier
    if _analysis_classifier is None:
        _analysis_classifier = AnalysisElementClassifier()
    return _analysis_classifier
