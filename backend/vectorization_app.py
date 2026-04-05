# -*- coding: utf-8 -*-
"""
Excel向量化应用
产品意义：提供Excel数据向量化和语义查询的功能
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from app.utils.excel_vectorizer import ExcelVectorizer

# 创建Flask应用
app = Flask(__name__)

# 配置CORS
CORS(app)

# 全局ExcelVectorizer实例
vectorizer = ExcelVectorizer()

# 向量化Excel数据
@app.route('/api/v1/vectorization/vectorize', methods=['POST'])
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

# 语义查询向量化数据
@app.route('/api/v1/vectorization/query', methods=['POST'])
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

# 获取已向量化的表
@app.route('/api/v1/vectorization/collections', methods=['GET'])
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

# 删除向量化数据
@app.route('/api/v1/vectorization/collections/<table_name>', methods=['DELETE'])
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

# 健康检查
@app.route('/health', methods=['GET'])
def health_check():
    """
    健康检查
    产品意义：用于监控服务状态
    """
    return jsonify({"status": "healthy"})

# 根路径
@app.route('/', methods=['GET'])
def index():
    """
    根路径
    产品意义：提供API服务信息
    """
    return jsonify({
        "name": "Excel向量化服务",
        "version": "V1.0",
        "status": "running",
        "endpoints": {
            "vectorization": {
                "vectorize": "/api/v1/vectorization/vectorize",
                "query": "/api/v1/vectorization/query",
                "collections": "/api/v1/vectorization/collections",
                "delete_collection": "/api/v1/vectorization/collections/{table_name}"
            }
        }
    })

if __name__ == '__main__':
    """
    启动应用
    产品意义：运行Flask服务
    """
    host = '0.0.0.0'
    port = 5002
    
    print(f"Starting Excel vectorization service on {host}:{port}")
    print(f"Health check: http://{host}:{port}/health")
    print(f"API docs: http://{host}:{port}/")
    
    app.run(
        host=host,
        port=port,
        debug=True
    )
