# -*- coding: utf-8 -*-
"""
LangGraph工具类
产品意义：封装LangGraph核心功能，支持Agent工作流编排
"""

from langgraph.graph import StateGraph, END
from langgraph.graph.state import CompiledStateGraph
from langgraph.runtime import get_runtime
from langgraph.checkpoint.memory import MemorySaver
from app.config import config

class LangGraphUtils:
    def __init__(self):
        """初始化LangGraph工具"""
        self.agent_config = config['agent']
        self.checkpoint_saver = MemorySaver()
    
    def create_state_graph(self, state_schema):
        """
        创建状态图
        产品意义：定义Agent工作流的状态结构
        """
        return StateGraph(state_schema)
    
    def compile_graph(self, graph, name="agent_workflow"):
        """
        编译状态图
        产品意义：将状态图编译为可执行的工作流
        """
        return graph.compile(
            name=name,
            checkpointer=self.checkpoint_saver,
            max_steps=self.agent_config.MAX_STEPS
        )
    
    def run_workflow(self, workflow, input_data, config=None):
        """
        运行工作流
        产品意义：执行Agent工作流并返回结果
        """
        runtime = get_runtime()
        
        # 运行工作流
        result = runtime.run(
            workflow,
            input_data,
            config=config or {}
        )
        
        return result
    
    def create_conditional_edge(self, condition_func, true_next, false_next):
        """
        创建条件边
        产品意义：根据条件选择不同的工作流路径
        """
        def conditional_edge(state):
            if condition_func(state):
                return true_next
            else:
                return false_next
        return conditional_edge
    
    def create_parallel_edges(self, edges):
        """
        创建并行边
        产品意义：支持并行执行多个节点
        """
        def parallel_edge(state):
            return edges
        return parallel_edge
    
    def create_agent_node(self, agent_func, name):
        """
        创建Agent节点
        产品意义：标准化Agent节点的创建
        """
        def node_func(state):
            result = agent_func(state)
            return result
        node_func.__name__ = name
        return node_func
