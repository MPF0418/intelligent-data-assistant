# -*- coding: utf-8 -*-
"""
数据字典
产品意义：存储和管理数据字段的语义信息，辅助数据理解和分析
"""

from typing import Dict, Any, List, Optional
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from app.utils.langchain_utils import LangChainUtils
from app.config import config

class DataDictionary:
    def __init__(self):
        """初始化数据字典"""
        self.langchain_utils = LangChainUtils()
        self.embeddings = self.langchain_utils.get_embeddings()
        self.collection_name = "data_dictionary"
        self.db_path = config['database'].CHROMA_DB_PATH
        
        # 初始化向量存储
        self.vector_store = Chroma(
            collection_name=self.collection_name,
            embedding_function=self.embeddings,
            persist_directory=self.db_path
        )
    
    def add_field(self, field_name: str, field_description: str, data_type: str, metadata: Dict[str, Any] = None):
        """
        添加字段到数据字典
        产品意义：记录数据字段的语义信息
        """
        try:
            # 创建文档
            content = f"字段名: {field_name}\n描述: {field_description}\n类型: {data_type}"
            
            doc_metadata = {
                "field_name": field_name,
                "data_type": data_type,
                **(metadata or {})
            }
            
            document = Document(
                page_content=content,
                metadata=doc_metadata
            )
            
            # 添加到向量存储
            self.vector_store.add_documents([document])
            self.vector_store.persist()
            
            return True
        except Exception as e:
            print(f"添加字段失败: {str(e)}")
            return False
    
    def add_schema(self, schema: Dict[str, Any], source: str = "unknown"):
        """
        添加整个数据模式到数据字典
        产品意义：批量导入数据模式的字段信息
        """
        try:
            documents = []
            
            for field_name, field_info in schema.items():
                field_description = field_info.get('description', '')
                data_type = field_info.get('type', 'text')
                
                content = f"字段名: {field_name}\n描述: {field_description}\n类型: {data_type}"
                
                metadata = {
                    "field_name": field_name,
                    "data_type": data_type,
                    "source": source
                }
                
                document = Document(
                    page_content=content,
                    metadata=metadata
                )
                documents.append(document)
            
            # 添加到向量存储
            if documents:
                self.vector_store.add_documents(documents)
                self.vector_store.persist()
            
            return True
        except Exception as e:
            print(f"添加数据模式失败: {str(e)}")
            return False
    
    def retrieve_field_info(self, field_name: str) -> List[Dict[str, Any]]:
        """
        检索字段信息
        产品意义：获取字段的语义信息
        """
        try:
            # 相似性搜索
            results = self.vector_store.similarity_search_with_score(
                field_name,
                k=3
            )
            
            # 处理结果
            field_info_list = []
            for doc, score in results:
                if score < 0.6:  # 相似度阈值
                    field_info_list.append({
                        "field_name": doc.metadata.get("field_name", ""),
                        "description": doc.page_content,
                        "data_type": doc.metadata.get("data_type", ""),
                        "score": score,
                        "metadata": doc.metadata
                    })
            
            return field_info_list
        except Exception as e:
            print(f"检索字段信息失败: {str(e)}")
            return []
    
    def search_fields_by_type(self, data_type: str) -> List[Dict[str, Any]]:
        """
        按数据类型搜索字段
        产品意义：查找特定类型的字段
        """
        try:
            # 构建过滤条件
            filter_dict = {"data_type": data_type}
            
            # 搜索
            results = self.vector_store.similarity_search(
                "",  # 空查询，仅使用过滤条件
                k=10,
                filter=filter_dict
            )
            
            # 处理结果
            field_list = []
            for doc in results:
                field_list.append({
                    "field_name": doc.metadata.get("field_name", ""),
                    "description": doc.page_content,
                    "data_type": doc.metadata.get("data_type", ""),
                    "metadata": doc.metadata
                })
            
            return field_list
        except Exception as e:
            print(f"按类型搜索字段失败: {str(e)}")
            return []
    
    def get_dictionary_stats(self) -> Dict[str, Any]:
        """
        获取数据字典统计信息
        产品意义：了解数据字典的规模和内容分布
        """
        try:
            # 获取所有文档
            all_docs = self.vector_store.get()
            
            # 统计信息
            stats = {
                "total_fields": len(all_docs['ids']),
                "type_distribution": {},
                "source_distribution": {}
            }
            
            # 统计类型分布
            for metadata in all_docs['metadatas']:
                data_type = metadata.get('data_type', 'unknown')
                if data_type not in stats['type_distribution']:
                    stats['type_distribution'][data_type] = 0
                stats['type_distribution'][data_type] += 1
                
                source = metadata.get('source', 'unknown')
                if source not in stats['source_distribution']:
                    stats['source_distribution'][source] = 0
                stats['source_distribution'][source] += 1
            
            return stats
        except Exception as e:
            print(f"获取数据字典统计失败: {str(e)}")
            return {}
    
    def clear_dictionary(self):
        """
        清空数据字典
        产品意义：重置数据字典，清理旧数据
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
            print(f"清空数据字典失败: {str(e)}")
            return False
