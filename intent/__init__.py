# -*- coding: utf-8 -*-
"""
意图识别服务模块
合并了意图识别和实体提取功能
"""

import json
import os

# 意图表配置文件路径
INTENT_TABLE_PATH = os.path.join(os.path.dirname(__file__), 'intent_table.json')

class IntentTable:
    """意图表管理器"""
    
    _instance = None
    _intent_table = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def load(self):
        """加载意图表"""
        if self._intent_table is None:
            with open(INTENT_TABLE_PATH, 'r', encoding='utf-8') as f:
                self._intent_table = json.load(f)
        return self._intent_table
    
    def get_all_intents(self):
        """获取所有意图类型"""
        table = self.load()
        return table.get('intents', [])
    
    def get_intent_by_type(self, intent_type):
        """根据类型获取意图定义"""
        intents = self.get_all_intents()
        for intent in intents:
            if intent.get('type') == intent_type:
                return intent
        return None
    
    def get_required_fields(self, intent_type):
        """获取意图的必要字段"""
        intent = self.get_intent_by_type(intent_type)
        if intent:
            return intent.get('required_fields', [])
        return []
    
    def get_optional_fields(self, intent_type):
        """获取意图的可选字段"""
        intent = self.get_intent_by_type(intent_type)
        if intent:
            return intent.get('optional_fields', [])
        return []
    
    def get_all_keywords(self, intent_type):
        """获取意图的关键词"""
        intent = self.get_intent_by_type(intent_type)
        if intent:
            return intent.get('keywords', [])
        return []
    
    def get_clarification_template(self, intent_type, missing_field):
        """获取追问模板"""
        table = self.load()
        templates = table.get('clarification_templates', {})
        intent_templates = templates.get(intent_type, {})
        return intent_templates.get(missing_field, f"请补充 {missing_field} 信息")
    
    def is_intent_vectorizable(self, intent_type):
        """判断意图是否支持向量化"""
        intent = self.get_intent_by_type(intent_type)
        if intent:
            return intent.get('vectorizable', False)
        return False
    
    def get_intent_groups(self):
        """获取意图分组"""
        table = self.load()
        return table.get('intent_groups', {})

# 全局实例
intent_table = IntentTable()
