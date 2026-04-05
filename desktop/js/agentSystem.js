/**
 * Agent架构模块 - V4.0
 * 功能：实现分层Agent架构，将功能按职责拆分为专门的Agent
 * 
 * Agent类型：
 * 1. AnalysisAgent - 数据分析Agent：负责查询、聚合、筛选、统计
 * 2. ChartAgent - 图表Agent：负责图表推荐、配置生成
 * 3. ExplanationAgent - 解释Agent：负责结果解读、洞察生成
 * 4. PlanningAgent - 规划Agent：负责执行计划生成
 */

// ========== 基础Agent类 ==========
class BaseAgent {
    constructor(name, capabilities) {
        this.name = name;
        this.capabilities = capabilities;
        this.status = 'idle';
        this.lastExecution = null;
    }

    /**
     * 执行Agent任务（子类实现）
     * @param {Object} context - 执行上下文
     * @returns {Promise<Object>} 执行结果
     */
    async execute(context) {
        throw new Error('子类必须实现execute方法');
    }

    /**
     * 检查是否有能力执行
     * @param {string} capability - 能力名称
     * @returns {boolean}
     */
    hasCapability(capability) {
        return this.capabilities.includes(capability);
    }

    /**
     * 记录执行日志
     * @param {string} message - 日志消息
     * @param {string} level - 日志级别
     */
    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}][${this.name}] ${message}`);
    }
}

// ========== 分析Agent ==========
class AnalysisAgent extends BaseAgent {
    constructor() {
        super('分析Agent', [
            'query',         // 查询数据
            'aggregate',     // 聚合统计
            'filter',        // 筛选数据
            'sort',          // 排序
            'group',         // 分组
            'calculate'      // 计算
        ]);
    }

    /**
     * 执行分析任务
     * @param {Object} context - 执行上下文
     * @returns {Promise<Object>} 分析结果
     */
    async execute(context) {
        this.status = 'running';
        this.log('开始执行分析任务');
        
        const { config, data, headers } = context;
        const { queryType, valueColumn, groupColumn, aggregateFunction, filter, order, limit } = config;
        
        let result = {
            success: false,
            data: null,
            summary: '',
            insights: []
        };
        
        try {
            switch (queryType) {
                case 'find_max':
                case 'find_min':
                    result = this.findExtreme(data, headers, valueColumn, queryType);
                    break;
                    
                case 'find_top':
                    result = this.findTop(data, headers, valueColumn, limit, order);
                    break;
                    
                case 'group_aggregate':
                    result = this.groupAggregate(data, headers, groupColumn, valueColumn, aggregateFunction);
                    break;
                    
                case 'group_aggregate_find':
                    result = this.groupAggregateFind(data, headers, groupColumn, valueColumn, aggregateFunction, order);
                    break;
                    
                case 'group_count_find':
                    result = this.groupCountFind(data, headers, groupColumn, order);
                    break;
                    
                case 'filter':
                    result = this.filterData(data, headers, filter);
                    break;
                    
                case 'aggregate':
                    result = this.aggregate(data, headers, valueColumn, aggregateFunction);
                    break;
                    
                default:
                    result = await this.genericAnalysis(data, headers, config);
            }
            
            result.success = true;
            this.status = 'completed';
            this.log('分析任务完成');
            
        } catch (error) {
            result.success = false;
            result.error = error.message;
            this.status = 'failed';
            this.log(`分析任务失败: ${error.message}`, 'error');
        }
        
        this.lastExecution = { timestamp: Date.now(), config, result };
        return result;
    }

    /**
     * 查找极值
     */
    findExtreme(data, headers, valueColumn, queryType) {
        const parseNumeric = (v) => {
            if (v === null || v === undefined || v === '') return NaN;
            return parseFloat(String(v).replace(/,/g, '').replace(/[￥$€£%]/g, ''));
        };
        
        let targetValue = queryType === 'find_max' ? -Infinity : Infinity;
        let targetRow = null;
        
        for (const row of data) {
            const val = parseNumeric(row[valueColumn]);
            if (isNaN(val)) continue;
            
            if (queryType === 'find_max' && val > targetValue) {
                targetValue = val;
                targetRow = row;
            } else if (queryType === 'find_min' && val < targetValue) {
                targetValue = val;
                targetRow = row;
            }
        }
        
        return {
            data: targetRow,
            value: targetValue,
            summary: `${valueColumn}${queryType === 'find_max' ? '最大' : '最小'}值为${targetValue}`,
            insights: [`${targetRow ? Object.entries(targetRow).map(([k, v]) => `${k}: ${v}`).join(', ') : '未找到'}`]
        };
    }

    /**
     * 查找Top N
     */
    findTop(data, headers, valueColumn, limit = 5, order = 'desc') {
        const parseNumeric = (v) => {
            if (v === null || v === undefined || v === '') return NaN;
            return parseFloat(String(v).replace(/,/g, '').replace(/[￥$€£%]/g, ''));
        };
        
        const sorted = [...data]
            .map(row => ({ row, value: parseNumeric(row[valueColumn]) }))
            .filter(item => !isNaN(item.value))
            .sort((a, b) => order === 'desc' ? b.value - a.value : a.value - b.value)
            .slice(0, limit);
        
        return {
            data: sorted.map(s => s.row),
            values: sorted.map(s => s.value),
            summary: `${valueColumn}${order === 'desc' ? '最大' : '最小'}的前${limit}名`,
            insights: sorted.map((s, i) => `第${i + 1}名: ${s.value}`)
        };
    }

    /**
     * 分组聚合
     */
    groupAggregate(data, headers, groupColumn, valueColumn, aggregateFunction = 'sum') {
        const parseNumeric = (v) => {
            if (v === null || v === undefined || v === '') return 0;
            const num = parseFloat(String(v).replace(/,/g, '').replace(/[￥$€£%]/g, ''));
            return isNaN(num) ? 0 : num;
        };
        
        const groups = {};
        
        for (const row of data) {
            const key = row[groupColumn] || '未知';
            const val = parseNumeric(row[valueColumn]);
            
            if (!groups[key]) {
                groups[key] = { sum: 0, count: 0, values: [] };
            }
            groups[key].sum += val;
            groups[key].count += 1;
            groups[key].values.push(val);
        }
        
        const results = Object.entries(groups).map(([group, stats]) => {
            let value;
            switch (aggregateFunction) {
                case 'sum':
                    value = stats.sum;
                    break;
                case 'avg':
                    value = stats.sum / stats.count;
                    break;
                case 'count':
                    value = stats.count;
                    break;
                case 'max':
                    value = Math.max(...stats.values);
                    break;
                case 'min':
                    value = Math.min(...stats.values);
                    break;
                default:
                    value = stats.sum;
            }
            return { group, value, count: stats.count };
        });
        
        return {
            data: results,
            summary: `按${groupColumn}分组，${aggregateFunction === 'sum' ? '求和' : aggregateFunction === 'avg' ? '平均' : aggregateFunction === 'count' ? '计数' : aggregateFunction}${valueColumn}`,
            insights: results.slice(0, 5).map(r => `${r.group}: ${r.value.toFixed(2)}`)
        };
    }

    /**
     * 分组聚合后找极值
     */
    groupAggregateFind(data, headers, groupColumn, valueColumn, aggregateFunction, order) {
        const aggResult = this.groupAggregate(data, headers, groupColumn, valueColumn, aggregateFunction);
        
        // 排序找极值
        const sorted = [...aggResult.data].sort((a, b) => 
            order === 'desc' ? b.value - a.value : a.value - b.value
        );
        
        const top = sorted[0];
        
        return {
            data: sorted,
            top,
            summary: `${groupColumn}中${valueColumn}${order === 'desc' ? '最多' : '最少'}的是${top.group}，值为${top.value.toFixed(2)}`,
            insights: [`第一名: ${top.group} (${top.value.toFixed(2)})`, ...sorted.slice(1, 4).map((r, i) => `第${i + 2}名: ${r.group} (${r.value.toFixed(2)})`)]
        };
    }

    /**
     * 分组计数后找极值
     */
    groupCountFind(data, headers, groupColumn, order) {
        const groups = {};
        
        for (const row of data) {
            const key = row[groupColumn] || '未知';
            groups[key] = (groups[key] || 0) + 1;
        }
        
        const results = Object.entries(groups)
            .map(([group, count]) => ({ group, count }))
            .sort((a, b) => order === 'desc' ? b.count - a.count : a.count - b.count);
        
        const top = results[0];
        
        return {
            data: results,
            top,
            summary: `${groupColumn}中数量${order === 'desc' ? '最多' : '最少'}的是${top.group}，共${top.count}条`,
            insights: [`第一名: ${top.group} (${top.count}条)`, ...results.slice(1, 4).map((r, i) => `第${i + 2}名: ${r.group} (${r.count}条)`)]
        };
    }

    /**
     * 筛选数据
     */
    filterData(data, headers, filter) {
        // 简单筛选实现
        let filtered = data;
        
        if (filter && filter.column && filter.value) {
            filtered = data.filter(row => {
                const val = String(row[filter.column] || '').toLowerCase();
                const target = String(filter.value).toLowerCase();
                return val.includes(target);
            });
        }
        
        return {
            data: filtered,
            count: filtered.length,
            summary: `筛选后共${filtered.length}条数据`,
            insights: [`原始数据: ${data.length}条`, `筛选后: ${filtered.length}条`]
        };
    }

    /**
     * 聚合统计
     */
    aggregate(data, headers, valueColumn, aggregateFunction) {
        const parseNumeric = (v) => {
            if (v === null || v === undefined || v === '') return NaN;
            return parseFloat(String(v).replace(/,/g, '').replace(/[￥$€£%]/g, ''));
        };
        
        const values = data.map(row => parseNumeric(row[valueColumn])).filter(v => !isNaN(v));
        
        if (values.length === 0) {
            return { value: null, summary: '无有效数据' };
        }
        
        let result;
        const sum = values.reduce((a, b) => a + b, 0);
        
        switch (aggregateFunction) {
            case 'sum':
                result = sum;
                break;
            case 'avg':
                result = sum / values.length;
                break;
            case 'count':
                result = values.length;
                break;
            case 'max':
                result = Math.max(...values);
                break;
            case 'min':
                result = Math.min(...values);
                break;
            default:
                result = sum;
        }
        
        return {
            value: result,
            summary: `${valueColumn}的${aggregateFunction === 'sum' ? '总和' : aggregateFunction === 'avg' ? '平均值' : aggregateFunction === 'count' ? '数量' : aggregateFunction}为${typeof result === 'number' ? result.toFixed(2) : result}`,
            insights: [`有效数据: ${values.length}条`]
        };
    }

    /**
     * 通用分析
     */
    async genericAnalysis(data, headers, config) {
        return {
            data: data.slice(0, 100),
            summary: `返回前100条数据`,
            insights: [`总数据量: ${data.length}条`]
        };
    }
}

// ========== 图表Agent ==========
class ChartAgent extends BaseAgent {
    constructor() {
        super('图表Agent', [
            'recommend',     // 推荐图表
            'generate',      // 生成图表配置
            'customize',     // 自定义图表
            'convert'        // 图表类型转换
        ]);
    }

    /**
     * 执行图表任务
     * @param {Object} context - 执行上下文
     * @returns {Promise<Object>} 图表配置
     */
    async execute(context) {
        this.status = 'running';
        this.log('开始执行图表任务');
        
        const { action, dataProfile, analysisResult, userPreference } = context;
        
        let result = {
            success: false,
            charts: [],
            recommendations: []
        };
        
        try {
            switch (action) {
                case 'recommend':
                    result = this.recommendCharts(dataProfile);
                    break;
                    
                case 'generate':
                    result = this.generateChartConfig(analysisResult, userPreference);
                    break;
                    
                case 'customize':
                    result = this.customizeChart(context);
                    break;
                    
                default:
                    result = this.recommendCharts(dataProfile);
            }
            
            result.success = true;
            this.status = 'completed';
            this.log('图表任务完成');
            
        } catch (error) {
            result.success = false;
            result.error = error.message;
            this.status = 'failed';
            this.log(`图表任务失败: ${error.message}`, 'error');
        }
        
        this.lastExecution = { timestamp: Date.now(), context, result };
        return result;
    }

    /**
     * 推荐图表
     */
    recommendCharts(dataProfile) {
        const recommendations = [];
        
        if (!dataProfile || !dataProfile.schema) {
            return { charts: [], recommendations: [] };
        }
        
        const { schema, columns } = dataProfile;
        
        // 时间序列 → 折线图
        if (schema.dateCols.length > 0 && schema.numericCols.length > 0) {
            recommendations.push({
                type: 'line',
                priority: 1,
                title: '趋势分析',
                config: {
                    xAxis: schema.dateCols[0],
                    yAxis: schema.numericCols[0],
                    smooth: true
                },
                reason: '时间序列数据适合用折线图展示趋势变化'
            });
        }
        
        // 分类数据 → 柱状图
        if (schema.categoricalCols.length > 0 && schema.numericCols.length > 0) {
            recommendations.push({
                type: 'bar',
                priority: 2,
                title: '分类对比',
                config: {
                    xAxis: schema.categoricalCols[0],
                    yAxis: schema.numericCols[0]
                },
                reason: '分类数据适合用柱状图进行对比分析'
            });
        }
        
        // 少量分类 → 饼图
        if (schema.categoricalCols.length > 0) {
            const catCol = schema.categoricalCols[0];
            const catProfile = columns[catCol];
            if (catProfile && catProfile.uniqueCount <= 8 && schema.numericCols.length > 0) {
                recommendations.push({
                    type: 'pie',
                    priority: 3,
                    title: '占比分布',
                    config: {
                        label: catCol,
                        value: schema.numericCols[0]
                    },
                    reason: '类别较少时适合用饼图展示占比'
                });
            }
        }
        
        // 多个数值列 → 散点图
        if (schema.numericCols.length >= 2) {
            recommendations.push({
                type: 'scatter',
                priority: 4,
                title: '相关性分析',
                config: {
                    xAxis: schema.numericCols[0],
                    yAxis: schema.numericCols[1]
                },
                reason: '两个数值列可以用散点图分析相关性'
            });
        }
        
        // 按优先级排序
        recommendations.sort((a, b) => a.priority - b.priority);
        
        return {
            charts: [],
            recommendations,
            summary: `根据数据特征推荐${recommendations.length}种图表类型`
        };
    }

    /**
     * 生成图表配置
     */
    generateChartConfig(analysisResult, userPreference) {
        if (!analysisResult || !analysisResult.data) {
            return { charts: [], error: '无分析结果' };
        }
        
        const { data } = analysisResult;
        const charts = [];
        
        // 根据数据结构生成图表配置
        if (Array.isArray(data) && data.length > 0) {
            const firstItem = data[0];
            
            // 如果有group和value字段，生成柱状图
            if (firstItem.group !== undefined && firstItem.value !== undefined) {
                charts.push({
                    type: 'bar',
                    title: analysisResult.summary || '数据分析结果',
                    config: {
                        labels: data.map(d => d.group),
                        datasets: [{
                            label: '数值',
                            data: data.map(d => d.value),
                            backgroundColor: 'rgba(102, 126, 234, 0.6)',
                            borderColor: 'rgba(102, 126, 234, 1)',
                            borderWidth: 1
                        }]
                    }
                });
            }
            
            // 如果有group和count字段，生成柱状图
            if (firstItem.group !== undefined && firstItem.count !== undefined) {
                charts.push({
                    type: 'bar',
                    title: analysisResult.summary || '数据分析结果',
                    config: {
                        labels: data.map(d => d.group),
                        datasets: [{
                            label: '数量',
                            data: data.map(d => d.count),
                            backgroundColor: 'rgba(76, 175, 80, 0.6)',
                            borderColor: 'rgba(76, 175, 80, 1)',
                            borderWidth: 1
                        }]
                    }
                });
            }
        }
        
        return {
            charts,
            summary: `生成${charts.length}个图表配置`
        };
    }

    /**
     * 自定义图表
     */
    customizeChart(context) {
        const { baseChart, customizations } = context;
        
        // 应用自定义配置
        const customized = { ...baseChart };
        
        if (customizations) {
            if (customizations.title) {
                customized.title = customizations.title;
            }
            if (customizations.colors) {
                customized.config.datasets.forEach((ds, i) => {
                    ds.backgroundColor = customizations.colors[i] || ds.backgroundColor;
                });
            }
        }
        
        return {
            charts: [customized],
            summary: '图表已自定义'
        };
    }
}

// ========== 解释Agent ==========
class ExplanationAgent extends BaseAgent {
    constructor() {
        super('解释Agent', [
            'summarize',     // 总结结果
            'insight',       // 生成洞察
            'suggest',       // 提供建议
            'translate'      // 翻译技术术语
        ]);
    }

    /**
     * 执行解释任务
     * @param {Object} context - 执行上下文
     * @returns {Promise<Object>} 解释结果
     */
    async execute(context) {
        this.status = 'running';
        this.log('开始执行解释任务');
        
        const { action, analysisResult, dataProfile, userInput } = context;
        
        let result = {
            success: false,
            explanation: '',
            insights: [],
            suggestions: []
        };
        
        try {
            switch (action) {
                case 'summarize':
                    result = this.summarizeResult(analysisResult, dataProfile);
                    break;
                    
                case 'insight':
                    result = this.generateInsights(analysisResult, dataProfile);
                    break;
                    
                case 'suggest':
                    result = this.generateSuggestions(analysisResult, dataProfile);
                    break;
                    
                default:
                    result = this.fullExplanation(analysisResult, dataProfile, userInput);
            }
            
            result.success = true;
            this.status = 'completed';
            this.log('解释任务完成');
            
        } catch (error) {
            result.success = false;
            result.error = error.message;
            this.status = 'failed';
            this.log(`解释任务失败: ${error.message}`, 'error');
        }
        
        this.lastExecution = { timestamp: Date.now(), context, result };
        return result;
    }

    /**
     * 总结结果
     */
    summarizeResult(analysisResult, dataProfile) {
        if (!analysisResult) {
            return { explanation: '暂无分析结果' };
        }
        
        const parts = [];
        
        // 添加数据概况
        if (dataProfile && dataProfile.summary) {
            parts.push(`📊 数据概况：${dataProfile.summary}`);
        }
        
        // 添加分析结果
        if (analysisResult.summary) {
            parts.push(`📈 分析结果：${analysisResult.summary}`);
        }
        
        // 添加关键发现
        if (analysisResult.insights && analysisResult.insights.length > 0) {
            parts.push(`🔍 关键发现：\n${analysisResult.insights.map((i, idx) => `  ${idx + 1}. ${i}`).join('\n')}`);
        }
        
        return {
            explanation: parts.join('\n\n'),
            insights: analysisResult.insights || [],
            summary: analysisResult.summary
        };
    }

    /**
     * 生成洞察
     */
    generateInsights(analysisResult, dataProfile) {
        const insights = [];
        
        if (!analysisResult || !analysisResult.data) {
            return { insights: ['数据量不足，无法生成洞察'] };
        }
        
        const { data, top } = analysisResult;
        
        // 极值洞察
        if (top) {
            insights.push(`🏆 最显著的是"${top.group}"，数值为${typeof top.value === 'number' ? top.value.toFixed(2) : top.value || top.count}`);
        }
        
        // 分布洞察
        if (Array.isArray(data) && data.length > 1) {
            const values = data.map(d => d.value || d.count).filter(v => typeof v === 'number');
            if (values.length > 0) {
                const max = Math.max(...values);
                const min = Math.min(...values);
                const avg = values.reduce((a, b) => a + b, 0) / values.length;
                
                insights.push(`📊 数值范围：${min.toFixed(2)} ~ ${max.toFixed(2)}，平均值：${avg.toFixed(2)}`);
                
                // 集中度分析
                const top3Sum = values.slice(0, 3).reduce((a, b) => a + b, 0);
                const total = values.reduce((a, b) => a + b, 0);
                const concentration = (top3Sum / total * 100).toFixed(1);
                
                if (concentration > 50) {
                    insights.push(`⚡ 前3名占比${concentration}%，集中度较高`);
                }
            }
        }
        
        return {
            insights,
            explanation: insights.join('\n')
        };
    }

    /**
     * 生成建议
     */
    generateSuggestions(analysisResult, dataProfile) {
        const suggestions = [];
        
        if (!analysisResult) {
            return { suggestions: ['请先进行数据分析'] };
        }
        
        const { data, top } = analysisResult;
        
        // 基于结果的行动建议
        if (top) {
            suggestions.push(`💡 建议：重点关注"${top.group}"，它是表现最突出的类别`);
        }
        
        // 数据质量建议
        if (dataProfile && dataProfile.quality) {
            if (dataProfile.quality.completeness < 90) {
                suggestions.push(`⚠️ 数据完整度${dataProfile.quality.completeness}%，建议检查缺失值`);
            }
        }
        
        // 后续分析建议
        suggestions.push(`📌 可以尝试：查看详细数据、生成图表、进行对比分析`);
        
        return {
            suggestions,
            explanation: suggestions.join('\n')
        };
    }

    /**
     * 完整解释
     */
    fullExplanation(analysisResult, dataProfile, userInput) {
        const summary = this.summarizeResult(analysisResult, dataProfile);
        const insights = this.generateInsights(analysisResult, dataProfile);
        const suggestions = this.generateSuggestions(analysisResult, dataProfile);
        
        return {
            explanation: [summary.explanation, insights.explanation, suggestions.explanation].filter(Boolean).join('\n\n---\n\n'),
            insights: [...summary.insights, ...insights.insights],
            suggestions: suggestions.suggestions,
            summary: summary.summary
        };
    }
}

// ========== 规划Agent ==========
class PlanningAgent extends BaseAgent {
    constructor() {
        super('规划Agent', [
            'plan',          // 生成执行计划
            'decompose',     // 分解复杂任务
            'validate',      // 验证计划可行性
            'optimize'       // 优化执行顺序
        ]);
    }

    /**
     * 执行规划任务
     * @param {Object} context - 执行上下文
     * @returns {Promise<Object>} 执行计划
     */
    async execute(context) {
        this.status = 'running';
        this.log('开始执行规划任务');
        
        const { action, userInput, dataProfile, config } = context;
        
        let result = {
            success: false,
            plan: null,
            steps: []
        };
        
        try {
            switch (action) {
                case 'plan':
                    result = this.generatePlan(userInput, dataProfile, config);
                    break;
                    
                case 'decompose':
                    result = this.decomposeTask(userInput, dataProfile);
                    break;
                    
                default:
                    result = this.generatePlan(userInput, dataProfile, config);
            }
            
            result.success = true;
            this.status = 'completed';
            this.log('规划任务完成');
            
        } catch (error) {
            result.success = false;
            result.error = error.message;
            this.status = 'failed';
            this.log(`规划任务失败: ${error.message}`, 'error');
        }
        
        this.lastExecution = { timestamp: Date.now(), context, result };
        return result;
    }

    /**
     * 生成执行计划
     */
    generatePlan(userInput, dataProfile, config) {
        const steps = [];
        let estimatedTime = 0;
        
        if (!config) {
            return { plan: null, steps: [], error: '缺少配置信息' };
        }
        
        const { queryType, valueColumn, groupColumn, aggregateFunction, order, limit } = config;
        
        // 根据查询类型生成步骤
        switch (queryType) {
            case 'find_max':
            case 'find_min':
                steps.push({
                    step: 1,
                    action: '数据准备',
                    description: `解析${valueColumn}列的数值`,
                    detail: '处理千分位、货币符号等格式',
                    estimatedMs: 50
                });
                steps.push({
                    step: 2,
                    action: '极值查找',
                    description: `查找${valueColumn}的${queryType === 'find_max' ? '最大' : '最小'}值`,
                    detail: `遍历${dataProfile?.shape?.rows || '所有'}行数据`,
                    estimatedMs: 100
                });
                steps.push({
                    step: 3,
                    action: '结果展示',
                    description: '显示目标记录和数值',
                    detail: '包含完整行数据',
                    estimatedMs: 30
                });
                break;
                
            case 'group_aggregate_find':
                steps.push({
                    step: 1,
                    action: '数据分组',
                    description: `按${groupColumn}分组`,
                    detail: `统计各${groupColumn}的数据`,
                    estimatedMs: 100
                });
                steps.push({
                    step: 2,
                    action: '聚合计算',
                    description: `对${valueColumn}进行${this.getAggregationName(aggregateFunction)}运算`,
                    detail: `${aggregateFunction === 'sum' ? '求和' : aggregateFunction === 'avg' ? '平均' : '统计'}各组的${valueColumn}`,
                    estimatedMs: 80
                });
                steps.push({
                    step: 3,
                    action: '排序筛选',
                    description: `按数值${order === 'desc' ? '降序' : '升序'}排列`,
                    detail: `找出${order === 'desc' ? '最大' : '最小'}的组`,
                    estimatedMs: 30
                });
                steps.push({
                    step: 4,
                    action: '结果展示',
                    description: '显示排名和详细数据',
                    detail: '包含各组排名和数值',
                    estimatedMs: 50
                });
                break;
                
            case 'group_count_find':
                steps.push({
                    step: 1,
                    action: '数据分组',
                    description: `按${groupColumn}分组`,
                    detail: '统计各组的记录数',
                    estimatedMs: 80
                });
                steps.push({
                    step: 2,
                    action: '计数统计',
                    description: '计算各组的数量',
                    detail: `统计各${groupColumn}的出现次数`,
                    estimatedMs: 50
                });
                steps.push({
                    step: 3,
                    action: '排序筛选',
                    description: `按数量${order === 'desc' ? '降序' : '升序'}排列`,
                    detail: `找出数量${order === 'desc' ? '最多' : '最少'}的组`,
                    estimatedMs: 30
                });
                steps.push({
                    step: 4,
                    action: '结果展示',
                    description: '显示排名和统计数据',
                    detail: '包含各组排名和数量',
                    estimatedMs: 40
                });
                break;
                
            default:
                steps.push({
                    step: 1,
                    action: '数据处理',
                    description: '准备数据',
                    detail: '解析和转换数据格式',
                    estimatedMs: 100
                });
                steps.push({
                    step: 2,
                    action: '执行查询',
                    description: '执行分析操作',
                    detail: '根据配置执行相应操作',
                    estimatedMs: 200
                });
                steps.push({
                    step: 3,
                    action: '结果展示',
                    description: '展示分析结果',
                    detail: '格式化输出结果',
                    estimatedMs: 50
                });
        }
        
        // 计算预估时间
        estimatedTime = steps.reduce((sum, s) => sum + s.estimatedMs, 0);
        
        return {
            plan: {
                queryType,
                totalSteps: steps.length,
                estimatedTime,
                complexity: steps.length <= 2 ? 'simple' : steps.length <= 4 ? 'medium' : 'complex'
            },
            steps,
            summary: `将执行${steps.length}个步骤，预计耗时${estimatedTime}ms`
        };
    }

    /**
     * 分解复杂任务
     */
    decomposeTask(userInput, dataProfile) {
        // 检测是否为复合查询
        const complexPatterns = [
            { pattern: /先.*再|然后.*最后/, type: 'sequential' },
            { pattern: /同时|并且|以及/, type: 'parallel' },
            { pattern: /对比|比较/, type: 'comparison' }
        ];
        
        for (const { pattern, type } of complexPatterns) {
            if (pattern.test(userInput)) {
                return {
                    type,
                    subtasks: this.extractSubtasks(userInput, type),
                    summary: `检测到${type === 'sequential' ? '顺序' : type === 'parallel' ? '并行' : '对比'}任务`
                };
            }
        }
        
        return {
            type: 'simple',
            subtasks: [{ description: userInput }],
            summary: '单一任务，无需分解'
        };
    }

    /**
     * 提取子任务
     */
    extractSubtasks(userInput, type) {
        // 简单的分词提取
        const separators = ['先', '再', '然后', '最后', '同时', '并且', '以及'];
        let remaining = userInput;
        const subtasks = [];
        
        for (const sep of separators) {
            const parts = remaining.split(sep);
            if (parts.length > 1) {
                if (parts[0].trim()) {
                    subtasks.push({ description: parts[0].trim() });
                }
                remaining = parts.slice(1).join(sep);
            }
        }
        
        if (remaining.trim()) {
            subtasks.push({ description: remaining.trim() });
        }
        
        return subtasks.length > 0 ? subtasks : [{ description: userInput }];
    }

    /**
     * 获取聚合函数名称
     */
    getAggregationName(func) {
        const names = {
            sum: '求和',
            avg: '平均',
            count: '计数',
            max: '最大值',
            min: '最小值'
        };
        return names[func] || func;
    }
}

// ========== Agent调度器 ==========
class AgentRouter {
    constructor() {
        this.agents = {
            analysis: new AnalysisAgent(),
            chart: new ChartAgent(),
            explanation: new ExplanationAgent(),
            planning: new PlanningAgent()
        };
        
        this.executionHistory = [];
    }

    /**
     * 路由到合适的Agent
     * @param {string} agentType - Agent类型
     * @param {Object} context - 执行上下文
     * @returns {Promise<Object>} 执行结果
     */
    async route(agentType, context) {
        const agent = this.agents[agentType];
        
        if (!agent) {
            throw new Error(`未知的Agent类型: ${agentType}`);
        }
        
        const startTime = Date.now();
        const result = await agent.execute(context);
        const duration = Date.now() - startTime;
        
        // 记录执行历史
        this.executionHistory.push({
            agent: agentType,
            timestamp: startTime,
            duration,
            success: result.success
        });
        
        return {
            ...result,
            agent: agentType,
            duration
        };
    }

    /**
     * 执行完整流程
     * @param {Object} config - 查询配置
     * @param {Array} data - 数据
     * @param {Array} headers - 列名
     * @param {Object} dataProfile - 数据画像
     * @returns {Promise<Object>} 完整结果
     */
    async executeFullPipeline(config, data, headers, dataProfile) {
        const results = {};
        
        // 1. 生成执行计划
        results.plan = await this.route('planning', {
            action: 'plan',
            userInput: config.userInput,
            dataProfile,
            config
        });
        
        // 2. 执行分析
        results.analysis = await this.route('analysis', {
            config,
            data,
            headers
        });
        
        // 3. 生成图表配置
        results.chart = await this.route('chart', {
            action: 'generate',
            analysisResult: results.analysis,
            dataProfile
        });
        
        // 4. 生成解释
        results.explanation = await this.route('explanation', {
            action: 'summarize',
            analysisResult: results.analysis,
            dataProfile,
            userInput: config.userInput
        });
        
        return {
            success: results.analysis?.success || false,
            plan: results.plan,
            analysis: results.analysis,
            chart: results.chart,
            explanation: results.explanation,
            totalDuration: Object.values(results).reduce((sum, r) => sum + (r.duration || 0), 0)
        };
    }

    /**
     * 获取Agent状态
     */
    getAgentStatus() {
        return Object.entries(this.agents).map(([type, agent]) => ({
            type,
            name: agent.name,
            status: agent.status,
            capabilities: agent.capabilities,
            lastExecution: agent.lastExecution?.timestamp
        }));
    }

    /**
     * 获取执行历史
     */
    getExecutionHistory(limit = 10) {
        return this.executionHistory.slice(-limit);
    }
}

// 导出单例
const agentRouter = new AgentRouter();
export default agentRouter;

// 同时导出各个Agent类供单独使用
export { BaseAgent, AnalysisAgent, ChartAgent, ExplanationAgent, PlanningAgent, AgentRouter };
