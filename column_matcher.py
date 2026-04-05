# -*- coding: utf-8 -*-
"""
列名语义匹配模块
功能：使用分层策略匹配用户描述与数据列名
策略：
  1. 字面匹配 - 使用jieba分词提取实体词，进行包含匹配
  2. 语义匹配 - 调用大模型从列名列表中选择最匹配的列
产品意义：理解用户意图中的"实体"，准确映射到数据列
"""

import jieba
import jieba.posseg as pseg
import requests
import json
import re
import os
from typing import List, Dict, Optional, Tuple

class ColumnMatcher:
    """列名匹配器 - 分层匹配策略"""
    
    def __init__(self, llm_api_url=None):
        self.llm_api_url = llm_api_url or os.environ.get('LLM_API_URL', 'http://localhost:11434/api/generate')
        
        # 初始化jieba分词
        # 添加常见数据分析领域的词汇
        self._init_jieba()
    
    def _init_jieba(self):
        """初始化jieba分词器，添加领域词汇"""
        # 数据分析常见词汇
        domain_words = [
            '省公司', '市公司', '县公司', '分公司', '总公司',
            '省公司名称', '省公司编码', '公司描述', '公司代码',
            '事件数量', '事件类型', '事件状态', '事件名称', '事件编号',
            '上报时间', '确认时间', '处理时间', '完成时间', '事发时间',
            '险情分类', '险情级别', '险情类型', '险情确认时长',
            '站点名称', '站点id',
            '统计', '分析', '查询', '查找', '排序', '筛选',
            '平均值', '最大值', '最小值', '总和', '计数',
            '柱状图', '折线图', '饼图', '散点图',
            '按', '按照', '根据', '对', '对于',
            '各', '每个', '所有', '全部',
        ]
        for word in domain_words:
            jieba.add_word(word, freq=10000)  # 提高频率确保不被拆分
    
    def extract_entities(self, text: str) -> List[str]:
        """
        从用户输入中提取实体词
        使用jieba分词，提取名词和有意义的词组
        
        产品意义：理解用户需求中提到的"东西"，如"省公司"、"事件数量"
        
        V3.0优化：优先保留完整词组，再进行分词匹配
        """
        entities = []
        
        # 1. 首先提取连续的中文字符作为"完整词候选"
        # 这些是用户可能想要表达的完整实体名
        chinese_pattern = re.compile(r'[\u4e00-\u9fa5]{2,}')
        complete_phrases = chinese_pattern.findall(text)
        
        # 按长度降序排序，优先保留更长的完整词
        complete_phrases_sorted = sorted(complete_phrases, key=len, reverse=True)
        
        # 2. 使用jieba分词提取更细粒度的词
        words = pseg.cut(text)
        
        # 需要过滤的停用词
        stop_words = {
            '的', '了', '是', '在', '有', '和', '与', '或', '等', '之',
            '这', '那', '我', '你', '他', '她', '它',
            '请', '帮', '帮忙', '想要', '需要', '希望',
            '一下', '一些', '所有', '全部', '每个', '各个',
            '按照', '根据', '通过', '使用', '用',
            '并', '且', '然后', '接着', '最后',
            '显示', '展示', '呈现', '看看', '查看',
        }
        
        # 分词结果
        segmented_words = []
        for word, flag in words:
            word = word.strip()
            
            # 过滤条件
            if len(word) < 2:
                continue
            if word in stop_words:
                continue
            if word.isdigit():
                continue
            if re.match(r'^[a-zA-Z]$', word):
                continue
            
            segmented_words.append(word)
        
        # 3. 合并结果：完整词在前，分词结果在后
        # 这样匹配时会优先尝试完整词
        entities = complete_phrases_sorted + segmented_words
        
        # 去重并保持顺序
        seen = set()
        unique_entities = []
        for e in entities:
            if e not in seen:
                seen.add(e)
                unique_entities.append(e)
        
        return unique_entities
    
    def literal_match(self, text: str, columns: List[str]) -> Tuple[Optional[str], float, str]:
        """
        字面匹配 - 检查用户输入中的实体词是否在列名中
        
        Args:
            text: 用户输入
            columns: 数据列名列表
            
        Returns:
            (匹配的列名, 置信度, 匹配方式说明)
        """
        if not columns:
            return None, 0.0, "列名列表为空"
        
        # 提取实体词
        entities = self.extract_entities(text)
        
        if not entities:
            return None, 0.0, "未提取到有效实体词"
        
        # 按实体词长度降序排序，优先匹配更长的词
        entities_sorted = sorted(entities, key=len, reverse=True)
        
        # 收集所有候选匹配
        candidates = []
        
        for entity in entities_sorted:
            entity_lower = entity.lower()
            
            for col in columns:
                col_lower = col.lower()
                
                # 1. 完全匹配：实体词与列名完全相同（最高优先级）
                if entity_lower == col_lower:
                    return col, 1.0, f"完全匹配: '{entity}' = '{col}'"
                
                # 2. 列名包含实体词：如"省公司" in "省公司名称"
                if entity_lower in col_lower:
                    # 计算匹配度：实体词长度 / 列名长度
                    # 越接近1表示实体词占列名的比例越高，匹配越准确
                    score = len(entity) / len(col)
                    candidates.append({
                        'column': col,
                        'score': score,
                        'entity': entity,
                        'type': 'contains'
                    })
        
        # 如果有候选，选择匹配度最高的
        if candidates:
            # 按分数排序
            candidates.sort(key=lambda x: x['score'], reverse=True)
            
            # 如果有多个相同分数的候选，优先选择：
            # 1. "名称"类列 > "编码"类列
            # 2. 更短的列名（更精确）
            top_candidates = [c for c in candidates if c['score'] == candidates[0]['score']]
            
            if len(top_candidates) > 1:
                # 优先选择包含"名称"、"描述"的列
                name_cols = [c for c in top_candidates if '名称' in c['column'] or '描述' in c['column']]
                if name_cols:
                    best = name_cols[0]
                else:
                    # 选择最短的列名（更精确）
                    best = min(top_candidates, key=lambda x: len(x['column']))
            else:
                best = top_candidates[0]
            
            # 如果分数足够高（>0.5），认为匹配成功
            if best['score'] >= 0.5:
                return best['column'], best['score'], f"列名包含实体: '{best['entity']}' in '{best['column']}'"
        
        # 3. 尝试组合匹配：多个实体词组合后匹配列名
        # 例如："险情" + "确认" + "时长" → "险情确认时长"
        combined_entities = ''.join(entities_sorted)
        for col in columns:
            col_lower = col.lower()
            if combined_entities.lower() in col_lower or col_lower in combined_entities.lower():
                # 组合匹配成功
                overlap = len(set(combined_entities) & set(col))
                score = overlap / len(col) if len(col) > 0 else 0
                if score >= 0.6:  # 组合匹配要求更高的阈值
                    return col, score, f"组合匹配: '{combined_entities}' -> '{col}'"
        
        # 4. 语义映射匹配（处理常见同义词）
        # 例如："省份" → "省公司名称"
        semantic_mappings = {
            '省份': ['省公司名称', '省公司'],
            '城市': ['市公司'],
            '县': ['县公司'],
            '事件数': ['事件数量'],
            '事件量': ['事件数量'],
            '数量': ['事件数量', '数量'],
            '时长': ['险情确认时长', '时长'],
            '事件': ['事件数量', '事件名称', '事件类型'],
            '事件数量': ['事件数量'],
        }
        
        for entity in entities_sorted:
            # 检查是否有语义映射
            if entity in semantic_mappings:
                # 按映射目标的优先级尝试匹配
                for mapped_col in semantic_mappings[entity]:
                    if mapped_col in columns:
                        # 优先选择更具体的列（包含'数量'的列优先级更高）
                        if '数量' in mapped_col:
                            return mapped_col, 0.9, f"语义映射: '{entity}' → '{mapped_col}'"
                        return mapped_col, 0.8, f"语义映射: '{entity}' → '{mapped_col}'"
        
        return None, 0.0, f"字面匹配失败，最高分数: {candidates[0]['score']:.2f}" if candidates else "字面匹配失败"
    
    def semantic_match_with_llm(self, text: str, columns: List[str]) -> Tuple[Optional[str], float, str]:
        """
        语义匹配 - 使用大模型从列名列表中选择最匹配的列
        
        产品意义：当字面匹配无法理解用户意图时，让大模型帮忙"翻译"
        """
        if not columns:
            return None, 0.0, "列名列表为空"
        
        # 构建提示词
        prompt = f"""你是一个数据分析助手。用户想要对数据进行分析，请从给定的列名列表中选择最匹配用户需求的列名。

用户需求: {text}

可用列名:
{json.dumps(columns, ensure_ascii=False, indent=1)}

请分析用户需求，选择最匹配的列名。如果用户需求中没有明确提到任何列名，或者无法确定，请返回"无匹配"。

返回格式（JSON）:
{{"column": "匹配的列名", "confidence": 0.95, "reason": "匹配理由"}}

只返回JSON，不要其他内容。"""

        try:
            response = requests.post(
                self.llm_api_url,
                json={
                    "model": "qwen2.5:7b",
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "num_predict": 200
                    }
                },
                timeout=30
            )
            
            if response.status_code != 200:
                return None, 0.0, f"LLM API错误: {response.status_code}"
            
            result = response.json()
            response_text = result.get('response', '').strip()
            
            # 解析JSON响应
            # 尝试提取JSON部分
            json_match = re.search(r'\{[^}]+\}', response_text)
            if json_match:
                llm_result = json.loads(json_match.group())
                column = llm_result.get('column', '')
                confidence = llm_result.get('confidence', 0.5)
                reason = llm_result.get('reason', '')
                
                if column == "无匹配" or column not in columns:
                    return None, 0.0, f"LLM判断无匹配: {reason}"
                
                return column, confidence, f"语义匹配: {reason}"
            
            return None, 0.0, f"LLM响应解析失败: {response_text[:100]}"
            
        except requests.exceptions.Timeout:
            return None, 0.0, "LLM API超时"
        except Exception as e:
            return None, 0.0, f"LLM调用异常: {str(e)}"
    
    def match(self, text: str, columns: List[str], use_llm_fallback: bool = True) -> Dict:
        """
        分层匹配 - 按优先级尝试不同匹配策略
        
        策略顺序：
        1. 字面匹配（jieba分词 + 包含匹配）
        2. 语义匹配（大模型）
        
        Args:
            text: 用户输入
            columns: 数据列名列表
            use_llm_fallback: 是否在字面匹配失败时使用大模型
            
        Returns:
            {
                'column': 匹配的列名或None,
                'confidence': 置信度,
                'method': 'literal' 或 'semantic' 或 'none',
                'reason': 匹配说明,
                'entities': 提取的实体词列表
            }
        """
        result = {
            'column': None,
            'confidence': 0.0,
            'method': 'none',
            'reason': '',
            'entities': []
        }
        
        # 提取实体词（用于日志和调试）
        result['entities'] = self.extract_entities(text)
        
        # 第一层：字面匹配
        column, score, reason = self.literal_match(text, columns)
        
        if column and score >= 0.5:
            result['column'] = column
            result['confidence'] = score
            result['method'] = 'literal'
            result['reason'] = reason
            return result
        
        # 第二层：语义匹配（大模型）
        if use_llm_fallback:
            column, score, reason = self.semantic_match_with_llm(text, columns)
            
            if column:
                result['column'] = column
                result['confidence'] = score
                result['method'] = 'semantic'
                result['reason'] = reason
                return result
        
        # 无匹配
        result['reason'] = f"未找到匹配列名。字面匹配: {reason}"
        return result


# 全局匹配器实例
_column_matcher = None

def get_column_matcher():
    """获取列名匹配器实例（懒加载）"""
    global _column_matcher
    if _column_matcher is None:
        _column_matcher = ColumnMatcher()
    return _column_matcher
