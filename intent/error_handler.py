# -*- coding: utf-8 -*-
"""
错误处理与日志记录模块
提供统一的错误处理和日志记录功能
"""

import logging
import traceback
import json
from datetime import datetime
from typing import Dict, Any, Optional
from functools import wraps
import os

# 配置日志
def setup_logging(log_dir: str = "./logs", log_level: int = logging.INFO):
    """
    设置日志记录
    
    Args:
        log_dir: 日志目录
        log_level: 日志级别
    """
    # 确保日志目录存在
    os.makedirs(log_dir, exist_ok=True)
    
    # 日志文件路径
    log_file = os.path.join(log_dir, f"intent_{datetime.now().strftime('%Y%m%d')}.log")
    
    # 配置日志格式
    formatter = logging.Formatter(
        '%(asctime)s [%(levelname)s] [%(name)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # 文件处理器
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setFormatter(formatter)
    file_handler.setLevel(log_level)
    
    # 控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.WARNING)
    
    # 根日志记录器
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    
    return root_logger


class IntentLogger:
    """
    意图识别日志记录器
    
    负责记录所有意图识别相关的事件：
    - 用户输入
    - 意图识别结果
    - 追问过程
    - 执行结果
    - 错误信息
    """
    
    def __init__(self, name: str = "intent"):
        self.logger = logging.getLogger(name)
        self.decision_log = []  # 决策路径日志
    
    def log_input(self, query: str, columns: list, context: Optional[Dict] = None):
        """记录用户输入"""
        self.logger.info(f"User Input: {query}")
        self.logger.info(f"Columns: {columns}")
        if context:
            self.logger.info(f"Context: {json.dumps(context, ensure_ascii=False)}")
        
        # 记录到决策日志
        self.decision_log.append({
            'timestamp': datetime.now().isoformat(),
            'event': 'input',
            'query': query,
            'columns': columns
        })
    
    def log_intent_result(self, intents: list, all_clear: bool):
        """记录意图识别结果"""
        self.logger.info(f"Intents: {json.dumps(intents, ensure_ascii=False)}")
        self.logger.info(f"All Clear: {all_clear}")
        
        self.decision_log.append({
            'timestamp': datetime.now().isoformat(),
            'event': 'intent_recognition',
            'intents': intents,
            'all_clear': all_clear
        })
    
    def log_clarification(self, questions: list, round_num: int):
        """记录追问"""
        self.logger.info(f"Clarification Round {round_num}: {json.dumps(questions, ensure_ascii=False)}")
        
        self.decision_log.append({
            'timestamp': datetime.now().isoformat(),
            'event': 'clarification',
            'round': round_num,
            'questions': questions
        })
    
    def log_user_response(self, response: str, selected_option: Optional[str] = None):
        """记录用户响应"""
        self.logger.info(f"User Response: {response}")
        if selected_option:
            self.logger.info(f"Selected Option: {selected_option}")
        
        self.decision_log.append({
            'timestamp': datetime.now().isoformat(),
            'event': 'user_response',
            'response': response,
            'selected_option': selected_option
        })
    
    def log_execution(self, action: str, result: Dict):
        """记录执行结果"""
        self.logger.info(f"Execution Action: {action}")
        self.logger.info(f"Result: {json.dumps(result, ensure_ascii=False)}")
        
        self.decision_log.append({
            'timestamp': datetime.now().isoformat(),
            'event': 'execution',
            'action': action,
            'result': result
        })
    
    def log_error(self, error: Exception, context: Optional[Dict] = None):
        """记录错误"""
        error_msg = str(error)
        traceback_str = traceback.format_exc()
        
        self.logger.error(f"Error: {error_msg}")
        self.logger.error(f"Traceback: {traceback_str}")
        
        if context:
            self.logger.error(f"Context: {json.dumps(context, ensure_ascii=False)}")
        
        self.decision_log.append({
            'timestamp': datetime.now().isoformat(),
            'event': 'error',
            'error': error_msg,
            'traceback': traceback_str,
            'context': context
        })
    
    def log_rejection(self, reason: str, branch: str):
        """记录拒识"""
        self.logger.warning(f"Rejection: {reason} (branch: {branch})")
        
        self.decision_log.append({
            'timestamp': datetime.now().isoformat(),
            'event': 'rejection',
            'reason': reason,
            'branch': branch
        })
    
    def get_decision_log(self) -> list:
        """获取决策日志"""
        return self.decision_log
    
    def clear_decision_log(self):
        """清空决策日志"""
        self.decision_log = []


class ErrorHandler:
    """
    统一错误处理器
    
    提供各种场景的错误处理：
    - 网络异常重试
    - 模型加载失败降级
    - 超时处理
    - 优雅的错误提示
    """
    
    # 重试配置
    MAX_RETRIES = 3
    RETRY_DELAY = 1  # 秒
    
    @staticmethod
    def retry_on_error(max_retries: int = MAX_RETRIES, delay: float = RETRY_DELAY):
        """
        重试装饰器
        
        Args:
            max_retries: 最大重试次数
            delay: 重试延迟（秒）
        """
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                import time
                
                last_exception = None
                for attempt in range(max_retries + 1):
                    try:
                        return func(*args, **kwargs)
                    except Exception as e:
                        last_exception = e
                        if attempt < max_retries:
                            logging.warning(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
                            time.sleep(delay)
                        else:
                            logging.error(f"All {max_retries + 1} attempts failed")
                
                raise last_exception
            
            return wrapper
        return decorator
    
    @staticmethod
    def handle_api_error(error: Exception, fallback_value: Any = None) -> Dict[str, Any]:
        """
        处理API错误
        
        Args:
            error: 异常对象
            fallback_value: 降级值
        
        Returns:
            错误响应字典
        """
        error_type = type(error).__name__
        error_msg = str(error)
        
        # 判断错误类型
        if 'timeout' in error_msg.lower():
            return {
                'success': False,
                'error_type': 'timeout',
                'message': '请求超时，请稍后重试',
                'suggestion': '请检查网络连接后重试'
            }
        elif 'connection' in error_msg.lower():
            return {
                'success': False,
                'error_type': 'connection',
                'message': '无法连接到服务，请检查网络',
                'suggestion': '请确保网络连接正常'
            }
        elif 'authentication' in error_msg.lower() or 'auth' in error_msg.lower():
            return {
                'success': False,
                'error_type': 'authentication',
                'message': '认证失败',
                'suggestion': '请检查API密钥配置'
            }
        elif 'quota' in error_msg.lower() or 'limit' in error_msg.lower():
            return {
                'success': False,
                'error_type': 'quota',
                'message': 'API调用次数已达上限',
                'suggestion': '请稍后再试'
            }
        else:
            return {
                'success': False,
                'error_type': error_type,
                'message': f'处理失败: {error_msg}',
                'suggestion': '请稍后重试或联系管理员'
            }
    
    @staticmethod
    def format_error_response(error: Exception, include_details: bool = False) -> Dict[str, Any]:
        """
        格式化错误响应
        
        Args:
            error: 异常对象
            include_details: 是否包含详细错误信息
        
        Returns:
            格式化的错误响应
        """
        response = {
            'success': False,
            'error': {
                'type': type(error).__name__,
                'message': str(error)
            }
        }
        
        if include_details:
            response['error']['traceback'] = traceback.format_exc()
        
        return response
    
    @staticmethod
    def safe_execute(func, *args, fallback=None, error_callback=None, **kwargs):
        """
        安全执行函数
        
        Args:
            func: 要执行的函数
            *args: 位置参数
            fallback: 失败时的返回值
            error_callback: 错误回调函数
            **kwargs: 关键字参数
        
        Returns:
            函数执行结果或fallback值
        """
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logging.error(f"Safe execute failed: {e}")
            
            if error_callback:
                error_callback(e)
            
            return fallback


class PerformanceMonitor:
    """
    性能监控器
    
    记录各环节的执行时间，帮助发现性能瓶颈
    """
    
    def __init__(self):
        self.timings = {}
    
    def start(self, operation: str):
        """开始计时"""
        self.timings[operation] = {
            'start': datetime.now(),
            'end': None,
            'duration': None
        }
    
    def end(self, operation: str):
        """结束计时"""
        if operation in self.timings and self.timings[operation]['start']:
            self.timings[operation]['end'] = datetime.now()
            delta = self.timings[operation]['end'] - self.timings[operation]['start']
            self.timings[operation]['duration'] = delta.total_seconds()
    
    def get_timings(self) -> Dict[str, float]:
        """获取所有计时"""
        return {
            op: timing['duration']
            for op, timing in self.timings.items()
            if timing['duration'] is not None
        }
    
    def log_timings(self):
        """记录计时日志"""
        for op, duration in self.get_timings().items():
            logging.info(f"Performance: {op} took {duration:.3f}s")


# 初始化默认日志记录器
default_logger = IntentLogger()
error_handler = ErrorHandler()
performance_monitor = PerformanceMonitor()


__all__ = [
    'setup_logging',
    'IntentLogger',
    'ErrorHandler', 
    'PerformanceMonitor',
    'default_logger',
    'error_handler',
    'performance_monitor'
]
