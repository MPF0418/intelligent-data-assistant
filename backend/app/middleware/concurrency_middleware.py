# -*- coding: utf-8 -*-
"""
并发控制中间件
产品意义：防止系统过载，保护服务稳定性
"""

from flask import request, jsonify
from app.utils.performance_manager import concurrency_controller
import time

def add_concurrency_control(app):
    """
    添加并发控制中间件
    产品意义：在请求处理前检查并发限制
    """
    
    @app.before_request
    def check_concurrency():
        """
        检查并发限制
        产品意义：在请求处理前验证系统负载
        """
        # 跳过健康检查和性能监控端点
        if request.path in ['/health', '/api/v1/performance/metrics', '/api/v1/performance/concurrency/status']:
            return None
        
        # 获取并发状态
        status = concurrency_controller.get_status()
        
        # 如果并发数达到限制，返回503错误
        if status['available_slots'] <= 0:
            return jsonify({
                "error": "系统繁忙，请稍后再试",
                "retry_after": 5
            }), 503
    
    @app.after_request
    def record_request_time(response):
        """
        记录请求处理时间
        产品意义：监控API响应时间
        """
        if hasattr(request, 'start_time'):
            duration = (time.time() - request.start_time) * 1000
            from app.utils.performance_manager import perf_monitor
            # 记录所有API请求的性能数据
            perf_monitor.record_metric(f"{request.method} {request.path}", duration)
            # 同时记录到总请求数
            perf_monitor.record_metric("total_requests", 1, "count")
        
        return response
    
    @app.before_request
    def record_start_time():
        """
        记录请求开始时间
        产品意义：为性能监控提供基础数据
        """
        request.start_time = time.time()
    
    return app