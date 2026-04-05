# -*- coding: utf-8 -*-
"""
高级分析工具类
产品意义：提供智能数据洞察、预测分析、异常检测和关联分析功能
"""

from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import IsolationForest
from sklearn.cluster import KMeans
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate
from app.config import config

class AdvancedAnalysis:
    def __init__(self):
        """初始化高级分析工具"""
        self.api_config = config['api']
        self.agent_config = config['agent']
    
    def get_llm(self, provider='openai'):
        """
        获取大语言模型实例
        产品意义：支持多模型切换，提高系统可靠性
        """
        if provider == 'openai' and self.api_config.OPENAI_API_KEY:
            return ChatOpenAI(
                api_key=self.api_config.OPENAI_API_KEY,
                model="gpt-4-turbo",
                temperature=self.agent_config.TEMPERATURE,
                max_tokens=self.agent_config.MAX_TOKENS
            )
        elif provider == 'anthropic' and self.api_config.ANTHROPIC_API_KEY:
            return ChatAnthropic(
                api_key=self.api_config.ANTHROPIC_API_KEY,
                model="claude-3-opus-20240229",
                temperature=self.agent_config.TEMPERATURE,
                max_tokens=self.agent_config.MAX_TOKENS
            )
        else:
            # 降级方案：使用OpenAI作为默认
            return ChatOpenAI(
                api_key=self.api_config.OPENAI_API_KEY,
                model="gpt-4-turbo",
                temperature=self.agent_config.TEMPERATURE,
                max_tokens=self.agent_config.MAX_TOKENS
            )
    
    def intelligent_insight(self, data: Dict[str, Any], business_rules: List[str] = None) -> Dict[str, Any]:
        """
        智能数据洞察
        产品意义：结合业务规则和数据分析结果，提供深度洞察
        """
        try:
            # 分析数据
            analysis_result = self._analyze_data(data)
            
            # 结合业务规则生成洞察
            insight = self._generate_insight(analysis_result, business_rules)
            
            return {
                "analysis": analysis_result,
                "insight": insight
            }
        except Exception as e:
            print(f"智能数据洞察失败: {str(e)}")
            return {
                "error": str(e),
                "insight": "无法生成智能洞察，请检查数据格式"
            }
    
    def predictive_analysis(self, historical_data: List[Dict[str, Any]], forecast_period: int = 3) -> Dict[str, Any]:
        """
        预测分析
        产品意义：基于历史数据进行趋势预测
        """
        try:
            # 转换数据格式
            df = pd.DataFrame(historical_data)
            
            # 提取时间序列数据
            if 'timestamp' in df.columns and 'value' in df.columns:
                # 排序并转换时间戳
                df['timestamp'] = pd.to_datetime(df['timestamp'])
                df = df.sort_values('timestamp')
                
                # 准备特征
                df['time_index'] = range(len(df))
                X = df['time_index'].values.reshape(-1, 1)
                y = df['value'].values
                
                # 训练模型
                model = LinearRegression()
                model.fit(X, y)
                
                # 预测
                last_index = df['time_index'].iloc[-1]
                future_indices = np.array([last_index + i for i in range(1, forecast_period + 1)]).reshape(-1, 1)
                predictions = model.predict(future_indices)
                
                # 生成预测结果
                predictions_list = []
                for i, pred in enumerate(predictions):
                    predictions_list.append({
                        "period": i + 1,
                        "predicted_value": float(pred)
                    })
                
                return {
                    "predictions": predictions_list,
                    "model_score": float(model.score(X, y))
                }
            else:
                return {
                    "error": "历史数据需要包含timestamp和value字段"
                }
        except Exception as e:
            print(f"预测分析失败: {str(e)}")
            return {
                "error": str(e),
                "predictions": []
            }
    
    def anomaly_detection(self, data: List[Dict[str, Any]], contamination: float = 0.1) -> Dict[str, Any]:
        """
        异常检测
        产品意义：识别数据中的异常模式
        """
        try:
            # 转换数据格式
            df = pd.DataFrame(data)
            
            # 提取数值特征
            numerical_columns = df.select_dtypes(include=[np.number]).columns
            if len(numerical_columns) == 0:
                return {
                    "error": "数据中没有数值特征用于异常检测"
                }
            
            # 准备数据
            X = df[numerical_columns].values
            
            # 训练异常检测模型
            model = IsolationForest(contamination=contamination, random_state=42)
            model.fit(X)
            
            # 预测异常
            scores = model.score_samples(X)
            anomalies = model.predict(X)  # -1表示异常，1表示正常
            
            # 生成结果
            results = []
            for i, (score, anomaly) in enumerate(zip(scores, anomalies)):
                results.append({
                    "index": i,
                    "is_anomaly": bool(anomaly == -1),
                    "anomaly_score": float(score),
                    "data": df.iloc[i].to_dict()
                })
            
            return {
                "anomalies": [r for r in results if r['is_anomaly']],
                "all_results": results,
                "anomaly_count": sum(1 for r in results if r['is_anomaly'])
            }
        except Exception as e:
            print(f"异常检测失败: {str(e)}")
            return {
                "error": str(e),
                "anomalies": []
            }
    
    def correlation_analysis(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        关联分析
        产品意义：发现数据之间的关联关系
        """
        try:
            # 转换数据格式
            df = pd.DataFrame(data['data'])
            
            # 计算相关性矩阵
            numerical_columns = df.select_dtypes(include=[np.number]).columns
            if len(numerical_columns) < 2:
                return {
                    "error": "需要至少两个数值特征来计算相关性"
                }
            
            correlation_matrix = df[numerical_columns].corr()
            
            # 生成关联分析结果
            correlations = []
            for i, col1 in enumerate(numerical_columns):
                for j, col2 in enumerate(numerical_columns):
                    if i < j:  # 避免重复
                        corr_value = correlation_matrix.iloc[i, j]
                        correlations.append({
                            "feature1": col1,
                            "feature2": col2,
                            "correlation": float(corr_value),
                            "strength": self._get_correlation_strength(corr_value)
                        })
            
            # 按相关性强度排序
            correlations.sort(key=lambda x: abs(x['correlation']), reverse=True)
            
            return {
                "correlations": correlations,
                "top_correlations": correlations[:10]  # 返回前10个最强关联
            }
        except Exception as e:
            print(f"关联分析失败: {str(e)}")
            return {
                "error": str(e),
                "correlations": []
            }
    
    def _analyze_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        分析数据
        产品意义：提取数据的基本统计特征
        """
        analysis = {}
        
        if 'data' in data:
            df = pd.DataFrame(data['data'])
            
            # 基本统计信息
            analysis['basic_stats'] = {}
            for col in df.columns:
                if pd.api.types.is_numeric_dtype(df[col]):
                    analysis['basic_stats'][col] = {
                        "mean": float(df[col].mean()),
                        "median": float(df[col].median()),
                        "std": float(df[col].std()),
                        "min": float(df[col].min()),
                        "max": float(df[col].max())
                    }
            
            # 数据形状
            analysis['shape'] = {
                "rows": int(df.shape[0]),
                "columns": int(df.shape[1])
            }
        
        return analysis
    
    def _generate_insight(self, analysis_result: Dict[str, Any], business_rules: List[str] = None) -> str:
        """
        生成智能洞察
        产品意义：结合分析结果和业务规则，提供有价值的洞察
        """
        system_prompt = "你是一个智能数据分析师，负责基于数据分析结果和业务规则生成深度洞察。请根据提供的分析结果和业务规则，生成专业、有洞察力的分析报告。"
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "分析结果:\n{analysis}\n\n业务规则:\n{rules}\n\n请生成智能数据洞察，包括数据趋势、异常情况、潜在问题和建议。")
        ])
        
        llm = self.get_llm()
        chain = prompt | llm
        
        result = chain.invoke({
            "analysis": str(analysis_result),
            "rules": "\n".join(business_rules) if business_rules else "无"
        })
        
        return result.content.strip()
    
    def _get_correlation_strength(self, correlation: float) -> str:
        """
        获取相关性强度
        产品意义：将相关性数值转换为易于理解的强度描述
        """
        abs_corr = abs(correlation)
        if abs_corr >= 0.8:
            return "极强"
        elif abs_corr >= 0.6:
            return "强"
        elif abs_corr >= 0.4:
            return "中等"
        elif abs_corr >= 0.2:
            return "弱"
        else:
            return "极弱"
