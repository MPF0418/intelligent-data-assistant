# -*- coding: utf-8 -*-
"""
智能交互相关API
产品意义：暴露智能交互增强功能，供前端调用
"""

from flask import Blueprint, request, jsonify
from app.utils.interaction_utils import InteractionUtils

interaction_bp = Blueprint('interaction', __name__)

# 创建InteractionUtils实例
interaction_utils = InteractionUtils()

@interaction_bp.route('/process', methods=['POST'])
def process_query():
    """
    处理用户查询
    产品意义：理解用户意图，提供智能回复
    """
    try:
        data = request.json
        user_query = data.get('user_query', '')
        conversation_id = data.get('conversation_id', None)
        
        if not user_query:
            return jsonify({"error": "用户查询不能为空"}), 400
        
        result = interaction_utils.process_query(user_query, conversation_id)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@interaction_bp.route('/history', methods=['GET'])
def get_history():
    """
    获取对话历史
    产品意义：查看完整的对话记录
    """
    try:
        conversation_id = request.args.get('conversation_id', '')
        
        if not conversation_id:
            return jsonify({"error": "对话ID不能为空"}), 400
        
        history = interaction_utils.get_conversation_history(conversation_id)
        
        return jsonify({"history": history})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@interaction_bp.route('/clear', methods=['POST'])
def clear_conversation():
    """
    清空对话历史
    产品意义：重置对话状态，开始新的对话
    """
    try:
        data = request.json
        conversation_id = data.get('conversation_id', '')
        
        if not conversation_id:
            return jsonify({"error": "对话ID不能为空"}), 400
        
        success = interaction_utils.clear_conversation(conversation_id)
        
        return jsonify({"success": success})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
