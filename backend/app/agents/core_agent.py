# -*- coding: utf-8 -*-
"""
核心Agent模块
产品意义：统一协调和调度所有任务，是系统的核心智能体
"""

from typing import Dict, Any, List, Optional
from app.agents.skill_manager import SkillManager
from app.agents.model_selector import ModelSelector
from app.agents.decision_logger import DecisionLogger

class CoreAgent:
    def __init__(self):
        """
        初始化核心Agent
        产品意义：设置核心组件，包括Skill管理器、模型选择器和决策日志器
        """
        self.skill_manager = SkillManager()
        self.model_selector = ModelSelector()
        self.decision_logger = DecisionLogger()
    
    def analyze_task(self, user_query: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        分析用户任务
        产品意义：理解用户需求，确定任务类型和复杂度
        """
        # 简单的任务分析逻辑
        # 实际项目中可以使用更复杂的NLP模型
        task_analysis = {
            'user_query': user_query,
            'context': context,
            'task_type': self._determine_task_type(user_query),
            'complexity': self._determine_complexity(user_query),
            'urgency': self._determine_urgency(user_query),
            'required_skills': self._identify_required_skills(user_query)
        }
        return task_analysis
    
    def _determine_task_type(self, user_query: str) -> str:
        """
        确定任务类型
        产品意义：根据用户输入确定任务类型，如查询、分析、可视化等
        """
        query_lower = user_query.lower()
        
        if any(keyword in query_lower for keyword in ['图表', '可视化', '绘制', '图']):
            return 'visualization'
        elif any(keyword in query_lower for keyword in ['分析', '统计', '计算']):
            return 'analysis'
        elif any(keyword in query_lower for keyword in ['查询', '查找', '搜索']):
            return 'query'
        elif any(keyword in query_lower for keyword in ['报告', '总结']):
            return 'report'
        elif any(keyword in query_lower for keyword in ['清洗', '处理', '转换']):
            return 'data_cleaning'
        else:
            return 'general'
    
    def _determine_complexity(self, user_query: str) -> str:
        """
        确定任务复杂度
        产品意义：根据用户输入确定任务复杂度，选择合适的模型
        """
        query_lower = user_query.lower()
        
        # 简单任务：单一查询，明确的指令
        if any(keyword in query_lower for keyword in ['最大值', '最小值', '总和', '平均值']):
            return 'low'
        # 中等复杂度：需要多步骤处理
        elif any(keyword in query_lower for keyword in ['分析', '统计', '趋势']):
            return 'medium'
        # 复杂任务：需要深度理解和多步骤推理
        elif any(keyword in query_lower for keyword in ['预测', '建议', '优化', '方案']):
            return 'high'
        else:
            return 'medium'
    
    def _determine_urgency(self, user_query: str) -> str:
        """
        确定任务紧急程度
        产品意义：根据用户输入确定任务紧急程度，调整处理优先级
        """
        query_lower = user_query.lower()
        
        if any(keyword in query_lower for keyword in ['立即', '马上', '快速', '紧急']):
            return 'high'
        else:
            return 'normal'
    
    def _identify_required_skills(self, user_query: str) -> List[str]:
        """
        识别所需的Skill
        产品意义：根据用户输入识别需要的Skill，为后续执行做准备
        """
        required_skills = []
        query_lower = user_query.lower()
        
        if any(keyword in query_lower for keyword in ['清洗', '处理', '转换']):
            required_skills.append('dataCleaning')
        if any(keyword in query_lower for keyword in ['分析', '统计', '计算']):
            required_skills.append('dataAnalysis')
        if any(keyword in query_lower for keyword in ['趋势', '变化', '增长']):
            required_skills.append('trendAnalysis')
        if any(keyword in query_lower for keyword in ['异常', '检测', '问题']):
            required_skills.append('anomalyDetection')
        if any(keyword in query_lower for keyword in ['建议', '方案', '策略']):
            required_skills.append('businessAdvice')
        if any(keyword in query_lower for keyword in ['图表', '可视化', '绘制', '图']):
            required_skills.append('chartGenerator')
        
        return required_skills
    
    def select_skills(self, task_analysis: Dict[str, Any]) -> List[tuple]:
        """
        选择Skill
        产品意义：根据任务分析结果选择合适的Skill，并准备参数
        """
        skills = []
        required_skills = task_analysis.get('required_skills', [])
        
        for skill_name in required_skills:
            # 准备Skill参数
            params = {
                'user_query': task_analysis.get('user_query'),
                'context': task_analysis.get('context'),
                'task_type': task_analysis.get('task_type')
            }
            skills.append((skill_name, params))
        
        # 如果没有识别到Skill，根据任务类型添加默认Skill
        if not skills:
            task_type = task_analysis.get('task_type')
            if task_type == 'visualization':
                skills.append(('chartGenerator', {
                    'user_query': task_analysis.get('user_query'),
                    'context': task_analysis.get('context')
                }))
            elif task_type == 'analysis':
                skills.append(('dataAnalysis', {
                    'user_query': task_analysis.get('user_query'),
                    'context': task_analysis.get('context')
                }))
            else:
                skills.append(('dataAnalysis', {
                    'user_query': task_analysis.get('user_query'),
                    'context': task_analysis.get('context')
                }))
        
        return skills
    
    def integrate_results(self, results: List[Any], task_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        整合Skill执行结果
        产品意义：将多个Skill的执行结果整合为最终响应
        """
        # 简单的结果整合逻辑
        # 实际项目中可以根据任务类型和Skill执行结果进行更复杂的整合
        final_result = {
            'success': True,
            'task_type': task_analysis.get('task_type'),
            'results': results,
            'summary': self._generate_summary(results, task_analysis)
        }
        
        return final_result
    
    def _generate_summary(self, results: List[Any], task_analysis: Dict[str, Any]) -> str:
        """
        生成结果摘要
        产品意义：为用户提供简洁明了的结果摘要
        """
        task_type = task_analysis.get('task_type')
        
        if task_type == 'visualization':
            return '已生成图表'
        elif task_type == 'analysis':
            return '已完成数据分析'
        elif task_type == 'query':
            return '已完成数据查询'
        elif task_type == 'report':
            return '已生成分析报告'
        elif task_type == 'data_cleaning':
            return '已完成数据清洗'
        else:
            return '已完成任务'
    
    def run(self, user_query: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        运行核心Agent
        产品意义：执行完整的任务处理流程
        """
        try:
            # 1. 任务分析
            task_analysis = self.analyze_task(user_query, context)
            
            # 2. 决策记录开始
            self.decision_logger.start_session()
            self.decision_logger.log_task_analysis(task_analysis)
            
            # 3. 选择模型
            model = self.model_selector.select_model(task_analysis)
            self.decision_logger.log_model_selection(model)
            
            # 4. 选择Skill
            skills = self.select_skills(task_analysis)
            self.decision_logger.log_skill_selection(skills)
            
            # 5. 执行Skill
            results = []
            for skill_name, params in skills:
                try:
                    result = self.skill_manager.execute_skill(skill_name, params)
                    results.append(result)
                    self.decision_logger.log_skill_execution(skill_name, result)
                except Exception as e:
                    # 记录Skill执行错误，但继续执行其他Skill
                    error_result = {
                        'success': False,
                        'skill_name': skill_name,
                        'error': str(e)
                    }
                    results.append(error_result)
                    self.decision_logger.log_skill_execution(skill_name, error_result)
            
            # 6. 整合结果
            final_result = self.integrate_results(results, task_analysis)
            
            # 7. 决策记录结束
            self.decision_logger.end_session()
            
            return final_result
        except Exception as e:
            # 记录整体错误
            self.decision_logger.log_error(str(e))
            self.decision_logger.end_session()
            
            return {
                'success': False,
                'error': str(e)
            }
