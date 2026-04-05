# -*- coding: utf-8 -*-
"""
智能交互增强工具类
产品意义：提供自然语言理解、多轮对话和上下文管理功能
"""

from typing import Dict, Any, List, Optional
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from app.config import config

class InteractionUtils:
    def __init__(self):
        """初始化智能交互工具"""
        self.api_config = config['api']
        self.agent_config = config['agent']
        self.conversation_history = {}
    
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
    
    def process_query(self, user_query: str, conversation_id: str = None) -> Dict[str, Any]:
        """
        处理用户查询
        产品意义：理解用户意图，提供智能回复
        """
        try:
            # 获取或创建对话历史
            if not conversation_id:
                conversation_id = self._generate_conversation_id()
            
            # 添加用户消息到历史
            self._add_message(conversation_id, "human", user_query)
            
            # 构建对话上下文
            context = self._build_context(conversation_id)
            
            # 理解用户意图
            intent = self._understand_intent(user_query, context)
            
            # 生成回复
            response = self._generate_response(user_query, context, intent)
            
            # 添加AI回复到历史
            self._add_message(conversation_id, "ai", response)
            
            return {
                "conversation_id": conversation_id,
                "intent": intent,
                "response": response,
                "context": context
            }
        except Exception as e:
            print(f"处理查询失败: {str(e)}")
            return {
                "error": str(e),
                "response": "抱歉，我遇到了一些问题，请稍后再试。"
            }
    
    def _understand_intent(self, user_query: str, context: str) -> str:
        """
        理解用户意图
        产品意义：识别用户的查询目的，提供针对性的响应
        """
        system_prompt = "你是一个智能数据洞察助手，负责理解用户的查询意图。请根据用户的问题和对话上下文，判断用户的意图类型。"
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "对话上下文:\n{context}\n\n用户问题: {query}\n\n请判断用户的意图类型，输出一个简短的标签，如：数据分析、图表生成、报告生成、数据导入、系统设置等。")
        ])
        
        llm = self.get_llm()
        chain = prompt | llm
        
        result = chain.invoke({
            "context": context,
            "query": user_query
        })
        
        return result.content.strip()
    
    def _generate_response(self, user_query: str, context: str, intent: str) -> str:
        """
        生成智能回复
        产品意义：基于用户意图和上下文，生成准确、相关的响应
        """
        system_prompt = f"你是一个智能数据洞察助手，负责回答用户的问题。用户的意图是：{intent}。请根据对话上下文和用户问题，提供准确、专业的回答。"
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "对话上下文:\n{context}\n\n用户问题: {query}")
        ])
        
        llm = self.get_llm()
        chain = prompt | llm
        
        result = chain.invoke({
            "context": context,
            "query": user_query
        })
        
        return result.content.strip()
    
    def _build_context(self, conversation_id: str) -> str:
        """
        构建对话上下文
        产品意义：提供完整的对话历史，支持多轮对话
        """
        if conversation_id not in self.conversation_history:
            return ""
        
        history = self.conversation_history[conversation_id]
        context = []
        
        for msg in history[-10:]:  # 只保留最近10条消息
            role = "用户" if msg['role'] == "human" else "助手"
            context.append(f"{role}: {msg['content']}")
        
        return "\n".join(context)
    
    def _add_message(self, conversation_id: str, role: str, content: str):
        """
        添加消息到对话历史
        产品意义：维护对话上下文，支持多轮对话
        """
        if conversation_id not in self.conversation_history:
            self.conversation_history[conversation_id] = []
        
        self.conversation_history[conversation_id].append({
            "role": role,
            "content": content,
            "timestamp": self._get_timestamp()
        })
        
        # 限制历史消息数量
        if len(self.conversation_history[conversation_id]) > 50:
            self.conversation_history[conversation_id] = self.conversation_history[conversation_id][-50:]
    
    def _generate_conversation_id(self) -> str:
        """
        生成对话ID
        产品意义：唯一标识对话，支持多用户并行对话
        """
        import uuid
        return str(uuid.uuid4())
    
    def _get_timestamp(self) -> str:
        """
        获取当前时间戳
        产品意义：记录消息的时间信息
        """
        import datetime
        return datetime.datetime.now().isoformat()
    
    def clear_conversation(self, conversation_id: str):
        """
        清空对话历史
        产品意义：重置对话状态，开始新的对话
        """
        if conversation_id in self.conversation_history:
            del self.conversation_history[conversation_id]
        return True
    
    def get_conversation_history(self, conversation_id: str) -> List[Dict[str, Any]]:
        """
        获取对话历史
        产品意义：查看完整的对话记录
        """
        if conversation_id not in self.conversation_history:
            return []
        return self.conversation_history[conversation_id]
