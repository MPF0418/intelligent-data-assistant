# -*- coding: utf-8 -*-
"""
配置管理模块
产品意义：集中管理所有配置，便于维护和部署
"""

import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# API配置
class APIConfig:
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
    ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
    API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:5001')
    API_TIMEOUT = int(os.getenv('API_TIMEOUT', '30'))

# 数据库配置
class DatabaseConfig:
    CHROMA_DB_PATH = os.getenv('CHROMA_DB_PATH', './chromadb')
    CHROMA_COLLECTION_NAME = os.getenv('CHROMA_COLLECTION_NAME', 'data_insight')
    CHROMA_ANNOY_INDEX_N_TREES = int(os.getenv('CHROMA_ANNOY_INDEX_N_TREES', '10'))

# Agent配置
class AgentConfig:
    MAX_STEPS = int(os.getenv('MAX_STEPS', '10'))
    MAX_TOKENS = int(os.getenv('MAX_TOKENS', '4096'))
    TEMPERATURE = float(os.getenv('TEMPERATURE', '0.7'))
    AGENT_TIMEOUT = int(os.getenv('AGENT_TIMEOUT', '60'))

# RAG配置
class RAGConfig:
    EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'sentence-transformers/all-MiniLM-L6-v2')
    CHUNK_SIZE = int(os.getenv('CHUNK_SIZE', '1000'))
    CHUNK_OVERLAP = int(os.getenv('CHUNK_OVERLAP', '100'))
    TOP_K = int(os.getenv('TOP_K', '5'))
    SIMILARITY_THRESHOLD = float(os.getenv('SIMILARITY_THRESHOLD', '0.7'))

# 系统配置
class SystemConfig:
    DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    MAX_REQUEST_SIZE = int(os.getenv('MAX_REQUEST_SIZE', '10485760'))  # 10MB

# 导出配置
config = {
    'api': APIConfig,
    'database': DatabaseConfig,
    'agent': AgentConfig,
    'rag': RAGConfig,
    'system': SystemConfig
}
