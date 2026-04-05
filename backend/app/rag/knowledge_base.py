# -*- coding: utf-8 -*-
"""
领域知识库
产品意义：存储和检索业务规则、政策法规等领域知识，辅助分析决策
"""

from typing import Dict, Any, List, Optional
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from langchain_community.document_loaders import TextLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.utils.langchain_utils import LangChainUtils
from app.config import config

class KnowledgeBase:
    def __init__(self):
        """初始化领域知识库"""
        self.langchain_utils = LangChainUtils()
        self.embeddings = self.langchain_utils.get_embeddings()
        self.collection_name = "domain_knowledge"
        self.db_path = config['database'].CHROMA_DB_PATH
        self.chunk_size = config['rag'].CHUNK_SIZE
        self.chunk_overlap = config['rag'].CHUNK_OVERLAP
        
        # 初始化向量存储
        self.vector_store = Chroma(
            collection_name=self.collection_name,
            embedding_function=self.embeddings,
            persist_directory=self.db_path
        )
    
    def add_document(self, file_path: str, metadata: Dict[str, Any] = None):
        """
        添加文档到知识库
        产品意义：导入业务规则、政策法规等领域知识
        """
        try:
            # 根据文件类型选择加载器
            if file_path.endswith('.pdf'):
                loader = PyPDFLoader(file_path)
            else:
                loader = TextLoader(file_path, encoding='utf-8')
            
            # 加载文档
            documents = loader.load()
            
            # 分割文档
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=self.chunk_size,
                chunk_overlap=self.chunk_overlap
            )
            split_docs = text_splitter.split_documents(documents)
            
            # 添加元数据
            if metadata:
                for doc in split_docs:
                    doc.metadata.update(metadata)
            
            # 添加到向量存储
            self.vector_store.add_documents(split_docs)
            self.vector_store.persist()
            
            return True
        except Exception as e:
            print(f"添加文档失败: {str(e)}")
            return False
    
    def add_text(self, text: str, metadata: Dict[str, Any] = None):
        """
        添加文本到知识库
        产品意义：直接添加业务规则、政策法规等文本内容
        """
        try:
            # 创建文档
            document = Document(
                page_content=text,
                metadata=metadata or {}
            )
            
            # 分割文档
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=self.chunk_size,
                chunk_overlap=self.chunk_overlap
            )
            split_docs = text_splitter.split_documents([document])
            
            # 添加到向量存储
            self.vector_store.add_documents(split_docs)
            self.vector_store.persist()
            
            return True
        except Exception as e:
            print(f"添加文本失败: {str(e)}")
            return False
    
    def retrieve_knowledge(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """
        检索相关知识
        产品意义：根据查询检索相关的领域知识
        """
        try:
            # 相似性搜索
            results = self.vector_store.similarity_search_with_score(
                query,
                k=k
            )
            
            # 处理结果
            knowledge_items = []
            for doc, score in results:
                if score < 0.7:  # 相似度阈值
                    knowledge_items.append({
                        "content": doc.page_content,
                        "score": score,
                        "metadata": doc.metadata
                    })
            
            return knowledge_items
        except Exception as e:
            print(f"检索知识失败: {str(e)}")
            return []
    
    def search_by_metadata(self, metadata_filter: Dict[str, Any], k: int = 10) -> List[Dict[str, Any]]:
        """
        根据元数据搜索知识
        产品意义：按类别、来源等元数据筛选知识
        """
        try:
            # 构建过滤条件
            filter_dict = {}
            for key, value in metadata_filter.items():
                filter_dict[key] = value
            
            # 搜索
            results = self.vector_store.similarity_search(
                "",  # 空查询，仅使用过滤条件
                k=k,
                filter=filter_dict
            )
            
            # 处理结果
            knowledge_items = []
            for doc in results:
                knowledge_items.append({
                    "content": doc.page_content,
                    "metadata": doc.metadata
                })
            
            return knowledge_items
        except Exception as e:
            print(f"按元数据搜索失败: {str(e)}")
            return []
    
    def get_knowledge_stats(self) -> Dict[str, Any]:
        """
        获取知识库统计信息
        产品意义：了解知识库的规模和内容分布
        """
        try:
            # 获取所有文档
            all_docs = self.vector_store.get()
            
            # 统计信息
            stats = {
                "total_documents": len(all_docs['ids']),
                "total_chunks": len(all_docs['ids']),  # 每个分块算一个文档
                "metadata_distribution": {}
            }
            
            # 统计元数据分布
            for metadata in all_docs['metadatas']:
                for key, value in metadata.items():
                    if key not in stats['metadata_distribution']:
                        stats['metadata_distribution'][key] = {}
                    if value not in stats['metadata_distribution'][key]:
                        stats['metadata_distribution'][key][value] = 0
                    stats['metadata_distribution'][key][value] += 1
            
            return stats
        except Exception as e:
            print(f"获取知识库统计失败: {str(e)}")
            return {}
    
    def clear_knowledge(self):
        """
        清空知识库
        产品意义：重置知识库，清理旧数据
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
            print(f"清空知识库失败: {str(e)}")
            return False
