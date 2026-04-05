# -*- coding: utf-8 -*-
"""
大模型提示词模块
包含拒识判断、追问生成等核心提示词
"""

from typing import Dict, Any, List, Optional


class LLMPromptManager:
    """
    大模型提示词管理器
    
    负责生成各种场景下的提示词：
    1. 意图识别 + 实体提取
    2. 拒识判断
    3. 追问生成
    4. 配置生成
    """
    
    # 意图类型定义
    INTENT_TYPES = [
        "query_value",  # 数值查询
        "chart",        # 绘制图表
        "sort",         # 排序
        "filter",       # 筛选
        "aggregate",    # 聚合计算
        "compare",      # 对比分析
        "trend",        # 趋势分析
        "ranking",      # 排名
        "export"        # 导出数据
    ]
    
    # 意图类型中文名
    INTENT_NAMES = {
        "query_value": "数值查询",
        "chart": "绘制图表",
        "sort": "排序",
        "filter": "筛选",
        "aggregate": "聚合计算",
        "compare": "对比分析",
        "trend": "趋势分析",
        "ranking": "排名",
        "export": "导出数据"
    }
    
    @classmethod
    def generate_intent_recognition_prompt(cls, context: Dict[str, Any]) -> str:
        """
        生成意图识别提示词
        
        Args:
            context: 包含 user_query, columns, sample_data, history 等
        
        Returns:
            提示词字符串
        """
        user_query = context.get('user_query', '')
        columns = context.get('columns', [])
        sample_data = context.get('sample_data', [])
        history = context.get('history', [])
        
        # 构建列信息
        column_info = "\n".join([f"- {col}" for col in columns])
        
        # 构建样例数据
        sample_lines = []
        for row in sample_data[:5]:
            line = ", ".join([f"{k}: {v}" for k, v in row.items()])
            sample_lines.append(line)
        sample_info = "\n".join(sample_lines) if sample_lines else "无样例数据"
        
        # 构建历史信息
        history_info = ""
        if history:
            history_lines = []
            for item in history[-5:]:  # 最近5条
                role = "用户" if item.get('type') == 'user' else "系统"
                content = item.get('content', '')[:100]  # 截断
                history_lines.append(f"{role}: {content}")
            history_info = "\n".join(history_lines)
        
        prompt = f"""你是一个智能数据分析助手，负责理解用户的查询意图并提取相关实体。

## 当前任务
分析以下用户查询，识别出所有数据分析相关的意图，并提取每个意图所需的实体。

## 用户查询
{user_query}

## 数据列信息
{column_info}

## 数据样例
{sample_info}

{f"## 对话历史\n{history_info}\n" if history_info else ""}
## 意图类型定义
请识别以下意图类型（可多选）：

1. **query_value** (数值查询): 查询某个筛选条件下的数值
   - 必要字段: filter_column, filter_value, target_column
   - 示例: "广东省的销售额是多少"

2. **chart** (绘制图表): 绘制数据图表
   - 必要字段: chart_type, x_axis, y_axis
   - 示例: "绘制销售额柱状图"

3. **sort** (排序): 对数据进行排序
   - 必要字段: sort_column, sort_direction
   - 示例: "按销售额从高到低排序"

4. **filter** (筛选): 筛选数据
   - 必要字段: filter_column, filter_value
   - 示例: "筛选出华东地区的数据"

5. **aggregate** (聚合计算): 聚合计算
   - 必要字段: aggregate_column, aggregate_method, group_by
   - 示例: "按地区统计销售额总和"

6. **compare** (对比分析): 对比分析
   - 必要字段: compare_column, group_by
   - 示例: "对比各地区的销售额"

7. **trend** (趋势分析): 趋势分析
   - 必要字段: time_column, value_column
   - 示例: "分析销售额的变化趋势"

8. **ranking** (排名): 排名
   - 必要字段: rank_column, top_n
   - 示例: "销售额前10的产品"

9. **export** (导出数据): 导出数据
   - 必要字段: export_format
   - 示例: "导出为Excel"

## 输出要求
请以JSON格式输出，结构如下：
```json
{{
    "intents": [
        {{
            "type": "chart",
            "name": "绘制图表",
            "entities": {{"chart_type": "bar", "x_axis": "地区", "y_axis": "销售额"}},
            "is_clear": true,
            "confidence": 0.95
        }}
    ],
    "all_clear": true,
    "clarification_needed": []
}}
```

**重要规则**：
1. 必须从用户查询中识别出**所有**可能的意图，不能遗漏
2. 对于每个意图，检查必要字段是否都能从查询中提取
3. 如果某个意图的必要字段无法提取，设置 is_clear: false，并在 clarification_needed 中说明缺少什么
4. 只需要输出JSON，不要有其他文字"""
        
        return prompt
    
    @classmethod
    def generate_rejection_check_prompt(cls, user_query: str) -> str:
        """
        生成拒识判断提示词
        
        Args:
            user_query: 用户查询
        
        Returns:
            提示词字符串
        """
        prompt = f"""你是一个智能数据分析助手，负责判断用户查询是否与数据分析相关。

## 用户查询
{user_query}

## 判断标准
- **与数据分析相关**：查询、数据统计、数据可视化、图表绘制、数据筛选、排序、聚合计算、趋势分析、数据导出等
- **与数据分析无关**：天气查询、订餐、导航、聊天、诗词、新闻、娱乐等非数据分析需求

## 输出要求
请以JSON格式输出：
```json
{{
    "is_related": true/false,
    "reason": "判断理由",
    "message": "如果拒识，给用户的提示信息",
    "suggestions": ["建议1", "建议2", "建议3"]
}}
```

**注意**：只要用户有一点点数据分析的可能，就判断为相关。宁可误判为相关，也不要错判为无关。"""
        
        return prompt
    
    @classmethod
    def generate_clarification_prompt(cls, context: Dict[str, Any]) -> str:
        """
        生成追问提示词
        
        Args:
            context: 包含 intents, unclear_intents, columns, sample_data 等
        
        Returns:
            提示词字符串
        """
        intents = context.get('intents', [])
        unclear_intents = context.get('unclear_intents', [])
        columns = context.get('columns', [])
        sample_data = context.get('sample_data', [])
        
        # 构建列信息
        column_info = "\n".join([f"- {col}" for col in columns])
        
        # 构建不明确的意图信息
        unclear_info = []
        for intent in unclear_intents:
            intent_type = intent.get('type')
            name = cls.INTENT_NAMES.get(intent_type, intent_type)
            missing = intent.get('missing_fields', [])
            unclear_info.append(f"- {name}: 缺少 {', '.join(missing)}")
        
        unclear_str = "\n".join(unclear_info) if unclear_info else "无"
        
        prompt = f"""你是一个智能数据分析助手，负责在用户需求不明确时生成追问问题。

## 当前状态
用户已经表达了以下意图，但部分意图的信息不完整：

## 已识别的意图
{json.dumps(intents, ensure_ascii=False, indent=2)}

## 信息不完整的意图
{unclear_str}

## 数据列信息
{column_info}

## 追问要求
1. 为每个信息不完整的意图生成追问问题
2. 追问问题要简洁明了，便于用户理解
3. 提供选项时，从数据列中选择合适的选项
4. 必须包含"以上都不是，意图识别有误"选项，让用户可以转向大模型

## 输出要求
请以JSON格式输出：
```json
{{
    "needs_clarification": true,
    "questions": [
        {{
            "intent_type": "chart",
            "field": "y_axis",
            "question": "请问Y轴要显示什么字段？",
            "options": [
                {{"label": "销售额", "value": "销售额"}},
                {{"label": "利润", "value": "利润"}},
                {{"label": "数量", "value": "数量"}}
            ]
        }}
    ],
    "message": "请补充以下信息以便我更好地为您服务"
}}
```"""
        
        return prompt
    
    @classmethod
    def generate_config_prompt(cls, context: Dict[str, Any]) -> str:
        """
        生成执行配置提示词
        
        Args:
            context: 包含 intents, columns, sample_data 等
        
        Returns:
            提示词字符串
        """
        intents = context.get('intents', [])
        columns = context.get('columns', [])
        sample_data = context.get('sample_data', [])
        
        # 构建列信息
        column_info = "\n".join([f"- {col}" for col in columns])
        
        # 构建样例数据
        sample_lines = []
        for row in sample_data[:3]:
            line = ", ".join([f"{k}: {v}" for k, v in row.items()])
            sample_lines.append(line)
        sample_info = "\n".join(sample_lines) if sample_lines else "无"
        
        prompt = f"""你是一个智能数据分析助手，负责生成数据查询和可视化的执行配置。

## 已识别的意图
{json.dumps(intents, ensure_ascii=False, indent=2)}

## 数据列信息
{column_info}

## 数据样例
{sample_info}

## 配置生成要求
根据已识别的意图，生成对应的执行配置：

1. **查询类意图 (filter, query_value)**:
   - 生成筛选条件
   - 确定目标列

2. **图表类意图 (chart)**:
   - 确定图表类型 (bar, line, pie, scatter)
   - 确定X轴和Y轴
   - 如需排序，确定排序字段和方向

3. **排序类意图 (sort)**:
   - 确定排序列
   - 确定排序方向 (asc/desc)

4. **聚合类意图 (aggregate)**:
   - 确定聚合列
   - 确定聚合方式 (sum, mean, count, max, min)
   - 确定分组列

5. **趋势类意图 (trend)**:
   - 确定时间列
   - 确定数值列

6. **排名类意图 (ranking)**:
   - 确定排名列
   - 确定Top N

7. **导出类意图 (export)**:
   - 确定导出格式

## 输出要求
请以JSON格式输出，包含所有需要执行的配置："""
        
        return prompt
    
    @classmethod
    def parse_llm_response(cls, response: str, expected_type: str = 'intents') -> Dict[str, Any]:
        """
        解析大模型响应
        
        Args:
            response: 大模型返回的文本
            expected_type: 期望的响应类型
        
        Returns:
            解析后的字典
        """
        import json
        import re
        
        # 尝试提取JSON部分
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            try:
                result = json.loads(json_match.group())
                return result
            except json.JSONDecodeError:
                pass
        
        # 返回错误
        return {
            'error': '无法解析大模型响应',
            'raw_response': response
        }


# 辅助函数：导入json
import json

__all__ = ['LLMPromptManager']
