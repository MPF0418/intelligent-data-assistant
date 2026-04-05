# -*- coding: utf-8 -*-
"""
Excel向量化API
产品意义：提供Excel数据向量化和语义查询的接口
"""

from flask import Blueprint, request, jsonify
from typing import Dict, Any
import pandas as pd
import io
import base64
from app.utils.excel_vectorizer import ExcelVectorizer

# 创建蓝图
vectorization_bp = Blueprint('vectorization', __name__)

# 全局ExcelVectorizer实例
vectorizer = ExcelVectorizer()

@vectorization_bp.route('/vectorize', methods=['POST'])
def vectorize_excel():
    """
    向量化Excel数据
    产品意义：将Excel表格数据转换为向量存储，支持后续的语义查询
    """
    try:
        # 获取请求数据
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据为空'
            }), 400
        
        # 提取数据
        table_name = data.get('table_name')
        excel_data = data.get('data')
        
        if not table_name or not excel_data:
            return jsonify({
                'success': False,
                'message': '缺少表名或数据'
            }), 400
        
        # 转换数据为DataFrame
        if isinstance(excel_data, dict) and 'headers' in excel_data and 'rows' in excel_data:
            headers = excel_data['headers']
            rows = excel_data['rows']
            df = pd.DataFrame(rows, columns=headers)
        else:
            return jsonify({
                'success': False,
                'message': '数据格式错误'
            }), 400
        
        # 执行向量化
        result = vectorizer.vectorize(df, table_name)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'向量化失败: {str(e)}'
        }), 500

@vectorization_bp.route('/query', methods=['POST'])
def query_vectorized_data():
    """
    语义查询向量化数据
    产品意义：基于语义理解进行智能查询，支持地域、时间等语义扩展
    """
    try:
        # 获取请求数据
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据为空'
            }), 400
        
        # 提取查询参数
        query_text = data.get('query')
        table_name = data.get('table_name')
        filters = data.get('filters', {})
        top_k = data.get('top_k', 10)
        
        if not query_text or not table_name:
            return jsonify({
                'success': False,
                'message': '缺少查询文本或表名'
            }), 400
        
        # 执行查询
        result = vectorizer.query(query_text, table_name, filters, top_k)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'查询失败: {str(e)}'
        }), 500

@vectorization_bp.route('/collections', methods=['GET'])
def get_collections():
    """
    获取已向量化的表
    产品意义：查看系统中已向量化的Excel表列表
    """
    try:
        collections = vectorizer.get_collections()
        
        return jsonify({
            'success': True,
            'collections': collections
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'获取集合失败: {str(e)}'
        }), 500

@vectorization_bp.route('/collections/<table_name>', methods=['DELETE'])
def delete_collection(table_name):
    """
    删除向量化数据
    产品意义：清理不需要的向量数据，释放存储空间
    """
    try:
        result = vectorizer.delete_collection(table_name)
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 404
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'删除失败: {str(e)}'
        }), 500
