# -*- coding: utf-8 -*-
"""
大模型客户端模块
负责调用大模型API进行意图识别、拒识判断、追问生成等
"""

import json
import logging
from typing import Dict, Any, Optional, Callable

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)


class LLMClient:
    """
    大模型客户端
    
    支持多种大模型接入：
    - OpenAI API
    - Claude API
    - 兼容OpenAI格式的API
    
    核心功能：
    1. 意图识别 + 实体提取
    2. 拒识判断
    3. 追问生成
    4. 配置生成
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        初始化大模型客户端
        
        Args:
            config: 配置信息，包含 api_key, base_url, model 等
        """
        self.config = config or {}
        self.api_key = self.config.get('api_key', '')
        self.base_url = self.config.get('base_url', 'https://api.openai.com/v1')
        self.model = self.config.get('model', 'gpt-3.5-turbo')
        self._client = None
    
    def _get_client(self):
        """获取实际的API客户端"""
        if self._client is None:
            # 这里可以集成实际的API客户端
            # 目前先返回None，使用模拟实现
            pass
        return self._client
    
    def analyze(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        分析用户查询
        
        这是主要的入口方法，根据上下文自动选择合适的处理方式：
        1. 首先判断是否与数据分析相关（拒识判断）
        2. 如果相关，进行意图识别和实体提取
        3. 如果意图不明确，生成追问问题
        
        Args:
            context: 包含 user_query, columns, sample_data, history 等
        
        Returns:
            分析结果字典
        """
        try:
            from llm_prompts import LLMPromptManager
        except ImportError:
            # 尝试相对导入
            LLMPromptManager = None
        
        user_query = context.get('user_query', '')
        
        # Step 1: 拒识判断
        logger.info(f"大模型分析: {user_query}")
        
        # 先尝试本地解析，如果失败再调用API
        # 这里简化实现，实际应该调用大模型API
        
        # 调用大模型进行意图识别
        prompt = LLMPromptManager.generate_intent_recognition_prompt(context)
        
        try:
            # 这里应该调用实际的API
            # result = self._call_api(prompt)
            # 模拟返回结果
            result = self._mock_intent_recognition(user_query, context.get('columns', []))
            
            return result
            
        except Exception as e:
            logger.error(f"大模型分析失败: {e}")
            return {
                'is_rejected': True,
                'message': f'分析失败: {str(e)}',
                'suggestions': ['请尝试更清晰地描述您的需求']
            }
    
    def _call_api(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """
        调用大模型API
        
        Args:
            prompt: 用户提示词
            system_prompt: 系统提示词
        
        Returns:
            大模型返回的文本
        """
        # 实际实现应该调用API
        # 这里留作接口，实际使用时请实现具体的API调用逻辑
        
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': self.model,
            'messages': [
                {'role': 'system', 'content': system_prompt or '你是一个智能数据分析助手。'},
                {'role': 'user', 'content': prompt}
            ],
            'temperature': 0.7,
            'max_tokens': 2000
        }
        
        # 发起请求
        # import requests
        # response = requests.post(
        #     f'{self.base_url}/chat/completions',
        #     headers=headers,
        #     json=payload,
        #     timeout=30
        # )
        # return response.json()['choices'][0]['message']['content']
        
        raise NotImplementedError("请实现具体的API调用逻辑")
    
    def _mock_intent_recognition(self, query: str, columns: list) -> Dict[str, Any]:
        """
        模拟意图识别（用于测试）
        
        实际使用时应该删除此方法，使用真实API调用
        """
        try:
            from llm_prompts import LLMPromptManager
        except ImportError:
            LLMPromptManager = None
        
        query_lower = query.lower()
        intents = []
        
        # 检测图表意图
        chart_keywords = ['图', '图表', '绘制', '画图', '可视化', '柱状图', '折线图', '饼图', 'bar', 'line', 'pie']
        if any(kw in query_lower for kw in chart_keywords):
            chart_type = 'bar'
            if '折线' in query_lower or 'line' in query_lower:
                chart_type = 'line'
            elif '饼' in query_lower or 'pie' in query_lower:
                chart_type = 'pie'
            
            # 尝试匹配X/Y轴
            x_axis = None
            y_axis = None
            for col in columns:
                col_lower = col.lower()
                if 'x_axis' not in locals() and any(kw in col_lower for kw in ['地区', '省', '市', '区域', '产品', '类别']):
                    x_axis = col
                if 'y_axis' not in locals() and any(kw in col_lower for kw in ['销售', '利润', '金额', '数量', '额']):
                    y_axis = col
            
            intents.append({
                'type': 'chart',
                'name': '绘制图表',
                'entities': {
                    'chart_type': chart_type,
                    'x_axis': x_axis,
                    'y_axis': y_axis
                },
                'is_clear': x_axis is not None and y_axis is not None,
                'confidence': 0.9
            })
        
        # 检测排序意图
        sort_keywords = ['排序', '从高到低', '从低到高', '升序', '降序', 'asc', 'desc', '由大到小', '由小到大']
        if any(kw in query_lower for kw in sort_keywords):
            sort_direction = 'desc' if any(kw in query_lower for kw in ['从高到低', '降序', '由大到小', 'desc']) else 'asc'
            
            # 尝试匹配排序列
            sort_column = None
            for col in columns:
                col_lower = col.lower()
                if any(kw in col_lower for kw in ['销售', '利润', '金额', '数量', '额', '业绩']):
                    sort_column = col
                    break
            
            intents.append({
                'type': 'sort',
                'name': '排序',
                'entities': {
                    'sort_column': sort_column,
                    'sort_direction': sort_direction
                },
                'is_clear': sort_column is not None,
                'confidence': 0.9
            })
        
        # 检测筛选意图
        filter_keywords = ['筛选', '过滤', '查找', '查询', '找出', '只看', '只要']
        if any(kw in query_lower for kw in filter_keywords):
            # 尝试匹配筛选列和值
            filter_column = None
            filter_value = None
            
            for col in columns:
                col_lower = col.lower()
                # 检查是否提到了某列的值
                for val in query_lower.split():
                    if val in col_lower:
                        filter_column = col
                        break
            
            intents.append({
                'type': 'filter',
                'name': '筛选',
                'entities': {
                    'filter_column': filter_column,
                    'filter_value': filter_value
                },
                'is_clear': filter_column is not None and filter_value is not None,
                'confidence': 0.8
            })
        
        # 检测聚合意图
        aggregate_keywords = ['统计', '汇总', '总和', '合计', '平均', '求和', '分组', '各', '每个']
        if any(kw in query_lower for kw in aggregate_keywords):
            aggregate_method = 'sum'
            if '平均' in query_lower:
                aggregate_method = 'mean'
            elif '计数' in query_lower or 'count' in query_lower:
                aggregate_method = 'count'
            
            intents.append({
                'type': 'aggregate',
                'name': '聚合计算',
                'entities': {
                    'aggregate_column': None,
                    'aggregate_method': aggregate_method,
                    'group_by': None
                },
                'is_clear': False,
                'confidence': 0.8
            })
        
        # 如果没有识别到任何意图，返回拒识
        if not intents:
            return {
                'is_rejected': True,
                'message': '抱歉，我无法理解您的需求。请尝试更清晰地描述您的数据分析需求。',
                'suggestions': [
                    '统计各省份的平均销售额',
                    '绘制销售额柱状图',
                    '按地区分组统计数量'
                ]
            }
        
        # 检查是否有不明确的意图
        unclear_intents = [i for i in intents if not i.get('is_clear')]
        
        return {
            'intents': intents,
            'all_clear': len(unclear_intents) == 0,
            'clarification_needed': [
                {
                    'intent_type': i.get('type'),
                    'missing_fields': self._get_missing_fields(i)
                }
                for i in unclear_intents
            ]
        }
    
    def _get_missing_fields(self, intent: Dict) -> list:
        """获取缺失的字段"""
        missing = []
        entities = intent.get('entities', {})
        
        intent_type = intent.get('type')
        
        if intent_type == 'chart':
            if not entities.get('chart_type'):
                missing.append('chart_type')
            if not entities.get('x_axis'):
                missing.append('x_axis')
            if not entities.get('y_axis'):
                missing.append('y_axis')
        
        elif intent_type == 'sort':
            if not entities.get('sort_column'):
                missing.append('sort_column')
            if not entities.get('sort_direction'):
                missing.append('sort_direction')
        
        elif intent_type == 'filter':
            if not entities.get('filter_column'):
                missing.append('filter_column')
            if not entities.get('filter_value'):
                missing.append('filter_value')
        
        elif intent_type == 'aggregate':
            if not entities.get('aggregate_column'):
                missing.append('aggregate_column')
            if not entities.get('aggregate_method'):
                missing.append('aggregate_method')
        
        return missing


class MockLLMClient(LLMClient):
    """模拟大模型客户端，用于测试"""
    
    def __init__(self):
        super().__init__({})
    
    def analyze(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """使用模拟逻辑进行分析"""
        return self._mock_intent_recognition(
            context.get('user_query', ''),
            context.get('columns', [])
        )


__all__ = ['LLMClient', 'MockLLMClient']
