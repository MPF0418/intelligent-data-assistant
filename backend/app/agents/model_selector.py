# -*- coding: utf-8 -*-
"""
模型选择器
产品意义：根据任务复杂度选择合适的模型，平衡能力、速度和成本
"""

from typing import Dict, Any

class ModelSelector:
    def __init__(self):
        """
        初始化模型选择器
        产品意义：设置模型选择策略
        """
        pass
    
    def select_model(self, task_analysis: Dict[str, Any]) -> str:
        """
        选择模型
        产品意义：根据任务分析结果选择合适的模型
        """
        complexity = task_analysis.get('complexity', 'medium')
        urgency = task_analysis.get('urgency', 'normal')
        task_type = task_analysis.get('task_type', 'general')
        
        # 基于任务复杂度和紧急程度选择模型
        if complexity == 'high':
            # 复杂任务使用大模型
            return 'large_model'
        elif complexity == 'medium':
            if urgency == 'high':
                # 中等复杂度且紧急的任务使用本地模型
                return 'local_model'
            else:
                # 中等复杂度且不紧急的任务，根据任务类型选择
                if task_type in ['visualization', 'report']:
                    # 需要生成图表或报告的任务使用大模型
                    return 'large_model'
                else:
                    # 其他任务使用本地模型
                    return 'local_model'
        else:
            # 简单任务使用规则引擎
            return 'rule_engine'
    
    def get_model_info(self, model_name: str) -> Dict[str, Any]:
        """
        获取模型信息
        产品意义：提供模型的详细信息，用于前端展示和调试
        """
        model_info = {
            'large_model': {
                'name': '大模型',
                'description': '使用Kimi-K2.5等大语言模型，适合复杂推理任务',
                'response_time': '2-5秒',
                'accuracy': '高',
                'cost': '高'
            },
            'local_model': {
                'name': '本地模型',
                'description': '使用本地BERT模型，适合流程化、结构化任务',
                'response_time': '10-50ms',
                'accuracy': '中',
                'cost': '低'
            },
            'rule_engine': {
                'name': '规则引擎',
                'description': '使用规则匹配，适合简单、明确的任务',
                'response_time': '<1ms',
                'accuracy': '中',
                'cost': '极低'
            }
        }
        
        return model_info.get(model_name, {
            'name': model_name,
            'description': '未知模型',
            'response_time': '未知',
            'accuracy': '未知',
            'cost': '未知'
        })
    
    def get_available_models(self) -> list:
        """
        获取可用模型列表
        产品意义：提供系统中所有可用的模型
        """
        return ['large_model', 'local_model', 'rule_engine']
