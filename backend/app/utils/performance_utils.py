# -*- coding: utf-8 -*-
"""
性能优化工具类
产品意义：提供性能监控、缓存优化和并发控制功能
"""

import time
import functools
import asyncio
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime
import threading
import hashlib
import json

class PerformanceMonitor:
    """性能监控器"""
    
    def __init__(self):
        """初始化性能监控器"""
        self.metrics = {}
        self.lock = threading.Lock()
    
    def record_metric(self, name: str, value: float, unit: str = 'ms'):
        """
        记录性能指标
        产品意义：收集系统运行时的性能数据
        """
        with self.lock:
            if name not in self.metrics:
                self.metrics[name] = []
            
            self.metrics[name].append({
                'value': value,
                'unit': unit,
                'timestamp': datetime.now().isoformat()
            })
            
            # 限制历史记录数量
            if len(self.metrics[name]) > 1000:
                self.metrics[name] = self.metrics[name][-1000:]
    
    def get_metric_stats(self, name: str) -> Dict[str, Any]:
        """
        获取指标统计信息
        产品意义：分析性能指标，发现性能瓶颈
        """
        if name not in self.metrics:
            return {}
        
        values = [m['value'] for m in self.metrics[name]]
        
        return {
            'count': len(values),
            'min': min(values),
            'max': max(values),
            'avg': sum(values) / len(values),
            'latest': values[-1] if values else None
        }
    
    def get_all_metrics(self) -> Dict[str, Any]:
        """
        获取所有指标
        产品意义：提供完整的性能数据视图
        """
        result = {}
        for name in self.metrics:
            result[name] = self.get_metric_stats(name)
        return result

class CacheManager:
    """缓存管理器"""
    
    def __init__(self, max_size: int = 1000, ttl: int = 3600):
        """
        初始化缓存管理器
        产品意义：提供高效的缓存机制，减少重复计算
        """
        self.cache = {}
        self.max_size = max_size
        self.ttl = ttl
        self.lock = threading.Lock()
    
    def _generate_key(self, func_name: str, args: tuple, kwargs: dict) -> str:
        """
        生成缓存键
        产品意义：确保相同参数的函数调用使用相同的缓存
        """
        key_data = {
            'func': func_name,
            'args': str(args),
            'kwargs': str(sorted(kwargs.items()))
        }
        key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def get(self, key: str) -> Optional[Any]:
        """
        获取缓存
        产品意义：从缓存中快速获取结果
        """
        with self.lock:
            if key in self.cache:
                entry = self.cache[key]
                if time.time() - entry['timestamp'] < self.ttl:
                    return entry['value']
                else:
                    del self.cache[key]
            return None
    
    def set(self, key: str, value: Any):
        """
        设置缓存
        产品意义：将结果存储到缓存中
        """
        with self.lock:
            # 如果缓存已满，删除最旧的条目
            if len(self.cache) >= self.max_size:
                oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k]['timestamp'])
                del self.cache[oldest_key]
            
            self.cache[key] = {
                'value': value,
                'timestamp': time.time()
            }
    
    def clear(self):
        """
        清空缓存
        产品意义：重置缓存，释放内存
        """
        with self.lock:
            self.cache.clear()

class ConcurrencyController:
    """并发控制器"""
    
    def __init__(self, max_concurrent: int = 10):
        """
        初始化并发控制器
        产品意义：控制系统并发度，防止资源耗尽
        """
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.active_tasks = 0
        self.lock = threading.Lock()
    
    async def execute(self, func: Callable, *args, **kwargs) -> Any:
        """
        执行任务
        产品意义：在并发控制下执行任务
        """
        async with self.semaphore:
            with self.lock:
                self.active_tasks += 1
            
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                with self.lock:
                    self.active_tasks -= 1
    
    def get_status(self) -> Dict[str, Any]:
        """
        获取状态
        产品意义：监控并发控制器的运行状态
        """
        with self.lock:
            return {
                'max_concurrent': self.max_concurrent,
                'active_tasks': self.active_tasks,
                'available_slots': self.max_concurrent - self.active_tasks
            }

def performance_monitor(monitor: PerformanceMonitor, metric_name: str):
    """
    性能监控装饰器
    产品意义：自动记录函数执行时间
    """
    def decorator(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                duration = (time.time() - start_time) * 1000  # 转换为毫秒
                monitor.record_metric(metric_name, duration)
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration = (time.time() - start_time) * 1000  # 转换为毫秒
                monitor.record_metric(metric_name, duration)
        
        # 判断函数是否是协程函数
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator

def cache_result(cache_manager: CacheManager):
    """
    缓存装饰器
    产品意义：自动缓存函数结果，提高性能
    """
    def decorator(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            key = cache_manager._generate_key(func.__name__, args, kwargs)
            
            # 尝试从缓存获取
            cached_result = cache_manager.get(key)
            if cached_result is not None:
                return cached_result
            
            # 执行函数
            result = await func(*args, **kwargs)
            
            # 存储到缓存
            cache_manager.set(key, result)
            
            return result
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            key = cache_manager._generate_key(func.__name__, args, kwargs)
            
            # 尝试从缓存获取
            cached_result = cache_manager.get(key)
            if cached_result is not None:
                return cached_result
            
            # 执行函数
            result = func(*args, **kwargs)
            
            # 存储到缓存
            cache_manager.set(key, result)
            
            return result
        
        # 判断函数是否是协程函数
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator

class TokenOptimizer:
    """Token优化器"""
    
    @staticmethod
    def optimize_prompt(prompt: str, max_tokens: int = 4096) -> str:
        """
        优化提示词
        产品意义：减少Token消耗，提高响应速度
        """
        # 移除多余的空格和换行
        optimized = ' '.join(prompt.split())
        
        # 移除重复的句子
        sentences = optimized.split('。')
        unique_sentences = []
        seen = set()
        
        for sentence in sentences:
            sentence = sentence.strip()
            if sentence and sentence not in seen:
                unique_sentences.append(sentence)
                seen.add(sentence)
        
        optimized = '。'.join(unique_sentences)
        
        # 限制长度
        if len(optimized) > max_tokens:
            optimized = optimized[:max_tokens]
        
        return optimized
    
    @staticmethod
    def estimate_tokens(text: str) -> int:
        """
        估算Token数量
        产品意义：预估API调用成本
        """
        # 简单估算：中文字符约等于1.5个token，英文单词约等于1个token
        chinese_chars = len([c for c in text if '\u4e00' <= c <= '\u9fff'])
        english_words = len(text.split())
        
        return int(chinese_chars * 1.5 + english_words)
