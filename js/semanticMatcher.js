/**
 * 语义匹配器 - 用于检测和解决用户需求中的模糊点
 * 
 * 核心功能：
 * 1. 列名语义相似度计算
 * 2. 模糊点检测
 * 3. 生成确认询问语句
 * 4. 上下文记忆
 */

class SemanticMatcher {
    constructor() {
        this.columnAliases = {
            // 区域相关
            '区域': ['地区', '省份', '省', '城市', '地市', '区县', '地址', '位置', '地域'],
            '地区': ['区域', '省份', '省', '城市', '地市', '区县'],
            '省份': ['省', '区域', '地区', '城市'],
            '省': ['省份', '区域', '地区'],
            
            // 销售额相关
            '销售额': ['销售金额', '营收', '收入', '营业额', '销售业绩', '金额', '总价'],
            '销售金额': ['销售额', '营收', '收入', '金额'],
            '营收': ['销售额', '销售金额', '收入', '营业额'],
            
            // 时间相关
            '时间': ['日期', '创建时间', '更新时间', '时间戳', '年月日', '日期时间'],
            '日期': ['时间', '创建日期', '更新日期', '年月日'],
            
            // 产品相关
            '产品': ['商品', '货品', '物品', 'SKU', '产品名称', '商品名称'],
            '商品': ['产品', '货品', '物品', 'SKU'],
            
            // 客户相关
            '客户': ['顾客', '用户', '买家', '消费者', '客户名称', '客户名'],
            '顾客': ['客户', '用户', '买家'],
            
            // 数量相关
            '数量': ['个数', '件数', '计数', '总量', '总计', '销量', '销售数量', '购买数量'],
            
            // 状态相关
            '状态': ['情况', '进展', '阶段', '当前状态'],
            '类型': ['类别', '分类', '种类', '类型名称']
        };
        
        // 模糊模式检测
        this.ambiguousPatterns = [
            {
                type: 'vague_column',
                patterns: [/这个|那个|它/, /数据|信息/, /相关|有关/],
                description: '列名指代不明确'
            },
            {
                type: 'vague_intent',
                patterns: [/分析|看看|处理|了解一下/, /情况|状况|趋势/],
                description: '分析意图不明确'
            },
            {
                type: 'vague_time',
                patterns: [/最近|近期|前段时间/, /很久|长期以来/],
                description: '时间范围不明确'
            },
            {
                type: 'vague_filter',
                patterns: [/高|低|大|小|多|少/, /一些|部分|很多|少量/],
                description: '筛选条件不明确'
            }
        ];
        
        // 上下文记忆
        this.context = {
            confirmedMappings: {},  // 已确认的列名映射
            lastQuery: null,        // 上次查询
            conversationHistory: [] // 对话历史
        };
    }
    
    /**
     * 分析用户输入中的列名引用
     * @param {string} userInput - 用户输入
     * @param {string[]} availableColumns - 可用的列名
     * @returns {Object} 分析结果
     */
    analyzeColumnReferences(userInput, availableColumns) {
        console.log('[SemanticMatcher] 分析列名引用:', userInput);
        console.log('[SemanticMatcher] 可用列名:', availableColumns);
        
        const result = {
            originalInput: userInput,
            mentionedTerms: [],      // 用户提到的术语
            matchedColumns: [],      // 直接匹配的列
            fuzzyMatches: [],        // 模糊匹配的列
            ambiguousTerms: [],      // 模糊的术语
            needsConfirmation: false // 是否需要确认
        };
        
        // 提取用户提到的可能列名（名词）
        const extractedTerms = this.extractPotentialColumnTerms(userInput, availableColumns);
        result.mentionedTerms = extractedTerms;
        
        console.log('[SemanticMatcher] 提取的术语:', extractedTerms);
        
        // 去重：记录已经处理过的列名，避免重复
        const processedColumns = new Set();
        
        // 对每个提取的术语进行匹配
        for (const term of extractedTerms) {
            // 如果这个术语已经在精确匹配列表中，跳过
            if (processedColumns.has(term)) {
                continue;
            }
            
            const matchResult = this.findBestColumnMatch(term, availableColumns);
            
            if (matchResult.matchType === 'exact') {
                // 精确匹配
                result.matchedColumns.push({
                    term: term,
                    column: matchResult.column,
                    confidence: 1.0
                });
                processedColumns.add(matchResult.column);
            } else if (matchResult.matchType === 'fuzzy') {
                // 模糊匹配，需要确认
                result.fuzzyMatches.push({
                    term: term,
                    suggestedColumn: matchResult.column,
                    confidence: matchResult.confidence,
                    alternatives: matchResult.alternatives
                });
                result.needsConfirmation = true;
            } else {
                // 未匹配到 - 但如果是常见术语，不标记为模糊，而是忽略
                // 只有当术语看起来像是列名但又匹配不到时，才标记为模糊
                if (this.isLikelyColumnName(term)) {
                    result.ambiguousTerms.push({
                        term: term,
                        reason: '未找到匹配的列名'
                    });
                    result.needsConfirmation = true;
                }
            }
        }
        
        return result;
    }
    
    /**
     * 判断一个术语是否可能是列名
     */
    isLikelyColumnName(term) {
        // 首先排除常见的非列名词汇（动词、介词等）
        const nonColumnWords = [
            '绘制', '画', '生成', '创建', '制作', '查看', '显示', '分析', '统计',
            '查询', '搜索', '筛选', '找出', '列出', '计算', '求', '比较', '对比',
            '了解', '知道', '看看', '处理', '执行', '进行', '开始', '结束',
            '哪个', '什么', '怎么', '多少', '的', '了', '吗', '呢', '啊', '和', '与', '或'
        ];
        
        if (nonColumnWords.includes(term)) {
            return false;
        }
        
        // 常见列名关键词
        const columnKeywords = ['额', '量', '数', '率', '值', '价', '本', '润', '期', '间', '名', '称', '型', '态', '类', '区', '省', '市', '品', '户'];
        
        // 如果术语包含常见列名关键词，可能是列名
        for (const keyword of columnKeywords) {
            if (term.includes(keyword)) {
                return true;
            }
        }
        
        // 如果术语在常见列名词典中，可能是列名
        const commonTerms = [
            '区域', '地区', '省份', '省', '城市', '销售额', '销售金额', '营收',
            '时间', '日期', '产品', '商品', '客户', '顾客', '数量', '状态',
            '类型', '类别', '名称', '价格', '成本', '利润', '增长', '增长率'
        ];
        
        if (commonTerms.includes(term)) {
            return true;
        }
        
        return false;
    }
    
    /**
     * 提取可能的列名术语
     * @param {string} userInput - 用户输入
     * @param {string[]} availableColumns - 可用的列名列表
     */
    extractPotentialColumnTerms(userInput, availableColumns) {
        const terms = [];
        const lowerInput = userInput.toLowerCase();
        
        console.log('[SemanticMatcher] 提取术语，输入:', userInput);
        console.log('[SemanticMatcher] 可用列名:', availableColumns);
        
        // 第一步：检查可用列名中是否有精确匹配的
        console.log('[SemanticMatcher] 第一步：检查精确匹配');
        for (const col of availableColumns) {
            const colLower = col.toLowerCase();
            const inputLower = userInput.toLowerCase();
            console.log(`[SemanticMatcher] 检查列名: "${col}" (小写: "${colLower}") 是否在输入中: "${inputLower}"`);
            if (inputLower.includes(colLower)) {
                console.log('[SemanticMatcher] ✓ 找到精确匹配:', col);
                terms.push(col);
            }
        }
        console.log('[SemanticMatcher] 第一步完成，提取的术语:', terms);
        
        // 第二步：检查常见列名词典（包括别名）
        const commonTerms = [
            '区域', '地区', '省份', '省', '城市', '销售额', '销售金额', '营收',
            '时间', '日期', '产品', '商品', '客户', '顾客', '数量', '状态',
            '类型', '类别', '名称', '价格', '成本', '利润', '增长', '增长率'
        ];
        
        for (const term of commonTerms) {
            if (lowerInput.includes(term.toLowerCase()) && !terms.includes(term)) {
                terms.push(term);
            }
        }
        
        // 第三步：使用正则提取可能的列名（2-10个字符的名词）
        // 匹配"XX的"、"XX是"等模式中的名词
        const nounPattern = /[\u4e00-\u9fa5]{2,10}(?=(的|是|为|有|在|按|从|到|和|与|或|吗|呢|？|\?))/g;
        const matches = userInput.match(nounPattern) || [];
        
        for (const match of matches) {
            if (!terms.includes(match)) {
                terms.push(match);
            }
        }
        
        return terms;
    }
    
    /**
     * 查找最佳列名匹配
     */
    findBestColumnMatch(term, availableColumns) {
        console.log('[SemanticMatcher] 查找列名匹配:', term);
        console.log('[SemanticMatcher] 可用列:', availableColumns);
        
        // 1. 精确匹配（忽略大小写）
        const termLower = term.toLowerCase();
        const exactMatch = availableColumns.find(col => {
            const colLower = col.toLowerCase();
            const isMatch = colLower === termLower;
            if (isMatch) {
                console.log('[SemanticMatcher] 精确匹配成功:', col, '===', term);
            }
            return isMatch;
        });
        
        if (exactMatch) {
            console.log('[SemanticMatcher] 返回精确匹配:', exactMatch);
            return {
                matchType: 'exact',
                column: exactMatch,
                confidence: 1.0
            };
        }
        
        // 2. 检查已确认的映射
        if (this.context.confirmedMappings[term]) {
            console.log('[SemanticMatcher] 使用已确认映射:', this.context.confirmedMappings[term]);
            return {
                matchType: 'exact',
                column: this.context.confirmedMappings[term],
                confidence: 1.0
            };
        }
        
        // 3. 检查别名映射
        let aliases = this.columnAliases[term] || [];
        
        // 如果没有找到别名，尝试反向查找（如"省"→"省份"）
        if (aliases.length === 0) {
            for (const [key, value] of Object.entries(this.columnAliases)) {
                if (value.includes(term) && availableColumns.includes(key)) {
                    aliases = [key];
                    break;
                }
            }
        }
        
        for (const alias of aliases) {
            if (availableColumns.includes(alias)) {
                return {
                    matchType: 'fuzzy',
                    column: alias,
                    confidence: 0.9,
                    alternatives: []
                };
            }
        }
        
        // 4. 计算语义相似度
        const similarities = availableColumns.map(col => ({
            column: col,
            similarity: this.calculateSimilarity(term, col)
        }));
        
        similarities.sort((a, b) => b.similarity - a.similarity);
        
        if (similarities.length > 0 && similarities[0].similarity > 0.6) {
            return {
                matchType: 'fuzzy',
                column: similarities[0].column,
                confidence: similarities[0].similarity,
                alternatives: similarities.slice(1, 4).map(s => s.column)
            };
        }
        
        // 5. 未匹配
        return {
            matchType: 'none',
            column: null,
            confidence: 0
        };
    }
    
    /**
     * 计算两个词的相似度（基于字符重叠和编辑距离）
     */
    calculateSimilarity(term1, term2) {
        // 字符集合相似度（Jaccard）
        const set1 = new Set(term1.split(''));
        const set2 = new Set(term2.split(''));
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        const jaccard = intersection.size / union.size;
        
        // 编辑距离相似度
        const editDistance = this.levenshteinDistance(term1, term2);
        const maxLength = Math.max(term1.length, term2.length);
        const editSimilarity = 1 - (editDistance / maxLength);
        
        // 包含关系
        let containment = 0;
        if (term1.includes(term2) || term2.includes(term1)) {
            containment = 0.5;
        }
        
        // 综合相似度
        return Math.min(1.0, jaccard * 0.4 + editSimilarity * 0.4 + containment * 0.2);
    }
    
    /**
     * 计算编辑距离
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }
    
    /**
     * 生成确认询问语句
     */
    generateConfirmationQuestion(analysisResult) {
        const questions = [];
        
        // 处理模糊匹配的列
        for (const fuzzy of analysisResult.fuzzyMatches) {
            const alternatives = fuzzy.alternatives.length > 0 
                ? `（也可能是${fuzzy.alternatives.join('、')}）`
                : '';
            
            questions.push({
                type: 'column_confirmation',
                term: fuzzy.term,
                suggested: fuzzy.suggestedColumn,
                message: `您提到的"${fuzzy.term}"是否指的是"${fuzzy.suggestedColumn}"${alternatives}？`,
                options: [
                    { label: `是的，指的是"${fuzzy.suggestedColumn}"`, value: fuzzy.suggestedColumn },
                    ...fuzzy.alternatives.map(alt => ({ label: `不，指的是"${alt}"`, value: alt })),
                    { label: '以上都不是', value: 'none' }
                ]
            });
        }
        
        // 处理未匹配的术语
        for (const ambiguous of analysisResult.ambiguousTerms) {
            questions.push({
                type: 'clarification',
                term: ambiguous.term,
                message: `我没有理解您提到的"${ambiguous.term}"具体指什么，能否详细说明一下？`,
                options: []
            });
        }
        
        return questions;
    }
    
    /**
     * 记录用户确认
     */
    recordConfirmation(userTerm, actualColumn) {
        this.context.confirmedMappings[userTerm] = actualColumn;
        this.context.conversationHistory.push({
            timestamp: new Date().toISOString(),
            userTerm: userTerm,
            confirmedColumn: actualColumn
        });
    }
    
    /**
     * 重置上下文
     */
    resetContext() {
        this.context = {
            confirmedMappings: {},
            lastQuery: null,
            conversationHistory: []
        };
    }
}

const semanticMatcher = new SemanticMatcher();
export default semanticMatcher;
