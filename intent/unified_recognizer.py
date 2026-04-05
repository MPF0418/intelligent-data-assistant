# -*- coding: utf-8 -*-
"""
统一意图识别器
合并了意图识别和实体提取功能
"""

import re
import json
import os
import sys

# 处理导入路径
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# 加载意图表JSON
INTENT_TABLE_PATH = os.path.join(current_dir, 'intent_table.json')

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

class UnifiedIntentRecognizer:
    """统一意图识别器"""
    
    def __init__(self):
        self.intent_table = IntentTable()
        # 初始化时加载意图表
        self.intents = self.intent_table.get_all_intents()
    
    def recognize(self, user_query, columns=None):
        """
        统一的意图识别方法
        
        参数:
            user_query: 用户输入的查询
            columns: 数据表的列信息 (可选)
            
        返回:
            {
                "intents": [
                    {
                        "type": "chart",
                        "name": "绘制图表",
                        "entities": {"chart_type": "bar", "x_axis": "产品"},
                        "is_clear": false,
                        "confidence": 0.9
                    }
                ],
                "all_clear": false,
                "clarifications_needed": ["y_axis"]
            }
        """
        user_query = user_query.strip()
        
        # 1. 识别所有意图
        recognized_intents = self._recognize_all_intents(user_query)
        
        # 2. 提取实体信息（列名匹配）
        if columns:
            recognized_intents = self._extract_entities(recognized_intents, user_query, columns)
        
        # 3. 判断每个意图的需求是否明确
        for intent in recognized_intents:
            intent['is_clear'] = self._is_intent_clear(intent)
        
        # 4. 汇总结果
        all_clear = all(intent.get('is_clear', False) for intent in recognized_intents)
        clarifications_needed = self._get_clarifications_needed(recognized_intents)
        
        return {
            "intents": recognized_intents,
            "all_clear": all_clear,
            "clarifications_needed": clarifications_needed,
            "intent_count": len(recognized_intents)
        }
    
    def _recognize_all_intents(self, user_query):
        """识别所有可能的意图"""
        results = []
        
        for intent_def in self.intents:
            intent_type = intent_def.get('type')
            keywords = intent_def.get('keywords', [])
            
            # 检查是否匹配关键词
            matched = False
            for keyword in keywords:
                if keyword in user_query:
                    matched = True
                    break
            
            if matched:
                results.append({
                    "type": intent_type,
                    "name": intent_def.get('name'),
                    "entities": {},
                    "confidence": 0.8,
                    "method": "keyword"
                })
        
        # 如果没有识别出任何意图，返回空列表
        return results
    
    def _extract_entities(self, intents, user_query, columns):
        """提取实体信息（列名匹配等）"""
        for intent in intents:
            intent_type = intent.get('type')
            
            # 根据不同意图类型提取实体
            if intent_type == 'chart':
                entities = self._extract_chart_entities(user_query, columns)
            elif intent_type == 'sort':
                entities = self._extract_sort_entities(user_query, columns)
            elif intent_type == 'filter':
                entities = self._extract_filter_entities(user_query, columns)
            elif intent_type == 'aggregate':
                entities = self._extract_aggregate_entities(user_query, columns)
            elif intent_type == 'query_value':
                entities = self._extract_query_value_entities(user_query, columns)
            elif intent_type == 'ranking':
                entities = self._extract_ranking_entities(user_query, columns)
            elif intent_type == 'extreme':
                entities = self._extract_extreme_entities(user_query, columns)
            else:
                entities = {}
            
            intent['entities'].update(entities)
        
        return intents
    
    def _extract_chart_entities(self, user_query, columns):
        """提取图表相关实体"""
        entities = {}
        
        # 图表类型识别
        chart_type_map = {
            '柱状图': 'bar', '条形图': 'bar', 'bar': 'bar',
            '折线图': 'line', '线图': 'line', 'line': 'line',
            '饼图': 'pie', '饼': 'pie',
            '散点图': 'scatter', 'scatter': 'scatter',
            '面积图': 'area', 'area': 'area',
            '雷达图': 'radar', 'radar': 'radar'
        }
        
        for chart_keyword, chart_type in chart_type_map.items():
            if chart_keyword in user_query:
                entities['chart_type'] = chart_type
                break
        
        # 尝试匹配列名
        matched_columns = self._match_columns(user_query, columns)
        
        # X轴和Y轴的判断逻辑
        if len(matched_columns) >= 2:
            # 假设第一个匹配的是X轴，第二个是Y轴
            entities['x_axis'] = matched_columns[0]
            entities['y_axis'] = matched_columns[1]
        elif len(matched_columns) == 1:
            # 只有一个匹配，根据上下文判断
            # 简单处理：优先作为Y轴（数值轴）
            entities['y_axis'] = matched_columns[0]
        
        return entities
    
    def _extract_sort_entities(self, user_query, columns):
        """提取排序相关实体"""
        entities = {}
        
        # 排序方向识别
        direction_map = {
            '从大到小': 'desc', '由大到小': 'desc', '降序': 'desc', 'desc': 'desc',
            '从小到大': 'asc', '由小到大': 'asc', '升序': 'asc', 'asc': 'asc',
            '从高到低': 'desc', '从低到高': 'asc'
        }
        
        for dir_keyword, direction in direction_map.items():
            if dir_keyword in user_query:
                entities['sort_direction'] = direction
                break
        
        # 匹配排序列
        matched_columns = self._match_columns(user_query, columns)
        if matched_columns:
            entities['sort_column'] = matched_columns[0]
        
        return entities
    
    def _extract_filter_entities(self, user_query, columns):
        """提取筛选相关实体"""
        entities = {}
        
        # 匹配筛选列和筛选值
        matched_columns = self._match_columns(user_query, columns)
        
        if matched_columns:
            entities['filter_column'] = matched_columns[0]
        
        # 尝试提取筛选值（简化处理）
        # 实际应该更复杂的NLP处理
        value_patterns = [
            r'(男性|女性)',
            r'(\d+)',
            r'大于(\d+)',
            r'小于(\d+)',
            r'包含(\S+)'
        ]
        
        for pattern in value_patterns:
            match = re.search(pattern, user_query)
            if match:
                entities['filter_value'] = match.group(1)
                break
        
        return entities
    
    def _extract_aggregate_entities(self, user_query, columns):
        """提取聚合相关实体"""
        entities = {}
        
        # 聚合方式识别
        method_map = {
            '总和': 'sum', '合计': 'sum', '求和': 'sum',
            '平均': 'avg', '平均值': 'avg', 'mean': 'avg',
            '最大': 'max', '最大值': 'max',
            '最小': 'min', '最小值': 'min',
            '计数': 'count', '多少': 'count',
            '数量': 'count'
        }
        
        for method_keyword, method in method_map.items():
            if method_keyword in user_query:
                entities['aggregate_method'] = method
                break
        
        # 匹配聚合列
        matched_columns = self._match_columns(user_query, columns)
        if matched_columns:
            entities['aggregate_column'] = matched_columns[0]
        
        return entities
    
    def _extract_query_value_entities(self, user_query, columns):
        """提取数值查询相关实体"""
        entities = {}
        
        # 匹配列
        matched_columns = self._match_columns(user_query, columns)
        
        if len(matched_columns) >= 2:
            entities['filter_column'] = matched_columns[0]
            entities['target_column'] = matched_columns[1]
        elif len(matched_columns) == 1:
            entities['target_column'] = matched_columns[0]
        
        return entities
    
    def _extract_ranking_entities(self, user_query, columns):
        """提取排名相关实体"""
        entities = {}
        
        # 排名数量识别
        rank_match = re.search(r'前(\d+)|top(\d+)|前(\d+)名', user_query)
        if rank_match:
            rank_num = rank_match.group(1) or rank_match.group(2) or rank_match.group(3)
            entities['rank_count'] = int(rank_num)
        
        # 匹配排序列
        matched_columns = self._match_columns(user_query, columns)
        if matched_columns:
            entities['rank_column'] = matched_columns[0]
        
        return entities
    
    def _extract_extreme_entities(self, user_query, columns):
        """提取极值查询相关实体"""
        entities = {}
        
        # 极值类型识别
        if '最高' in user_query or '最大' in user_query or '最好' in user_query:
            entities['extreme_type'] = 'max'
        elif '最低' in user_query or '最小' in user_query or '最差' in user_query:
            entities['extreme_type'] = 'min'
        
        # 匹配列
        matched_columns = self._match_columns(user_query, columns)
        if matched_columns:
            entities['target_column'] = matched_columns[0]
        
        return entities
    
    def _match_columns(self, user_query, columns):
        """匹配查询中的列名"""
        matched = []
        user_query_lower = user_query.lower()
        
        for column in columns:
            # 精确匹配
            if column in user_query:
                matched.append(column)
            # 模糊匹配（简化）
            elif column.lower() in user_query_lower:
                matched.append(column)
        
        return matched
    
    def _is_intent_clear(self, intent):
        """判断意图的需求是否明确"""
        intent_type = intent.get('type')
        entities = intent.get('entities', {})
        
        # 获取必要字段
        required_fields = self.intent_table.get_required_fields(intent_type)
        
        # 检查所有必要字段是否都有值
        for field in required_fields:
            if field not in entities or not entities[field]:
                return False
        
        return True
    
    def _get_clarifications_needed(self, intents):
        """获取需要追问的字段"""
        clarifications = []
        
        for intent in intents:
            if not intent.get('is_clear', False):
                intent_type = intent.get('type')
                entities = intent.get('entities', {})
                
                # 获取缺少的必要字段
                required_fields = self.intent_table.get_required_fields(intent_type)
                for field in required_fields:
                    if field not in entities or not entities[field]:
                        template = self.intent_table.get_clarification_template(intent_type, field)
                        clarifications.append({
                            "intent_type": intent_type,
                            "missing_field": field,
                            "question": template
                        })
        
        return clarifications
    
    def generate_clarification_options(self, clarifications_needed, columns):
        """生成追问选项"""
        options = []
        
        for clar in clarifications_needed:
            intent_type = clar.get('intent_type')
            missing_field = clar.get('missing_field')
            
            if missing_field in columns:
                # 使用列名作为选项
                for column in columns:
                    options.append({
                        "intent_type": intent_type,
                        "field": missing_field,
                        "value": column,
                        "question": clar.get('question')
                    })
        
        return options


# 创建全局实例
_recognizer = None

def get_recognizer():
    """获取意图识别器实例"""
    global _recognizer
    if _recognizer is None:
        _recognizer = UnifiedIntentRecognizer()
    return _recognizer
