# -*- coding: utf-8 -*-
"""
主应用入口
产品意义：初始化Flask应用，注册路由，启动服务
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import logging
import sys
from app.api.v1.router import api_bp
from app.api.v1.vectorization import vectorization_bp
from app.api.v1.test import test_bp
from app.config import config
from app.utils.performance_manager import (
    perf_monitor,
    cache_manager,
    concurrency_controller
)
from app.middleware.concurrency_middleware import add_concurrency_control

# 配置日志
logging.basicConfig(
    level=getattr(logging, config['system'].LOG_LEVEL),
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# 创建Flask应用
app = Flask(__name__)

# 全局CORS配置
from flask_cors import CORS
CORS(app, resources={r"/*": {"origins": "*"}})

# 处理OPTIONS预检请求
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    return '', 204

# 配置应用
app.config['MAX_CONTENT_LENGTH'] = config['system'].MAX_REQUEST_SIZE
app.config['JSON_AS_ASCII'] = False

# 添加并发控制中间件
app = add_concurrency_control(app)

# 注册API路由
app.register_blueprint(api_bp, url_prefix='/api/v1')
# 直接注册vectorization蓝图
app.register_blueprint(vectorization_bp, url_prefix='/api/v1/vectorization')
# 注册测试蓝图
app.register_blueprint(test_bp, url_prefix='/api/v1/test')

# 健康检查端点
@app.route('/health', methods=['GET'])
def health_check():
    """
    健康检查
    产品意义：用于监控服务状态
    """
    return jsonify({"status": "healthy"})

# 性能监控端点
@app.route('/api/v1/performance/metrics', methods=['GET'])
def get_performance_metrics():
    """
    获取性能指标
    产品意义：监控系统性能，发现瓶颈
    """
    return jsonify({
        "status": "success",
        "data": perf_monitor.get_all_metrics()
    })

# 清空缓存端点
@app.route('/api/v1/performance/cache/clear', methods=['POST'])
def clear_cache():
    """
    清空缓存
    产品意义：释放内存，重置缓存
    """
    cache_manager.clear()
    return jsonify({
        "status": "success",
        "message": "缓存已清空"
    })

# 并发状态端点
@app.route('/api/v1/performance/concurrency/status', methods=['GET'])
def get_concurrency_status():
    """
    获取并发状态
    产品意义：监控系统并发情况
    """
    return jsonify({
        "status": "success",
        "data": concurrency_controller.get_status()
    })

# 根路径
@app.route('/', methods=['GET'])
def index():
    """
    根路径
    产品意义：提供API服务信息
    """
    return jsonify({
        "name": "智能数据洞察助手 API",
        "version": "V5.0",
        "status": "running",
        "endpoints": {
            "agent": {
                "analysis": "/api/v1/agent/analysis",
                "data": "/api/v1/agent/data",
                "chart": "/api/v1/agent/chart",
                "report": "/api/v1/agent/report"
            },
            "rag": {
                "memory": {
                    "add": "/api/v1/rag/memory/add",
                    "retrieve": "/api/v1/rag/memory/retrieve",
                    "history": "/api/v1/rag/memory/history"
                },
                "knowledge": {
                    "add": "/api/v1/rag/knowledge/add",
                    "retrieve": "/api/v1/rag/knowledge/retrieve"
                },
                "dictionary": {
                    "add": "/api/v1/rag/dictionary/add",
                    "retrieve": "/api/v1/rag/dictionary/retrieve"
                }
            },
            "performance": {
                "metrics": "/api/v1/performance/metrics",
                "cache_clear": "/api/v1/performance/cache/clear",
                "concurrency_status": "/api/v1/performance/concurrency/status"
            },
            "test": {
                "hello": "/api/v1/test/hello"
            }
        }
    })

# 测试端点
@app.route('/api/v1/test/hello', methods=['GET'])
def test_hello():
    """
    测试端点
    产品意义：测试API端点是否能够正常工作
    """
    return jsonify({
        'success': True,
        'message': 'Hello, World!'
    })

if __name__ == '__main__':
    """
    启动应用
    产品意义：运行Flask服务
    """
    host = '0.0.0.0'
    port = 5001
    
    logger.info(f"Starting server on {host}:{port}")
    logger.info(f"Health check: http://{host}:{port}/health")
    logger.info(f"API docs: http://{host}:{port}/")
    
    app.run(
        host=host,
        port=port,
        debug=config['system'].DEBUG
    )
