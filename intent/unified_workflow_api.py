# -*- coding: utf-8 -*-
"""
统一意图识别与工作流API
整合本地模型、大模型、追问、拒识等所有功能
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import os
import sys

# 添加当前目录到路径
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# 导入模块
from unified_recognizer import get_recognizer
from workflow_manager import UnifiedWorkflowManager
from llm_client import MockLLMClient

# 初始化组件
logger.info("初始化统一意图识别与工作流API...")

# 本地意图识别器
local_recognizer = None
try:
    local_recognizer = get_recognizer()
    logger.info("本地意图识别器初始化成功")
except Exception as e:
    logger.warning(f"本地意图识别器初始化失败: {e}")

# 大模型客户端（使用模拟客户端）
llm_client = MockLLMClient()
logger.info("大模型客户端初始化成功（模拟模式）")

# 统一工作流管理器
workflow_manager = UnifiedWorkflowManager(local_recognizer, llm_client)
logger.info("统一工作流管理器初始化成功")


@app.route('/api/v1/workflow/process', methods=['POST'])
def process_workflow():
    """
    统一工作流处理接口
    
    请求参数:
    {
        "query": "用户输入",
        "columns": ["列1", "列2", ...],
        "sample_data": [{"列1": "值1", ...}, ...]
    }
    
    返回:
    {
        "success": true,
        "data": {
            "status": "ready|clarification_needed|rejected",
            "action": "execute|clarify|reject|escalate",
            "branch": "local|llm",
            "intents": [...],  // 意图列表
            "questions": [...],  // 追问问题（如果需要）
            "message": "提示信息"
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
        sample_data = data.get('sample_data', [])
        
        logger.info(f"工作流处理请求: query={user_query}, columns={columns[:5]}...")
        
        # 调用工作流管理器处理
        result = workflow_manager.process(user_query, columns, sample_data)
        
        logger.info(f"工作流处理结果: status={result.get('status')}, action={result.get('action')}")
        
        return jsonify({
            "success": True,
            "data": result
        })
    
    except Exception as e:
        logger.error(f"工作流处理异常: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/v1/workflow/respond', methods=['POST'])
def process_user_response():
    """
    处理用户的追问响应接口
    
    请求参数:
    {
        "response": "用户的选择或输入"
    }
    
    返回:
    {
        "success": true,
        "data": {
            "status": "ready|clarification_needed|rejected",
            "action": "execute|clarify|reject",
            "intents": [...],
            "message": "提示信息"
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'response' not in data:
            return jsonify({
                "success": False,
                "error": "缺少response参数"
            }), 400
        
        user_response = data.get('response')
        
        logger.info(f"用户响应: {user_response}")
        
        # 调用工作流管理器处理用户响应
        result = workflow_manager.process_user_response(user_response)
        
        logger.info(f"响应处理结果: status={result.get('status')}, action={result.get('action')}")
        
        return jsonify({
            "success": True,
            "data": result
        })
    
    except Exception as e:
        logger.error(f"处理用户响应异常: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/v1/workflow/reset', methods=['POST'])
def reset_workflow():
    """
    重置工作流上下文
    """
    try:
        workflow_manager.context.reset()
        return jsonify({
            "success": True,
            "message": "工作流上下文已重置"
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/v1/workflow/status', methods=['GET'])
def get_workflow_status():
    """
    获取当前工作流状态
    """
    try:
        context = workflow_manager.context
        return jsonify({
            "success": True,
            "data": {
                "user_query": context.user_query,
                "branch": context.branch,
                "followup_round": context.followup_round,
                "status": context.status,
                "intent_count": len(context.intents)
            }
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/v1/intent/recognize', methods=['POST'])
def recognize_intent():
    """
    意图识别接口（兼容旧版）
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
        
        if local_recognizer:
            result = local_recognizer.recognize(user_query, columns)
            return jsonify({
                "success": True,
                "data": result
            })
        else:
            return jsonify({
                "success": False,
                "error": "本地意图识别器不可用"
            }), 500
    
    except Exception as e:
        logger.error(f"意图识别异常: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/v1/intent/clarify', methods=['POST'])
def generate_clarification():
    """
    生成追问选项接口（兼容旧版）
    """
    try:
        data = request.get_json()
        
        clarifications_needed = data.get('clarifications_needed', [])
        columns = data.get('columns', [])
        
        if local_recognizer:
            options = local_recognizer.generate_clarification_options(clarifications_needed, columns)
            
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
        else:
            return jsonify({
                "success": False,
                "error": "本地意图识别器不可用"
            }), 500
    
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
        from unified_recognizer import IntentTable
        intent_table = IntentTable()
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
        "service": "unified-workflow-api",
        "components": {
            "local_recognizer": local_recognizer is not None,
            "llm_client": llm_client is not None,
            "workflow_manager": workflow_manager is not None
        }
    })


if __name__ == '__main__':
    logger.info("启动统一意图识别与工作流API服务...")
    logger.info(f"监听端口: 5004")
    app.run(host='0.0.0.0', port=5004, debug=True)
