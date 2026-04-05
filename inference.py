# -*- coding: utf-8 -*-
"""
智能数据洞察助手 - 意图识别推理脚本
功能：加载训练好的模型，对用户输入进行意图识别
"""

import json
import torch
from transformers import BertTokenizer, BertForSequenceClassification

class IntentClassifier:
    """意图识别器"""
    
    def __init__(self, model_path='./model'):
        """初始化模型"""
        self.model_path = model_path
        self.tokenizer = None
        self.model = None
        self.label_config = None
        self._load_model()
    
    def _load_model(self):
        """加载模型和配置"""
        try:
            # 加载分词器和模型
            self.tokenizer = BertTokenizer.from_pretrained(self.model_path)
            self.model = BertForSequenceClassification.from_pretrained(self.model_path)
            self.model.eval()
            
            # 加载标签配置
            with open(f'{self.model_path}/label_config.json', 'r', encoding='utf-8') as f:
                self.label_config = json.load(f)
            
            print(f"模型加载成功: {self.model_path}")
        except Exception as e:
            print(f"模型加载失败: {e}")
            raise
    
    def predict(self, text):
        """
        预测意图
        
        参数:
            text: 用户输入文本
        
        返回:
            {
                'intent': 意图标签,
                'confidence': 置信度,
                'description': 意图描述,
                'need_confirmation': 是否需要确认,
                'all_probabilities': 所有类别的概率
            }
        """
        # 分词
        inputs = self.tokenizer(
            text,
            padding='max_length',
            truncation=True,
            max_length=64,
            return_tensors='pt'
        )
        
        # 推理
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits
            probabilities = torch.softmax(logits, dim=1)
            max_prob, predicted_label = torch.max(probabilities, dim=1)
        
        # 获取结果
        intent = self.label_config['label_names'][str(predicted_label.item())]
        confidence = max_prob.item()
        description = self.label_config['label_descriptions'][intent]
        
        # 获取所有概率
        all_probs = {}
        for idx, prob in enumerate(probabilities[0].tolist()):
            label_name = self.label_config['label_names'][str(idx)]
            all_probs[label_name] = round(prob, 4)
        
        # 置信度检查
        need_confirmation = confidence < 0.6
        
        result = {
            'intent': intent,
            'confidence': round(confidence, 4),
            'description': description,
            'need_confirmation': need_confirmation,
            'all_probabilities': all_probs
        }
        
        return result
    
    def batch_predict(self, texts):
        """批量预测"""
        return [self.predict(text) for text in texts]

def identify_intent(text):
    """便捷函数：识别意图"""
    classifier = IntentClassifier()
    return classifier.predict(text)

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1:
        text = ' '.join(sys.argv[1:])
        result = identify_intent(text)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        # 交互模式
        print("意图识别测试 (输入 'quit' 退出)")
        print("-" * 40)
        classifier = IntentClassifier()
        
        while True:
            text = input("\n请输入: ").strip()
            if text.lower() == 'quit':
                break
            
            result = classifier.predict(text)
            print(f"\n意图: {result['intent']}")
            print(f"描述: {result['description']}")
            print(f"置信度: {result['confidence']:.2%}")
            if result['need_confirmation']:
                print("⚠️ 置信度较低，建议确认")
