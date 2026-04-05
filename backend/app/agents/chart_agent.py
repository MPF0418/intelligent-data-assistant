# -*- coding: utf-8 -*-
"""
图表Agent
产品意义：负责智能图表类型推荐和可视化配置
"""

from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from app.utils.langchain_utils import LangChainUtils
from app.utils.langgraph_utils import LangGraphUtils

class ChartState(BaseModel):
    """图表Agent的状态结构"""
    user_query: str
    data_schema: Dict[str, Any]
    chart_recommendations: List[Dict[str, Any]] = []
    chart_config: Dict[str, Any] = {}
    error: Optional[str] = None
    completed: bool = False

class ChartAgent:
    def __init__(self):
        """初始化图表Agent"""
        self.langchain_utils = LangChainUtils()
        self.langgraph_utils = LangGraphUtils()
        self.llm = self.langchain_utils.get_llm()
    
    def analyze_query(self, state: ChartState) -> ChartState:
        """
        分析用户查询
        产品意义：理解用户的可视化需求
        """
        try:
            system_prompt = """
            你是一个专业的数据分析可视化专家，负责分析用户的查询意图并理解其可视化需求。
            
            请分析用户查询，提取关键的可视化需求，包括：
            1. 分析类型（如趋势分析、对比分析、分布分析等）
            2. 关注的维度和指标
            3. 可能的图表类型偏好
            
            输出格式：
            {
                "analysis_type": "分析类型",
                "dimensions": ["维度1", "维度2"],
                "metrics": ["指标1", "指标2"],
                "chart_preferences": ["图表类型1", "图表类型2"]
            }
            """
            
            chain = self.langchain_utils.create_chat_chain(system_prompt, self.llm)
            result = chain.invoke({"input": state.user_query})
            
            # 解析结果（简化处理）
            import json
            try:
                analysis_result = json.loads(result)
                state.chart_config["analysis_type"] = analysis_result.get("analysis_type", "unknown")
                state.chart_config["dimensions"] = analysis_result.get("dimensions", [])
                state.chart_config["metrics"] = analysis_result.get("metrics", [])
                state.chart_config["chart_preferences"] = analysis_result.get("chart_preferences", [])
            except Exception:
                # 降级处理
                state.chart_config["analysis_type"] = "basic"
                state.chart_config["dimensions"] = []
                state.chart_config["metrics"] = []
                state.chart_config["chart_preferences"] = ["柱状图", "折线图"]
            
        except Exception as e:
            state.error = f"分析查询失败: {str(e)}"
        
        return state
    
    def recommend_charts(self, state: ChartState) -> ChartState:
        """
        推荐图表类型
        产品意义：基于数据结构和用户需求推荐合适的图表类型
        """
        try:
            schema = state.data_schema
            analysis_type = state.chart_config.get("analysis_type", "basic")
            dimensions = state.chart_config.get("dimensions", [])
            metrics = state.chart_config.get("metrics", [])
            
            system_prompt = """
            你是一个专业的图表推荐专家，负责根据数据结构和分析需求推荐合适的图表类型。
            
            请根据以下信息，推荐最适合的图表类型：
            1. 数据结构：包含字段名称和类型
            2. 分析类型：如趋势分析、对比分析、分布分析等
            3. 关注的维度和指标
            
            对于每种推荐的图表类型，请提供：
            - 图表类型名称
            - 推荐理由
            - 适用场景
            - 配置建议（如X轴、Y轴字段等）
            
            请推荐3-5种图表类型，按适用性排序。
            """
            
            chain = self.langchain_utils.create_chat_chain(system_prompt, self.llm)
            
            input_data = f"数据结构: {schema}\n分析类型: {analysis_type}\n维度: {dimensions}\n指标: {metrics}"
            recommendations = chain.invoke({"input": input_data})
            
            # 解析推荐结果（简化处理）
            # 实际应该使用结构化输出
            state.chart_recommendations = [
                {
                    "chart_type": "柱状图",
                    "reason": "适合对比不同类别的数据",
                    "scenario": "类别比较",
                    "config": {"x_axis": "类别", "y_axis": "数值"}
                },
                {
                    "chart_type": "折线图",
                    "reason": "适合展示数据随时间的变化趋势",
                    "scenario": "趋势分析",
                    "config": {"x_axis": "时间", "y_axis": "数值"}
                },
                {
                    "chart_type": "饼图",
                    "reason": "适合展示部分与整体的关系",
                    "scenario": "占比分析",
                    "config": {"labels": "类别", "values": "数值"}
                }
            ]
            
        except Exception as e:
            state.error = f"推荐图表失败: {str(e)}"
        
        return state
    
    def generate_config(self, state: ChartState) -> ChartState:
        """
        生成图表配置
        产品意义：为推荐的图表类型生成详细的配置
        """
        try:
            recommendations = state.chart_recommendations
            schema = state.data_schema
            
            if not recommendations:
                state.error = "未生成图表推荐"
                return state
            
            # 为每个推荐的图表生成详细配置
            for recommendation in recommendations:
                chart_type = recommendation["chart_type"]
                
                # 根据图表类型和数据结构生成配置
                if chart_type == "柱状图":
                    # 自动选择合适的字段
                    categorical_fields = [field for field, info in schema.items() if info['type'] == 'text']
                    numeric_fields = [field for field, info in schema.items() if info['type'] == 'numeric']
                    
                    if categorical_fields and numeric_fields:
                        recommendation["config"]["x_axis"] = categorical_fields[0]
                        recommendation["config"]["y_axis"] = numeric_fields[0]
                
                elif chart_type == "折线图":
                    # 自动选择合适的字段
                    datetime_fields = [field for field, info in schema.items() if info['type'] == 'datetime']
                    numeric_fields = [field for field, info in schema.items() if info['type'] == 'numeric']
                    
                    if datetime_fields and numeric_fields:
                        recommendation["config"]["x_axis"] = datetime_fields[0]
                        recommendation["config"]["y_axis"] = numeric_fields[0]
                
                elif chart_type == "饼图":
                    # 自动选择合适的字段
                    categorical_fields = [field for field, info in schema.items() if info['type'] == 'text']
                    numeric_fields = [field for field, info in schema.items() if info['type'] == 'numeric']
                    
                    if categorical_fields and numeric_fields:
                        recommendation["config"]["labels"] = categorical_fields[0]
                        recommendation["config"]["values"] = numeric_fields[0]
            
            state.completed = True
            
        except Exception as e:
            state.error = f"生成图表配置失败: {str(e)}"
        
        return state
    
    def create_workflow(self):
        """
        创建图表Agent工作流
        产品意义：定义图表推荐和配置的流程
        """
        graph = self.langgraph_utils.create_state_graph(ChartState)
        
        # 添加节点
        graph.add_node("analyze_query", self.analyze_query)
        graph.add_node("recommend_charts", self.recommend_charts)
        graph.add_node("generate_config", self.generate_config)
        
        # 添加边
        graph.set_entry_point("analyze_query")
        graph.add_edge("analyze_query", "recommend_charts")
        graph.add_edge("recommend_charts", "generate_config")
        graph.add_edge("generate_config", END)
        
        # 编译工作流
        workflow = self.langgraph_utils.compile_graph(graph, "chart_workflow")
        return workflow
    
    def run_chart_recommendation(self, user_query: str, data_schema: Dict[str, Any]) -> Dict[str, Any]:
        """
        运行图表推荐流程
        产品意义：为用户推荐合适的图表类型并生成配置
        """
        workflow = self.create_workflow()
        
        initial_state = ChartState(
            user_query=user_query,
            data_schema=data_schema
        )
        
        result = self.langgraph_utils.run_workflow(workflow, initial_state)
        
        return {
            "chart_recommendations": result.chart_recommendations,
            "chart_config": result.chart_config,
            "error": result.error,
            "completed": result.completed
        }
