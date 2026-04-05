"""
统一Web服务器 - 同时提供前端页面和后端API
启动后访问: http://localhost:8888
"""
from flask import Flask, send_from_directory, jsonify, request
import requests
import os

app = Flask(__name__, static_folder='.')

# 后端API地址
INTENT_API = 'http://localhost:5001'
VECTOR_API = 'http://localhost:5002'

@app.route('/')
def index():
    """提供前端页面"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    """提供静态文件"""
    return send_from_directory('.', filename)

# ==================== 意图识别API代理 ====================
@app.route('/api/identify-intent', methods=['POST'])
def proxy_intent():
    try:
        response = requests.post(f'{INTENT_API}/api/identify-intent', json=request.json, timeout=60)
        return response.json()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze', methods=['POST'])
def proxy_analyze():
    try:
        response = requests.post(f'{INTENT_API}/api/analyze', json=request.json, timeout=60)
        return response.json()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/execute', methods=['POST'])
def proxy_execute():
    try:
        response = requests.post(f'{INTENT_API}/api/execute', json=request.json, timeout=120)
        return response.json()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-config', methods=['POST'])
def proxy_generate_config():
    try:
        response = requests.post(f'{INTENT_API}/api/generate-config', json=request.json, timeout=120)
        return response.json()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== 向量化API代理 ====================
@app.route('/health', methods=['GET'])
def proxy_health():
    """前端会检查这个健康端点"""
    return jsonify({'status': 'ok', 'port': 8000})

@app.route('/api/v1/vectorization/collections', methods=['GET', 'POST'])
def proxy_collections():
    try:
        if request.method == 'GET':
            response = requests.get(f'{VECTOR_API}/api/v1/vectorization/collections', timeout=30)
        else:
            response = requests.post(f'{VECTOR_API}/api/v1/vectorization/collections', json=request.json, timeout=60)
        return response.json()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/vectorization/collections/<name>/documents', methods=['GET', 'POST'])
def proxy_documents(name):
    try:
        if request.method == 'GET':
            response = requests.get(f'{VECTOR_API}/api/v1/vectorization/collections/{name}/documents', timeout=30)
        else:
            response = requests.post(f'{VECTOR_API}/api/v1/vectorization/collections/{name}/documents', json=request.json, timeout=60)
        return response.json()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/vectorization/vectorize', methods=['POST'])
def proxy_vectorize():
    try:
        response = requests.post(f'{VECTOR_API}/api/v1/vectorization/vectorize', json=request.json, timeout=120)
        return response.json()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/vectorization/query', methods=['POST'])
def proxy_query():
    try:
        response = requests.post(f'{VECTOR_API}/api/v1/vectorization/query', json=request.json, timeout=60)
        return response.json()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/vectorization/search', methods=['POST'])
def proxy_search():
    try:
        response = requests.post(f'{VECTOR_API}/api/v1/vectorization/search', json=request.json, timeout=60)
        return response.json()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/query/generate-config', methods=['POST'])
def proxy_query_config():
    try:
        response = requests.post(f'{INTENT_API}/api/v1/query/generate-config', json=request.json, timeout=120)
        return response.json()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("\n" + "="*50)
    print("🚀 智能数据分析助手 启动成功！")
    print("="*50)
    print("📍 访问地址: http://localhost:8888")
    print("="*50)
    print("📋 注意：需要先启动5001和5002的后端服务")
    print("="*50)
    
    # 启动Web服务器
    app.run(host='0.0.0.0', port=8888, debug=False, threaded=True)