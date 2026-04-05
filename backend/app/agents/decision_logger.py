# -*- coding: utf-8 -*-
"""
决策日志器
产品意义：记录Agent的决策过程和执行情况，提供可观测性
"""

import uuid
import json
import os
from datetime import datetime
from typing import Dict, Any, List

class DecisionLogger:
    def __init__(self):
        """
        初始化决策日志器
        产品意义：设置日志存储路径和初始化日志记录
        """
        self.session_id = None
        self.logs = []
        self.log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logs')
        os.makedirs(self.log_dir, exist_ok=True)
    
    def start_session(self):
        """
        开始一个新的会话
        产品意义：为每个用户请求创建一个独立的会话，便于追踪完整的决策过程
        """
        self.session_id = str(uuid.uuid4())
        self.logs = []
        self._log('session_start', {'session_id': self.session_id})
    
    def log_task_analysis(self, analysis: Dict[str, Any]):
        """
        记录任务分析结果
        产品意义：记录Agent对用户任务的分析过程和结果
        """
        self._log('task_analysis', analysis)
    
    def log_model_selection(self, model: str):
        """
        记录模型选择结果
        产品意义：记录Agent选择的模型，便于分析模型选择策略的有效性
        """
        self._log('model_selection', {'model': model})
    
    def log_skill_selection(self, skills: List[tuple]):
        """
        记录Skill选择结果
        产品意义：记录Agent选择的Skill，便于分析Skill使用情况
        """
        skills_info = [{'skill_name': skill[0], 'params': skill[1]} for skill in skills]
        self._log('skill_selection', {'skills': skills_info})
    
    def log_skill_execution(self, skill_name: str, result: Dict[str, Any]):
        """
        记录Skill执行结果
        产品意义：记录Skill的执行情况，便于分析Skill的有效性和性能
        """
        self._log('skill_execution', {
            'skill_name': skill_name,
            'result': result
        })
    
    def log_error(self, error: str):
        """
        记录错误信息
        产品意义：记录系统错误，便于排查和修复问题
        """
        self._log('error', {'error': error})
    
    def end_session(self):
        """
        结束会话并保存日志
        产品意义：保存完整的决策过程日志，便于后续分析和调试
        """
        self._log('session_end', {'session_id': self.session_id})
        self._save_logs()
    
    def _log(self, log_type: str, data: Dict[str, Any]):
        """
        记录日志
        产品意义：统一的日志记录方法，确保日志格式一致
        """
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'type': log_type,
            'data': data
        }
        self.logs.append(log_entry)
    
    def _save_logs(self):
        """
        保存日志到文件
        产品意义：持久化存储日志，便于后续分析和调试
        """
        if not self.session_id:
            return
        
        log_file = os.path.join(self.log_dir, f'{self.session_id}.json')
        try:
            with open(log_file, 'w', encoding='utf-8') as f:
                json.dump(self.logs, f, ensure_ascii=False, indent=2)
            print(f"✅ 日志保存成功: {log_file}")
        except Exception as e:
            print(f"❌ 日志保存失败: {str(e)}")
    
    def get_logs(self) -> List[Dict[str, Any]]:
        """
        获取当前会话的日志
        产品意义：提供当前会话的完整日志，用于前端展示和调试
        """
        return self.logs
    
    def get_session_id(self) -> str:
        """
        获取当前会话ID
        产品意义：提供会话标识，便于追踪和关联相关日志
        """
        return self.session_id
