// 需求分类模块 - 智能路由用户请求到合适的处理引擎
// 产品意义：根据用户输入的特征，决定使用本地模型（精准模式）还是大模型（智能模式）
// 分类标准：用户是否提供了准确的列名和清晰的指令

class RequirementClassifier {
    constructor() {
        // 分类阈值配置
        this.thresholds = {
            minConfidenceForLocal: 0.8,  // 本地模型最低置信度
            maxAmbiguityScore: 0.3       // 最大模糊度评分
        };
        
        // API配置 - 支持从URL参数动态配置（用于公网部署）
        // 用法：https://前端地址?apiUrl=https://后端API地址
        const urlParams = new URLSearchParams(window.location.search);
        const apiBaseUrl = urlParams.get('apiUrl') || 'http://localhost:5001';
        
        this.bertApiUrl = `${apiBaseUrl}/api/classify-requirement`;
        this.columnMatchApiUrl = `${apiBaseUrl}/api/match-column`;
        this.useBertClassification = true;  // 是否使用BERT分类
        this.useColumnMatchApi = true;      // 是否使用列名匹配API
        
        console.log('[RequirementClassifier] 需求分类模块已初始化（BERT + 列名语义匹配）');
        console.log('[RequirementClassifier] API地址:', apiBaseUrl);
    }
    
    /**
     * 分析用户需求，决定使用哪种处理模式
     * @param {string} userInput - 用户输入
     * @param {Array} columns - 数据列名列表
     * @param {Array} sampleData - 样本数据（用于推断字典值）
     * @returns {Object} 分类结果
     *   - mode: 'precise' | 'intelligent'
     *   - confidence: 分类置信度
     *   - reason: 分类理由
     *   - matchedColumns: 匹配到的列名
     *   - ambiguityScore: 模糊度评分
     */
    async classify(userInput, columns, sampleData = []) {
        console.log('[RequirementClassifier] 开始分类用户需求:', userInput);
        
        const lowerInput = userInput.toLowerCase();
        
        // V3.0新增：首先使用BERT模型判断是否为数据分析需求
        if (this.useBertClassification) {
            const bertResult = await this.classifyWithBERT(userInput);
            if (bertResult && !bertResult.is_data_analysis) {
                console.log('[RequirementClassifier] BERT拒识:', bertResult.label);
                return {
                    mode: 'rejected',
                    confidence: bertResult.confidence,
                    reason: '输入内容与数据分析无关',
                    suggestion: '本系统专注于数据分析，请输入与数据查询、统计分析、可视化相关的需求。例如："统计各省份的平均值"、"绘制销售额柱状图"',
                    matchedColumns: [],
                    ambiguityScore: 1.0,
                    hasComplexRequirements: false,
                    columnMatchScore: 0,
                    requiredSkills: [],
                    isSimpleQuery: false,
                    bertClassification: bertResult
                };
            }
        }
        
        // BERT判断为数据分析需求，继续后续处理
        // 兜底：如果BERT调用失败，使用规则检测
        const rejectionCheck = this.checkRejection(userInput);
        if (rejectionCheck.shouldReject) {
            console.log('[RequirementClassifier] 规则拒识:', rejectionCheck.reason);
            return {
                mode: 'rejected',
                confidence: 1.0,
                reason: rejectionCheck.reason,
                suggestion: rejectionCheck.suggestion,
                matchedColumns: [],
                ambiguityScore: 1.0,
                hasComplexRequirements: false,
                columnMatchScore: 0,
                requiredSkills: [],
                isSimpleQuery: false
            };
        }
        
        // V3.0新增：使用分层策略匹配列名
        // 1. 字面匹配（jieba分词 + 包含匹配）
        // 2. 语义匹配（大模型兜底）
        let mentionedColumns = [];
        let columnMatchScore = 0;
        
        if (this.useColumnMatchApi && columns && columns.length > 0) {
            const matchResult = await this.matchColumnWithAPI(userInput, columns);
            if (matchResult && matchResult.column) {
                mentionedColumns = [{
                    column: matchResult.column,
                    matchType: matchResult.method,  // 'literal' 或 'semantic'
                    confidence: matchResult.confidence,
                    reason: matchResult.reason,
                    entities: matchResult.entities
                }];
                columnMatchScore = matchResult.confidence;
                console.log('[RequirementClassifier] 列名匹配结果:', matchResult);
            } else {
                // API匹配失败，使用本地匹配作为兜底
                mentionedColumns = this.extractMentionedColumns(lowerInput, columns);
                columnMatchScore = this.calculateColumnMatchScore(mentionedColumns, columns);
                console.log('[RequirementClassifier] 本地列名匹配:', mentionedColumns);
            }
        } else {
            // 未启用API，使用本地匹配
            mentionedColumns = this.extractMentionedColumns(lowerInput, columns);
            columnMatchScore = this.calculateColumnMatchScore(mentionedColumns, columns);
        }
        
        // 3. V4.0新增：实体提取与链接
        // 检测用户输入中的筛选值（如"广东省"）并链接到数据列
        let entityExtractionResult = null;
        let hasUnlinkedEntities = false;
        let hasHighConfidenceFilter = false;  // 新增：标记是否有高置信度的筛选条件
        
        // 注意：这里使用sampleData参数（方法签名中定义的参数名）
        if (window.entityExtractor && sampleData && sampleData.length > 0) {
            try {
                entityExtractionResult = window.entityExtractor.extractAndLink(userInput, columns, sampleData);
                console.log('[RequirementClassifier] 实体提取结果:', entityExtractionResult);
                
                // 检查筛选条件的链接情况
                if (entityExtractionResult.filters && entityExtractionResult.filters.length > 0) {
                    // V4.0修复：高置信度筛选 = 链接成功且匹配到至少1条数据
                    // 原来的阈值0.5在sampleData只有3行时会导致置信度只有0.33，无法通过
                    const highConfidenceFilters = entityExtractionResult.filters.filter(
                        f => f.linkedColumn && f.matchCount > 0
                    );
                    hasHighConfidenceFilter = highConfidenceFilters.length > 0;
                    
                    // 未链接实体：链接失败（数据中没有该值，需要大模型理解）
                    hasUnlinkedEntities = entityExtractionResult.filters.some(
                        f => !f.linkedColumn
                    );
                    
                    console.log('[RequirementClassifier] 高置信度筛选:', hasHighConfidenceFilter, 
                                '未链接实体:', hasUnlinkedEntities,
                                '筛选详情:', entityExtractionResult.filters.map(f => `${f.linkedColumn}=${f.linkedValue}(匹配${f.matchCount}条)`));
                    
                    // 如果所有筛选值都是高置信度的，视为本地模型可处理
                    if (hasHighConfidenceFilter && !hasUnlinkedEntities) {
                        console.log('[RequirementClassifier] 所有筛选条件都高置信度匹配，可由本地模型处理');
                    }
                }
            } catch (error) {
                console.warn('[RequirementClassifier] 实体提取失败:', error.message);
            }
        }
        
        // 4. 检测模糊表达
        const ambiguityScore = this.calculateAmbiguityScore(lowerInput, mentionedColumns);
        
        // 5. 检测复杂需求（单位转换、数据预处理等）
        // V4.0优化：传递实体提取结果，如果筛选值已链接则不视为复杂需求
        const hasComplexRequirements = this.detectComplexRequirements(lowerInput, entityExtractionResult);
        
        // 6. 检测是否为简单查询（V3.0新增：在检测Skills之前判断）
        // V4.0优化：如果有未链接的实体，不视为简单查询
        const isSimpleQuery = !hasUnlinkedEntities && this.detectSimpleQuery(userInput, mentionedColumns);
        console.log('[RequirementClassifier] 是否为简单查询:', isSimpleQuery, '(未链接实体:', hasUnlinkedEntities, ')');
        
        // 6. 检测需要调用的Skills（V3.0优化：简单查询不触发Skills）
        const requiredSkills = this.detectRequiredSkills(lowerInput, columns, isSimpleQuery);
        console.log('[RequirementClassifier] 需要调用的Skills:', requiredSkills);
        
        // 7. 综合判断
        // V4.0优化：传递hasHighConfidenceFilter参数
        const result = this.makeDecision(
            userInput,
            mentionedColumns,
            columnMatchScore,
            ambiguityScore,
            hasComplexRequirements,
            requiredSkills,
            hasUnlinkedEntities,
            entityExtractionResult,
            hasHighConfidenceFilter
        );
        
        // 添加Skills信息到结果
        result.requiredSkills = requiredSkills;
        result.isSimpleQuery = isSimpleQuery;
        result.entityExtraction = entityExtractionResult;
        result.hasHighConfidenceFilter = hasHighConfidenceFilter;
        
        console.log('[RequirementClassifier] 分类结果:', result);
        return result;
    }
    
    /**
     * V3.0新增：使用BERT模型进行需求分类
     * 调用后端API判断用户输入是否为数据分析需求
     */
    async classifyWithBERT(userInput) {
        try {
            const response = await fetch(this.bertApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: userInput })
            });
            
            if (!response.ok) {
                console.warn('[RequirementClassifier] BERT API调用失败:', response.status);
                return null;
            }
            
            const result = await response.json();
            console.log('[RequirementClassifier] BERT分类结果:', result);
            return result;
            
        } catch (error) {
            console.warn('[RequirementClassifier] BERT API调用异常:', error.message);
            return null;
        }
    }
    
    /**
     * V3.0新增：使用分层策略匹配列名
     * 调用后端API进行字面匹配 + 语义匹配
     */
    async matchColumnWithAPI(userInput, columns) {
        try {
            const response = await fetch(this.columnMatchApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    text: userInput, 
                    columns: columns,
                    use_llm_fallback: true  // 允许大模型兜底
                })
            });
            
            if (!response.ok) {
                console.warn('[RequirementClassifier] 列名匹配API调用失败:', response.status);
                return null;
            }
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            console.warn('[RequirementClassifier] 列名匹配API调用异常:', error.message);
            return null;
        }
    }
    
    /**
     * V3.0新增：检查是否需要拒识
     * 检测与数据分析无关的输入，如问候语、聊天、天气查询等
     * 注意：此方法作为BERT分类的兜底方案
     */
    checkRejection(userInput) {
        const lowerInput = userInput.toLowerCase().trim();
        
        // 1. 问候语检测
        const greetingPatterns = [
            /^(你好|您好|hi|hello|嗨|哈喽|在吗|在不在)[\s!！。.]*$/,
            /^(谢谢|感谢|再见|拜拜|goodbye|bye)[\s!！。.]*$/,
            /^(早上好|下午好|晚上好)[\s!！。.]*$/
        ];
        
        for (const pattern of greetingPatterns) {
            if (pattern.test(lowerInput)) {
                return {
                    shouldReject: true,
                    reason: '这是一句问候语，与数据分析无关',
                    suggestion: '请输入数据分析相关的需求，例如："统计各省份的平均值"、"绘制销售额柱状图"、"查找最大的险情确认时长"'
                };
            }
        }
        
        // 2. 完全不相关的关键词检测
        const irrelevantKeywords = [
            '天气', '新闻', '股票', '电影', '音乐', '游戏', '购物', '外卖', '打车', '导航',
            '笑话', '故事', '诗歌', '作文', '翻译', '编程', '代码', 'bug', '报错',
            '帮助', '怎么用', '如何使用', '教程', '说明', '文档', '你是谁', '你叫什么'
        ];
        
        for (const keyword of irrelevantKeywords) {
            if (lowerInput.includes(keyword)) {
                // 检查是否同时包含数据分析关键词（可能是复杂查询）
                const analysisKeywords = ['统计', '分析', '查询', '查找', '排序', '筛选', '图表', '绘制', '画'];
                const hasAnalysisKeyword = analysisKeywords.some(k => lowerInput.includes(k));
                
                if (!hasAnalysisKeyword) {
                    return {
                        shouldReject: true,
                        reason: `输入包含与数据分析无关的关键词"${keyword}"`,
                        suggestion: '本系统专注于数据分析，请输入与数据查询、统计分析、可视化相关的需求'
                    };
                }
            }
        }
        
        // 3. 输入过短检测（少于3个字符且不是简单指令）
        if (userInput.trim().length < 3) {
            return {
                shouldReject: true,
                reason: '输入内容过短，无法理解您的意图',
                suggestion: '请提供更详细的查询描述，例如："按照省份统计销售额并绘制柱状图"'
            };
        }
        
        // 4. 纯数字或符号检测
        const textWithoutChinese = userInput.trim().replace(/[\u4e00-\u9fa5]/g, '');
        if (textWithoutChinese.length > 0 && /^[\d\s\p{P}\p{S}]+$/u.test(textWithoutChinese)) {
            if (userInput.trim().length < 5) {
                return {
                    shouldReject: true,
                    reason: '输入只包含数字或符号，无法识别数据分析意图',
                    suggestion: '请输入包含中文描述的查询指令，例如："统计各地区的平均值"'
                };
            }
        }
        
        return { shouldReject: false };
    }
    
    /**
     * 检测是否为简单查询
     * V3.0新增：简单查询特征
     * - 查找/查询/搜索 + 最大/最小/最高/最低 + 列名
     * - 列名完全匹配
     * - 无复杂条件
     */
    detectSimpleQuery(userInput, mentionedColumns) {
        // 必须有列名匹配
        if (mentionedColumns.length === 0) {
            return false;
        }
        
        // 简单查询模式
        const simplePatterns = [
            // 查找最大/最小值
            /^(查找|查询|搜索|看看|显示|列出).{0,5}(最大|最小|最高|最低|最大|最小)的?/,
            /^(查找|查询|搜索).{0,10}(最大|最小|最高|最低)/,
            // 排序查询
            /^(按|按照).+?(排序|排列|排)/,
            /^(查找|查询).{0,5}(前|第).+?(个|条|名)/,
            // 简单筛选
            /^(查找|查询|搜索).{0,5}(所有|全部|哪些)/,
        ];
        
        for (const pattern of simplePatterns) {
            if (pattern.test(userInput)) {
                // 额外检查：列名是否完全匹配
                const hasExactMatch = mentionedColumns.some(m => m.matchType === 'exact');
                if (hasExactMatch) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * 提取文本中提到的列名
     */
    extractMentionedColumns(text, columns) {
        const mentioned = [];
        
        // 按列名长度降序排序，优先匹配更长的列名
        const sortedColumns = [...columns].sort((a, b) => b.length - a.length);
        
        for (const col of sortedColumns) {
            const lowerCol = col.toLowerCase();
            // 检查文本中是否包含完整列名
            if (text.includes(lowerCol)) {
                mentioned.push({
                    column: col,
                    matchType: 'exact',  // 完全匹配
                    position: text.indexOf(lowerCol)
                });
            } else {
                // 检查是否包含列名的关键词（部分匹配）
                const keywords = this.extractKeywords(lowerCol);
                for (const keyword of keywords) {
                    if (text.includes(keyword) && keyword.length >= 2) {
                        mentioned.push({
                            column: col,
                            matchType: 'partial',  // 部分匹配
                            matchedKeyword: keyword,
                            position: text.indexOf(keyword)
                        });
                        break;
                    }
                }
            }
        }
        
        // 按位置排序，保留最前面的匹配
        mentioned.sort((a, b) => a.position - b.position);
        
        // 去重：如果部分匹配和完全匹配指向同一列，保留完全匹配
        const uniqueMentioned = [];
        const seenColumns = new Set();
        
        for (const item of mentioned) {
            if (!seenColumns.has(item.column)) {
                uniqueMentioned.push(item);
                seenColumns.add(item.column);
            }
        }
        
        return uniqueMentioned;
    }
    
    /**
     * 提取列名的关键词（用于部分匹配）
     */
    extractKeywords(columnName) {
        // 简单的关键词提取：按常见分隔符分割
        const separators = ['_', '-', ' ', '（', '）', '(', ')', '、'];
        let keywords = [columnName];
        
        for (const sep of separators) {
            const newKeywords = [];
            for (const kw of keywords) {
                newKeywords.push(...kw.split(sep).filter(k => k.length >= 2));
            }
            keywords = [...keywords, ...newKeywords];
        }
        
        // 去重并排序（长的优先）
        return [...new Set(keywords)].sort((a, b) => b.length - a.length);
    }
    
    /**
     * 计算列名匹配得分
     */
    calculateColumnMatchScore(mentionedColumns, allColumns) {
        if (mentionedColumns.length === 0) return 0;
        
        let exactMatchCount = 0;
        let partialMatchCount = 0;
        
        for (const item of mentionedColumns) {
            if (item.matchType === 'exact') {
                exactMatchCount++;
            } else {
                partialMatchCount++;
            }
        }
        
        // 完全匹配得分高，部分匹配得分低
        const score = (exactMatchCount * 1.0 + partialMatchCount * 0.5) / mentionedColumns.length;
        return Math.min(score, 1.0);
    }
    
    /**
     * 计算模糊度评分
     */
    calculateAmbiguityScore(text, mentionedColumns) {
        let score = 0;
        
        // 1. 如果没有匹配到任何列名，模糊度高
        if (mentionedColumns.length === 0) {
            score += 0.5;
        }
        
        // 2. 如果只有部分匹配，增加模糊度
        const partialMatches = mentionedColumns.filter(m => m.matchType === 'partial').length;
        if (partialMatches > 0) {
            score += partialMatches * 0.2;
        }
        
        // 3. 检测模糊词汇
        const ambiguousWords = ['什么', '哪些', '怎么', '如何', '某', '相关', '有关', '等'];
        for (const word of ambiguousWords) {
            if (text.includes(word)) {
                score += 0.1;
            }
        }
        
        // 4. 检测自然语言描述（非结构化）
        const structuredPatterns = [
            /按[照]?\s*.+?\s*统计/,  // 按照XX统计
            /各\s*.+?\s*的/,         // 各XX的
            /\S+?的\S+?/,            // XX的XX
        ];
        
        let hasStructuredPattern = false;
        for (const pattern of structuredPatterns) {
            if (pattern.test(text)) {
                hasStructuredPattern = true;
                break;
            }
        }
        
        if (!hasStructuredPattern) {
            score += 0.2;
        }
        
        return Math.min(score, 1.0);
    }
    
    /**
     * 检测复杂需求
     * V4.0优化：接收实体提取结果，如果筛选值已链接则不视为复杂需求
     */
    detectComplexRequirements(text, entityExtractionResult = null) {
        const complexPatterns = [
            // 单位转换
            /转[换]?\s*\w+/,           // 转换成、转换为
            /\w+\s*转\s*\w+/,          // XX转XX
            /单位[为是]?\w+/,          // 单位为
            
            // 数据预处理
            /保留\s*\d+\s*位[小数]?/,  // 保留2位小数
            /格式[化为]?/,             // 格式化
            /计算\s*.+?\s*率/,        // 计算增长率
            /同比|环比|占比|比例/,     // 复杂计算
            
            // 复杂筛选
            /大于|小于|等于|超过|低于/, // 条件筛选
            /并且|而且|同时|以及/,     // 多条件
            /或者|或/,                 // 或条件
            
            // 复杂可视化
            /对比|比较|趋势|分布|占比/, // 分析型需求
            /多[个]?图/,              // 多图
            /联动|关联|相关/,          // 图表联动
        ];
        
        for (const pattern of complexPatterns) {
            if (pattern.test(text)) {
                return true;
            }
        }
        
        // V4.0优化：检测包含具体筛选值的需求
        // 但如果实体提取已成功链接筛选值，则不视为复杂需求
        if (this.hasSpecificFilterValues(text)) {
            // 检查实体提取结果
            if (entityExtractionResult && entityExtractionResult.filters) {
                // V4.0修复：只要链接成功且匹配到数据，就算高置信度
                const highConfidenceFilters = entityExtractionResult.filters.filter(
                    f => f.linkedColumn && f.matchCount > 0
                );
                const hasUnlinkedFilters = entityExtractionResult.filters.some(
                    f => !f.linkedColumn
                );
                
                // 如果所有筛选值都已链接，不视为复杂需求
                if (highConfidenceFilters.length > 0 && !hasUnlinkedFilters) {
                    console.log('[RequirementClassifier] 检测到具体筛选值，但已全部链接，不视为复杂需求');
                    return false;
                }
            }
            
            console.log('[RequirementClassifier] 检测到具体筛选值且未链接，需要大模型处理');
            return true;
        }
        
        return false;
    }
    
    /**
     * V4.0新增：检测用户输入中是否包含具体的筛选值
     * 产品意义：当用户指定具体的筛选条件（如"江苏省"、"广东省"、"张三"）时，
     * 本地模型无法正确解析这些值，应该降级到大模型处理
     */
    hasSpecificFilterValues(text) {
        // 先排除明显的图表/分组查询格式，这些不是筛选值
        // 如"XX和YY的柱状图"、"按XX和YY统计"
        const chartPattern = /(柱状图|折线图|饼图|条形图|散点图|图表|统计图)$/;
        const groupByPattern = /按[照]?.+(和|与|或).+(统计|分组|分析)/;
        
        if (chartPattern.test(text) || groupByPattern.test(text)) {
            console.log('[RequirementClassifier] 检测到图表/分组查询，不是筛选值');
            return false;
        }
        
        // 模式1：XX和XX的...（如"江苏省和广东省的销售额"）
        // 匹配两个或多个具体值用"和"、"与"、"或"连接
        // 注意：排除列名组合的情况（如"省份和销售额"）
        const multiValuePattern = /[^，。！？\s]{2,}(和|与|或)[^，。！？\s]{2,}的/;
        if (multiValuePattern.test(text)) {
            // 进一步检查：如果匹配的内容是列名组合，则不是筛选值
            const match = text.match(/([^，。！？\s]{2,})(和|与|或)([^，。！？\s]{2,})的/);
            if (match) {
                const part1 = match[1];
                const part2 = match[3];
                // 如果两部分都是列名（如"省份"、"销售额"），则不是筛选值
                // 这里简化处理：如果包含"省"、"市"等字样，认为是筛选值
                const isLocation1 = /(省|市|区|县|镇|乡)$/.test(part1) || 
                    ['江苏', '浙江', '广东', '北京', '上海'].some(p => part1.includes(p));
                const isLocation2 = /(省|市|区|县|镇|乡)$/.test(part2) || 
                    ['江苏', '浙江', '广东', '北京', '上海'].some(p => part2.includes(p));
                
                if (isLocation1 || isLocation2) {
                    console.log(`[RequirementClassifier] 检测到多值筛选: ${part1} 和 ${part2}`);
                    return true;
                }
            }
        }
        
        // 模式2：XX是/为/等于XX（如"省份是江苏"）
        const filterPattern = /(是|为|等于)[^，。！？\s]{2,}/;
        if (filterPattern.test(text) && !/是(多少|什么|哪)/.test(text)) {
            return true;
        }
        
        // 模式3：包含具体地名/人名等（常见筛选值）
        // 检测是否包含省份名、城市名等
        const provinceNames = ['北京', '天津', '上海', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江', 
            '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西', 
            '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海', '宁夏', '新疆', '内蒙古', '西藏'];
        const hasProvince = provinceNames.some(prov => text.includes(prov));
        
        // 如果包含地名，且不是简单的"按XX统计"格式，且不是图表查询
        if (hasProvince && !/^按[照]?.+统计/.test(text) && !/^各.+的/.test(text) && !chartPattern.test(text)) {
            return true;
        }
        
        return false;
    }
    
    /**
     * 检测需要调用的Skills
     * 产品意义：在需求分类阶段就判断出是否需要调用特定的Skills
     * V3.0优化：区分"简单查询"和"深度分析"场景
     * - 简单查询（如查找最大/最小值、排序）→ 本地模型处理，不调用Skills
     * - 深度分析（如统计分析、趋势预测、异常检测）→ 大模型处理，调用Skills
     */
    detectRequiredSkills(text, columns, isSimpleQuery = false) {
        const requiredSkills = [];
        const lowerText = text.toLowerCase();
        
        // 如果是简单查询，不调用数据分析类Skills（本地模型可以处理）
        if (isSimpleQuery) {
            console.log('[RequirementClassifier] 检测到简单查询，跳过Skills检测');
            return requiredSkills;
        }
        
        // 1. 数据清洗 Skill（总是检测，因为涉及数据预处理）
        const cleaningPatterns = [
            /清洗|清理|去重|填充|缺失值|异常值|标准化|归一化/,
            /数据.*质量|质量.*数据/,
        ];
        if (cleaningPatterns.some(p => p.test(lowerText))) {
            requiredSkills.push({
                name: 'dataCleaning',
                priority: 1,
                reason: '用户提到数据清洗相关需求'
            });
        }
        
        // 2. 数据分析 Skill - 排除简单查询场景
        // 简单查询特征：查找/查询 + 最大/最小/最高/最低 + 列名
        const isSimpleStatQuery = /^(查找|查询|搜索|看看|显示).{0,5}(最大|最小|最高|最低|最大|最小)的?/.test(text) ||
                                   /^(查找|查询|搜索).{0,10}(最大|最小|最高|最低)/.test(text);
        
        if (!isSimpleStatQuery) {
            const analysisPatterns = [
                /分析|统计|指标|洞察|规律|特征|相关性|关联/,
                /平均值|中位数|方差|标准差|分布|频率|占比/,
                /统计.*分析|分析.*统计|深度.*分析/,
            ];
            if (analysisPatterns.some(p => p.test(lowerText))) {
                requiredSkills.push({
                    name: 'dataAnalysis',
                    priority: 2,
                    reason: '用户提到深度数据分析需求'
                });
            }
        }
        
        // 3. 趋势分析 Skill
        const trendPatterns = [
            /趋势|走势|变化|增长|下降|上升|波动/,
            /时间序列|历史|过去|未来|预测|forecast/,
            /同比|环比|同期|相比|对比.*时间|随.*变化/,
        ];
        if (trendPatterns.some(p => p.test(lowerText))) {
            requiredSkills.push({
                name: 'trendAnalysis',
                priority: 3,
                reason: '用户提到趋势分析相关需求'
            });
        }
        
        // 4. 异常检测 Skill
        const anomalyPatterns = [
            /异常|异常值|离群|偏离|异常点|不正常|异常.*检测/,
            /检测.*异常|发现.*问题|识别.*风险|找出.*异常/,
        ];
        if (anomalyPatterns.some(p => p.test(lowerText))) {
            requiredSkills.push({
                name: 'anomalyDetection',
                priority: 4,
                reason: '用户提到异常检测相关需求'
            });
        }
        
        // 5. 业务建议 Skill
        const advicePatterns = [
            /建议|推荐|优化|改进|方案|策略|措施|对策/,
            /怎么办|如何解决|有什么办法|应该|需要.*做/,
            /为什么|原因|因素|影响|根源|本质/,
        ];
        if (advicePatterns.some(p => p.test(lowerText))) {
            requiredSkills.push({
                name: 'businessAdvice',
                priority: 5,
                reason: '用户提到业务建议相关需求'
            });
        }
        
        // 6. 图表生成 Skill（如果用户明确要求可视化）
        const chartPatterns = [
            /图|表|可视化|绘制|画|展示|呈现/,
            /柱状图|折线图|饼图|散点图|雷达图|热力图/,
        ];
        if (chartPatterns.some(p => p.test(lowerText))) {
            requiredSkills.push({
                name: 'chartGenerator',
                priority: 6,
                reason: '用户提到图表生成相关需求'
            });
        }
        
        // 按优先级排序
        requiredSkills.sort((a, b) => a.priority - b.priority);
        
        return requiredSkills;
    }
    
    /**
     * 做出分类决策
     * 决策顺序（V3.0优化）：
     * 1. 首先判断本地模型能否处理（列名匹配度、模糊度、复杂需求）
     * 2. 只有当本地模型无法处理时，才考虑使用大模型
     * 3. Skills检测仅作为大模型模式的补充，不作为切换到智能模式的触发条件
     */
    makeDecision(userInput, mentionedColumns, matchScore, ambiguityScore, hasComplexRequirements, requiredSkills = [], hasUnlinkedEntities = false, entityExtractionResult = null, hasHighConfidenceFilter = false) {
        let mode = 'precise';
        let confidence = 1.0;
        let reasons = [];
        
        // V4.0优化：检查是否是高置信度筛选查询
        // 如果筛选值在数据中完全匹配，即使hasUnlinkedEntities为true，也可以走本地模型
        const isHighConfidenceFilterQuery = hasHighConfidenceFilter && !hasUnlinkedEntities;
        
        // 第一步：检查是否满足本地模型处理条件
        
        // 1. 检查复杂需求（本地模型无法处理）
        if (hasComplexRequirements) {
            mode = 'intelligent';
            confidence = 0.95;
            reasons.push('检测到复杂需求（单位转换、数据预处理等）');
        }
        
        // 2. 检查模糊度（需求不明确，需要大模型理解）
        if (ambiguityScore > this.thresholds.maxAmbiguityScore) {
            mode = 'intelligent';
            confidence = Math.max(0.7, 1 - ambiguityScore);
            reasons.push(`需求表达较模糊（模糊度: ${ambiguityScore.toFixed(2)}）`);
        }
        
        // 3. 检查列名匹配度（无法确定操作对象）
        if (matchScore < this.thresholds.minConfidenceForLocal) {
            mode = 'intelligent';
            confidence = Math.max(0.6, matchScore);
            reasons.push(`列名匹配度较低（匹配度: ${matchScore.toFixed(2)}）`);
        }
        
        // 4. 如果没有匹配到任何列名（完全不知道用户想操作哪一列）
        if (mentionedColumns.length === 0) {
            mode = 'intelligent';
            confidence = 0.5;
            reasons.push('未在输入中识别到列名');
        }
        
        // 5. V4.0优化：检查是否有未链接的实体
        // 如果是高置信度筛选查询，不走大模型
        if (hasUnlinkedEntities && !isHighConfidenceFilterQuery) {
            mode = 'intelligent';
            confidence = 0.85;
            reasons.push('检测到未识别的筛选条件（如地名、人名等），需要大模型理解');
        }
        
        // 6. V4.0新增：如果实体提取成功且有筛选条件，记录到结果中
        if (entityExtractionResult && entityExtractionResult.filters && entityExtractionResult.filters.length > 0) {
            const linkedFilters = entityExtractionResult.filters.filter(f => f.linkedColumn && f.confidence > 0.1);
            if (linkedFilters.length > 0) {
                reasons.push(`实体链接成功: ${linkedFilters.map(f => `${f.linkedColumn}=${f.linkedValue}`).join(', ')}`);
            }
        }
        
        // 7. V4.0新增：如果是高置信度筛选查询，明确标记
        if (isHighConfidenceFilterQuery) {
            reasons.push('高置信度筛选查询（筛选值在数据中完全匹配）');
        }
        
        // 第二步：如果确定使用大模型，再判断需要调用哪些Skills
        // 注意：Skills检测不再作为切换到智能模式的触发条件！
        // 简单查询（如"查找最大的XX"）即使匹配到dataAnalysis，也应该用本地模型
        
        if (mode === 'precise') {
            // 本地模型可以处理的情况
            reasons.push('列名匹配度高，需求明确，适合本地模型处理');
            
            // 记录检测到的Skills但不改变模式（用于日志记录）
            const detectedSkills = requiredSkills.filter(s => s.name !== 'chartGenerator');
            if (detectedSkills.length > 0) {
                reasons.push(`检测到相关Skills（本地模式不调用）: ${detectedSkills.map(s => s.name).join(', ')}`);
            }
        } else {
            // 大模型模式：附加Skills信息到原因中
            const nonChartSkills = requiredSkills.filter(s => s.name !== 'chartGenerator');
            if (nonChartSkills.length > 0) {
                reasons.push(`将调用Skills: ${nonChartSkills.map(s => s.name).join(', ')}`);
            }
        }
        
        return {
            mode: mode,
            confidence: confidence,
            reason: reasons.join('；'),
            matchedColumns: mentionedColumns.map(m => ({
                column: m.column,
                matchType: m.matchType
            })),
            ambiguityScore: ambiguityScore,
            hasComplexRequirements: hasComplexRequirements,
            columnMatchScore: matchScore,
            requiredSkills: requiredSkills  // 保留Skills信息供后续使用
        };
    }
    
    /**
     * 获取大模型需要的上下文信息
     */
    getContextForLLM(columns, sampleData, mentionedColumns) {
        // 构建列信息，包含字典值（用于大模型理解）
        const columnInfo = [];
        
        for (const col of columns) {
            const info = {
                name: col,
                type: this.inferColumnType(col, sampleData),
                sampleValues: this.getSampleValues(col, sampleData, 5),
                isMatched: mentionedColumns.some(m => m.column === col)
            };
            
            columnInfo.push(info);
        }
        
        return columnInfo;
    }
    
    /**
     * 推断列的数据类型
     */
    inferColumnType(columnName, sampleData) {
        // 根据列名推断类型
        const nameLower = columnName.toLowerCase();
        
        if (['时间', '日期', 'time', 'date'].some(k => nameLower.includes(k))) {
            return 'datetime';
        }
        if (['金额', '价格', '数值', '数量', '金额', '销量', '时长'].some(k => nameLower.includes(k))) {
            return 'numeric';
        }
        if (['名称', '名字', '姓名', '公司', '部门', '类别', '类型'].some(k => nameLower.includes(k))) {
            return 'categorical';
        }
        if (['id', '编号', '编码', 'code'].some(k => nameLower.includes(k))) {
            return 'identifier';
        }
        
        // 根据样本数据推断
        if (sampleData.length > 0) {
            const value = sampleData[0][columnName];
            if (typeof value === 'number') return 'numeric';
            if (!isNaN(Date.parse(value))) return 'datetime';
        }
        
        return 'text';
    }
    
    /**
     * 获取列的样本值（用于字典值）
     */
    getSampleValues(columnName, sampleData, limit = 5) {
        const values = [];
        const seen = new Set();
        
        for (const row of sampleData) {
            const value = row[columnName];
            if (value !== null && value !== undefined && !seen.has(value)) {
                values.push(value);
                seen.add(value);
                if (values.length >= limit) break;
            }
        }
        
        return values;
    }
}

// 导出单例
export default new RequirementClassifier();
