# -*- coding: utf-8 -*-
"""
系统设置配置模块
支持本地模型和大模型流程的配置
"""

import json
import os
from typing import Dict, Any, Optional


class SystemConfig:
    """
    系统配置管理
    
    支持的配置项：
    - 是否使用本地模型
    - 本地模型配置
    - 大模型配置
    - 追问配置
    - 拒识配置
    """
    
    DEFAULT_CONFIG = {
        # 意图识别设置
        "intent_recognition": {
            "use_local_model": True,           # 是否使用本地模型
            "local_model_fallback": True,      # 本地模型失败时是否转大模型
            "confidence_threshold": 0.3,        # 置信度阈值
        },
        
        # 追问设置
        "clarification": {
            "max_rounds_local": 3,             # 本地模型最大追问轮次
            "max_rounds_llm": 3,               # 大模型最大追问轮次
            "include_intent_error_option": True,  # 是否包含"意图识别有误"选项
        },
        
        # 拒识设置
        "rejection": {
            "local_model_can_reject": True,    # 本地模型是否能拒识
            "llm_can_reject": True,            # 大模型是否能拒识
            "rejection_message": "抱歉，我无法理解您的需求。请尝试更清晰地描述您的数据分析需求。",
        },
        
        # 大模型设置
        "llm": {
            "enabled": True,                   # 是否启用大模型
            "provider": "openai",              # 大模型提供商
            "model": "gpt-3.5-turbo",         # 模型名称
            "temperature": 0.7,                # 温度参数
            "max_tokens": 2000,                # 最大token数
        },
        
        # 向量化设置
        "vectorization": {
            "enabled": True,                   # 是否启用向量化
            "use_for_entity_matching": True,   # 是否用于实体匹配
            "cache_results": True,              # 是否缓存结果
        },
        
        # 性能设置
        "performance": {
            "enable_cache": True,               # 是否启用缓存
            "cache_ttl": 3600,                 # 缓存有效期（秒）
            "request_timeout": 30,              # 请求超时（秒）
            "max_retries": 3,                  # 最大重试次数
        },
        
        # 日志设置
        "logging": {
            "level": "INFO",                   # 日志级别
            "log_decisions": True,             # 是否记录决策路径
            "log_file": "./logs/intent.log",   # 日志文件路径
        }
    }
    
    def __init__(self, config_path: Optional[str] = None):
        """
        初始化配置管理器
        
        Args:
            config_path: 配置文件路径
        """
        self.config_path = config_path or "./config/intent_config.json"
        self.config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """加载配置"""
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    user_config = json.load(f)
                
                # 合并默认配置和用户配置
                config = self.DEFAULT_CONFIG.copy()
                self._deep_merge(config, user_config)
                return config
            except Exception as e:
                print(f"Failed to load config: {e}")
                return self.DEFAULT_CONFIG.copy()
        else:
            # 使用默认配置
            return self.DEFAULT_CONFIG.copy()
    
    def _deep_merge(self, base: Dict, update: Dict):
        """深度合并字典"""
        for key, value in update.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._deep_merge(base[key], value)
            else:
                base[key] = value
    
    def save_config(self):
        """保存配置到文件"""
        os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
        
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        获取配置项
        
        Args:
            key: 配置键（支持点号分隔的路径，如 "llm.model"）
            default: 默认值
        
        Returns:
            配置值
        """
        keys = key.split('.')
        value = self.config
        
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        
        return value
    
    def set(self, key: str, value: Any):
        """
        设置配置项
        
        Args:
            key: 配置键
            value: 配置值
        """
        keys = key.split('.')
        config = self.config
        
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        
        config[keys[-1]] = value
    
    def is_local_model_enabled(self) -> bool:
        """是否启用本地模型"""
        return self.get("intent_recognition.use_local_model", True)
    
    def is_llm_enabled(self) -> bool:
        """是否启用大模型"""
        return self.get("llm.enabled", True)
    
    def get_max_clarification_rounds(self, branch: str = "local") -> int:
        """
        获取最大追问轮次
        
        Args:
            branch: 分支类型 ("local" 或 "llm")
        
        Returns:
            最大轮次
        """
        if branch == "llm":
            return self.get("clarification.max_rounds_llm", 3)
        return self.get("clarification.max_rounds_local", 3)
    
    def can_local_model_reject(self) -> bool:
        """本地模型是否能拒识"""
        return self.get("rejection.local_model_can_reject", True)
    
    def can_llm_reject(self) -> bool:
        """大模型是否能拒识"""
        return self.get("rejection.llm_can_reject", True)
    
    def get_rejection_message(self) -> str:
        """获取拒识提示信息"""
        return self.get("rejection.rejection_message", "抱歉，我无法理解您的需求。")
    
    def get_llm_config(self) -> Dict[str, Any]:
        """获取大模型配置"""
        return self.get("llm", {})
    
    def get_vectorization_config(self) -> Dict[str, Any]:
        """获取向量化配置"""
        return self.get("vectorization", {})
    
    def reset_to_default(self):
        """重置为默认配置"""
        self.config = self.DEFAULT_CONFIG.copy()
        self.save_config()


# 全局配置实例
_config = None


def get_config(config_path: Optional[str] = None) -> SystemConfig:
    """
    获取配置实例（单例）
    
    Args:
        config_path: 配置文件路径
    
    Returns:
        配置实例
    """
    global _config
    
    if _config is None:
        _config = SystemConfig(config_path)
    
    return _config


def is_local_model_enabled() -> bool:
    """是否启用本地模型"""
    return get_config().is_local_model_enabled()


def is_llm_enabled() -> bool:
    """是否启用大模型"""
    return get_config().is_llm_enabled()


__all__ = ['SystemConfig', 'get_config', 'is_local_model_enabled', 'is_llm_enabled']
