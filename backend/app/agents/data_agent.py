# -*- coding: utf-8 -*-
"""
数据Agent
产品意义：负责数据理解、数据质量评估和数据预处理
"""

from typing import Dict, Any, Optional
from pydantic import BaseModel
from app.utils.langchain_utils import LangChainUtils
from app.utils.langgraph_utils import LangGraphUtils

class DataState(BaseModel):
    """数据Agent的状态结构"""
    data: Dict[str, Any]
    data_schema: Dict[str, Any] = {}
    data_profile: Dict[str, Any] = {}
    quality_issues: list = []
    recommendations: list = []
    error: Optional[str] = None
    completed: bool = False

class DataAgent:
    def __init__(self):
        """初始化数据Agent"""
        self.langchain_utils = LangChainUtils()
        self.langgraph_utils = LangGraphUtils()
        self.llm = self.langchain_utils.get_llm()
    
    def analyze_schema(self, state: DataState) -> DataState:
        """
        分析数据结构
        产品意义：理解数据的结构和字段含义
        """
        try:
            data = state.data
            
            # 提取数据结构
            if isinstance(data, dict) and 'headers' in data and 'rows' in data:
                headers = data['headers']
                rows = data['rows']
                
                # 分析每个字段的类型和统计信息
                schema = {}
                for i, header in enumerate(headers):
                    # 提取该字段的所有值
                    values = [row[i] for row in rows if i < len(row)]
                    # 过滤空值
                    non_empty_values = [v for v in values if v is not None and v != '']
                    
                    # 简单类型推断
                    field_type = 'text'
                    if non_empty_values:
                        # 检查是否为数值
                        is_numeric = True
                        for v in non_empty_values:
                            try:
                                float(v)
                            except:
                                is_numeric = False
                                break
                        if is_numeric:
                            field_type = 'numeric'
                        # 检查是否为日期
                        elif any('日期' in header or '时间' in header for header in [header]):
                            field_type = 'datetime'
                    
                    schema[header] = {
                        'type': field_type,
                        'count': len(values),
                        'non_empty_count': len(non_empty_values),
                        'empty_count': len(values) - len(non_empty_values),
                        'unique_count': len(set(non_empty_values)) if non_empty_values else 0
                    }
                
                state.data_schema = schema
            
        except Exception as e:
            state.error = f"分析数据结构失败: {str(e)}"
        
        return state
    
    def profile_data(self, state: DataState) -> DataState:
        """
        数据画像
        产品意义：评估数据质量，发现数据特征
        """
        try:
            schema = state.data_schema
            
            if not schema:
                state.error = "数据结构未分析"
                return state
            
            # 计算数据质量指标
            total_fields = len(schema)
            total_values = sum([field['count'] for field in schema.values()])
            total_empty = sum([field['empty_count'] for field in schema.values()])
            
            completeness = (1 - total_empty / total_values) * 100 if total_values > 0 else 0
            
            # 分析字段类型分布
            type_distribution = {}
            for field_name, field_info in schema.items():
                field_type = field_info['type']
                if field_type not in type_distribution:
                    type_distribution[field_type] = 0
                type_distribution[field_type] += 1
            
            # 发现数据质量问题
            quality_issues = []
            for field_name, field_info in schema.items():
                empty_ratio = field_info['empty_count'] / field_info['count'] if field_info['count'] > 0 else 0
                if empty_ratio > 0.5:
                    quality_issues.append({
                        'field': field_name,
                        'issue': f"字段空值比例过高 ({empty_ratio:.2%})",
                        'severity': 'high'
                    })
                elif empty_ratio > 0.2:
                    quality_issues.append({
                        'field': field_name,
                        'issue': f"字段空值比例较高 ({empty_ratio:.2%})",
                        'severity': 'medium'
                    })
            
            state.data_profile = {
                'completeness': round(completeness, 2),
                'field_count': total_fields,
                'type_distribution': type_distribution,
                'total_values': total_values,
                'empty_values': total_empty
            }
            
            state.quality_issues = quality_issues
            
        except Exception as e:
            state.error = f"数据画像失败: {str(e)}"
        
        return state
    
    def generate_recommendations(self, state: DataState) -> DataState:
        """
        生成数据处理建议
        产品意义：基于数据质量问题提供改进建议
        """
        try:
            profile = state.data_profile
            issues = state.quality_issues
            
            if not profile:
                state.error = "数据画像未完成"
                return state
            
            system_prompt = """
            你是一个专业的数据质量分析师，负责根据数据画像和质量问题生成数据处理建议。
            
            请根据以下信息，生成详细的数据处理建议：
            1. 数据质量概览
            2. 具体质量问题的处理建议
            3. 数据预处理步骤建议
            4. 数据使用注意事项
            
            建议应该具体、可操作，并且针对业务场景。
            """
            
            chain = self.langchain_utils.create_chat_chain(system_prompt, self.llm)
            
            input_data = f"数据画像: {profile}\n质量问题: {issues}"
            recommendations = chain.invoke({"input": input_data})
            
            # 解析建议（简化处理）
            state.recommendations = [
                {
                    "type": "data_quality",
                    "content": recommendations
                }
            ]
            
            state.completed = True
            
        except Exception as e:
            state.error = f"生成建议失败: {str(e)}"
        
        return state
    
    def create_workflow(self):
        """
        创建数据Agent工作流
        产品意义：定义数据处理流程的执行顺序
        """
        graph = self.langgraph_utils.create_state_graph(DataState)
        
        # 添加节点
        graph.add_node("analyze_schema", self.analyze_schema)
        graph.add_node("profile_data", self.profile_data)
        graph.add_node("generate_recommendations", self.generate_recommendations)
        
        # 添加边
        graph.set_entry_point("analyze_schema")
        graph.add_edge("analyze_schema", "profile_data")
        graph.add_edge("profile_data", "generate_recommendations")
        graph.add_edge("generate_recommendations", END)
        
        # 编译工作流
        workflow = self.langgraph_utils.compile_graph(graph, "data_workflow")
        return workflow
    
    def run_data_analysis(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        运行数据分析流程
        产品意义：执行完整的数据理解和质量评估
        """
        workflow = self.create_workflow()
        
        initial_state = DataState(
            data=data
        )
        
        result = self.langgraph_utils.run_workflow(workflow, initial_state)
        
        return {
            "data_schema": result.data_schema,
            "data_profile": result.data_profile,
            "quality_issues": result.quality_issues,
            "recommendations": result.recommendations,
            "error": result.error,
            "completed": result.completed
        }
