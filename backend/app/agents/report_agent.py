# -*- coding: utf-8 -*-
"""
报告Agent
产品意义：负责自动化分析报告生成和报告管理
"""

from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from app.utils.langchain_utils import LangChainUtils
from app.utils.langgraph_utils import LangGraphUtils

class ReportState(BaseModel):
    """报告Agent的状态结构"""
    user_query: str
    analysis_results: Dict[str, Any]
    report_content: str = ""
    report_template: str = "default"
    report_format: str = "markdown"
    error: Optional[str] = None
    completed: bool = False

class ReportAgent:
    def __init__(self):
        """初始化报告Agent"""
        self.langchain_utils = LangChainUtils()
        self.langgraph_utils = LangGraphUtils()
        self.llm = self.langchain_utils.get_llm()
    
    def select_template(self, state: ReportState) -> ReportState:
        """
        选择报告模板
        产品意义：根据分析类型选择合适的报告模板
        """
        try:
            analysis_results = state.analysis_results
            user_query = state.user_query
            
            # 分析报告类型
            system_prompt = """
            你是一个专业的报告模板选择专家，负责根据分析结果和用户查询选择合适的报告模板。
            
            请根据以下信息，选择最合适的报告模板：
            1. 用户查询：了解用户的分析需求
            2. 分析结果：了解分析的内容和类型
            
            可供选择的模板：
            - default：通用分析报告模板
            - trend：趋势分析报告模板
            - comparison：对比分析报告模板
            - summary：摘要报告模板
            - detailed：详细分析报告模板
            
            请返回模板名称，并简要说明选择理由。
            """
            
            chain = self.langchain_utils.create_chat_chain(system_prompt, self.llm)
            
            input_data = f"用户查询: {user_query}\n分析结果: {analysis_results}"
            template_selection = chain.invoke({"input": input_data})
            
            # 解析结果（简化处理）
            state.report_template = "default"  # 默认模板
            
        except Exception as e:
            state.error = f"选择模板失败: {str(e)}"
        
        return state
    
    def generate_report(self, state: ReportState) -> ReportState:
        """
        生成报告内容
        产品意义：根据分析结果生成详细的分析报告
        """
        try:
            analysis_results = state.analysis_results
            user_query = state.user_query
            template = state.report_template
            
            # 根据模板生成报告
            system_prompt = """
            你是一个专业的数据分析报告撰写者，负责根据分析结果生成详细、专业的分析报告。
            
            请根据以下信息，生成一份完整的分析报告：
            1. 用户查询：{user_query}
            2. 分析结果：{analysis_results}
            3. 报告模板：{template}
            
            报告应该包括：
            - 报告标题
            - 分析背景和目的
            - 数据概览
            - 详细分析结果
            - 数据洞察和建议
            - 结论
            
            报告应该语言专业、逻辑清晰，便于业务人员理解。
            """
            
            chain = self.langchain_utils.create_chat_chain(system_prompt, self.llm)
            
            input_data = f"用户查询: {user_query}\n分析结果: {analysis_results}\n报告模板: {template}"
            report_content = chain.invoke({"input": input_data})
            
            state.report_content = report_content
            
        except Exception as e:
            state.error = f"生成报告失败: {str(e)}"
        
        return state
    
    def format_report(self, state: ReportState) -> ReportState:
        """
        格式化报告
        产品意义：将报告内容格式化为指定的格式
        """
        try:
            report_content = state.report_content
            report_format = state.report_format
            
            # 根据格式要求进行格式化
            if report_format == "html":
                # 转换为HTML格式
                html_report = f"""
                <!DOCTYPE html>
                <html>
                <head>
                    <title>数据分析报告</title>
                    <style>
                        body {{ font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }}
                        h1, h2, h3 {{ color: #333; }}
                        .section {{ margin-bottom: 20px; }}
                        .summary {{ background-color: #f5f5f5; padding: 15px; border-radius: 5px; }}
                    </style>
                </head>
                <body>
                    <h1>数据分析报告</h1>
                    <div class="section">
                        {report_content}
                    </div>
                </body>
                </html>
                """
                state.report_content = html_report
            
            state.completed = True
            
        except Exception as e:
            state.error = f"格式化报告失败: {str(e)}"
        
        return state
    
    def create_workflow(self):
        """
        创建报告Agent工作流
        产品意义：定义报告生成的流程
        """
        graph = self.langgraph_utils.create_state_graph(ReportState)
        
        # 添加节点
        graph.add_node("select_template", self.select_template)
        graph.add_node("generate_report", self.generate_report)
        graph.add_node("format_report", self.format_report)
        
        # 添加边
        graph.set_entry_point("select_template")
        graph.add_edge("select_template", "generate_report")
        graph.add_edge("generate_report", "format_report")
        graph.add_edge("format_report", END)
        
        # 编译工作流
        workflow = self.langgraph_utils.compile_graph(graph, "report_workflow")
        return workflow
    
    def run_report_generation(self, user_query: str, analysis_results: Dict[str, Any], report_format: str = "markdown") -> Dict[str, Any]:
        """
        运行报告生成流程
        产品意义：为用户生成完整的分析报告
        """
        workflow = self.create_workflow()
        
        initial_state = ReportState(
            user_query=user_query,
            analysis_results=analysis_results,
            report_format=report_format
        )
        
        result = self.langgraph_utils.run_workflow(workflow, initial_state)
        
        return {
            "report_content": result.report_content,
            "report_template": result.report_template,
            "report_format": result.report_format,
            "error": result.error,
            "completed": result.completed
        }
