// 意图识别模块（三层混合架构：规则匹配 + 本地BERT模型 + 大模型API兜底）
// 功能：使用三层策略进行意图识别，确保高准确率
// 响应时间：规则匹配 < 1ms，本地模型 10-50ms，大模型API 2-5秒

class IntentRecognizer {
    constructor() {
        // 意图类型定义
        this.intentTypes = {
            QUERY_FIND: '查找特定数据（最大值、最小值、排名等）',
            QUERY_AGGREGATE: '统计汇总（求和、计数、平均值等）',
            QUERY_FILTER: '筛选过滤（按条件筛选数据）',
            QUERY_SORT: '排序（升序、降序排列）',
            CHART_BAR: '柱状图可视化',
            CHART_LINE: '折线图可视化',
            CHART_PIE: '饼图可视化',
            CHART_SCATTER: '散点图可视化',
            CHART_GENERAL: '通用图表可视化'
        };
        
        // 规则匹配关键词（权重越高优先级越高）
        this.rules = {
            CHART_BAR: {
                keywords: ['柱状图', '条形图', '柱图', '条图', '对比图', '比较图', '排名图'],
                weight: 3
            },
            CHART_LINE: {
                keywords: ['折线图', '线图', '曲线图', '趋势图', '走势图', '面积图', '变化图', '增长图'],
                weight: 3
            },
            CHART_PIE: {
                keywords: ['饼图', '环形图', '圆图', '占比图', '比例图', '构成图', '份额'],
                weight: 3
            },
            CHART_SCATTER: {
                keywords: ['散点图', '散点', '点图', '气泡图', '分布图', '相关性', '相关图', 'xy图', '坐标图'],
                weight: 3
            },
            CHART_GENERAL: {
                keywords: ['图表', '可视化', '画图', '绘图', '绘制', '图形', '图示', '展示图', '分析图', '统计图', '图表化', '图形化'],
                weight: 2
            },
            QUERY_FIND: {
                keywords: ['哪个', '谁', '哪', '最大', '最小', '最高', '最低', '第一名', '最后一名', '前几名', '后几名', '排名', '找出', '查找', '搜索', '寻找', '定位', '极值', '最值', 'top'],
                weight: 3
            },
            QUERY_AGGREGATE: {
                keywords: ['统计', '汇总', '合计', '总计', '总数', '平均', '求和', '计数', '多少', '计算', '数量', '分组', '分类统计', '平均值', '中位数'],
                weight: 2
            },
            QUERY_FILTER: {
                keywords: ['筛选', '过滤', '只要', '只看', '只显示', '排除', '去除', '删除', '保留', '选择', '提取', '条件', '满足', '符合', '大于', '小于', '等于', '包含', '不包含', '在...之间', '范围内'],
                weight: 2
            },
            QUERY_SORT: {
                keywords: ['排序', '排列', '从小到大', '从大到小', '升序', '降序', '正序', '倒序', '从低到高', '从高到低', '从早到晚', '从晚到早'],
                weight: 2
            }
        };
        
        // 拒识规则 - 当用户输入包含这些关键词时，判定为无效查询
        this.rejectionRules = {
            // 完全不相关的场景
            irrelevantKeywords: [
                '天气', '新闻', '股票', '电影', '音乐', '游戏', '购物', '外卖', '打车', '导航',
                '聊天', '笑话', '故事', '诗歌', '作文', '翻译', '编程', '代码', 'bug', '报错',
                '你好', '您好', '在吗', '在不在', 'hello', 'hi', '嗨', '哈喽',
                '谢谢', '感谢', '再见', '拜拜', '再见', 'goodbye', 'bye',
                '帮助', '怎么用', '如何使用', '教程', '说明', '文档'
            ],
            // 置信度阈值 - 低于此值且没有匹配到任何关键词时拒识
            minConfidenceThreshold: 0.2,
            // 最小关键词匹配数
            minKeywordMatches: 1
        };
        
        // 组合规则（用于处理复杂查询 - 统计+图表组合）
        this.combinationRules = [
            {
                pattern: /(统计|汇总|分组|平均|求和|计数).*(柱状图|条形图|柱图|图表)/i,
                intents: ['QUERY_AGGREGATE', 'CHART_BAR'],
                primary: 'CHART_BAR'  // 主要意图是绘图
            },
            {
                pattern: /(统计|汇总|分组|平均|求和|计数).*(折线图|趋势图|线图)/i,
                intents: ['QUERY_AGGREGATE', 'CHART_LINE'],
                primary: 'CHART_LINE'
            },
            {
                pattern: /(统计|汇总|分组|平均|求和|计数).*(饼图|占比图|环形图)/i,
                intents: ['QUERY_AGGREGATE', 'CHART_PIE'],
                primary: 'CHART_PIE'
            },
            {
                pattern: /(排序|排列).*(柱状图|条形图|图表)/i,
                intents: ['QUERY_SORT', 'CHART_BAR'],
                primary: 'CHART_BAR'
            },
            {
                pattern: /(绘制|生成|画).*(柱状图|条形图|柱图)/i,
                intents: ['CHART_BAR'],
                primary: 'CHART_BAR'
            },
            {
                pattern: /(绘制|生成|画).*(折线图|趋势图|线图)/i,
                intents: ['CHART_LINE'],
                primary: 'CHART_LINE'
            },
            {
                pattern: /(绘制|生成|画).*(饼图|占比图)/i,
                intents: ['CHART_PIE'],
                primary: 'CHART_PIE'
            },
            {
                // 谁是XX人/哪里人 - 筛选查询
                pattern: /谁(是|在|来自|住|来自)?(.+?)(人|的|居住|工作|在)/i,
                intents: ['QUERY_FILTER'],
                primary: 'QUERY_FILTER'
            },
            {
                // XX人在哪里/有哪些 - 筛选查询
                pattern: /(.+?人)(在哪里|有哪些|是谁|是哪些)/i,
                intents: ['QUERY_FILTER'],
                primary: 'QUERY_FILTER'
            }
        ];
        
        // 本地模型API配置 - 支持从URL参数动态配置（用于公网部署）
        const urlParams = new URLSearchParams(window.location.search);
        this.localModelApiUrl = urlParams.get('apiUrl') || 'http://localhost:5001';
        this.useLocalModel = true;
        this.modelAvailable = false;
        
        // 大模型API配置（从config.js读取）
        this.useLLMFallback = true; // 是否启用大模型兜底
        this.llmConfidenceThreshold = 0.5; // 低于此阈值时调用大模型
        
        console.log('[IntentRecognizer] 本地API地址:', this.localModelApiUrl);
        
        // 检查本地模型API可用性
        this.checkLocalModelAvailability();
    }
    
    // V4.2增强：检查统一API服务可用性（合并后的单端口服务）
    async checkLocalModelAvailability() {
        // V4.2: 统一API服务只使用5001端口
        const services = [
            { name: '统一API服务', url: `${this.localModelApiUrl}/health`, port: 5001 }
        ];
        
        this.servicesStatus = {};
        let apiAvailable = true;
        
        for (const service of services) {
            try {
                const response = await fetch(service.url, {
                    method: 'GET',
                    signal: AbortSignal.timeout(2000)
                });
                
                if (response.ok) {
                    try {
                        const data = await response.json();
                        if (data.status === 'success') {
                            this.servicesStatus[service.name] = { available: true, port: service.port };
                            console.log(`✅ ${service.name}可用 (端口${service.port})`);
                        } else {
                            this.servicesStatus[service.name] = { available: false, port: service.port, error: '服务返回错误状态' };
                            console.log(`⚠️ ${service.name}返回错误 (端口${service.port})`);
                            apiAvailable = false;
                        }
                    } catch (jsonError) {
                        // 如果返回的不是JSON，可能是HTML错误页面
                        this.servicesStatus[service.name] = { available: false, port: service.port, error: '服务返回非JSON响应' };
                        console.log(`⚠️ ${service.name}返回非JSON响应 (端口${service.port})`);
                        apiAvailable = false;
                    }
                } else {
                    this.servicesStatus[service.name] = { available: false, port: service.port, error: 'HTTP错误' };
                    console.log(`⚠️ ${service.name}返回错误 (端口${service.port})`);
                    apiAvailable = false;
                }
            } catch (error) {
                this.servicesStatus[service.name] = { available: false, port: service.port, error: error.message };
                console.log(`⚠️ ${service.name}不可用 (端口${service.port}): ${error.message}`);
                apiAvailable = false;
            }
        }
        
        // 即使API服务不可用，本地规则匹配功能仍然可用
        // 所以本地模型状态应该始终为可用
        this.modelAvailable = true;
        
        // 检测完成后触发回调，让UI更新
        if (this.onStatusChange) {
            this.onStatusChange(this.getModelStatus());
        }
        
        return this.modelAvailable;
    }
    
    // 检查是否需要拒识
    checkRejection(text) {
        const lowerText = text.toLowerCase().trim();
        
        // 检查是否包含完全不相关的关键词
        for (const keyword of this.rejectionRules.irrelevantKeywords) {
            if (lowerText.includes(keyword.toLowerCase())) {
                return {
                    shouldReject: true,
                    reason: `输入包含不相关关键词"${keyword}"，请提供与数据分析相关的查询`,
                    suggestion: '请尝试输入类似："统计各省份的平均值"、"绘制柱状图"、"找出最大值"等数据分析相关的指令'
                };
            }
        }
        
        // 检查输入是否过短（少于3个字符）
        if (text.trim().length < 3) {
            return {
                shouldReject: true,
                reason: '输入内容过短，无法理解您的意图',
                suggestion: '请提供更详细的查询描述，例如："按照省份统计销售额并绘制柱状图"'
            };
        }
        
        // 检查是否只包含数字或符号（不包括中文）
        // 使用 Unicode 属性来检查是否只包含数字、空格和标点符号
        const textWithoutChinese = text.trim().replace(/[\u4e00-\u9fa5]/g, '');
        if (textWithoutChinese.length > 0 && /^[\d\s\p{P}\p{S}]+$/u.test(textWithoutChinese)) {
            // 如果去掉中文后只剩下数字、空格和符号，且原文字数很少，则拒识
            if (text.trim().length < 5) {
                return {
                    shouldReject: true,
                    reason: '输入只包含数字或符号，无法识别数据分析意图',
                    suggestion: '请输入包含中文描述的查询指令，例如："统计各地区的平均值"'
                };
            }
        }
        
        return { shouldReject: false };
    }
    
    // 规则匹配
    matchByRules(text) {
        // 首先检查是否需要拒识
        const rejectionCheck = this.checkRejection(text);
        if (rejectionCheck.shouldReject) {
            return {
                intent: null,
                confidence: 0,
                method: 'rejected',
                rejectionReason: rejectionCheck.reason,
                suggestion: rejectionCheck.suggestion,
                scores: {},
                matchedKeywords: []
            };
        }
        
        const scores = {};
        const lowerText = text.toLowerCase();
        const matchedKeywords = {};
        
        // 计算每个意图的得分
        for (const [intent, rule] of Object.entries(this.rules)) {
            let score = 0;
            matchedKeywords[intent] = [];
            
            for (const keyword of rule.keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    score += rule.weight;
                    matchedKeywords[intent].push(keyword);
                }
            }
            scores[intent] = score;
        }
        
        // 检查组合规则（统计+图表组合）
        let primaryIntentFromCombo = null;
        for (const comboRule of this.combinationRules) {
            if (comboRule.pattern.test(text)) {
                for (const intent of comboRule.intents) {
                    scores[intent] = (scores[intent] || 0) + 5;  // 组合规则加分更高
                }
                // 记录主要意图（通常是图表）
                if (comboRule.primary) {
                    primaryIntentFromCombo = comboRule.primary;
                }
            }
        }
        
        // 找出最高分
        let maxScore = 0;
        let matchedIntent = null;
        
        // 如果有组合规则指定的主要意图，优先使用
        if (primaryIntentFromCombo && scores[primaryIntentFromCombo] > 0) {
            matchedIntent = primaryIntentFromCombo;
            maxScore = scores[primaryIntentFromCombo];
        } else {
            // 否则按分数排序
            for (const [intent, score] of Object.entries(scores)) {
                if (score > maxScore) {
                    maxScore = score;
                    matchedIntent = intent;
                }
            }
        }
        
        // 计算置信度
        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
        let confidence = 0;
        
        if (maxScore > 0 && totalScore > 0) {
            confidence = Math.min(0.95, maxScore / Math.max(totalScore, 5) + 0.4);
        }
        
        return {
            intent: matchedIntent,
            confidence,
            method: 'rule',
            scores,
            matchedKeywords: matchedKeywords[matchedIntent] || []
        };
    }
    
    // 调用本地模型API
    async callLocalModel(text) {
        if (!this.useLocalModel || !this.modelAvailable) {
            return null;
        }
        
        try {
            const response = await fetch(`${this.localModelApiUrl}/api/identify-intent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text }),
                signal: AbortSignal.timeout(5000)
            });
            
            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }
            
            const result = await response.json();
            return {
                ...result,
                method: 'local_model'
            };
        } catch (error) {
            console.warn('本地模型API调用失败:', error);
            this.modelAvailable = false;
            return null;
        }
    }
    
    // 调用大模型API（兜底方案）
    async callLLM(text, dataInfo = null) {
        if (!this.useLLMFallback) {
            return null;
        }
        
        // 检查是否有配置
        if (typeof window.config === 'undefined' || !window.config.ai || !window.config.ai.apiUrl) {
            console.warn('大模型API未配置，跳过兜底');
            return null;
        }
        
        try {
            const prompt = this.buildLLMPrompt(text, dataInfo);
            
            const response = await fetch(`${window.config.ai.apiUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.config.ai.apiKey}`
                },
                body: JSON.stringify({
                    model: window.config.ai.model,
                    messages: [
                        {
                            role: 'system',
                            content: '你是一位意图识别专家，请分析用户输入并返回JSON格式的意图识别结果。'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 200
                }),
                signal: AbortSignal.timeout(30000)
            });
            
            if (!response.ok) {
                throw new Error(`LLM API请求失败: ${response.status}`);
            }
            
            const result = await response.json();
            const content = result.choices[0].message.content;
            
            // 解析JSON结果
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const llmResult = JSON.parse(jsonMatch[0]);
                return {
                    intent: llmResult.intent,
                    confidence: llmResult.confidence || 0.8,
                    description: llmResult.description || this.intentTypes[llmResult.intent],
                    reason: llmResult.reason,
                    method: 'llm_fallback'
                };
            }
            
            return null;
        } catch (error) {
            console.warn('大模型API调用失败:', error);
            return null;
        }
    }
    
    // 构建大模型提示词
    buildLLMPrompt(text, dataInfo) {
        let prompt = `请分析以下用户输入，识别用户意图。

用户输入："${text}"

可选意图类型：
- QUERY_FIND: 查找特定数据（最大值、最小值、排名等）
- QUERY_AGGREGATE: 统计汇总（求和、计数、平均值等）
- QUERY_FILTER: 筛选过滤（按条件筛选数据）
- QUERY_SORT: 排序（升序、降序排列）
- CHART_BAR: 柱状图可视化
- CHART_LINE: 折线图可视化
- CHART_PIE: 饼图可视化
- CHART_GENERAL: 通用图表可视化

请返回JSON格式结果：
{
  "intent": "意图类型",
  "confidence": 0.95,
  "description": "意图描述",
  "reason": "判断理由"
}

只返回JSON，不要其他内容。`;

        if (dataInfo) {
            prompt += `\n\n数据表信息：\n- 列名：${dataInfo.columns?.join(', ') || '未知'}\n- 行数：${dataInfo.rowCount || 0}`;
        }
        
        return prompt;
    }
    
    // 主识别函数（三层混合策略）
    async recognize(text, dataInfo = null) {
        const startTime = performance.now();
        
        // ========== 第一层：规则匹配 ==========
        const ruleResult = this.matchByRules(text);
        
        // 检查是否被拒识
        if (ruleResult.method === 'rejected') {
            const endTime = performance.now();
            return {
                ...ruleResult,
                responseTime: endTime - startTime,
                isRejected: true
            };
        }
        
        // 如果规则匹配置信度高，直接返回
        if (ruleResult.confidence >= 0.8) {
            const endTime = performance.now();
            return {
                ...ruleResult,
                description: this.intentTypes[ruleResult.intent],
                responseTime: endTime - startTime
            };
        }
        
        // ========== 第二层：本地BERT模型 ==========
        if (this.useLocalModel && this.modelAvailable) {
            const modelResult = await this.callLocalModel(text);
            
            if (modelResult && modelResult.confidence >= this.llmConfidenceThreshold) {
                const endTime = performance.now();
                return {
                    ...modelResult,
                    responseTime: endTime - startTime
                };
            }
        }
        
        // ========== 第三层：大模型API兜底 ==========
        // 如果前两层置信度都很低，调用大模型
        if (this.useLLMFallback && ruleResult.confidence < this.llmConfidenceThreshold) {
            const llmResult = await this.callLLM(text, dataInfo);
            
            if (llmResult) {
                const endTime = performance.now();
                return {
                    ...llmResult,
                    responseTime: endTime - startTime
                };
            }
        }
        
        // 返回规则结果或默认值
        const endTime = performance.now();
        
        if (ruleResult.intent) {
            return {
                ...ruleResult,
                description: this.intentTypes[ruleResult.intent],
                responseTime: endTime - startTime,
                needConfirmation: ruleResult.confidence < 0.5
            };
        }
        
        // 默认返回通用查询
        return {
            intent: 'QUERY_AGGREGATE',
            confidence: 0.5,
            method: 'default',
            description: this.intentTypes.QUERY_AGGREGATE,
            responseTime: endTime - startTime,
            needConfirmation: true
        };
    }
    
    // 同步识别函数（仅规则匹配，不调用API）
    recognizeSync(text) {
        const startTime = performance.now();
        const ruleResult = this.matchByRules(text);
        const endTime = performance.now();
        
        if (ruleResult.intent) {
            return {
                ...ruleResult,
                description: this.intentTypes[ruleResult.intent],
                responseTime: endTime - startTime,
                needConfirmation: ruleResult.confidence < 0.5
            };
        }
        
        return {
            intent: 'QUERY_AGGREGATE',
            confidence: 0.5,
            method: 'default',
            description: this.intentTypes.QUERY_AGGREGATE,
            responseTime: endTime - startTime,
            needConfirmation: true
        };
    }
    
    // 判断是否为图表意图
    isChartIntent(intent) {
        return intent && intent.startsWith('CHART_');
    }
    
    // 判断是否为查询意图
    isQueryIntent(intent) {
        return intent && intent.startsWith('QUERY_');
    }
    
    // 获取意图类型描述
    getIntentDescription(intent) {
        return this.intentTypes[intent] || '未知意图';
    }
    
    // 获取所有意图类型
    getIntentTypes() {
        return this.intentTypes;
    }
    
    // 设置本地模型API地址
    setLocalModelApiUrl(url) {
        this.localModelApiUrl = url;
        this.checkLocalModelAvailability();
    }
    
    // 启用/禁用本地模型
    setUseLocalModel(use) {
        this.useLocalModel = use;
        if (use) {
            this.checkLocalModelAvailability();
        }
    }
    
    // 启用/禁用大模型兜底
    setUseLLMFallback(use) {
        this.useLLMFallback = use;
    }
    
    // 设置大模型置信度阈值
    setLLMConfidenceThreshold(threshold) {
        this.llmConfidenceThreshold = threshold;
    }
    
    // V4.1增强：获取模型状态（包含所有服务状态）
    getModelStatus() {
        return {
            useLocalModel: this.useLocalModel,
            modelAvailable: this.modelAvailable,
            servicesStatus: this.servicesStatus || {},
            localModelApiUrl: this.localModelApiUrl,
            useLLMFallback: this.useLLMFallback,
            llmConfidenceThreshold: this.llmConfidenceThreshold
        };
    }
    
    // 批量识别
    batchRecognize(texts) {
        return texts.map(text => this.recognizeSync(text));
    }
    
    // 获取意图统计
    getIntentStats(texts) {
        const results = this.batchRecognize(texts);
        const stats = {};
        
        for (const result of results) {
            if (!stats[result.intent]) {
                stats[result.intent] = 0;
            }
            stats[result.intent]++;
        }
        
        return stats;
    }
    
    // V4.2更新：分析要素识别（使用统一API服务）
    async analyzeElements(text) {
        if (!this.modelAvailable) {
            return null;
        }
        
        // V4.2: 统一API服务使用5001端口
        const analysisApiUrl = this.localModelApiUrl;
        
        try {
            const response = await fetch(`${analysisApiUrl}/api/analyze-elements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text }),
                signal: AbortSignal.timeout(10000)
            });
            
            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('[V4.0] 分析要素识别结果:', result);
            
            return {
                aggregateFunction: result.aggregate_function,
                aggregateConfidence: result.aggregate_confidence,
                outputType: result.output_type,
                outputConfidence: result.output_confidence,
                method: 'analysis_model'
            };
        } catch (error) {
            console.warn('[V4.0] 分析要素识别失败:', error);
            return null;
        }
    }
    
    // V4.0新增：综合识别（意图 + 分析要素）
    async recognizeWithElements(text, dataInfo = null) {
        const startTime = performance.now();
        
        // 并行执行意图识别和分析要素识别
        const [intentResult, elementsResult] = await Promise.all([
            this.recognize(text, dataInfo),
            this.analyzeElements(text)
        ]);
        
        const endTime = performance.now();
        
        return {
            ...intentResult,
            elements: elementsResult,
            responseTime: endTime - startTime
        };
    }
}

// 导出单例实例
const intentRecognizer = new IntentRecognizer();
export default intentRecognizer;
