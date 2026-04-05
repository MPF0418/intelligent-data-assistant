# -*- coding: utf-8 -*-
"""
RAG相关API
产品意义：暴露RAG知识系统的功能，供前端调用
"""

from flask import Blueprint, request, jsonify
from app.rag.memory_store import MemoryStore
from app.rag.knowledge_base import KnowledgeBase
from app.rag.data_dictionary import DataDictionary
from app.utils.performance_utils_fixed import cache_result, performance_monitor
from app.utils.performance_manager import cache_manager, perf_monitor

rag_bp = Blueprint('rag', __name__)

@rag_bp.route('/memory/add', methods=['POST'])
def add_to_memory():
    """
    添加查询到记忆库
    产品意义：记录用户的历史查询和分析结果
    """
    try:
        data = request.json
        user_query = data.get('user_query', '')
        analysis_result = data.get('analysis_result', {})
        data_schema = data.get('data_schema', {})
        
        if not user_query:
            return jsonify({"error": "用户查询不能为空"}), 400
        
        memory_store = MemoryStore()
        success = memory_store.add_query(user_query, analysis_result, data_schema)
        
        return jsonify({"success": success})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@rag_bp.route('/memory/retrieve', methods=['POST'])
@cache_result(cache_manager)
def retrieve_from_memory():
    """
    从记忆库检索相似查询
    产品意义：找到与当前查询相似的历史分析
    """
    try:
        data = request.json
        user_query = data.get('user_query', '')
        k = data.get('k', 3)
        
        if not user_query:
            return jsonify({"error": "用户查询不能为空"}), 400
        
        memory_store = MemoryStore()
        results = memory_store.retrieve_similar_queries(user_query, k)
        
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@rag_bp.route('/memory/history', methods=['GET'])
@cache_result(cache_manager)
def get_memory_history():
    """
    获取查询历史
    产品意义：查看用户的历史查询记录
    """
    try:
        limit = int(request.args.get('limit', 10))
        
        memory_store = MemoryStore()
        history = memory_store.get_query_history(limit)
        
        return jsonify({"history": history})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@rag_bp.route('/knowledge/add', methods=['POST'])
def add_to_knowledge():
    """
    添加知识到知识库
    产品意义：导入业务规则、政策法规等领域知识
    """
    try:
        data = request.json
        text = data.get('text', '')
        metadata = data.get('metadata', {})
        
        if not text:
            return jsonify({"error": "文本内容不能为空"}), 400
        
        knowledge_base = KnowledgeBase()
        success = knowledge_base.add_text(text, metadata)
        
        return jsonify({"success": success})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@rag_bp.route('/knowledge/retrieve', methods=['POST'])
@cache_result(cache_manager)
def retrieve_knowledge():
    """
    检索相关知识
    产品意义：根据查询检索相关的领域知识
    """
    try:
        data = request.json
        query = data.get('query', '')
        k = data.get('k', 5)
        
        if not query:
            return jsonify({"error": "查询内容不能为空"}), 400
        
        knowledge_base = KnowledgeBase()
        results = knowledge_base.retrieve_knowledge(query, k)
        
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@rag_bp.route('/dictionary/add', methods=['POST'])
def add_to_dictionary():
    """
    添加字段到数据字典
    产品意义：记录数据字段的语义信息
    """
    try:
        data = request.json
        field_name = data.get('field_name', '')
        field_description = data.get('field_description', '')
        data_type = data.get('data_type', 'text')
        metadata = data.get('metadata', {})
        
        if not field_name:
            return jsonify({"error": "字段名不能为空"}), 400
        
        data_dictionary = DataDictionary()
        success = data_dictionary.add_field(field_name, field_description, data_type, metadata)
        
        return jsonify({"success": success})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@rag_bp.route('/dictionary/retrieve', methods=['POST'])
@cache_result(cache_manager)
def retrieve_field_info():
    """
    检索字段信息
    产品意义：获取字段的语义信息
    """
    try:
        data = request.json
        field_name = data.get('field_name', '')
        
        if not field_name:
            return jsonify({"error": "字段名不能为空"}), 400
        
        data_dictionary = DataDictionary()
        results = data_dictionary.retrieve_field_info(field_name)
        
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
