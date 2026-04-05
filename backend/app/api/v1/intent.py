# -*- coding: utf-8 -*-
"""
意图识别API
产品意义：提供本地意图识别服务
"""

from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import re
import torch
from transformers import BertTokenizer, BertForSequenceClassification
import os

intent_bp = Blueprint('intent', __name__)

# 意图识别规则库（作为BERT模型的兜底）
INTENT_PATTERNS = {
    'aggregate': {
        'patterns': [
            r'统计|汇总|总计|合计|求和|平均|最大|最小|count|sum|avg|max|min',
            r'按.*分组|group by',
            r'各.*的.*|每个.*的.*'
        ],
        'keywords': ['统计', '汇总', '平均', '最大', '最小', '求和', '分组']
    },
    'chart': {
        'patterns': [
            r'图|图表|画图|绘制|柱状图|折线图|饼图|bar|line|pie|chart',
            r'可视化|展示|显示'
        ],
        'keywords': ['图', 'chart', '可视化', '绘制']
    },
    'filter': {
        'patterns': [
            r'筛选|过滤|查找|搜索|查询|select|where|filter',
            r'大于|小于|等于|包含|是.*的'
        ],
        'keywords': ['筛选', '过滤', '查找', '查询']
    },
    'sort': {
        'patterns': [
            r'排序|排列|顺序|倒序|升序|降序|sort|order',
            r'从高到低|从低到高|最多|最少'
        ],
        'keywords': ['排序', '顺序', '倒序']
    },
    'trend': {
        'patterns': [
            r'趋势|变化|增长|下降|上升|走势|预测|trend',
            r'同比|环比|对比|比较'
        ],
        'keywords': ['趋势', '变化', '增长', '走势']
    }
}

# 加载BERT模型
tokenizer = None
model = None
label2id = {'filter': 0, 'aggregate': 1, 'chart': 2, 'sort': 3, 'trend': 4}
id2label = {0: 'filter', 1: 'aggregate', 2: 'chart', 3: 'sort', 4: 'trend'}

# 尝试加载BERT模型
tokenizer = None
model = None
try:
    model_path = './app/models/bert_requirement_classifier'
    if os.path.exists(model_path):
        tokenizer = BertTokenizer.from_pretrained(model_path)
        model = BertForSequenceClassification.from_pretrained(model_path)
        model.eval()
        print("BERT模型加载成功")
    else:
        print("BERT模型未找到，将使用规则匹配")
except Exception as e:
    print(f"加载BERT模型失败: {e} (将使用规则匹配)")

# 使用BERT模型进行分类
def classify_with_bert(text):
    """
    使用BERT模型进行需求分类
    """
    try:
        if not tokenizer or not model:
            return None
        
        # 分词
        inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=128)
        
        # 推理
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
            probabilities = torch.softmax(logits, dim=1)
            
        # 获取预测结果
        predicted_class = torch.argmax(probabilities, dim=1).item()
        confidence = probabilities[0][predicted_class].item()
        
        return {
            "type": id2label[predicted_class],
            "confidence": confidence,
            "method": "bert"
        }
    except Exception as e:
        print(f"⚠️ BERT分类失败: {e}")
        return None

# 使用规则进行分类
def classify_with_rule(text):
    """
    使用规则进行需求分类
    """
    text_lower = text.lower()
    
    # 检测是否为图表需求
    if any(kw in text_lower for kw in ['图', 'chart', '柱状图', '折线图', '饼图', '绘制', '画图']):
        return {
            "type": "chart",
            "confidence": 0.9,
            "method": "rule"
        }
    
    # 检测是否为筛选需求
    if any(kw in text_lower for kw in ['筛选', '过滤', '查找', '查询', 'where', '查一下', '请问', '是多少', '多少', '查询', '查找']):
        return {
            "type": "filter",
            "confidence": 0.85,
            "method": "rule"
        }
    
    # 检测是否为聚合需求
    if any(kw in text_lower for kw in ['统计', '汇总', '平均', '最大', '最小', '求和', '总额', '总和']):
        return {
            "type": "aggregate",
            "confidence": 0.85,
            "method": "rule"
        }
    
    # 检测是否为"XX的YY"模式（如"广东省的销售额"）
    if re.search(r'[^]+的[^]+', text_lower):
        return {
            "type": "filter",
            "confidence": 0.8,
            "method": "rule"
        }
    
    # 检测是否为询问模式（如"广东省的销售额是多少"）
    if any(kw in text_lower for kw in ['是多少', '多少', '多少钱', '多少个', '多少人']):
        return {
            "type": "filter",
            "confidence": 0.8,
            "method": "rule"
        }
    
    # 默认返回未知
    return {
        "type": "unknown",
        "confidence": 0.5,
        "method": "rule"
    }

@intent_bp.route('/identify-intent', methods=['POST'])
def identify_intent():
    """
    识别用户查询意图
    产品意义：本地轻量级意图识别，无需调用大模型
    """
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({
                "error": "文本不能为空",
                "intent": "unknown",
                "confidence": 0.0
            }), 400
        
        # 转换小写便于匹配
        text_lower = text.lower()
        
        # 匹配意图
        best_intent = 'unknown'
        best_confidence = 0.0
        matched_keywords = []
        
        for intent_name, intent_config in INTENT_PATTERNS.items():
            confidence = 0.0
            keywords_found = []
            
            # 检查正则模式
            for pattern in intent_config['patterns']:
                if re.search(pattern, text_lower):
                    confidence += 0.3
            
            # 检查关键词
            for keyword in intent_config['keywords']:
                if keyword in text_lower:
                    confidence += 0.2
                    keywords_found.append(keyword)
            
            # 去重
            confidence = min(confidence, 1.0)
            
            # 选择最佳匹配
            if confidence > best_confidence:
                best_confidence = confidence
                best_intent = intent_name
                matched_keywords = keywords_found
        
        # 如果置信度太低，标记为unknown
        if best_confidence < 0.3:
            best_intent = 'unknown'
            best_confidence = 0.0
        
        return jsonify({
            "intent": best_intent,
            "confidence": round(best_confidence, 2),
            "keywords": matched_keywords,
            "method": "local_model",
            "text": text
        })
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "intent": "unknown",
            "confidence": 0.0
        }), 500

@intent_bp.route('/classify-requirement', methods=['POST', 'OPTIONS'])
@cross_origin(origins='*', methods=['POST', 'OPTIONS'], allow_headers=['Content-Type', 'Authorization', 'Accept'])
def classify_requirement():
    """
    需求分类API
    产品意义：供前端需求分类模块调用
    """
    try:
        data = request.json
        text = data.get('text', '')
        
        # 首先尝试使用BERT模型
        bert_result = classify_with_bert(text)
        if bert_result:
            return jsonify(bert_result)
        
        # BERT模型不可用时，使用规则匹配作为兜底
        rule_result = classify_with_rule(text)
        return jsonify(rule_result)
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "type": "unknown",
            "confidence": 0.0
        }), 500

@intent_bp.route('/match-column', methods=['POST', 'OPTIONS'])
@cross_origin(origins='*', methods=['POST', 'OPTIONS'], allow_headers=['Content-Type', 'Authorization', 'Accept'])
def match_column():
    """
    列名匹配API
    产品意义：供前端匹配用户输入与数据列名
    """
    try:
        data = request.json
        text = data.get('text', '')
        columns = data.get('columns', [])
        
        text_lower = text.lower()
        matches = []
        
        # 简单的关键词匹配
        for col in columns:
            col_lower = col.lower()
            # 检查列名是否出现在文本中
            if col_lower in text_lower:
                matches.append({
                    "column": col,
                    "confidence": 1.0,
                    "match_type": "exact"
                })
            # 检查部分匹配
            elif any(part in text_lower for part in col_lower.split()):
                matches.append({
                    "column": col,
                    "confidence": 0.8,
                    "match_type": "partial"
                })
        
        return jsonify({
            "matches": matches,
            "method": "rule"
        })
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "matches": []
        }), 500

@intent_bp.route('/health', methods=['GET'])
@cross_origin(origins='*')
def intent_health():
    """
    意图识别服务健康检查
    产品意义：供前端检测本地模型可用性
    """
    model_status = "available" if model else "unavailable"
    return jsonify({
        "status": "healthy",
        "service": "intent_recognition",
        "version": "1.0.0",
        "model_status": model_status
    })