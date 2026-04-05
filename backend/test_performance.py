# -*- coding: utf-8 -*-
"""
性能压测脚本
产品意义：测试系统在高并发情况下的性能表现
"""

import requests
import json
import time
import threading
from typing import Dict, Any, List
from concurrent.futures import ThreadPoolExecutor, as_completed

class PerformanceTester:
    """性能测试器"""
    
    def __init__(self, base_url: str = "http://localhost:5001"):
        """
        初始化测试器
        产品意义：设置测试的基础URL
        """
        self.base_url = base_url
        self.results = []
    
    def single_request(self, endpoint: str, method: str = "GET", payload: Dict = None) -> Dict[str, Any]:
        """
        单次请求
        产品意义：执行一次API请求并记录性能数据
        """
        start_time = time.time()
        
        try:
            if method == "GET":
                response = requests.get(f"{self.base_url}{endpoint}")
            else:
                response = requests.post(f"{self.base_url}{endpoint}", json=payload)
            
            duration = (time.time() - start_time) * 1000  # 转换为毫秒
            
            return {
                "success": response.status_code == 200,
                "duration": duration,
                "status_code": response.status_code,
                "error": None
            }
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            return {
                "success": False,
                "duration": duration,
                "status_code": None,
                "error": str(e)
            }
    
    def test_endpoint(self, endpoint: str, method: str = "GET", payload: Dict = None, 
                     num_requests: int = 10, concurrent: int = 5) -> Dict[str, Any]:
        """
        测试端点性能
        产品意义：并发执行多次请求，统计性能指标
        """
        print(f"\n测试端点: {method} {endpoint}")
        print(f"请求数: {num_requests}, 并发数: {concurrent}")
        
        durations = []
        success_count = 0
        error_count = 0
        errors = []
        
        def make_request():
            result = self.single_request(endpoint, method, payload)
            return result
        
        # 使用线程池执行并发请求
        with ThreadPoolExecutor(max_workers=concurrent) as executor:
            futures = [executor.submit(make_request) for _ in range(num_requests)]
            
            for future in as_completed(futures):
                result = future.result()
                durations.append(result["duration"])
                
                if result["success"]:
                    success_count += 1
                else:
                    error_count += 1
                    if result["error"]:
                        errors.append(result["error"])
        
        # 计算统计指标
        durations.sort()
        
        stats = {
            "endpoint": endpoint,
            "method": method,
            "total_requests": num_requests,
            "success_count": success_count,
            "error_count": error_count,
            "success_rate": success_count / num_requests * 100,
            "min_duration": min(durations),
            "max_duration": max(durations),
            "avg_duration": sum(durations) / len(durations),
            "median_duration": durations[len(durations) // 2],
            "p95_duration": durations[int(len(durations) * 0.95)],
            "p99_duration": durations[int(len(durations) * 0.99)],
            "errors": errors[:5]  # 只记录前5个错误
        }
        
        self.results.append(stats)
        
        # 打印结果
        print(f"成功率: {stats['success_rate']:.1f}%")
        print(f"平均响应时间: {stats['avg_duration']:.2f}ms")
        print(f"最小响应时间: {stats['min_duration']:.2f}ms")
        print(f"最大响应时间: {stats['max_duration']:.2f}ms")
        print(f"P95响应时间: {stats['p95_duration']:.2f}ms")
        print(f"P99响应时间: {stats['p99_duration']:.2f}ms")
        
        if errors:
            print(f"错误示例: {errors[0]}")
        
        return stats
    
    def test_health_check(self, num_requests: int = 100, concurrent: int = 10) -> Dict[str, Any]:
        """
        测试健康检查端点
        产品意义：验证基础服务的性能
        """
        return self.test_endpoint("/health", "GET", None, num_requests, concurrent)
    
    def test_api_info(self, num_requests: int = 50, concurrent: int = 5) -> Dict[str, Any]:
        """
        测试API信息端点
        产品意义：验证API列表查询性能
        """
        return self.test_endpoint("/", "GET", None, num_requests, concurrent)
    
    def test_agent_analysis(self, num_requests: int = 20, concurrent: int = 5) -> Dict[str, Any]:
        """
        测试分析Agent端点
        产品意义：验证数据分析功能的性能
        """
        payload = {
            "user_query": "分析最近一周的销售数据",
            "data_schema": {
                "fields": ["date", "sales", "region"],
                "types": ["date", "number", "string"]
            }
        }
        return self.test_endpoint("/api/v1/agent/analysis", "POST", payload, num_requests, concurrent)
    
    def test_rag_retrieve(self, num_requests: int = 30, concurrent: int = 5) -> Dict[str, Any]:
        """
        测试RAG检索端点
        产品意义：验证记忆检索功能的性能
        """
        payload = {
            "user_query": "测试查询",
            "k": 3
        }
        return self.test_endpoint("/api/v1/rag/memory/retrieve", "POST", payload, num_requests, concurrent)
    
    def test_performance_metrics(self, num_requests: int = 50, concurrent: int = 5) -> Dict[str, Any]:
        """
        测试性能监控端点
        产品意义：验证性能数据查询性能
        """
        return self.test_endpoint("/api/v1/performance/metrics", "GET", None, num_requests, concurrent)
    
    def run_all_tests(self) -> Dict[str, Any]:
        """
        运行所有性能测试
        产品意义：执行完整的性能测试套件
        """
        print("开始性能压测...")
        print("=" * 60)
        
        # 运行测试
        self.test_health_check(num_requests=100, concurrent=10)
        self.test_api_info(num_requests=50, concurrent=5)
        self.test_agent_analysis(num_requests=20, concurrent=5)
        self.test_rag_retrieve(num_requests=30, concurrent=5)
        self.test_performance_metrics(num_requests=50, concurrent=5)
        
        # 生成汇总报告
        print("\n" + "=" * 60)
        print("性能测试汇总")
        print("=" * 60)
        
        total_requests = sum(r["total_requests"] for r in self.results)
        total_success = sum(r["success_count"] for r in self.results)
        total_errors = sum(r["error_count"] for r in self.results)
        
        print(f"总请求数: {total_requests}")
        print(f"成功请求数: {total_success}")
        print(f"失败请求数: {total_errors}")
        print(f"总体成功率: {(total_success/total_requests*100):.1f}%")
        
        # 计算总体性能指标
        all_durations = []
        for result in self.results:
            # 估算每个端点的平均响应时间
            avg_duration = result["avg_duration"]
            all_durations.extend([avg_duration] * result["total_requests"])
        
        if all_durations:
            all_durations.sort()
            print(f"\n总体响应时间统计:")
            print(f"平均响应时间: {sum(all_durations)/len(all_durations):.2f}ms")
            print(f"最小响应时间: {min(all_durations):.2f}ms")
            print(f"最大响应时间: {max(all_durations):.2f}ms")
            print(f"P95响应时间: {all_durations[int(len(all_durations)*0.95)]:.2f}ms")
        
        # 性能评估
        print("\n性能评估:")
        if total_success/total_requests >= 0.99:
            print("✓ 系统稳定性: 优秀")
        elif total_success/total_requests >= 0.95:
            print("△ 系统稳定性: 良好")
        else:
            print("✗ 系统稳定性: 需要改进")
        
        avg_response = sum(all_durations)/len(all_durations) if all_durations else 0
        if avg_response < 100:
            print("✓ 响应速度: 优秀")
        elif avg_response < 500:
            print("△ 响应速度: 良好")
        else:
            print("✗ 响应速度: 需要优化")
        
        # 保存结果
        report = {
            "summary": {
                "total_requests": total_requests,
                "success_count": total_success,
                "error_count": total_errors,
                "success_rate": total_success/total_requests,
                "avg_response_time": sum(all_durations)/len(all_durations) if all_durations else 0
            },
            "results": self.results
        }
        
        return report

if __name__ == "__main__":
    """
    主函数
    产品意义：执行性能压测
    """
    tester = PerformanceTester()
    report = tester.run_all_tests()
    
    # 保存测试报告
    with open("performance_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print("\n性能测试报告已保存到 performance_report.json")