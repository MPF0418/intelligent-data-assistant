# -*- coding: utf-8 -*-
"""
查询记忆库
产品意义：存储和检索历史查询，避免重复分析，提高系统效率
"""

from typing import Dict, Any, List, Optional
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from app.utils.langchain_utils import LangChainUtils
from app.config import config

class MemoryStore:
    def __init__(self):
        """初始化查询记忆库"""
        self.langchain_utils = LangChainUtils()
        self.embeddings = self.langchain_utils.get_embeddings()
        self.collection_name = "query_memory"
        self.db_path = config['database'].CHROMA_DB_PATH
        
        # 初始化向量存储
        self.vector_store = Chroma(
            collection_name=self.collection_name,
            embedding_function=self.embeddings,
            persist_directory=self.db_path
        )
    
    def add_query(self, user_query: str, analysis_result: Dict[str, Any], data_schema: Dict[str, Any]):
        """
        添加查询到记忆库
        产品意义：记录用户的历史查询和分析结果
        """
        try:
            # 创建文档
            metadata = {
                "query": user_query,
                "timestamp": self._get_timestamp(),
                "data_schema": data_schema
            }
            
            # 提取分析结果的关键信息作为文档内容
            content = self._extract_key_info(analysis_result)
            
            document = Document(
                page_content=content,
                metadata=metadata
            )
            
            # 添加到向量存储
            self.vector_store.add_documents([document])
            self.vector_store.persist()
            
            return True
        except Exception as e:
            print(f"添加查询失败: {str(e)}")
            return False
    
    def retrieve_similar_queries(self, user_query: str, k: int = 3) -> List[Dict[str, Any]]:
        """
        检索相似的历史查询
        产品意义：找到与当前查询相似的历史分析，提供参考
        """
        try:
            # 相似性搜索
            results = self.vector_store.similarity_search_with_score(
                user_query,
                k=k
            )
            
            # 处理结果
            similar_queries = []
            for doc, score in results:
                if score < 0.7:  # 相似度阈值
                    similar_queries.append({
                        "query": doc.metadata.get("query", ""),
                        "content": doc.page_content,
                        "score": score,
                        "timestamp": doc.metadata.get("timestamp", ""),
                        "data_schema": doc.metadata.get("data_schema", {})
                    })
            
            return similar_queries
        except Exception as e:
            print(f"检索相似查询失败: {str(e)}")
            return []
    
    def get_query_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        获取查询历史
        产品意义：查看用户的历史查询记录
        """
        try:
            # 获取所有文档
            all_docs = self.vector_store.get()
            
            # 处理结果
            history = []
            for i, (doc_id, embedding, metadata, content) in enumerate(zip(
                all_docs['ids'],
                all_docs['embeddings'],
                all_docs['metadatas'],
                all_docs['documents']
            )):
                if i >= limit:
                    break
                
                history.append({
                    "id": doc_id,
                    "query": metadata.get("query", ""),
                    "content": content,
                    "timestamp": metadata.get("timestamp", ""),
                    "data_schema": metadata.get("data_schema", {})
                })
            
            # 按时间戳排序
            history.sort(key=lambda x: x['timestamp'], reverse=True)
            
            return history
        except Exception as e:
            print(f"获取查询历史失败: {str(e)}")
            return []
    
    def clear_memory(self):
        """
        清空记忆库
        产品意义：重置记忆库，清理旧数据
        """
        try:
            # 删除所有文档
            self.vector_store.delete_collection()
            
            # 重新初始化
            self.vector_store = Chroma(
                collection_name=self.collection_name,
                embedding_function=self.embeddings,
                persist_directory=self.db_path
            )
            
            return True
        except Exception as e:
            print(f"清空记忆库失败: {str(e)}")
            return False
    
    def _extract_key_info(self, analysis_result: Dict[str, Any]) -> str:
        """
        提取分析结果的关键信息
        产品意义：将复杂的分析结果转换为可存储的文本
        """
        # 提取关键信息
        key_info = []
        
        if "analysis_steps" in analysis_result:
            key_info.append(f"分析步骤: {len(analysis_result['analysis_steps'])}")
        
        if "results" in analysis_result:
            results = analysis_result['results']
            if "summary" in results:
                key_info.append(f"分析总结: {results['summary'][:100]}...")
        
        return " ".join(key_info) if key_info else "无关键信息"
    
    def _get_timestamp(self) -> str:
        """
        获取当前时间戳
        产品意义：记录查询的时间信息
        """
        import datetime
        return datetime.datetime.now().isoformat()
