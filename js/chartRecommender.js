// 图表智能推荐器 - 基于数据特征和意图类型的智能推荐引擎
// 功能：分析数据特征，推荐最适合的图表类型
// 响应时间：< 5ms
// 用户价值：用户说"可视化一下"即可生成最合适的图表

class ChartRecommender {
    constructor() {
        // 数据特征到图表类型的映射规则
        // 产品意义：根据数据的内在特征自动选择最佳可视化方式
        this.featureToChart = {
            // 时间序列数据 → 折线图（展示趋势变化）
            'timeSeries': { 
                chart: 'line', 
                reason: '展示时间序列趋势', 
                weight: 0.9,
                keywords: ['趋势', '变化', '走势', '随时间']
            },
            // 分类数据 → 柱状图（直观比较大小）
            'categorical': { 
                chart: 'bar', 
                reason: '直观比较分类数据', 
                weight: 0.85,
                keywords: ['对比', '比较', '排名']
            },
            // 占比数据 → 饼图（展示部分与整体关系）
            'proportional': { 
                chart: 'pie', 
                reason: '展示部分与整体关系', 
                weight: 0.8,
                keywords: ['占比', '比例', '分布', '份额']
            },
            // 相关性数据 → 散点图（分析变量间关系）
            'correlation': { 
                chart: 'scatter', 
                reason: '分析变量间相关性', 
                weight: 0.75,
                keywords: ['相关', '关系', '影响']
            },
            // 数值分布 → 柱状图或直方图
            'distribution': { 
                chart: 'bar', 
                reason: '展示数据分布情况', 
                weight: 0.7,
                keywords: ['分布', '频次']
            }
        };
        
        // 意图类型到图表类型的映射规则
        // 产品意义：根据用户的明确意图推荐对应图表
        this.intentToChart = {
            'CHART_BAR': [
                { chart: 'bar', reason: '用户明确要求柱状图', weight: 1.0 }
            ],
            'CHART_LINE': [
                { chart: 'line', reason: '用户明确要求折线图', weight: 1.0 }
            ],
            'CHART_PIE': [
                { chart: 'pie', reason: '用户明确要求饼图', weight: 1.0 }
            ],
            'CHART_SCATTER': [
                { chart: 'scatter', reason: '用户明确要求散点图', weight: 1.0 }
            ],
            // 聚合统计推荐柱状图或饼图
            'QUERY_AGGREGATE': [
                { chart: 'bar', reason: '适合分组对比', weight: 0.8 },
                { chart: 'pie', reason: '适合占比分析', weight: 0.7 }
            ],
            // 查找极值推荐柱状图（突出对比）
            'QUERY_FIND': [
                { chart: 'bar', reason: '突出极值对比', weight: 0.75 }
            ],
            // 排序推荐柱状图（有序展示）
            'QUERY_SORT': [
                { chart: 'bar', reason: '有序展示数据', weight: 0.7 }
            ],
            // 筛选推荐柱状图（对比筛选前后）
            'QUERY_FILTER': [
                { chart: 'bar', reason: '对比筛选结果', weight: 0.65 }
            ],
            // 通用图表推荐
            'CHART_GENERAL': [
                { chart: 'bar', reason: '通用对比图表', weight: 0.6 },
                { chart: 'pie', reason: '通用占比图表', weight: 0.5 }
            ]
        };
        
        // 列名关键词识别规则
        // 产品意义：快速识别数据列的类型（时间、分类、数值）
        this.columnKeywords = {
            // 时间列关键词
            timeColumns: ['日期', '时间', '年份', '月份', '季度', '周', '天', '年', '月', '日', 'timestamp', 'date', 'time'],
            // 分类列关键词
            categoricalColumns: ['省', '市', '区', '部门', '类别', '类型', '地区', '区域', '公司', '单位', '机构', '名称', '姓名', 'category', 'type', 'name'],
            // 数值列关键词
            valueColumns: ['金额', '数值', '数量', '时长', '分数', '销量', '额', '收入', '成本', '利润', '人数', '次数', '频率', 'value', 'amount', 'count', 'number']
        };
        
        // 推荐缓存（性能优化）
        this.recommendationCache = new Map();
        this.cacheMaxSize = 100;
    }
    
    /**
     * 推荐图表 - 核心方法
     * @param {Object} dataInfo - 数据信息 {columns, sampleData, rowCount}
     * @param {Object} intentResult - 意图识别结果
     * @param {String} userInput - 用户输入（可选，用于关键词匹配）
     * @returns {Array} 推荐的图表列表，按置信度降序排列
     * 
     * 用户价值：输入"可视化一下数据"，自动推荐最合适的 3 种图表
     */
    recommend(dataInfo, intentResult, userInput = '') {
        const startTime = performance.now();
        
        // 检查缓存（相同输入直接返回）
        const cacheKey = this.generateCacheKey(dataInfo, intentResult);
        if (this.recommendationCache.has(cacheKey)) {
            console.log('[ChartRecommender] 使用缓存推荐');
            return this.recommendationCache.get(cacheKey);
        }
        
        const recommendations = [];
        
        // 1. 分析数据特征
        const dataFeatures = this.analyzeDataFeatures(dataInfo);
        console.log('[ChartRecommender] 数据特征:', dataFeatures);
        
        // 2. 基于数据特征推荐
        for (const feature of dataFeatures) {
            const rec = this.featureToChart[feature];
            if (rec) {
                recommendations.push({
                    chartType: rec.chart,
                    reason: rec.reason,
                    confidence: rec.weight,
                    source: 'data_feature',
                    feature: feature
                });
            }
        }
        
        // 3. 基于意图推荐
        const intent = intentResult?.intent || 'CHART_GENERAL';
        const intentRecs = this.intentToChart[intent] || [];
        for (const rec of intentRecs) {
            recommendations.push({
                chartType: rec.chart,
                reason: rec.reason,
                confidence: rec.weight,
                source: 'intent_type'
            });
        }
        
        // 4. 基于用户输入关键词推荐
        if (userInput) {
            const keywordRec = this.matchUserKeywords(userInput);
            if (keywordRec) {
                // 如果已存在相同图表类型，更新置信度
                const existing = recommendations.find(r => r.chartType === keywordRec.chart);
                if (existing) {
                    existing.confidence = Math.max(existing.confidence, keywordRec.confidence);
                    existing.reason += '，' + keywordRec.reason;
                } else {
                    recommendations.push(keywordRec);
                }
            }
        }
        
        // 5. 去重并排序
        const finalRecommendations = this.deduplicateAndSort(recommendations);
        
        // 6. 添加到缓存
        if (this.recommendationCache.size >= this.cacheMaxSize) {
            // 清除最早的缓存
            const firstKey = this.recommendationCache.keys().next().value;
            this.recommendationCache.delete(firstKey);
        }
        this.recommendationCache.set(cacheKey, finalRecommendations);
        
        const endTime = performance.now();
        console.log(`[ChartRecommender] 推荐完成，耗时：${(endTime - startTime).toFixed(2)}ms`);
        
        return finalRecommendations;
    }
    
    /**
     * 分析数据特征
     * @param {Object} dataInfo - 数据信息
     * @returns {Array} 识别出的数据特征列表
     * 
     * 产品意义：理解数据的内在结构，为图表选择提供依据
     */
    analyzeDataFeatures(dataInfo) {
        const features = [];
        const { columns, sampleData = [] } = dataInfo || {};
        
        if (!columns || columns.length === 0) {
            return features;
        }
        
        // 检测时间序列特征
        const hasTimeColumn = columns.some(col => {
            const lowerCol = col.toLowerCase();
            return this.columnKeywords.timeColumns.some(kw => lowerCol.includes(kw.toLowerCase()));
        });
        if (hasTimeColumn) {
            features.push('timeSeries');
        }
        
        // 检测分类数据特征
        const hasCategoricalColumn = columns.some(col => {
            const lowerCol = col.toLowerCase();
            return this.columnKeywords.categoricalColumns.some(kw => lowerCol.includes(kw.toLowerCase()));
        });
        if (hasCategoricalColumn) {
            features.push('categorical');
        }
        
        // 检测数值数据特征
        const hasValueColumn = columns.some(col => {
            const lowerCol = col.toLowerCase();
            return this.columnKeywords.valueColumns.some(kw => lowerCol.includes(kw.toLowerCase()));
        });
        if (hasValueColumn) {
            features.push('value');
        }
        
        // 检测占比数据特征（有分组列和数值列）
        if (hasCategoricalColumn && hasValueColumn) {
            features.push('proportional');
        }
        
        // 检测相关性特征（至少 2 个数值列）
        const valueColumns = columns.filter(col => {
            const lowerCol = col.toLowerCase();
            return this.columnKeywords.valueColumns.some(kw => lowerCol.includes(kw.toLowerCase()));
        });
        if (valueColumns.length >= 2) {
            features.push('correlation');
        }
        
        // 检测分布特征（数值列 + 数据量较大）
        if (hasValueColumn && sampleData.length > 10) {
            features.push('distribution');
        }
        
        return features;
    }
    
    /**
     * 匹配用户输入关键词
     * @param {String} userInput - 用户输入
     * @returns {Object|null} 匹配的推荐结果
     * 
     * 产品意义：理解用户的明确需求，提供更精准的推荐
     */
    matchUserKeywords(userInput) {
        const lowerInput = userInput.toLowerCase();
        
        // 遍历所有关键词规则
        for (const [feature, config] of Object.entries(this.featureToChart)) {
            if (config.keywords && config.keywords.some(kw => lowerInput.includes(kw.toLowerCase()))) {
                return {
                    chartType: config.chart,
                    reason: `识别到关键词"${config.keywords.find(kw => lowerInput.includes(kw.toLowerCase()))}"`,
                    confidence: config.weight + 0.1, // 关键词匹配提高置信度
                    source: 'user_keyword',
                    feature: feature
                };
            }
        }
        
        return null;
    }
    
    /**
     * 去重并排序
     * @param {Array} recommendations - 推荐列表
     * @returns {Array} 去重排序后的推荐列表
     * 
     * 产品意义：确保推荐结果不重复，按推荐强度排序
     */
    deduplicateAndSort(recommendations) {
        const deduped = new Map();
        
        for (const rec of recommendations) {
            const existing = deduped.get(rec.chartType);
            if (!existing || existing.confidence < rec.confidence) {
                // 如果新推荐置信度更高，更新理由（合并理由）
                if (existing) {
                    rec.reason = existing.reason + '，' + rec.reason;
                }
                deduped.set(rec.chartType, rec);
            }
        }
        
        // 按置信度降序排序
        return Array.from(deduped.values())
            .sort((a, b) => b.confidence - a.confidence);
    }
    
    /**
     * 生成缓存键
     * @param {Object} dataInfo - 数据信息
     * @param {Object} intentResult - 意图识别结果
     * @returns {String} 缓存键
     */
    generateCacheKey(dataInfo, intentResult) {
        const columns = (dataInfo?.columns || []).sort().join(',');
        const intent = intentResult?.intent || 'none';
        return `${columns}|${intent}`;
    }
    
    /**
     * 清除缓存
     */
    clearCache() {
        this.recommendationCache.clear();
        console.log('[ChartRecommender] 缓存已清除');
    }
    
    /**
     * 获取推荐统计信息
     * @returns {Object} 统计信息
     */
    getStatistics() {
        return {
            cacheSize: this.recommendationCache.size,
            cacheMaxSize: this.cacheMaxSize,
            featureRules: Object.keys(this.featureToChart).length,
            intentRules: Object.keys(this.intentToChart).length
        };
    }
}

// 导出单例实例
const chartRecommender = new ChartRecommender();
export default chartRecommender;
