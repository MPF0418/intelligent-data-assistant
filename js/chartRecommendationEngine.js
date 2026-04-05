/**
 * 图表推荐引擎
 * 统一管理图表推荐逻辑，供多个模块调用
 */

class ChartRecommendationEngine {
    constructor() {
        // 推荐策略配置
        this.recommendationStrategies = {
            timeSeries: {
                priority: 1,
                chartTypes: ['line'],
                condition: (dataFeatures) => {
                    return dataFeatures.dateColumns.length > 0 && dataFeatures.numericColumns.length > 0;
                }
            },
            categorical: {
                priority: 2,
                chartTypes: ['bar', 'pie'],
                condition: (dataFeatures) => {
                    return dataFeatures.categoricalColumns.length > 0 && dataFeatures.numericColumns.length > 0;
                }
            },
            numerical: {
                priority: 3,
                chartTypes: ['bar', 'scatter'],
                condition: (dataFeatures) => {
                    return dataFeatures.numericColumns.length >= 1;
                }
            }
        };
        
        // 缓存推荐结果
        this.cache = new Map();
        this.cacheSize = 100;
    }
    
    /**
     * 生成推荐图表
     * @param {Object} dataFeatures - 数据特征
     * @param {Object} options - 可选配置
     * @returns {Array} 推荐的图表配置
     */
    recommendCharts(dataFeatures, options = {}) {
        // 生成缓存键
        const cacheKey = this.generateCacheKey(dataFeatures, options);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const recommendations = [];
        
        // 按优先级执行推荐策略
        Object.entries(this.recommendationStrategies)
            .sort(([,a], [,b]) => a.priority - b.priority)
            .forEach(([strategy, config]) => {
                if (config.condition(dataFeatures)) {
                    const strategyRecommendations = this.generateRecommendations(strategy, dataFeatures, config);
                    recommendations.push(...strategyRecommendations);
                }
            });
        
        // 限制推荐数量
        const limitedRecommendations = recommendations.slice(0, options.limit || 5);
        
        // 缓存结果
        this.cache.set(cacheKey, limitedRecommendations);
        this.manageCache();
        
        return limitedRecommendations;
    }
    
    /**
     * 生成特定策略的推荐
     * @param {string} strategy - 策略名称
     * @param {Object} dataFeatures - 数据特征
     * @param {Object} config - 策略配置
     * @returns {Array} 推荐列表
     */
    generateRecommendations(strategy, dataFeatures, config) {
        const recommendations = [];
        
        config.chartTypes.forEach(chartType => {
            switch (chartType) {
                case 'line':
                    if (dataFeatures.dateColumns.length > 0 && dataFeatures.numericColumns.length > 0) {
                        recommendations.push({
                            type: 'line',
                            priority: config.priority,
                            title: '趋势分析',
                            config: {
                                xAxis: dataFeatures.dateColumns[0],
                                yAxis: dataFeatures.numericColumns.slice(0, 2),
                                smooth: true
                            },
                            reason: '时间序列数据适合用折线图展示趋势变化'
                        });
                    }
                    break;
                    
                case 'bar':
                    if (dataFeatures.categoricalColumns.length > 0 && dataFeatures.numericColumns.length > 0) {
                        recommendations.push({
                            type: 'bar',
                            priority: config.priority,
                            title: '分类对比',
                            config: {
                                xAxis: dataFeatures.categoricalColumns[0],
                                yAxis: dataFeatures.numericColumns[0]
                            },
                            reason: '分类数据适合用柱状图进行对比分析'
                        });
                    } else if (dataFeatures.numericColumns.length > 0) {
                        recommendations.push({
                            type: 'bar',
                            priority: config.priority + 1,
                            title: '数值分布',
                            config: {
                                xAxis: dataFeatures.numericColumns[0],
                                yAxis: 'count'
                            },
                            reason: '数值数据适合用柱状图展示分布'
                        });
                    }
                    break;
                    
                case 'pie':
                    if (dataFeatures.categoricalColumns.length > 0) {
                        const catCol = dataFeatures.categoricalColumns[0];
                        const catProfile = dataFeatures.columnProfiles?.[catCol];
                        if (catProfile && catProfile.uniqueCount <= 8 && dataFeatures.numericColumns.length > 0) {
                            recommendations.push({
                                type: 'pie',
                                priority: config.priority + 1,
                                title: '占比分布',
                                config: {
                                    label: catCol,
                                    value: dataFeatures.numericColumns[0]
                                },
                                reason: '类别较少时适合用饼图展示占比'
                            });
                        }
                    }
                    break;
                    
                case 'scatter':
                    if (dataFeatures.numericColumns.length >= 2) {
                        recommendations.push({
                            type: 'scatter',
                            priority: config.priority + 1,
                            title: '相关性分析',
                            config: {
                                xAxis: dataFeatures.numericColumns[0],
                                yAxis: dataFeatures.numericColumns[1]
                            },
                            reason: '两个数值列可以用散点图分析相关性'
                        });
                    }
                    break;
            }
        });
        
        return recommendations;
    }
    
    /**
     * 从数据生成特征
     * @param {Array} data - 数据数组
     * @param {Array} headers - 列名数组
     * @returns {Object} 数据特征
     */
    generateDataFeatures(data, headers) {
        const features = {
            rowCount: data.length,
            columnCount: headers.length,
            numericColumns: [],
            categoricalColumns: [],
            dateColumns: [],
            columnProfiles: {}
        };
        
        if (data.length === 0) {
            return features;
        }
        
        headers.forEach(col => {
            const profile = this.analyzeColumn(col, data);
            features.columnProfiles[col] = profile;
            
            if (profile.type === 'numeric') {
                features.numericColumns.push(col);
            } else if (profile.type === 'datetime') {
                features.dateColumns.push(col);
            } else if (profile.isCategorical) {
                features.categoricalColumns.push(col);
            }
        });
        
        return features;
    }
    
    /**
     * 分析列数据
     * @param {string} col - 列名
     * @param {Array} data - 数据数组
     * @returns {Object} 列信息
     */
    analyzeColumn(col, data) {
        const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined && v !== '');
        const nullCount = data.length - values.length;
        const uniqueValues = [...new Set(values)];
        const uniqueCount = uniqueValues.length;
        
        const typeInfo = this.inferColumnType(values);
        
        const profile = {
            name: col,
            type: typeInfo.type,
            totalCount: data.length,
            validCount: values.length,
            nullCount,
            uniqueCount,
            isCategorical: typeInfo.type === 'text' && uniqueCount <= 10 && uniqueCount < values.length * 0.5
        };
        
        return profile;
    }
    
    /**
     * 推断列类型
     * @param {Array} values - 值数组
     * @returns {Object} 类型信息
     */
    inferColumnType(values) {
        if (!values || values.length === 0) {
            return { type: 'unknown' };
        }
        
        const sampleSize = Math.min(values.length, 100);
        const samples = values.slice(0, sampleSize);
        
        const datePatterns = [
            /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
            /^\d{1,2}[-/]\d{1,2}[-/]\d{4}/,
            /^\d{4}年\d{1,2}月\d{1,2}日/
        ];
        
        let dateCount = 0;
        let numericCount = 0;
        
        samples.forEach(v => {
            const str = String(v).trim();
            
            if (datePatterns.some(p => p.test(str))) {
                dateCount++;
            }
            
            const num = parseFloat(str.replace(/,/g, '').replace(/[￥$€£%]/g, ''));
            if (!isNaN(num)) {
                numericCount++;
            }
        });
        
        if (dateCount > samples.length * 0.8) {
            return { type: 'datetime' };
        }
        
        if (numericCount > samples.length * 0.9) {
            return { type: 'numeric' };
        }
        
        return { type: 'text' };
    }
    
    /**
     * 生成缓存键
     * @param {Object} dataFeatures - 数据特征
     * @param {Object} options - 配置
     * @returns {string} 缓存键
     */
    generateCacheKey(dataFeatures, options) {
        const key = {
            numericColumns: dataFeatures.numericColumns.sort(),
            categoricalColumns: dataFeatures.categoricalColumns.sort(),
            dateColumns: dataFeatures.dateColumns.sort(),
            rowCount: dataFeatures.rowCount,
            limit: options.limit
        };
        return JSON.stringify(key);
    }
    
    /**
     * 管理缓存大小
     */
    manageCache() {
        if (this.cache.size > this.cacheSize) {
            const keys = Array.from(this.cache.keys());
            for (let i = 0; i < keys.length - this.cacheSize; i++) {
                this.cache.delete(keys[i]);
            }
        }
    }
    
    /**
     * 清除缓存
     */
    clearCache() {
        this.cache.clear();
    }
    
    /**
     * 获取缓存状态
     * @returns {Object} 缓存状态
     */
    getCacheStatus() {
        return {
            size: this.cache.size,
            maxSize: this.cacheSize
        };
    }
}

// 导出单例
const chartRecommendationEngine = new ChartRecommendationEngine();
export default chartRecommendationEngine;