# -*- coding: utf-8 -*-
"""
性能管理器
产品意义：集中管理性能监控、缓存和并发控制组件
"""

from app.utils.performance_utils_fixed import (
    PerformanceMonitor,
    CacheManager,
    ConcurrencyController
)

# 创建全局性能管理器实例
perf_monitor = PerformanceMonitor()
cache_manager = CacheManager(max_size=1000, ttl=3600)
concurrency_controller = ConcurrencyController(max_concurrent=10)