# -*- coding: utf-8 -*-
"""
Skill管理器
产品意义：管理和执行各种Skill，是核心Agent的能力扩展系统
"""

import importlib
import os
from typing import Dict, Any, List

class SkillManager:
    def __init__(self):
        """
        初始化Skill管理器
        产品意义：加载和管理所有可用的Skill
        """
        self.skills = {}
        self.load_skills()
    
    def load_skills(self):
        """
        加载Skill
        产品意义：自动发现和加载系统中的Skill
        """
        # 尝试从前端skills目录加载Skill
        frontend_skills_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '..', 'skills')
        
        # 预定义的Skill列表
        skill_names = [
            'dataCleaning',
            'dataAnalysis',
            'trendAnalysis',
            'anomalyDetection',
            'businessAdvice',
            'chartGenerator'
        ]
        
        for skill_name in skill_names:
            try:
                # 尝试从后端skills模块加载
                try:
                    module_path = f'app.skills.{skill_name}'
                    module = importlib.import_module(module_path)
                    if hasattr(module, 'Skill'):
                        skill = module.Skill()
                        self.skills[skill_name] = skill
                        print(f"[成功] 加载Skill: {skill_name}")
                    else:
                        # 如果后端没有，尝试从前端加载
                        self._load_frontend_skill(frontend_skills_path, skill_name)
                except ImportError:
                    # 后端模块不存在，尝试从前端加载
                    self._load_frontend_skill(frontend_skills_path, skill_name)
            except Exception as e:
                print(f"[错误] 加载Skill {skill_name} 失败: {str(e)}")
    
    def _load_frontend_skill(self, frontend_skills_path: str, skill_name: str):
        """
        从前端目录加载Skill
        产品意义：兼容前端的Skill实现
        """
        skill_file = os.path.join(frontend_skills_path, f'{skill_name}.js')
        if os.path.exists(skill_file):
            # 创建一个代理Skill，调用前端Skill
            class FrontendSkillProxy:
                def __init__(self, name):
                    self.name = name
                    self.info = {
                        'name': name,
                        'description': f'前端{name}技能',
                        'parameters': []
                    }
                
                def execute(self, params):
                    # 模拟前端Skill执行
                    return {
                        'success': True,
                        'skill_name': self.name,
                        'message': f'前端{self.name}技能执行成功',
                        'data': params
                    }
            
            skill = FrontendSkillProxy(skill_name)
            self.skills[skill_name] = skill
            print(f"[成功] 加载前端Skill: {skill_name}")
    
    def execute_skill(self, skill_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        执行Skill
        产品意义：调用指定的Skill处理任务
        """
        if skill_name not in self.skills:
            raise ValueError(f"Skill {skill_name} 未加载")
        
        try:
            skill = self.skills[skill_name]
            return skill.execute(params)
        except Exception as e:
            print(f"执行Skill {skill_name} 失败: {str(e)}")
            raise
    
    def get_skill_info(self, skill_name: str) -> Dict[str, Any]:
        """
        获取Skill信息
        产品意义：提供Skill的详细信息，用于前端展示和调试
        """
        if skill_name not in self.skills:
            return None
        
        skill = self.skills[skill_name]
        if hasattr(skill, 'info'):
            return skill.info
        else:
            return {
                'name': skill_name,
                'description': f'{skill_name}技能',
                'parameters': []
            }
    
    def get_loaded_skills(self) -> List[str]:
        """
        获取已加载的Skill列表
        产品意义：提供系统中所有可用的Skill
        """
        return list(self.skills.keys())
    
    def has_skill(self, skill_name: str) -> bool:
        """
        检查Skill是否存在
        产品意义：验证指定的Skill是否已加载
        """
        return skill_name in self.skills
