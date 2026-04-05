# -*- coding: utf-8 -*-
"""
统一工作流管理器
整合本地模型和大模型分支，处理追问、拒识等核心逻辑
"""

import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)


class WorkflowContext:
    """工作流上下文管理器"""
    
    MAX_FOLLOWUP_ROUNDS = 3  # 最大追问轮次
    
    def __init__(self):
        self.reset()
    
    def reset(self):
        """重置上下文"""
        self.user_query = ""  # 原始用户输入
        self.columns = []  # 数据列信息
        self.sample_data = []  # 样例数据
        self.intents = []  # 识别的意图列表
        self.followup_round = 0  # 当前追问轮次
        self.branch = None  # 'local' 或 'llm'
        self.history = []  # 对话历史
        self.status = 'init'  # init, running, waiting_clarification, executing, completed, rejected
    
    def set_initial_query(self, query: str, columns: List[str], sample_data: List[Dict]):
        """设置初始查询"""
        self.user_query = query
        self.columns = columns
        self.sample_data = sample_data
        self.history.append({
            'type': 'user',
            'content': query,
            'timestamp': datetime.now().isoformat()
        })
    
    def add_intent_result(self, intents: List[Dict]):
        """添加意图识别结果"""
        self.intents = intents
        self.history.append({
            'type': 'system',
            'content': f"意图识别: {json.dumps(intents, ensure_ascii=False)}",
            'timestamp': datetime.now().isoformat()
        })
    
    def add_user_response(self, response: str):
        """添加用户响应"""
        self.history.append({
            'type': 'user',
            'content': response,
            'timestamp': datetime.now().isoformat()
        })
    
    def increment_followup_round(self):
        """增加追问轮次"""
        self.followup_round += 1
        return self.followup_round
    
    def is_followup_exceeded(self) -> bool:
        """检查是否超过追问上限"""
        return self.followup_round >= self.MAX_FOLLOWUP_ROUNDS
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            'user_query': self.user_query,
            'columns': self.columns,
            'intents': self.intents,
            'followup_round': self.followup_round,
            'branch': self.branch,
            'history': self.history,
            'status': self.status
        }


class UnifiedWorkflowManager:
    """
    统一工作流管理器
    
    核心逻辑：
    1. 本地模型无法识别任何意图 → 小模型直接拒识
    2. 本地模型识别出意图 → 判断需求是否明确
    3. 需求不明确 → 追问（最多3轮）
    4. 3轮后仍不明确 → 转向大模型
    5. 用户选择"意图识别有误" → 转向大模型
    6. 大模型判断与数据分析无关 → 大模型拒识
    """
    
    def __init__(self, local_recognizer=None, llm_client=None):
        """
        初始化工作流管理器
        
        Args:
            local_recognizer: 本地意图识别器实例
            llm_client: 大模型客户端实例
        """
        self.local_recognizer = local_recognizer
        self.llm_client = llm_client
        self.context = WorkflowContext()
    
    def process(self, user_query: str, columns: List[str], sample_data: List[Dict]) -> Dict[str, Any]:
        """
        处理用户查询的主入口
        
        Args:
            user_query: 用户输入
            columns: 数据列信息
            sample_data: 样例数据
        
        Returns:
            处理结果，包含:
            - status: 处理状态
            - action: 下一个动作 (execute, clarify, reject, escalate)
            - data: 相关数据
            - message: 提示信息
        """
        # 重置上下文
        self.context.reset()
        self.context.set_initial_query(user_query, columns, sample_data)
        
        # Step 1: 本地模型意图识别
        logger.info(f"Step 1: 本地模型意图识别 - {user_query}")
        local_result = self._local_recognition(user_query, columns, sample_data)
        
        # 记录分支
        self.context.branch = 'local'
        
        # Step 2: 判断识别结果
        if not local_result['intents']:
            # 小模型无法识别任何意图 → 直接拒识
            logger.info("本地模型未识别出任何意图 → 小模型拒识")
            return {
                'status': 'rejected',
                'action': 'reject',
                'branch': 'local',
                'message': '抱歉，我无法理解您的需求。请尝试更清晰地描述您的数据分析需求，例如："统计销售额"、"绘制柱状图"等。',
                'suggestions': [
                    '统计各省份的平均销售额',
                    '绘制销售额柱状图',
                    '查找最大的险情确认时长',
                    '按地区分组统计数量'
                ]
            }
        
        # 记录意图识别结果
        self.context.add_intent_result(local_result['intents'])
        
        # Step 3: 判断需求是否明确
        clear_intents, unclear_intents = self._check_clarity(local_result['intents'])
        
        if clear_intents and not unclear_intents:
            # 所有意图都明确 → 执行
            logger.info(f"所有意图都明确，共 {len(clear_intents)} 个")
            return {
                'status': 'ready',
                'action': 'execute',
                'branch': 'local',
                'intents': clear_intents,
                'message': '正在执行...'
            }
        
        # 有不明确的意图 → 进入追问流程
        logger.info(f"有 {len(unclear_intents)} 个意图不明确，进入追问流程")
        return self._generate_followup(unclear_intents, columns, sample_data)
    
    def process_user_response(self, user_response: str) -> Dict[str, Any]:
        """
        处理用户的追问响应
        
        Args:
            user_response: 用户的选择或输入
        
        Returns:
            处理结果
        """
        # 记录用户响应
        self.context.add_user_response(user_response)
        
        # 检查是否是"意图识别有误"
        if user_response == 'reask' or user_response == 'intent_error':
            logger.info("用户选择意图识别有误 → 转向大模型")
            return self._escalate_to_llm("用户选择意图识别有误")
        
        # 检查是否达到追问上限
        round_num = self.context.increment_followup_round()
        if self.context.is_followup_exceeded():
            logger.info(f"追问轮次 {round_num} 已达上限 → 转向大模型")
            return self._escalate_to_llm(f"追问轮次 {round_num} 已达上限")
        
        # 处理用户的追问选择
        return self._process_clarification_response(user_response)
    
    def _local_recognition(self, query: str, columns: List[str], sample_data: List[Dict]) -> Dict:
        """本地模型意图识别"""
        if self.local_recognizer:
            try:
                result = self.local_recognizer.recognize(query, columns)
                return result
            except Exception as e:
                logger.error(f"本地模型识别失败: {e}")
        
        # 兜底：返回空结果
        return {'intents': [], 'all_clear': False}
    
    def _check_clarity(self, intents: List[Dict]) -> tuple:
        """检查意图是否明确"""
        clear_intents = []
        unclear_intents = []
        
        for intent in intents:
            if intent.get('is_clear', False):
                clear_intents.append(intent)
            else:
                unclear_intents.append(intent)
        
        return clear_intents, unclear_intents
    
    def _generate_followup(self, unclear_intents: List[Dict], columns: List[str], sample_data: List[Dict]) -> Dict:
        """生成追问"""
        self.context.status = 'waiting_clarification'
        
        # 构建追问问题
        questions = []
        for intent in unclear_intents:
            intent_type = intent.get('type')
            missing_fields = intent.get('missing_fields', [])
            
            for field in missing_fields:
                question = self._get_clarification_question(intent_type, field, columns)
                if question:
                    questions.append({
                        'intent_type': intent_type,
                        'field': field,
                        'question': question,
                        'options': self._generate_options(intent_type, field, columns)
                    })
        
        # 添加"意图识别有误"选项
        for q in questions:
            q['options'].append({
                'type': 'intent_error',
                'label': '以上都不是，意图识别有误',
                'value': 'reask'
            })
        
        return {
            'status': 'clarification_needed',
            'action': 'clarify',
            'branch': 'local',
            'followup_round': self.context.followup_round,
            'max_rounds': WorkflowContext.MAX_FOLLOWUP_ROUNDS,
            'questions': questions,
            'message': '请补充以下信息以便我更好地为您服务'
        }
    
    def _get_clarification_question(self, intent_type: str, field: str, columns: List[str]) -> str:
        """获取追问问题模板"""
        templates = {
            ('chart', 'chart_type'): '请选择图表类型',
            ('chart', 'x_axis'): '请问X轴要显示什么字段？',
            ('chart', 'y_axis'): '请问Y轴要显示什么字段？',
            ('sort', 'sort_column'): '请选择要排序的字段',
            ('sort', 'sort_direction'): '请选择排序方向（升序/降序）',
            ('filter', 'filter_column'): '请选择要筛选的字段',
            ('filter', 'filter_value'): '请输入筛选值',
            ('aggregate', 'aggregate_column'): '请选择要聚合的字段',
            ('aggregate', 'aggregate_method'): '请选择聚合方式（求和/平均/计数等）',
            ('compare', 'compare_column'): '请选择要对比的字段',
            ('trend', 'time_column'): '请选择时间字段',
            ('trend', 'value_column'): '请选择要分析趋势的数值字段',
            ('ranking', 'rank_column'): '请选择要排名的字段',
            ('ranking', 'top_n'): '请输入要显示前几名',
            ('export', 'export_format'): '请选择导出格式'
        }
        
        return templates.get((intent_type, field), f'请补充 {field} 信息')
    
    def _generate_options(self, intent_type: str, field: str, columns: List[str]) -> List[Dict]:
        """生成追问选项"""
        # 图表类型选项
        if field == 'chart_type':
            return [
                {'type': 'chart_type', 'label': '柱状图', 'value': 'bar'},
                {'type': 'chart_type', 'label': '折线图', 'value': 'line'},
                {'type': 'chart_type', 'label': '饼图', 'value': 'pie'},
                {'type': 'chart_type', 'label': '条形图', 'value': 'bar'},
                {'type': 'chart_type', 'label': '散点图', 'value': 'scatter'}
            ]
        
        # 排序方向选项
        if field == 'sort_direction':
            return [
                {'type': 'sort_direction', 'label': '从高到低（降序）', 'value': 'desc'},
                {'type': 'sort_direction', 'label': '从低到高（升序）', 'value': 'asc'}
            ]
        
        # 聚合方式选项
        if field == 'aggregate_method':
            return [
                {'type': 'aggregate_method', 'label': '求和', 'value': 'sum'},
                {'type': 'aggregate_method', 'label': '平均值', 'value': 'mean'},
                {'type': 'aggregate_method', 'label': '计数', 'value': 'count'},
                {'type': 'aggregate_method', 'label': '最大值', 'value': 'max'},
                {'type': 'aggregate_method', 'label': '最小值', 'value': 'min'}
            ]
        
        # 导出格式选项
        if field == 'export_format':
            return [
                {'type': 'export_format', 'label': 'Excel', 'value': 'xlsx'},
                {'type': 'export_format', 'label': 'CSV', 'value': 'csv'},
                {'type': 'export_format', 'label': 'JSON', 'value': 'json'}
            ]
        
        # 字段选择（从数据列中选择）
        if field in ['x_axis', 'y_axis', 'sort_column', 'filter_column', 'aggregate_column', 
                     'compare_column', 'time_column', 'value_column', 'rank_column']:
            return [
                {'type': 'column', 'label': col, 'value': col}
                for col in columns
            ]
        
        return []
    
    def _process_clarification_response(self, user_response: str) -> Dict:
        """处理用户的追问响应"""
        # 这里需要解析用户的响应，更新意图信息
        # 简化实现：假设用户选择了选项
        
        # 重新检查意图明确性
        clear_intents, unclear_intents = self._check_clarity(self.context.intents)
        
        if clear_intents and not unclear_intents:
            return {
                'status': 'ready',
                'action': 'execute',
                'branch': 'local',
                'intents': clear_intents,
                'message': '正在执行...'
            }
        
        # 仍有不明确的意图，继续追问
        return self._generate_followup(unclear_intents, self.context.columns, self.context.sample_data)
    
    def _escalate_to_llm(self, reason: str) -> Dict:
        """
        转向大模型分支
        
        Args:
            reason: 转向原因
        """
        logger.info(f"转向大模型，原因: {reason}")
        self.context.branch = 'llm'
        
        if not self.llm_client:
            # 没有大模型客户端，返回错误
            return {
                'status': 'error',
                'action': 'reject',
                'message': '大模型服务不可用，请稍后重试'
            }
        
        # 调用大模型进行意图识别和追问
        return self._llm_process(reason)
    
    def _llm_process(self, reason: str) -> Dict:
        """大模型处理流程"""
        # 构建上下文
        context = {
            'user_query': self.context.user_query,
            'columns': self.context.columns,
            'sample_data': self.context.sample_data[:5],  # 限制样例数量
            'history': self.context.history,
            'followup_round': self.context.followup_round,
            'escalation_reason': reason
        }
        
        # 调用大模型
        try:
            result = self.llm_client.analyze(context)
            
            # 判断结果
            if result.get('is_rejected'):
                # 大模型拒识
                return {
                    'status': 'rejected',
                    'action': 'reject',
                    'branch': 'llm',
                    'message': result.get('message', '抱歉，我无法理解您的需求。'),
                    'suggestions': result.get('suggestions', [])
                }
            
            if result.get('needs_clarification'):
                # 大模型需要追问
                return {
                    'status': 'clarification_needed',
                    'action': 'clarify',
                    'branch': 'llm',
                    'followup_round': self.context.followup_round + 1,
                    'max_rounds': WorkflowContext.MAX_FOLLOWUP_ROUNDS,
                    'questions': result.get('questions', []),
                    'message': result.get('message', '请补充以下信息')
                }
            
            # 大模型识别成功，执行
            return {
                'status': 'ready',
                'action': 'execute',
                'branch': 'llm',
                'intents': result.get('intents', []),
                'message': '正在执行...'
            }
            
        except Exception as e:
            logger.error(f"大模型调用失败: {e}")
            return {
                'status': 'error',
                'action': 'reject',
                'message': f'处理失败: {str(e)}'
            }


# 导出
__all__ = ['UnifiedWorkflowManager', 'WorkflowContext']
