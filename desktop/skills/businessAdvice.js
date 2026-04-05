// 业务建议技能
// 负责基于数据分析结果生成业务建议

const businessAdviceSkill = {
    info: {
        name: 'businessAdvice',
        displayName: '业务建议',
        description: '基于数据分析结果生成有针对性的业务建议',
        version: '1.0.0',
        author: 'AI Assistant'
    },
    
    // 执行业务建议生成
    async execute(data, options = {}) {
        try {
            const adviceResult = this.generateBusinessAdvice(data, options);
            
            return {
                success: true,
                data: adviceResult,
                message: '业务建议生成完成',
                details: {
                    adviceCount: adviceResult.advice.length
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // 生成业务建议
    generateBusinessAdvice(data, options) {
        const adviceResult = {
            advice: [],
            priorities: []
        };
        
        // 分析数据特征
        const dataFeatures = this.analyzeDataFeatures(data);
        
        // 生成建议
        adviceResult.advice = this.generateAdvice(dataFeatures, options);
        
        // 优先级排序
        adviceResult.priorities = this.prioritizeAdvice(adviceResult.advice);
        
        return adviceResult;
    },
    
    // 分析数据特征
    analyzeDataFeatures(data) {
        const features = {
            rowCount: data.length,
            columnCount: data.length > 0 ? Object.keys(data[0]).length : 0,
            numericColumns: [],
            categoricalColumns: [],
            dateColumns: [],
            dataQuality: {
                missingValues: 0,
                duplicateRows: 0
            }
        };
        
        if (data.length === 0) {
            return features;
        }
        
        const columns = Object.keys(data[0]);
        
        // 分析列类型
        columns.forEach(column => {
            const values = data.map(item => item[column]).filter(val => val !== '' && val !== null && val !== undefined);
            const numericValues = values.filter(val => !isNaN(parseFloat(val))).map(val => parseFloat(val));
            
            if (numericValues.length === values.length && values.length > 0) {
                features.numericColumns.push(column);
            } else {
                // 尝试判断是否为日期
                const dateValues = values.filter(val => !isNaN(Date.parse(val)));
                if (dateValues.length > 0) {
                    features.dateColumns.push(column);
                } else {
                    features.categoricalColumns.push(column);
                }
            }
        });
        
        // 分析数据质量
        features.dataQuality.missingValues = data.reduce((count, row) => {
            return count + Object.values(row).filter(val => val === '' || val === null || val === undefined).length;
        }, 0);
        
        // 简单的重复行检测
        const seen = new Set();
        data.forEach(row => {
            const key = JSON.stringify(row);
            if (seen.has(key)) {
                features.dataQuality.duplicateRows++;
            }
            seen.add(key);
        });
        
        return features;
    },
    
    // 生成建议
    generateAdvice(dataFeatures, options) {
        const advice = [];
        
        // 数据质量建议
        if (dataFeatures.dataQuality.missingValues > 0) {
            advice.push({
                category: '数据质量',
                title: '处理缺失值',
                description: `数据中存在 ${dataFeatures.dataQuality.missingValues} 个缺失值，建议进行数据清洗和填充`,
                priority: 'high',
                actionable: true
            });
        }
        
        if (dataFeatures.dataQuality.duplicateRows > 0) {
            advice.push({
                category: '数据质量',
                title: '移除重复数据',
                description: `数据中存在 ${dataFeatures.dataQuality.duplicateRows} 条重复记录，建议进行去重处理`,
                priority: 'medium',
                actionable: true
            });
        }
        
        // 分析建议
        if (dataFeatures.numericColumns.length > 0) {
            advice.push({
                category: '数据分析',
                title: '深入数值分析',
                description: `数据包含 ${dataFeatures.numericColumns.length} 个数值列，建议进行深入的统计分析和可视化`,
                priority: 'medium',
                actionable: true
            });
        }
        
        if (dataFeatures.dateColumns.length > 0) {
            advice.push({
                category: '数据分析',
                title: '时间序列分析',
                description: `数据包含 ${dataFeatures.dateColumns.length} 个日期列，建议进行时间序列分析和趋势预测`,
                priority: 'medium',
                actionable: true
            });
        }
        
        if (dataFeatures.categoricalColumns.length > 0) {
            advice.push({
                category: '数据分析',
                title: '分类数据分析',
                description: `数据包含 ${dataFeatures.categoricalColumns.length} 个分类列，建议进行分类统计和关联分析`,
                priority: 'low',
                actionable: true
            });
        }
        
        // 业务建议
        advice.push({
            category: '业务决策',
            title: '基于数据驱动决策',
            description: '建议建立数据驱动的决策机制，定期分析数据变化，及时调整业务策略',
            priority: 'high',
            actionable: true
        });
        
        advice.push({
            category: '业务优化',
            title: '流程优化',
            description: '基于数据分析结果，识别业务流程中的瓶颈，进行针对性优化',
            priority: 'medium',
            actionable: true
        });
        
        return advice;
    },
    
    // 优先级排序
    prioritizeAdvice(advice) {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        
        return advice
            .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
            .map(item => ({
                id: item.title,
                priority: item.priority,
                description: item.description
            }));
    }
};

export default businessAdviceSkill;