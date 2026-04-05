# -*- coding: utf-8 -*-
"""
Agent相关API
产品意义：暴露Agent系统的功能，供前端调用
"""

from flask import Blueprint, request, jsonify
from app.agents.analysis_agent import AnalysisAgent
from app.agents.data_agent import DataAgent
from app.agents.chart_agent import ChartAgent
from app.agents.report_agent import ReportAgent
from app.utils.performance_utils_fixed import cache_result, performance_monitor
from app.utils.performance_manager import cache_manager, perf_monitor

agent_bp = Blueprint('agent', __name__)

@agent_bp.route('/analysis', methods=['POST'])
@cache_result(cache_manager)
def run_analysis():
    """
    运行分析Agent
    产品意义：执行复杂的数据分析任务
    """
    try:
        data = request.json
        user_query = data.get('user_query', '')
        data_schema = data.get('data_schema', {})
        
        if not user_query:
            return jsonify({"error": "用户查询不能为空"}), 400
        
        analysis_agent = AnalysisAgent()
        result = analysis_agent.run_analysis(user_query, data_schema)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@agent_bp.route('/data', methods=['POST'])
@cache_result(cache_manager)
def run_data_analysis():
    """
    运行数据Agent
    产品意义：执行数据理解和质量评估
    """
    try:
        data = request.json
        input_data = data.get('data', {})
        
        if not input_data:
            return jsonify({"error": "数据不能为空"}), 400
        
        data_agent = DataAgent()
        result = data_agent.run_data_analysis(input_data)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@agent_bp.route('/chart', methods=['POST'])
@cache_result(cache_manager)
def run_chart_recommendation():
    """
    运行图表Agent
    产品意义：推荐合适的图表类型
    """
    try:
        data = request.json
        user_query = data.get('user_query', '')
        data_schema = data.get('data_schema', {})
        
        if not user_query:
            return jsonify({"error": "用户查询不能为空"}), 400
        
        chart_agent = ChartAgent()
        result = chart_agent.run_chart_recommendation(user_query, data_schema)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@agent_bp.route('/report', methods=['POST'])
@cache_result(cache_manager)
def run_report_generation():
    """
    运行报告Agent
    产品意义：生成分析报告
    """
    try:
        data = request.json
        user_query = data.get('user_query', '')
        analysis_results = data.get('analysis_results', {})
        report_format = data.get('report_format', 'markdown')
        
        if not user_query:
            return jsonify({"error": "用户查询不能为空"}), 400
        
        if not analysis_results:
            return jsonify({"error": "分析结果不能为空"}), 400
        
        report_agent = ReportAgent()
        result = report_agent.run_report_generation(user_query, analysis_results, report_format)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
