// 数据分析技能
// 负责对数据进行统计分析和洞察生成

const dataAnalysisSkill = {
    info: {
        name: 'dataAnalysis',
        displayName: '数据分析',
        description: '对数据进行统计分析，生成关键指标和洞察',
        version: '1.0.0',
        author: 'AI Assistant'
    },
    
    // 执行数据分析
    async execute(data, options = {}) {
        try {
            const analysisResult = this.analyzeData(data, options);
            
            return {
                success: true,
                data: analysisResult,
                message: '数据分析完成',
                details: {
                    analysisType: options.analysisType || 'comprehensive',
                    metricsCount: Object.keys(analysisResult.metrics).length
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // 分析数据
    analyzeData(data, options) {
        const analysisResult = {
            metrics: {},
            insights: [],
            recommendations: []
        };
        
        // 计算基本统计指标
        analysisResult.metrics = this.calculateMetrics(data);
        
        // 生成洞察
        analysisResult.insights = this.generateInsights(data, analysisResult.metrics);
        
        // 生成建议
        analysisResult.recommendations = this.generateRecommendations(data, analysisResult.metrics);
        
        return analysisResult;
    },
    
    // 计算统计指标
    calculateMetrics(data) {
        if (!data || data.length === 0) {
            return {};
        }
        
        const metrics = {};
        const columns = Object.keys(data[0]);
        
        columns.forEach(column => {
            const values = data.map(item => item[column]).filter(val => val !== '' && val !== null && val !== undefined);
            const numericValues = values.filter(val => !isNaN(parseFloat(val))).map(val => parseFloat(val));
            
            metrics[column] = {
                count: values.length,
                missing: data.length - values.length,
                unique: new Set(values).size,
                numeric: numericValues.length > 0
            };
            
            if (numericValues.length > 0) {
                metrics[column].mean = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
                metrics[column].min = Math.min(...numericValues);
                metrics[column].max = Math.max(...numericValues);
                metrics[column].sum = numericValues.reduce((sum, val) => sum + val, 0);
            }
        });
        
        return metrics;
    },
    
    // 生成洞察
    generateInsights(data, metrics) {
        const insights = [];
        
        // 数据质量洞察
        Object.entries(metrics).forEach(([column, stats]) => {
            if (stats.missing > 0) {
                insights.push(`列 "${column}" 存在 ${stats.missing} 个缺失值，占比 ${((stats.missing / (stats.count + stats.missing)) * 100).toFixed(2)}%`);
            }
        });
        
        // 数据分布洞察
        Object.entries(metrics).forEach(([column, stats]) => {
            if (stats.numeric) {
                const range = stats.max - stats.min;
                insights.push(`列 "${column}" 的数值范围为 ${stats.min} 到 ${stats.max}，平均值为 ${stats.mean.toFixed(2)}`);
            }
        });
        
        return insights;
    },
    
    // 生成建议
    generateRecommendations(data, metrics) {
        const recommendations = [];
        
        // 数据清洗建议
        Object.entries(metrics).forEach(([column, stats]) => {
            if (stats.missing > 0) {
                recommendations.push(`建议处理列 "${column}" 中的缺失值，可考虑填充或删除`);
            }
        });
        
        // 分析建议
        Object.entries(metrics).forEach(([column, stats]) => {
            if (stats.numeric && stats.count > 10) {
                recommendations.push(`建议对列 "${column}" 进行趋势分析和异常值检测`);
            }
        });
        
        return recommendations;
    }
};

export default dataAnalysisSkill;