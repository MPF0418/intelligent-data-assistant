# -*- coding: utf-8 -*-
"""
统一意图识别API
提供意图识别和实体提取的统一入口
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import sys

# 添加当前目录到路径
sys.path.insert(0, __file__.rsplit('/', 1)[0] or '.')

from unified_recognizer import get_recognizer

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# 初始化意图识别器
recognizer = get_recognizer()


@app.route('/api/v1/intent/recognize', methods=['POST'])
def recognize_intent():
    """
    统一的意图识别接口
    
    请求参数:
    {
        "query": "用户输入",
        "columns": ["列1", "列2", ...]  // 可选
    }
    
    返回:
    {
        "success": true,
        "data": {
            "intents": [
                {
                    "type": "chart",
                    "name": "绘制图表",
                    "entities": {"chart_type": "bar"},
                    "is_clear": false,
                    "confidence": 0.8
                }
            ],
            "all_clear": false,
            "clarifications_needed": [
                {
                    "intent_type": "chart",
                    "missing_field": "y_axis",
                    "question": "请问Y轴要显示什么字段？"
                }
            ]
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'query' not in data:
            return jsonify({
                "success": False,
                "error": "缺少query参数"
            }), 400
        
        user_query = data.get('query')
        columns = data.get('columns', [])
        
        logger.info(f"意图识别请求: query={user_query}, columns={columns}")
        
        # 调用意图识别器
        result = recognizer.recognize(user_query, columns)
        
        logger.info(f"意图识别结果: intents={result.get('intent_count')}, all_clear={result.get('all_clear')}")
        
        return jsonify({
            "success": True,
            "data": result
        })
    
    except Exception as e:
        logger.error(f"意图识别异常: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/v1/intent/clarify', methods=['POST'])
def generate_clarification():
    """
    生成追问选项接口
    
    请求参数:
    {
        "clarifications_needed": [...],
        "columns": ["列1", "列2", ...]
    }
    
    返回:
    {
        "success": true,
        "data": {
            "options": [...]
        }
    }
    """
    try:
        data = request.get_json()
        
        clarifications_needed = data.get('clarifications_needed', [])
        columns = data.get('columns', [])
        
        # 生成追问选项
        options = recognizer.generate_clarification_options(clarifications_needed, columns)
        
        # 添加"意图识别有误"选项
        options.append({
            "type": "intent_error",
            "label": "以上都不是，意图识别有误",
            "value": "reask"
        })
        
        return jsonify({
            "success": True,
            "data": {
                "options": options
            }
        })
    
    except Exception as e:
        logger.error(f"生成追问选项异常: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/v1/intent/table', methods=['GET'])
def get_intent_table():
    """获取意图表"""
    try:
        from intent_table import intent_table
        return jsonify({
            "success": True,
            "data": intent_table.load()
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/health', methods=['GET'])
def health():
    """健康检查"""
    return jsonify({
        "status": "ok",
        "service": "intent-recognition-api"
    })


if __name__ == '__main__':
    logger.info("启动统一意图识别API服务...")
    app.run(host='0.0.0.0', port=5003, debug=True)
