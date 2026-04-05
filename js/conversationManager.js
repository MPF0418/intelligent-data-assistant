/**
 * 对话管理器 - V4.0 智能对话交互系统
 * 
 * 核心逻辑：
 * 1. 提取实体（列名）
 * 2. 识别意图（统计、图表、筛选等）
 * 3. 根据意图检查实体是否足够
 * 4. 明确 → 执行
 * 5. 不明确 → 追问（最多2轮）
 * 6. 2轮后仍不明确 → 交给大模型
 */

import semanticMatcher from './semanticMatcher.js';

class ConversationManager {
    constructor() {
        this.conversationHistory = [];
        this.currentContext = {
            clarificationRound: 0,
            askedQuestions: new Set(),
            confirmedMappings: {},
            originalInput: null,
            pendingQuestions: []
        };
        this.state = 'idle';
        this.dataInfo = null;
        this.semanticMatcher = semanticMatcher;
        
        this.MAX_CLARIFICATION_ROUNDS = 2;
    }
    
    setDataInfo(columns, data) {
        this.dataInfo = {
            columns: columns || [],
            rowCount: data ? data.length : 0,
            sampleData: data ? data.slice(0, 10) : []
        };
        this.semanticMatcher.resetContext();
    }
    
    /**
     * 主入口：处理用户输入
     */
    async processUserInput(userInput) {
        console.log('[ConversationManager] 处理用户输入:', userInput);
        
        this.conversationHistory.push({
            role: 'user',
            content: userInput,
            timestamp: new Date().toISOString()
        });
        
        // 如果是追问状态，处理用户的回答
        if (this.state === 'waiting_for_clarification') {
            return this.handleClarificationResponse(userInput);
        }
        
        // 保存原始输入
        if (!this.currentContext.originalInput) {
            this.currentContext.originalInput = userInput;
        }
        
        // 评估需求完整性
        const assessment = this.assessRequirement(userInput);
        console.log('[ConversationManager] 需求评估:', assessment);
        
        // 需求完整，直接执行
        if (assessment.isComplete) {
            this.resetContext();
            return {
                type: 'execute',
                intent: assessment.intent,
                config: assessment.config,
                message: `好的，我将为您${assessment.description}。`
            };
        }
        
        // 检查是否超过最大追问轮次
        if (this.currentContext.clarificationRound >= this.MAX_CLARIFICATION_ROUNDS) {
            console.log('[ConversationManager] 超过最大追问轮次');
            this.resetContext();
            return {
                type: 'llm_fallback',
                message: '抱歉，经过多轮沟通我仍无法完全理解您的需求。让我使用AI来深度理解一下，或者您可以补充说明更多细节...',
                originalInput: this.currentContext.originalInput
            };
        }
        
        // 生成追问问题
        return this.generateClarificationQuestions(assessment);
    }
    
    /**
     * 评估需求完整性和清晰度
     * V5.0重构：实现置信度阈值机制（95%阈值）和完整需求理解
     * 
     * 判断标准：
     * 1. 必须识别所有关键要素（意图、维度、度量、排序等）
     * 2. 整体置信度必须 >= 0.95
     * 3. 低于阈值时返回llm_fallback，让大模型处理
     */
    assessRequirement(userInput) {
        // 特殊处理：对于"XX的YY是多少"这样的查询，直接识别为filter类型
        if (/(.*的.*是多少|.*的.*多少|.*的.*多少钱)/.test(userInput)) {
            console.log('[ConversationManager] 识别为查询类需求:', userInput);
            
            // 提取实体
            const extractedEntities = this.extractEntities(userInput);
            
            // 从用户输入中提取筛选值和数值列
            // 例如："广东省的销售额是多少" -> filterValue="广东省", valueColumn="销售额"
            const match = userInput.match(/(.+?)的(.+?)是多少/);
            let filterValue = null;
            let valueColumn = null;
            
            if (match) {
                filterValue = match[1].trim();
                valueColumn = match[2].trim();
            }
            
            // 识别意图为filter_aggregate
            const intentInfo = {
                type: 'filter_aggregate',
                confidence: 0.9,
                requires: { minDimensions: 1, minMeasures: 1 }
            };
            
            // 生成配置
            // 根据filterValue选择正确的filterColumn
            let filterColumn = extractedEntities.dimensions[0] || null;
            
            // 智能选择filterColumn：如果filterValue包含"省"，优先选择"省份"列
            if (filterValue && extractedEntities.dimensions.length > 1) {
                if (filterValue.includes('省')) {
                    const provinceColumn = extractedEntities.dimensions.find(col => col.includes('省份') || col.includes('省'));
                    if (provinceColumn) {
                        filterColumn = provinceColumn;
                    }
                } else if (filterValue.includes('地区') || filterValue.includes('区')) {
                    const regionColumn = extractedEntities.dimensions.find(col => col.includes('地区') || col.includes('区'));
                    if (regionColumn) {
                        filterColumn = regionColumn;
                    }
                }
            }
            
            const config = {
                queryType: 'filter_aggregate',
                filterColumn: filterColumn,
                filterValue: filterValue,
                valueColumn: valueColumn || extractedEntities.measures[0] || null,
                aggregateFunction: 'sum',
                userInput: userInput
            };
            
            return {
                isComplete: true,
                type: 'execute',
                intent: intentInfo,
                entities: extractedEntities,
                sortInfo: null,
                completeness: 0.95,
                config,
                description: '查询数据'
            };
        }
        
        // 1. 提取实体（列名）
        const extractedEntities = this.extractEntities(userInput);
        console.log('[ConversationManager] 提取的实体:', extractedEntities);
        
        // 2. 识别意图（可能多个）
        const intentInfo = this.recognizeIntent(userInput);
        console.log('[ConversationManager] 识别的意图:', intentInfo);
        
        // 3. 识别排序需求
        const sortInfo = this.extractSortConfig(userInput);
        console.log('[ConversationManager] 排序信息:', sortInfo);
        
        // 4. 检查图表需求是否缺少必要要素
        if (intentInfo.type && intentInfo.type.startsWith('chart')) {
            const requirements = this.getIntentRequirements(intentInfo.type);
            if (requirements.minDimensions > 0 && extractedEntities.dimensions.length < requirements.minDimensions) {
                console.log('[ConversationManager] 图表需求缺少维度列');
                return {
                    isComplete: false,
                    type: 'clarification',
                    message: '您的图表需求缺少分组维度，请选择或补充说明。',
                    missingElements: ['分组维度（如按省份、按产品）'],
                    intent: intentInfo,
                    entities: extractedEntities
                };
            }
            if (requirements.minMeasures > 0 && extractedEntities.measures.length < requirements.minMeasures) {
                console.log('[ConversationManager] 图表需求缺少度量列');
                return {
                    isComplete: false,
                    type: 'clarification',
                    message: '您的图表需求缺少分析指标，请选择或补充说明。',
                    missingElements: ['分析指标（如销售额、数量）'],
                    intent: intentInfo,
                    entities: extractedEntities
                };
            }
        }
        
        // 5. 计算需求完整度（0-1之间）
        const completeness = this.calculateCompleteness(userInput, intentInfo, extractedEntities, sortInfo);
        console.log('[ConversationManager] 需求完整度:', completeness);
        
        // 6. V5.0关键：置信度阈值机制 - 降低阈值到80%，避免过度拒识
        const CONFIDENCE_THRESHOLD = 0.80;
        const isComplete = completeness >= CONFIDENCE_THRESHOLD;
        
        // 7. 如果完整度不足，返回llm_fallback让大模型处理
        if (!isComplete) {
            console.log('[ConversationManager] 完整度不足，需要大模型处理:', completeness);
            return {
                isComplete: false,
                type: 'llm_fallback',
                message: '正在调用大模型进行深度理解...',
                reason: `需求完整度 ${(completeness * 100).toFixed(1)}% 低于阈值 ${(CONFIDENCE_THRESHOLD * 100).toFixed(0)}%`,
                intent: intentInfo,
                entities: extractedEntities,
                sortInfo: sortInfo,
                completeness,
                missingElements: this.identifyMissingElements(userInput, intentInfo, extractedEntities, sortInfo)
            };
        }
        
        // 8. 生成配置（包含排序信息）
        const config = this.generateConfig(intentInfo, extractedEntities, sortInfo);
        const description = this.generateDescription(intentInfo, extractedEntities, sortInfo);
        
        return {
            isComplete: true,
            type: 'execute',
            intent: intentInfo,
            entities: extractedEntities,
            sortInfo,
            completeness,
            config,
            description
        };
    }
    
    /**
     * V5.0新增：计算需求完整度
     * 产品意义：量化评估用户需求的理解程度（0-1之间）
     */
    calculateCompleteness(userInput, intentInfo, entities, sortInfo) {
        let score = 0;
        let totalWeight = 0;
        
        // 1. 意图识别权重：30%
        totalWeight += 0.3;
        if (intentInfo.type && intentInfo.confidence > 0.7) {
            score += 0.3 * intentInfo.confidence;
        } else if (intentInfo.type) {
            score += 0.3 * intentInfo.confidence * 0.5;  // 置信度低时减半
        }
        
        // 2. 维度列识别权重：25%
        totalWeight += 0.25;
        if (entities.dimensions.length > 0) {
            score += 0.25;
        }
        
        // 3. 度量列识别权重：25%
        totalWeight += 0.25;
        if (entities.measures.length > 0) {
            score += 0.25;
        }
        
        // 4. 排序需求识别权重：20%
        totalWeight += 0.2;
        if (sortInfo && sortInfo.sortOrder) {
            score += 0.2;
        } else if (!this.containsSortKeywords(userInput)) {
            // 用户没有提到排序，不扣分
            score += 0.2;
        }
        
        return totalWeight > 0 ? score / totalWeight : 0;
    }
    
    /**
     * V5.0新增：检查是否包含排序关键词
     */
    containsSortKeywords(userInput) {
        const sortKeywords = ['排序', '从高到低', '从低到高', '降序', '升序', '从大到小', '从小到大'];
        const lowerInput = userInput.toLowerCase();
        return sortKeywords.some(kw => lowerInput.includes(kw));
    }
    
    /**
     * V5.0新增：识别缺失的要素
     */
    identifyMissingElements(userInput, intentInfo, entities, sortInfo) {
        const missing = [];
        
        if (!intentInfo.type || intentInfo.confidence < 0.7) {
            missing.push('明确的分析意图（如统计、图表、筛选）');
        }
        
        if (entities.dimensions.length === 0) {
            missing.push('分组维度（如按省份、按产品）');
        }
        
        if (entities.measures.length === 0) {
            missing.push('分析指标（如销售额、数量）');
        }
        
        if (this.containsSortKeywords(userInput) && (!sortInfo || !sortInfo.sortOrder)) {
            missing.push('排序方式（从高到低或从低到高）');
        }
        
        return missing;
    }
    
    /**
     * 提取实体（列名）
     */
    extractEntities(userInput) {
        const entities = {
            dimensions: [],  // 维度列（如地区、产品）
            measures: [],    // 度量列（如销售额、数量）
            filters: [],     // 筛选条件
            all: []          // 所有提取的列名
        };
        
        const lowerInput = userInput.toLowerCase();
        
        // 遍历所有可用列名
        for (const col of this.dataInfo.columns) {
            const colLower = col.toLowerCase();
            
            // 检查是否包含完整列名
            if (lowerInput.includes(colLower)) {
                entities.all.push(col);
                
                // 判断是维度还是度量
                if (this.isDimension(col)) {
                    entities.dimensions.push(col);
                } else if (this.isMeasure(col)) {
                    entities.measures.push(col);
                } else {
                    // 无法确定，先放入 dimensions
                    entities.dimensions.push(col);
                }
            }
        }
        
        return entities;
    }
    
    /**
     * 判断是否为维度列
     */
    isDimension(columnName) {
        const dimensionKeywords = ['地区', '省份', '省', '城市', '产品', '商品', '客户', '类型', '类别', '状态', '日期', '时间'];
        return dimensionKeywords.some(kw => columnName.toLowerCase().includes(kw.toLowerCase()));
    }
    
    /**
     * 判断是否为度量列
     */
    isMeasure(columnName) {
        const measureKeywords = ['销售额', '金额', '数量', '价格', '成本', '利润', '营收', '收入', '增长', '率', '额', '量'];
        return measureKeywords.some(kw => columnName.toLowerCase().includes(kw.toLowerCase()));
    }
    
    /**
     * 识别意图
     */
    recognizeIntent(userInput) {
        const lowerInput = userInput.toLowerCase();
        
        // 意图模式
        const patterns = {
            aggregate_sum: {
                keywords: ['总和', '求和', '总计', '合计', 'sum'],
                confidence: 0.9
            },
            aggregate_avg: {
                keywords: ['平均', '均值', 'avg', 'average'],
                confidence: 0.9
            },
            aggregate_max: {
                keywords: ['最大', '最高', '最多', 'max'],
                confidence: 0.9
            },
            aggregate_min: {
                keywords: ['最小', '最低', '最少', 'min'],
                confidence: 0.9
            },
            aggregate_count: {
                keywords: ['数量', '个数', '计数', 'count'],
                confidence: 0.8
            },
            chart_bar: {
                keywords: ['柱状图', '条形图', 'bar'],
                confidence: 0.9
            },
            chart_pie: {
                keywords: ['饼图', 'pie'],
                confidence: 0.9
            },
            chart_line: {
                keywords: ['折线图', '趋势图', 'line'],
                confidence: 0.9
            },
            filter: {
                keywords: ['查找', '筛选', '找出', '搜索', '查询'],
                confidence: 0.7
            },
            find_extreme: {
                keywords: ['哪个', '哪一个'],
                confidence: 0.6
            },
            // V5.0新增：排序意图
            sort_desc: {
                keywords: ['从高到低', '从大到小', '降序', '倒序', '由高到低', '由大到小', '排序'],
                confidence: 0.85
            },
            sort_asc: {
                keywords: ['从低到高', '从小到大', '升序', '正序', '由低到高', '由小到大'],
                confidence: 0.85
            }
        };
        
        // 匹配意图
        let bestIntent = null;
        let bestConfidence = 0;
        
        for (const [intent, pattern] of Object.entries(patterns)) {
            for (const keyword of pattern.keywords) {
                if (lowerInput.includes(keyword.toLowerCase())) {
                    if (pattern.confidence > bestConfidence) {
                        bestIntent = intent;
                        bestConfidence = pattern.confidence;
                    }
                }
            }
        }
        
        // 如果没有明确匹配，检查是否包含统计相关词汇
        if (!bestIntent) {
            const statsKeywords = ['统计', '计算', '分析'];
            for (const kw of statsKeywords) {
                if (lowerInput.includes(kw)) {
                    bestIntent = 'aggregate_sum';  // 默认求和
                    bestConfidence = 0.5;
                    break;
                }
            }
        }
        
        return {
            type: bestIntent,
            confidence: bestConfidence,
            requires: this.getIntentRequirements(bestIntent)
        };
    }
    
    /**
     * 获取意图所需的要素
     */
    getIntentRequirements(intent) {
        const requirements = {
            aggregate_sum: { minDimensions: 0, minMeasures: 1 },
            aggregate_avg: { minDimensions: 0, minMeasures: 1 },
            aggregate_max: { minDimensions: 0, minMeasures: 1 },
            aggregate_min: { minDimensions: 0, minMeasures: 1 },
            aggregate_count: { minDimensions: 1, minMeasures: 0 },
            chart_bar: { minDimensions: 1, minMeasures: 1 },
            chart_pie: { minDimensions: 1, minMeasures: 1 },
            chart_line: { minDimensions: 1, minMeasures: 1 },
            filter: { minDimensions: 0, minMeasures: 0 },
            find_extreme: { minDimensions: 1, minMeasures: 1 }
        };
        
        return requirements[intent] || { minDimensions: 0, minMeasures: 0 };
    }
    
    /**
     * 检查缺失的要素
     */
    checkMissingElements(intent, entities) {
        const missing = [];
        
        if (!intent.type) {
            missing.push({
                type: 'intent',
                message: '您想进行什么操作？',
                options: ['统计分析', '生成图表', '筛选数据']
            });
            return missing;
        }
        
        const requirements = intent.requires;
        
        // 检查维度列
        if (requirements.minDimensions > 0 && entities.dimensions.length < requirements.minDimensions) {
            missing.push({
                type: 'dimension',
                message: `您想按哪一列进行${this.getIntentName(intent.type)}？`,
                options: this.dataInfo.columns.filter(col => this.isDimension(col))
            });
        }
        
        // 检查度量列
        if (requirements.minMeasures > 0 && entities.measures.length < requirements.minMeasures) {
            missing.push({
                type: 'measure',
                message: `您想对哪一列进行${this.getIntentName(intent.type)}？`,
                options: this.dataInfo.columns.filter(col => this.isMeasure(col))
            });
        }
        
        return missing;
    }
    
    /**
     * 获取意图名称
     */
    getIntentName(intent) {
        const names = {
            aggregate_sum: '求和',
            aggregate_avg: '求平均',
            aggregate_max: '求最大值',
            aggregate_min: '求最小值',
            aggregate_count: '计数',
            chart_bar: '生成柱状图',
            chart_pie: '生成饼图',
            chart_line: '生成折线图',
            filter: '筛选',
            find_extreme: '查找极值'
        };
        return names[intent] || '分析';
    }
    
    /**
     * 生成追问问题
     */
    generateClarificationQuestions(assessment) {
        this.state = 'waiting_for_clarification';
        this.currentContext.clarificationRound++;
        
        const missing = assessment.missingElements[0];  // 取第一个缺失的要素
        
        if (!missing) {
            // 没有缺失要素但需求仍不完整，交给大模型
            this.resetContext();
            return {
                type: 'llm_fallback',
                message: '抱歉，我仍无法完全理解您的需求。让我使用AI来深度理解一下，或者您可以补充说明更多细节...',
                originalInput: this.currentContext.originalInput
            };
        }
        
        // 记录已询问的问题
        const questionKey = `missing_${this.currentContext.clarificationRound}`;
        this.currentContext.askedQuestions.add(questionKey);
        
        // 生成选项 - 对于字符串类型的缺失要素
        const options = [];
        
        // 根据缺失要素类型生成选项
        if (missing.includes('维度')) {
            // 生成维度列选项
            const dimensionColumns = this.dataInfo.columns.filter(col => this.isDimension(col));
            dimensionColumns.slice(0, 5).forEach(col => {
                options.push({ label: col, value: col });
            });
        } else if (missing.includes('指标')) {
            // 生成度量列选项
            const measureColumns = this.dataInfo.columns.filter(col => this.isMeasure(col));
            measureColumns.slice(0, 5).forEach(col => {
                options.push({ label: col, value: col });
            });
        }
        
        options.push({ label: '补充说明更多细节', value: 'more_details' });
        options.push({ label: '以上都不是，让AI帮我理解', value: 'llm_fallback' });
        
        return {
            type: 'clarification',
            message: `您的需求缺少：${missing}，请选择或补充说明。`,
            missingType: 'general',
            options: options
        };
    }
    
    /**
     * 处理用户的澄清回答
     */
    async handleClarificationResponse(userInput) {
        console.log('[ConversationManager] 处理澄清回答:', userInput);
        
        const lowerInput = userInput.toLowerCase();
        
        // 检查用户是否选择让AI处理
        if (lowerInput.includes('ai') || lowerInput.includes('大模型') || lowerInput.includes('让ai') || lowerInput.includes('以上都不是')) {
            this.resetContext();
            return {
                type: 'llm_fallback',
                message: '好的，我将使用AI深度理解您的需求...',
                originalInput: this.currentContext.originalInput
            };
        }
        
        // 检查用户是否选择补充说明
        if (lowerInput.includes('补充') || lowerInput.includes('更多') || lowerInput.includes('细节')) {
            return {
                type: 'more_details',
                message: '请补充说明您的需求细节，例如：\n- 您想分析哪些数据列？\n- 您希望进行什么操作（统计、图表、筛选）？\n- 有什么筛选条件吗？'
            };
        }
        
        // 将用户的回答追加到原始输入
        const updatedInput = this.currentContext.originalInput + '，' + userInput;
        this.currentContext.originalInput = updatedInput;
        
        // 重置状态，重新评估
        this.state = 'idle';
        
        return this.processUserInput(updatedInput);
    }
    
    /**
     * 生成执行配置
     * V5.0增强：支持排序参数识别
     */
    generateConfig(intent, entities, sortInfo) {
        const config = {
            userInput: this.currentContext.originalInput,
            intentType: intent.type
        };
        
        console.log('[ConversationManager] generateConfig 排序信息:', sortInfo);
        
        // 根据意图类型生成配置
        if (intent.type.startsWith('aggregate')) {
            config.queryType = 'aggregate_groupby';
            config.groupColumn = entities.dimensions[0] || null;
            config.valueColumn = entities.measures[0] || entities.dimensions[1] || null;
            
            // 确定聚合函数
            if (intent.type === 'aggregate_sum') config.aggregateFunction = 'sum';
            else if (intent.type === 'aggregate_avg') config.aggregateFunction = 'avg';
            else if (intent.type === 'aggregate_max') config.aggregateFunction = 'max';
            else if (intent.type === 'aggregate_min') config.aggregateFunction = 'min';
            else if (intent.type === 'aggregate_count') config.aggregateFunction = 'count';
            
            // V5.0：添加排序配置
            if (sortInfo && sortInfo.sortOrder) {
                config.sortBy = sortInfo.sortBy;
                config.sortOrder = sortInfo.sortOrder;
            }
            
        } else if (intent.type.startsWith('chart')) {
            config.chartType = intent.type.replace('chart_', '');
            config.xAxisColumn = entities.dimensions[0] || null;
            config.yAxisColumn = entities.measures[0] || null;
            
            // V5.0：添加排序配置
            if (sortInfo && sortInfo.sortOrder) {
                config.sortBy = sortInfo.sortBy;
                config.sortOrder = sortInfo.sortOrder;
                config.description = `${this.generateDescription(intent, entities, sortInfo)}，按${sortInfo.sortBy}${sortInfo.sortOrder === 'desc' ? '降序' : '升序'}排列`;
            }
            
        } else if (intent.type === 'filter') {
            config.queryType = 'filter';
            config.filterColumn = entities.dimensions[0] || entities.measures[0] || null;
        }
        
        return config;
    }
    
    /**
     * V5.0新增：提取排序配置
     * 产品意义：识别用户排序需求（如"从高到低"、"升序排列"）
     */
    extractSortConfig(userInput) {
        const lowerInput = userInput.toLowerCase();
        
        console.log('[ConversationManager] extractSortConfig 输入:', userInput);
        console.log('[ConversationManager] dataInfo.columns:', this.dataInfo.columns);
        
        // 降序模式
        const descPatterns = [
            /从高到低|从大到小|降序|倒序|倒排|由高到低|由大到小/,
            /按.+?(降序|倒序|从高|从大到)/,
            /(最大|最高|最多).+?(优先|在前|排前)/,
        ];
        
        // 升序模式
        const ascPatterns = [
            /从低到高|从小到大|升序|正序|正排|由低到高|由小到大/,
            /按.+?(升序|正序|从低|从小)/,
            /(最小|最低|最少).+?(优先|在前|排前)/,
        ];
        
        let sortOrder = null;
        
        // 检测排序方向
        for (const pattern of descPatterns) {
            if (pattern.test(lowerInput)) {
                sortOrder = 'desc';
                break;
            }
        }
        
        if (!sortOrder) {
            for (const pattern of ascPatterns) {
                if (pattern.test(lowerInput)) {
                    sortOrder = 'asc';
                    break;
                }
            }
        }
        
        // 如果没有检测到排序需求，返回null
        if (!sortOrder) {
            return null;
        }
        
        // V5.0修复：改进排序字段识别逻辑
        // 策略1：尝试匹配"按{列名}排序"或"按照{列名}排序"
        let sortBy = null;
        
        // 检查是否包含"按"或"按照"
        if (lowerInput.includes('按')) {
            // 找出"按"或"按照"的位置
            const anIndex = lowerInput.indexOf('按');
            const anzhaoIndex = lowerInput.indexOf('按照');
            const startIndex = anzhaoIndex !== -1 ? anzhaoIndex + 2 : anIndex + 1;
            
            // 提取"按"后面的文本（直到排序方向词）
            const afterAn = lowerInput.substring(startIndex);
            
            // 尝试匹配列名
            for (const col of this.dataInfo.columns) {
                const colLower = col.toLowerCase();
                // 检查"按"后面是否跟着列名
                if (afterAn.includes(colLower)) {
                    // 确保列名在排序方向词之前
                    const colIndex = afterAn.indexOf(colLower);
                    const directionIndex = Math.min(
                        afterAn.indexOf('从高') !== -1 ? afterAn.indexOf('从高') : Infinity,
                        afterAn.indexOf('从低') !== -1 ? afterAn.indexOf('从低') : Infinity,
                        afterAn.indexOf('降序') !== -1 ? afterAn.indexOf('降序') : Infinity,
                        afterAn.indexOf('升序') !== -1 ? afterAn.indexOf('升序') : Infinity,
                        afterAn.indexOf('大到') !== -1 ? afterAn.indexOf('大到') : Infinity,
                        afterAn.indexOf('小到') !== -1 ? afterAn.indexOf('小到') : Infinity
                    );
                    
                    if (colIndex !== -1 && (directionIndex === Infinity || colIndex < directionIndex)) {
                        sortBy = col;
                        console.log('[ConversationManager] 找到排序字段:', sortBy);
                        break;
                    }
                }
            }
        }
        
        // 策略2：如果没找到，检查整个句子中提到的度量列（如销售额、数量等）
        if (!sortBy) {
            const measureKeywords = ['销售额', '金额', '数值', '数量', '值', '总数', '总计'];
            for (const keyword of measureKeywords) {
                if (lowerInput.includes(keyword)) {
                    // 检查是否有匹配的列名
                    for (const col of this.dataInfo.columns) {
                        if (col.toLowerCase().includes(keyword) || keyword.includes(col.toLowerCase())) {
                            sortBy = col;
                            console.log('[ConversationManager] 根据关键词找到排序字段:', sortBy);
                            break;
                        }
                    }
                    if (sortBy) break;
                }
            }
        }
        
        return {
            sortBy: sortBy || 'value',  // 默认按数值排序
            sortOrder: sortOrder
        };
    }
    
    /**
     * 生成描述
     */
    /**
     * V5.0增强：生成描述，支持排序信息
     */
    generateDescription(intent, entities, sortInfo) {
        let desc = this.getIntentName(intent.type);
        
        if (entities.dimensions.length > 0) {
            desc += `（按${entities.dimensions.join('、')}分组）`;
        }
        
        if (entities.measures.length > 0) {
            desc += `，分析${entities.measures.join('、')}`;
        }
        
        // V5.0：添加排序信息
        if (sortInfo && sortInfo.sortOrder) {
            desc += `，按${sortInfo.sortBy || '数值'}${sortInfo.sortOrder === 'desc' ? '从高到低' : '从低到高'}排序`;
        }
        
        return desc;
    }
    
    /**
     * 重置上下文
     */
    resetContext() {
        this.currentContext = {
            clarificationRound: 0,
            askedQuestions: new Set(),
            confirmedMappings: {},
            originalInput: null,
            pendingQuestions: []
        };
        this.state = 'idle';
    }
}

const conversationManager = new ConversationManager();
export default conversationManager;
