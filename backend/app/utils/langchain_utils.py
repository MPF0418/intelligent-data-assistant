# -*- coding: utf-8 -*-
"""
LangChain工具类
产品意义：封装LangChain核心功能，提供统一的接口
"""

from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from app.config import config

class LangChainUtils:
    def __init__(self):
        """初始化LangChain工具"""
        self.api_config = config['api']
        self.rag_config = config['rag']
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
    
    def get_embeddings(self):
        """
        获取嵌入模型
        产品意义：用于文本向量化，支持RAG功能
        """
        return HuggingFaceEmbeddings(
            model_name=self.rag_config.EMBEDDING_MODEL,
            model_kwargs={'device': 'cpu'}
        )
    
    def create_vector_store(self, documents, collection_name=None):
        """
        创建向量存储
        产品意义：存储和检索文本嵌入
        """
        embeddings = self.get_embeddings()
        collection_name = collection_name or config['database'].CHROMA_COLLECTION_NAME
        
        return Chroma.from_documents(
            documents=documents,
            embedding=embeddings,
            collection_name=collection_name,
            persist_directory=config['database'].CHROMA_DB_PATH
        )
    
    def create_chat_chain(self, system_prompt, llm=None):
        """
        创建聊天链
        产品意义：标准化聊天交互流程
        """
        if not llm:
            llm = self.get_llm()
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{input}")
        ])
        
        return prompt | llm | StrOutputParser()
    
    def create_rag_chain(self, vector_store, system_prompt, llm=None):
        """
        创建RAG链
        产品意义：结合向量检索和大模型生成
        """
        if not llm:
            llm = self.get_llm()
        
        retriever = vector_store.as_retriever(
            search_kwargs={"k": self.rag_config.TOP_K}
        )
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "Context:\n{context}\n\nQuestion:{input}")
        ])
        
        def format_docs(docs):
            return "\n".join([doc.page_content for doc in docs])
        
        return (
            {"context": retriever | format_docs, "input": RunnablePassthrough()}
            | prompt
            | llm
            | StrOutputParser()
        )
