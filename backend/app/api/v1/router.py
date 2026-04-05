# -*- coding: utf-8 -*-
"""
API路由整合
产品意义：统一管理所有API路由，便于维护和扩展
"""

from flask import Blueprint

# 导入API模块
from app.api.v1.agent import agent_bp
from app.api.v1.rag import rag_bp
from app.api.v1.interaction import interaction_bp
from app.api.v1.analysis import analysis_bp
from app.api.v1.intent import intent_bp
from app.api.v1.query import query_bp
from app.api.v1.vectorization import vectorization_bp
from app.api.v1.core_agent import core_agent_bp

# 创建主API蓝图
api_bp = Blueprint('api', __name__)

# 注册子蓝图
api_bp.register_blueprint(agent_bp, url_prefix='/agent')
api_bp.register_blueprint(rag_bp, url_prefix='/rag')
api_bp.register_blueprint(interaction_bp, url_prefix='/interaction')
api_bp.register_blueprint(analysis_bp, url_prefix='/analysis')
api_bp.register_blueprint(intent_bp, url_prefix='/intent')
api_bp.register_blueprint(query_bp, url_prefix='/query')
api_bp.register_blueprint(vectorization_bp, url_prefix='/vectorization')
api_bp.register_blueprint(core_agent_bp, url_prefix='/core-agent')
