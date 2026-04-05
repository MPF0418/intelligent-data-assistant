# -*- coding: utf-8 -*-
"""
分析Agent
产品意义：负责复杂的数据分析任务，支持多步骤分析流程
"""

from typing import Dict, Any, Optional
from pydantic import BaseModel
from app.utils.langchain_utils import LangChainUtils
from app.utils.langgraph_utils import LangGraphUtils

class AnalysisState(BaseModel):
    """分析Agent的状态结构"""
    user_query: str
    data_schema: Dict[str, Any]
    analysis_steps: list = []
    current_step: int = 0
    results: Dict[str, Any] = {}
    error: Optional[str] = None
    completed: bool = False

class AnalysisAgent:
    def __init__(self):
        """初始化分析Agent"""
        self.langchain_utils = LangChainUtils()
        self.langgraph_utils = LangGraphUtils()
        self.llm = self.langchain_utils.get_llm()
    
    def analyze_query(self, state: AnalysisState) -> AnalysisState:
        """
        分析用户查询
        产品意义：理解用户意图，分解复杂任务
        """
        try:
            system_prompt = """
            你是一个专业的数据分析助手，负责分析用户的查询意图并制定分析计划。
            
            请根据用户的查询和数据 schema，制定详细的分析步骤。
            每个步骤应该具体、可执行，并且与数据 schema 中的字段相关。
            
            输出格式：
            {
                "steps": [
                    {
                        "id": "step1",
                        "description": "步骤描述",
                        "type": "分析类型",
                        "fields": ["相关字段1", "相关字段2"]
                    }
                ],
                "reasoning": "你的分析思路"
            }
            """
            
            chain = self.langchain_utils.create_chat_chain(system_prompt, self.llm)
            
            input_data = f"用户查询: {state.user_query}\n数据schema: {state.data_schema}"
            result = chain.invoke({"input": input_data})
            
            # 解析结果（这里简化处理，实际应该使用结构化输出）
            import json
            try:
                analysis_plan = json.loads(result)
                state.analysis_steps = analysis_plan.get("steps", [])
            except Exception:
                # 降级处理
                state.analysis_steps = [
                    {
                        "id": "step1",
                        "description": "基础数据分析",
                        "type": "basic",
                        "fields": list(state.data_schema.keys())[:3]
                    }
                ]
            
            state.current_step = 0
            state.results["analysis_plan"] = state.analysis_steps
            
        except Exception as e:
            state.error = f"分析查询失败: {str(e)}"
        
        return state
    
    def execute_step(self, state: AnalysisState) -> AnalysisState:
        """
        执行分析步骤
        产品意义：按照分析计划执行具体步骤
        """
        try:
            if state.current_step >= len(state.analysis_steps):
                state.completed = True
                return state
            
            current_step = state.analysis_steps[state.current_step]
            step_id = current_step["id"]
            step_description = current_step["description"]
            step_type = current_step["type"]
            fields = current_step["fields"]
            
            # 这里模拟执行分析步骤
            # 实际应该根据步骤类型执行相应的分析逻辑
            step_result = {
                "step_id": step_id,
                "description": step_description,
                "type": step_type,
                "fields": fields,
                "result": f"执行了{step_description}，分析了字段: {', '.join(fields)}"
            }
            
            state.results[step_id] = step_result
            state.current_step += 1
            
        except Exception as e:
            state.error = f"执行步骤失败: {str(e)}"
        
        return state
    
    def generate_summary(self, state: AnalysisState) -> AnalysisState:
        """
        生成分析总结
        产品意义：将分析结果汇总为易理解的报告
        """
        try:
            system_prompt = """
            你是一个专业的数据分析报告撰写者，负责将分析结果汇总为清晰、专业的报告。
            
            请根据分析步骤和结果，生成一份详细的分析报告，包括：
            1. 分析背景和目的
            2. 分析步骤概述
            3. 详细分析结果
            4. 数据洞察和建议
            5. 结论
            
            报告应该语言专业、逻辑清晰，便于业务人员理解。
            """
            
            chain = self.langchain_utils.create_chat_chain(system_prompt, self.llm)
            
            input_data = f"用户查询: {state.user_query}\n分析步骤: {state.analysis_steps}\n分析结果: {state.results}"
            summary = chain.invoke({"input": input_data})
            
            state.results["summary"] = summary
            state.completed = True
            
        except Exception as e:
            state.error = f"生成总结失败: {str(e)}"
        
        return state
    
    def create_workflow(self):
        """
        创建分析Agent工作流
        产品意义：定义分析流程的执行顺序
        """
        graph = self.langgraph_utils.create_state_graph(AnalysisState)
        
        # 添加节点
        graph.add_node("analyze_query", self.analyze_query)
        graph.add_node("execute_step", self.execute_step)
        graph.add_node("generate_summary", self.generate_summary)
        
        # 添加边
        graph.set_entry_point("analyze_query")
        
        # 条件边：是否还有步骤需要执行
        def has_more_steps(state):
            return state.current_step < len(state.analysis_steps) and not state.error
        
        graph.add_conditional_edges(
            "analyze_query",
            self.langgraph_utils.create_conditional_edge(
                has_more_steps,
                "execute_step",
                "generate_summary"
            )
        )
        
        graph.add_conditional_edges(
            "execute_step",
            self.langgraph_utils.create_conditional_edge(
                has_more_steps,
                "execute_step",
                "generate_summary"
            )
        )
        
        graph.add_edge("generate_summary", END)
        
        # 编译工作流
        workflow = self.langgraph_utils.compile_graph(graph, "analysis_workflow")
        return workflow
    
    def run_analysis(self, user_query: str, data_schema: Dict[str, Any]) -> Dict[str, Any]:
        """
        运行分析流程
        产品意义：执行完整的分析流程并返回结果
        """
        workflow = self.create_workflow()
        
        initial_state = AnalysisState(
            user_query=user_query,
            data_schema=data_schema
        )
        
        result = self.langgraph_utils.run_workflow(workflow, initial_state)
        
        return {
            "analysis_steps": result.analysis_steps,
            "results": result.results,
            "error": result.error,
            "completed": result.completed
        }
