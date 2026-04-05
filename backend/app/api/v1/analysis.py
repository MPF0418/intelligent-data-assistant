# -*- coding: utf-8 -*-
"""
高级分析相关API
产品意义：暴露高级分析能力，供前端调用
"""

from flask import Blueprint, request, jsonify
from app.tools.advanced_analysis import AdvancedAnalysis

analysis_bp = Blueprint('analysis', __name__)

# 创建AdvancedAnalysis实例
advanced_analysis = AdvancedAnalysis()

@analysis_bp.route('/intelligent', methods=['POST'])
def intelligent_insight():
    """
    智能数据洞察
    产品意义：结合业务规则和数据分析结果，提供深度洞察
    """
    try:
        data = request.json
        business_rules = data.get('business_rules', None)
        
        result = advanced_analysis.intelligent_insight(data, business_rules)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analysis_bp.route('/predictive', methods=['POST'])
def predictive_analysis():
    """
    预测分析
    产品意义：基于历史数据进行趋势预测
    """
    try:
        data = request.json
        historical_data = data.get('historical_data', [])
        forecast_period = data.get('forecast_period', 3)
        
        if not historical_data:
            return jsonify({"error": "历史数据不能为空"}), 400
        
        result = advanced_analysis.predictive_analysis(historical_data, forecast_period)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analysis_bp.route('/anomaly', methods=['POST'])
def anomaly_detection():
    """
    异常检测
    产品意义：识别数据中的异常模式
    """
    try:
        data = request.json
        data_list = data.get('data', [])
        contamination = data.get('contamination', 0.1)
        
        if not data_list:
            return jsonify({"error": "数据不能为空"}), 400
        
        result = advanced_analysis.anomaly_detection(data_list, contamination)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analysis_bp.route('/correlation', methods=['POST'])
def correlation_analysis():
    """
    关联分析
    产品意义：发现数据之间的关联关系
    """
    try:
        data = request.json
        
        if 'data' not in data:
            return jsonify({"error": "数据不能为空"}), 400
        
        result = advanced_analysis.correlation_analysis(data)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
