# -*- coding: utf-8 -*-
"""
核心Agent API
产品意义：暴露核心Agent的功能，供前端调用
"""

from flask import Blueprint, request, jsonify
from app.agents.core_agent import CoreAgent
from app.utils.performance_utils_fixed import cache_result
from app.utils.performance_manager import cache_manager

core_agent_bp = Blueprint('core_agent', __name__)

# 创建核心Agent实例
core_agent = CoreAgent()

@core_agent_bp.route('/run', methods=['POST'])
@cache_result(cache_manager)
def run_core_agent():
    """
    运行核心Agent
    产品意义：处理用户请求，执行完整的任务处理流程
    """
    try:
        data = request.json
        user_query = data.get('user_query', '')
        context = data.get('context', {})
        
        if not user_query:
            return jsonify({"error": "用户查询不能为空"}), 400
        
        # 运行核心Agent
        result = core_agent.run(user_query, context)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@core_agent_bp.route('/skills', methods=['GET'])
def get_skills():
    """
    获取可用的Skill列表
    产品意义：提供系统中所有可用的Skill，用于前端展示和调试
    """
    try:
        # 从核心Agent获取Skill管理器
        skills = core_agent.skill_manager.get_loaded_skills()
        
        # 获取每个Skill的详细信息
        skills_info = []
        for skill_name in skills:
            skill_info = core_agent.skill_manager.get_skill_info(skill_name)
            if skill_info:
                skills_info.append(skill_info)
        
        return jsonify({
            'success': True,
            'skills': skills_info
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@core_agent_bp.route('/models', methods=['GET'])
def get_models():
    """
    获取可用的模型列表
    产品意义：提供系统中所有可用的模型，用于前端展示和调试
    """
    try:
        # 从核心Agent获取模型选择器
        models = core_agent.model_selector.get_available_models()
        
        # 获取每个模型的详细信息
        models_info = []
        for model_name in models:
            model_info = core_agent.model_selector.get_model_info(model_name)
            models_info.append(model_info)
        
        return jsonify({
            'success': True,
            'models': models_info
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
