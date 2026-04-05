# -*- coding: utf-8 -*-
"""
V4.0新增：分析要素识别API服务
独立的API服务，用于识别聚合函数和输出目标
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'service': 'analysis-elements', 'status': 'healthy', 'version': '4.0.0'})

@app.route('/api/analyze-elements', methods=['POST'])
def api_analyze_elements():
    """
    V4.0新增：分析要素识别接口
    识别用户输入中的聚合函数和输出目标
    """
    try:
        from analysis_inference import get_analysis_classifier
        
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': '缺少text参数'}), 400
        
        text = data['text'].strip()
        
        if not text:
            return jsonify({'error': 'text不能为空'}), 400
        
        clf = get_analysis_classifier()
        result = clf.predict(text)
        
        logger.info(f"分析要素识别: '{text}' -> 聚合={result['aggregate_function']} ({result['aggregate_confidence']:.2%}), 输出={result['output_type']} ({result['output_confidence']:.2%})")
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"分析要素识别失败: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/aggregate-types', methods=['GET'])
def api_aggregate_types():
    """V4.0新增：获取所有聚合函数类型"""
    return jsonify({
        'aggregate_types': {
            'sum': '求和，计算总和、合计、总计',
            'avg': '求平均，计算平均值、均值、人均',
            'max': '求最大值，找出最高值、峰值',
            'min': '求最小值，找出最低值、谷值',
            'count': '计数，统计数量、个数、频次',
            'median': '中位数，计算中间值',
            'std': '标准差，计算波动、离散程度',
            'distinct_count': '去重计数，统计不同值的数量',
            'ratio': '占比，计算百分比、比例',
            'growth_rate': '增长率，计算增幅、涨幅',
            'yoy': '同比，与去年同期比较',
            'mom': '环比，与上月比较',
            'rank': '排名，计算名次、排行',
            'none': '未指定聚合方式'
        }
    })

@app.route('/api/output-types', methods=['GET'])
def api_output_types():
    """V4.0新增：获取所有输出目标类型"""
    return jsonify({
        'output_types': {
            'chart_bar': '柱状图，用于对比分析',
            'chart_line': '折线图，用于趋势分析',
            'chart_pie': '饼图，用于占比分析',
            'chart_scatter': '散点图，用于相关性分析',
            'chart_radar': '雷达图，用于多维度对比',
            'chart_area': '面积图，用于累计趋势分析',
            'value': '数值输出，直接返回计算结果',
            'table': '表格输出，以表格形式展示数据',
            'none': '未指定输出方式'
        }
    })

@app.route('/', methods=['GET'])
def root():
    return jsonify({
        'service': '智能数据洞察助手 - 分析要素识别API',
        'version': '4.0.0',
        'status': 'running',
        'endpoints': {
            'health': '/api/health',
            'analyze_elements': '/api/analyze-elements',
            'aggregate_types': '/api/aggregate-types',
            'output_types': '/api/output-types'
        }
    })

if __name__ == '__main__':
    print("=" * 60)
    print("智能数据洞察助手 - 分析要素识别API服务")
    print("=" * 60)
    print("\n启动服务...")
    print("API地址: http://localhost:5002")
    print("\n接口列表:")
    print("  GET  /api/health           - 健康检查")
    print("  POST /api/analyze-elements - 分析要素识别")
    print("  GET  /api/aggregate-types  - 获取聚合函数类型")
    print("  GET  /api/output-types     - 获取输出目标类型")
    print("\n按 Ctrl+C 停止服务")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5002, debug=False)
