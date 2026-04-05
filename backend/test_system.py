# -*- coding: utf-8 -*-
"""
系统测试脚本
产品意义：验证系统功能是否正常工作
"""

import requests
import json
import time
from typing import Dict, Any, List

class SystemTester:
    """系统测试器"""
    
    def __init__(self, base_url: str = "http://localhost:5001"):
        """
        初始化测试器
        产品意义：设置测试的基础URL
        """
        self.base_url = base_url
        self.test_results = []
    
    def test_health_check(self) -> bool:
        """
        测试健康检查
        产品意义：验证服务是否正常运行
        """
        try:
            response = requests.get(f"{self.base_url}/health")
            success = response.status_code == 200 and response.json().get("status") == "healthy"
            self.test_results.append({
                "test": "健康检查",
                "success": success,
                "message": "服务运行正常" if success else "服务异常"
            })
            return success
        except Exception as e:
            self.test_results.append({
                "test": "健康检查",
                "success": False,
                "message": f"连接失败: {str(e)}"
            })
            return False
    
    def test_api_endpoints(self) -> bool:
        """
        测试API端点
        产品意义：验证所有API是否可访问
        """
        try:
            response = requests.get(f"{self.base_url}/")
            success = response.status_code == 200
            data = response.json()
            
            if success:
                endpoints = data.get("endpoints", {})
                self.test_results.append({
                    "test": "API端点",
                    "success": True,
                    "message": f"发现 {len(endpoints)} 个API分组"
                })
            else:
                self.test_results.append({
                    "test": "API端点",
                    "success": False,
                    "message": "获取API列表失败"
                })
            
            return success
        except Exception as e:
            self.test_results.append({
                "test": "API端点",
                "success": False,
                "message": f"连接失败: {str(e)}"
            })
            return False
    
    def test_agent_analysis(self) -> bool:
        """
        测试分析Agent
        产品意义：验证数据分析功能
        """
        try:
            payload = {
                "user_query": "分析最近一周的销售数据",
                "data_schema": {
                    "fields": ["date", "sales", "region"],
                    "types": ["date", "number", "string"]
                }
            }
            
            response = requests.post(
                f"{self.base_url}/api/v1/agent/analysis",
                json=payload
            )
            
            success = response.status_code == 200
            data = response.json()
            
            self.test_results.append({
                "test": "分析Agent",
                "success": success,
                "message": "分析功能正常" if success else f"分析失败: {data.get('error', '未知错误')}"
            })
            
            return success
        except Exception as e:
            self.test_results.append({
                "test": "分析Agent",
                "success": False,
                "message": f"连接失败: {str(e)}"
            })
            return False
    
    def test_rag_memory(self) -> bool:
        """
        测试RAG记忆库
        产品意义：验证记忆存储和检索功能
        """
        try:
            # 添加记忆
            add_payload = {
                "user_query": "测试查询",
                "analysis_result": {"result": "测试结果"},
                "data_schema": {"fields": ["test"]}
            }
            
            add_response = requests.post(
                f"{self.base_url}/api/v1/rag/memory/add",
                json=add_payload
            )
            
            # 检索记忆
            retrieve_payload = {
                "user_query": "测试查询",
                "k": 3
            }
            
            retrieve_response = requests.post(
                f"{self.base_url}/api/v1/rag/memory/retrieve",
                json=retrieve_payload
            )
            
            success = add_response.status_code == 200 and retrieve_response.status_code == 200
            
            self.test_results.append({
                "test": "RAG记忆库",
                "success": success,
                "message": "记忆库功能正常" if success else "记忆库功能异常"
            })
            
            return success
        except Exception as e:
            self.test_results.append({
                "test": "RAG记忆库",
                "success": False,
                "message": f"连接失败: {str(e)}"
            })
            return False
    
    def test_performance_metrics(self) -> bool:
        """
        测试性能监控
        产品意义：验证性能数据收集功能
        """
        try:
            response = requests.get(f"{self.base_url}/api/v1/performance/metrics")
            success = response.status_code == 200
            data = response.json()
            
            if success:
                metrics = data.get("data", {})
                self.test_results.append({
                    "test": "性能监控",
                    "success": True,
                    "message": f"收集到 {len(metrics)} 个性能指标"
                })
            else:
                self.test_results.append({
                    "test": "性能监控",
                    "success": False,
                    "message": "获取性能指标失败"
                })
            
            return success
        except Exception as e:
            self.test_results.append({
                "test": "性能监控",
                "success": False,
                "message": f"连接失败: {str(e)}"
            })
            return False
    
    def test_cache_clear(self) -> bool:
        """
        测试缓存清空
        产品意义：验证缓存管理功能
        """
        try:
            response = requests.post(f"{self.base_url}/api/v1/performance/cache/clear")
            success = response.status_code == 200
            data = response.json()
            
            self.test_results.append({
                "test": "缓存清空",
                "success": success,
                "message": data.get("message", "缓存操作完成") if success else "缓存清空失败"
            })
            
            return success
        except Exception as e:
            self.test_results.append({
                "test": "缓存清空",
                "success": False,
                "message": f"连接失败: {str(e)}"
            })
            return False
    
    def test_concurrency_status(self) -> bool:
        """
        测试并发状态
        产品意义：验证并发监控功能
        """
        try:
            response = requests.get(f"{self.base_url}/api/v1/performance/concurrency/status")
            success = response.status_code == 200
            data = response.json()
            
            if success:
                status = data.get("data", {})
                self.test_results.append({
                    "test": "并发状态",
                    "success": True,
                    "message": f"并发数: {status.get('active_tasks', 0)}/{status.get('max_concurrent', 10)}"
                })
            else:
                self.test_results.append({
                    "test": "并发状态",
                    "success": False,
                    "message": "获取并发状态失败"
                })
            
            return success
        except Exception as e:
            self.test_results.append({
                "test": "并发状态",
                "success": False,
                "message": f"连接失败: {str(e)}"
            })
            return False
    
    def run_all_tests(self) -> Dict[str, Any]:
        """
        运行所有测试
        产品意义：执行完整的系统测试
        """
        print("开始系统测试...")
        print("=" * 50)
        
        # 运行测试
        self.test_health_check()
        self.test_api_endpoints()
        self.test_agent_analysis()
        self.test_rag_memory()
        self.test_performance_metrics()
        self.test_cache_clear()
        self.test_concurrency_status()
        
        # 统计结果
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print("\n测试结果:")
        print("=" * 50)
        
        for result in self.test_results:
            status = "✓" if result["success"] else "✗"
            print(f"{status} {result['test']}: {result['message']}")
        
        print("\n" + "=" * 50)
        print(f"总测试数: {total_tests}")
        print(f"通过: {passed_tests}")
        print(f"失败: {failed_tests}")
        print(f"成功率: {(passed_tests/total_tests*100):.1f}%")
        
        return {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "success_rate": passed_tests/total_tests,
            "results": self.test_results
        }

if __name__ == "__main__":
    """
    主函数
    产品意义：执行系统测试
    """
    tester = SystemTester()
    results = tester.run_all_tests()
    
    # 保存测试结果
    with open("test_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print("\n测试结果已保存到 test_results.json")