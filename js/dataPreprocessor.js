// 数据预处理器 - 单位转换、公式计算、数据格式化
// 功能：在查询执行前对数据进行预处理，满足复杂业务需求
// 响应时间：< 10ms
// 用户价值：用户说"用万元显示"或"计算增长率"，系统自动处理数据转换

class DataPreprocessor {
    constructor() {
        // 单位转换规则库
        // 产品意义：支持常见的单位转换需求，无需用户手动计算
        this.unitConversions = {
            // 时间单位
            '秒转分钟': { 
                formula: (v) => v / 60, 
                inverseFormula: (v) => v * 60,
                decimalPlaces: 2,
                from: '秒',
                to: '分钟'
            },
            '分钟转小时': { 
                formula: (v) => v / 60, 
                inverseFormula: (v) => v * 60,
                decimalPlaces: 2,
                from: '分钟',
                to: '小时'
            },
            '小时转天': { 
                formula: (v) => v / 24, 
                inverseFormula: (v) => v * 24,
                decimalPlaces: 2,
                from: '小时',
                to: '天'
            },
            
            // 金额单位
            '元转万元': { 
                formula: (v) => v / 10000, 
                inverseFormula: (v) => v * 10000,
                decimalPlaces: 2,
                from: '元',
                to: '万元'
            },
            '万元转元': { 
                formula: (v) => v * 10000, 
                inverseFormula: (v) => v / 10000,
                decimalPlaces: 0,
                from: '万元',
                to: '元'
            },
            '千元转万元': { 
                formula: (v) => v / 10, 
                inverseFormula: (v) => v * 10,
                decimalPlaces: 2,
                from: '千元',
                to: '万元'
            },
            
            // 数量单位
            '个转千个': { 
                formula: (v) => v / 1000, 
                inverseFormula: (v) => v * 1000,
                decimalPlaces: 2,
                from: '个',
                to: '千个'
            },
            '吨转千吨': { 
                formula: (v) => v / 1000, 
                inverseFormula: (v) => v * 1000,
                decimalPlaces: 2,
                from: '吨',
                to: '千吨'
            }
        };
        
        // 公式计算规则库
        // 产品意义：支持常见的业务公式计算，如增长率、占比等
        this.formulaCalculations = {
            // 同比增长率 = (本期值 - 同期值) / 同期值 × 100%
            'growth_rate_yoy': {
                name: '同比增长率',
                formula: (current, previous) => {
                    if (!previous || previous === 0) return null;
                    return ((current - previous) / previous) * 100;
                },
                requiredColumns: ['本期值', '同期值'],
                columnPatterns: ['本期', '当前', '今年', '本月', '本年'],
                resultFormat: 'percentage',
                description: '计算同比增长率'
            },
            
            // 环比增长率 = (本期值 - 上期值) / 上期值 × 100%
            'growth_rate_mom': {
                name: '环比增长率',
                formula: (current, previous) => {
                    if (!previous || previous === 0) return null;
                    return ((current - previous) / previous) * 100;
                },
                requiredColumns: ['本期值', '上期值'],
                columnPatterns: ['本期', '当前', '今年', '本月'],
                resultFormat: 'percentage',
                description: '计算环比增长率'
            },
            
            // 占比 = 部分值 / 总和 × 100%
            'proportion': {
                name: '占比',
                formula: (part, total) => {
                    if (!total || total === 0) return null;
                    return (part / total) * 100;
                },
                requiredColumns: ['部分值', '总和'],
                columnPatterns: ['占比', '比例', '份额'],
                resultFormat: 'percentage',
                description: '计算占比'
            },
            
            // 完成率 = 实际值 / 目标值 × 100%
            'completion_rate': {
                name: '完成率',
                formula: (actual, target) => {
                    if (!target || target === 0) return null;
                    return (actual / target) * 100;
                },
                requiredColumns: ['实际值', '目标值'],
                columnPatterns: ['完成', '达成', '实现'],
                resultFormat: 'percentage',
                description: '计算目标完成率'
            },
            
            // 平均值 = 总和 / 数量
            'average': {
                name: '平均值',
                formula: (sum, count) => {
                    if (!count || count === 0) return null;
                    return sum / count;
                },
                requiredColumns: ['总和', '数量'],
                columnPatterns: ['平均', '均值'],
                resultFormat: 'decimal',
                description: '计算平均值'
            },
            
            // 利润率 = 利润 / 收入 × 100%
            'profit_margin': {
                name: '利润率',
                formula: (profit, revenue) => {
                    if (!revenue || revenue === 0) return null;
                    return (profit / revenue) * 100;
                },
                requiredColumns: ['利润', '收入'],
                columnPatterns: ['利润', '毛利率', '净利率'],
                resultFormat: 'percentage',
                description: '计算利润率'
            }
        };
        
        // 数据格式化配置
        this.defaultFormatting = {
            decimalPlaces: 2,           // 默认保留 2 位小数
            thousandSeparator: true,    // 启用千分位分隔符
            percentageDecimalPlaces: 2, // 百分比保留 2 位小数
            currencySymbol: '',         // 货币符号（可选）
            nullValue: '-',             // 空值显示
            largeNumberUnit: null       // 大数单位（如'万'、'亿'）
        };
        
        // 预处理历史（用于调试和回滚）
        this.preprocessingHistory = [];
        this.maxHistorySize = 50;
    }
    
    /**
     * 预处理数据 - 核心方法
     * @param {Array} data - 原始数据数组
     * @param {Object} transformConfig - 转换配置
     * @param {Array} columns - 列名数组
     * @returns {Array} 预处理后的数据
     * 
     * 用户价值：自动处理单位转换和公式计算，无需用户手动操作
     */
    transform(data, transformConfig, columns = []) {
        const startTime = performance.now();
        
        if (!transformConfig || !data || data.length === 0) {
            return data;
        }
        
        let result = [...data];
        const appliedTransforms = [];
        
        // 1. 单位转换
        if (transformConfig.unitConversion) {
            result = this.applyUnitConversion(result, transformConfig.unitConversion, columns);
            appliedTransforms.push('unitConversion');
        }
        
        // 2. 公式计算
        if (transformConfig.formulaCalculation) {
            result = this.applyFormulaCalculation(result, transformConfig.formulaCalculation, columns);
            appliedTransforms.push('formulaCalculation');
        }
        
        // 3. 数据格式化
        if (transformConfig.dataFormatting) {
            result = this.applyFormatting(result, transformConfig.dataFormatting, columns);
            appliedTransforms.push('dataFormatting');
        }
        
        // 4. 记录预处理历史
        this.recordHistory({
            timestamp: new Date().toISOString(),
            dataLength: data.length,
            appliedTransforms,
            config: transformConfig
        });
        
        const endTime = performance.now();
        console.log(`[DataPreprocessor] 预处理完成，耗时：${(endTime - startTime).toFixed(2)}ms，应用转换：${appliedTransforms.join(', ')}`);
        
        return result;
    }
    
    /**
     * 应用单位转换
     * @param {Array} data - 数据数组
     * @param {Object} config - 单位转换配置
     * @param {Array} columns - 列名数组
     * @returns {Array} 转换后的数据
     */
    applyUnitConversion(data, config, columns = []) {
        if (!config || !config.formula) {
            console.warn('[DataPreprocessor] 单位转换配置无效');
            return data;
        }
        
        const formula = typeof config.formula === 'function' ? config.formula : this.parseFormula(config.formula);
        const decimalPlaces = config.decimalPlaces !== undefined ? config.decimalPlaces : 2;
        
        console.log(`[DataPreprocessor] 应用单位转换：${config.from || '未知'} → ${config.to || '未知'}`);
        
        return data.map(row => {
            const newRow = { ...row };
            
            for (const key in newRow) {
                // 跳过非数值列
                if (!this.isNumericColumn(key, columns, newRow[key])) {
                    continue;
                }
                
                const value = parseFloat(newRow[key]);
                if (!isNaN(value)) {
                    const converted = formula(value);
                    newRow[key] = typeof converted === 'number' 
                        ? parseFloat(converted.toFixed(decimalPlaces)) 
                        : converted;
                }
            }
            
            return newRow;
        });
    }
    
    /**
     * 应用公式计算
     * @param {Array} data - 数据数组
     * @param {Object} config - 公式计算配置
     * @param {Array} columns - 列名数组
     * @returns {Array} 计算后的数据
     */
    applyFormulaCalculation(data, config, columns = []) {
        if (!config || !config.type) {
            console.warn('[DataPreprocessor] 公式计算配置无效');
            return data;
        }
        
        // 获取公式函数
        let formulaFunc;
        if (typeof config.formula === 'function') {
            formulaFunc = config.formula;
        } else if (config.type && this.formulaCalculations[config.type]) {
            formulaFunc = this.formulaCalculations[config.type].formula;
        } else if (typeof config.formula === 'string') {
            formulaFunc = this.parseFormula(config.formula);
        } else {
            console.warn('[DataPreprocessor] 未找到有效的公式');
            return data;
        }
        
        const resultFormat = config.resultFormat || 'decimal';
        const decimalPlaces = config.decimalPlaces !== undefined ? config.decimalPlaces : 2;
        
        console.log(`[DataPreprocessor] 应用公式计算：${config.type || '自定义公式'}`);
        
        return data.map(row => {
            const newRow = { ...row };
            
            // 根据所需列获取数据
            let result;
            if (config.requiredColumns && config.requiredColumns.length >= 2) {
                // 需要多列计算
                const values = config.requiredColumns.map(col => {
                    // 尝试匹配列名
                    const matchedColumn = this.findMatchingColumn(col, columns, config.columnPatterns);
                    const value = newRow[matchedColumn || col];
                    return parseFloat(value) || 0;
                });
                
                result = formulaFunc(...values);
                
                // 添加新列存储结果
                const resultColumnName = config.resultColumn || `${config.type}_result`;
                newRow[resultColumnName] = this.formatResult(result, resultFormat, decimalPlaces);
            }
            
            return newRow;
        });
    }
    
    /**
     * 应用数据格式化
     * @param {Array} data - 数据数组
     * @param {Object} config - 格式化配置
     * @param {Array} columns - 列名数组
     * @returns {Array} 格式化后的数据
     */
    applyFormatting(data, config, columns = []) {
        const formatConfig = { ...this.defaultFormatting, ...config };
        
        console.log('[DataPreprocessor] 应用数据格式化');
        
        return data.map(row => {
            const newRow = { ...row };
            
            for (const key in newRow) {
                const value = newRow[key];
                
                // 处理空值
                if (value === null || value === undefined || value === '') {
                    newRow[key] = formatConfig.nullValue;
                    continue;
                }
                
                // 处理数值
                if (this.isNumericColumn(key, columns, value)) {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                        newRow[key] = this.formatNumber(numValue, formatConfig);
                    }
                }
            }
            
            return newRow;
        });
    }
    
    /**
     * 推断转换配置（基于用户输入）
     * @param {String} userInput - 用户输入
     * @param {Array} columns - 列名数组
     * @returns {Object} 推断的转换配置
     * 
     * 用户价值：用户说"用万元显示"，自动推断需要单位转换
     */
    inferTransformConfig(userInput, columns = []) {
        if (!userInput) return null;
        
        const lowerInput = userInput.toLowerCase();
        const config = {};
        
        // 检测单位转换需求
        if (lowerInput.includes('万元') || lowerInput.includes('元') || lowerInput.includes('千元')) {
            if (lowerInput.includes('万元') && lowerInput.includes('元')) {
                config.unitConversion = {
                    from: '元',
                    to: '万元',
                    formula: (v) => v / 10000,
                    decimalPlaces: 2
                };
            } else if (lowerInput.includes('万元')) {
                config.unitConversion = {
                    from: '元',
                    to: '万元',
                    formula: (v) => v / 10000,
                    decimalPlaces: 2
                };
            }
        }
        
        // 检测公式计算需求
        if (lowerInput.includes('增长率') || lowerInput.includes('增长') || lowerInput.includes('增速')) {
            config.formulaCalculation = {
                type: 'growth_rate_yoy',
                resultColumn: '增长率',
                resultFormat: 'percentage',
                decimalPlaces: 2
            };
        }
        
        if (lowerInput.includes('占比') || lowerInput.includes('比例') || lowerInput.includes('份额')) {
            config.formulaCalculation = {
                type: 'proportion',
                resultColumn: '占比',
                resultFormat: 'percentage',
                decimalPlaces: 2
            };
        }
        
        if (lowerInput.includes('完成率') || lowerInput.includes('达成率')) {
            config.formulaCalculation = {
                type: 'completion_rate',
                resultColumn: '完成率',
                resultFormat: 'percentage',
                decimalPlaces: 2
            };
        }
        
        // 检测格式化需求
        if (lowerInput.includes('保留') && lowerInput.includes('小数')) {
            const match = lowerInput.match(/保留 (\d+) 位小数/);
            if (match) {
                config.dataFormatting = {
                    decimalPlaces: parseInt(match[1])
                };
            }
        }
        
        if (lowerInput.includes('百分比') || lowerInput.includes('%')) {
            if (!config.dataFormatting) {
                config.dataFormatting = {};
            }
            config.dataFormatting.resultFormat = 'percentage';
        }
        
        // 如果没有任何配置，返回 null
        return Object.keys(config).length > 0 ? config : null;
    }
    
    /**
     * 判断是否为数值列
     * @param {String} columnName - 列名
     * @param {Array} columns - 所有列名
     * @param {*} value - 示例值
     * @returns {Boolean} 是否为数值列
     */
    isNumericColumn(columnName, columns, value) {
        // 检查列名关键词
        const valueKeywords = ['金额', '数值', '数量', '时长', '分数', '销量', '额', '收入', '成本', '利润', '人数', '次数', '频率', '值'];
        const hasValueKeyword = valueKeywords.some(kw => columnName.includes(kw));
        
        if (hasValueKeyword) {
            return true;
        }
        
        // 检查实际值
        return !isNaN(parseFloat(value));
    }
    
    /**
     * 查找匹配的列名
     * @param {String} targetColumn - 目标列名
     * @param {Array} columns - 所有列名
     * @param {Array} patterns - 列名模式
     * @returns {String} 匹配的列名
     */
    findMatchingColumn(targetColumn, columns, patterns = []) {
        // 精确匹配
        if (columns.includes(targetColumn)) {
            return targetColumn;
        }
        
        // 模式匹配
        for (const pattern of patterns) {
            const matched = columns.find(col => col.includes(pattern));
            if (matched) {
                return matched;
            }
        }
        
        return targetColumn;
    }
    
    /**
     * 格式化数值
     * @param {Number} value - 数值
     * @param {Object} config - 格式化配置
     * @returns {String|Number} 格式化后的值
     */
    formatNumber(value, config) {
        // 百分比格式化
        if (config.resultFormat === 'percentage' || config.asPercentage) {
            return (value * 100).toFixed(config.percentageDecimalPlaces || 2) + '%';
        }
        
        // 货币格式化
        if (config.currencySymbol) {
            const formatted = this.formatWithThousandSeparator(value, config.decimalPlaces);
            return config.currencySymbol + formatted;
        }
        
        // 普通数值格式化
        if (config.thousandSeparator) {
            return this.formatWithThousandSeparator(value, config.decimalPlaces);
        }
        
        // 大数单位
        if (config.largeNumberUnit) {
            return this.formatWithLargeUnit(value, config.largeNumberUnit, config.decimalPlaces);
        }
        
        // 默认格式化
        return parseFloat(value.toFixed(config.decimalPlaces));
    }
    
    /**
     * 格式化结果
     * @param {*} result - 计算结果
     * @param {String} format - 格式化类型
     * @param {Number} decimalPlaces - 小数位数
     * @returns {*} 格式化后的结果
     */
    formatResult(result, format, decimalPlaces = 2) {
        if (result === null || result === undefined) {
            return null;
        }
        
        switch (format) {
            case 'percentage':
                return (result).toFixed(decimalPlaces) + '%';
            case 'currency':
                return this.formatWithThousandSeparator(result, decimalPlaces);
            case 'decimal':
            default:
                return parseFloat(result.toFixed(decimalPlaces));
        }
    }
    
    /**
     * 添加千分位分隔符
     * @param {Number} value - 数值
     * @param {Number} decimalPlaces - 小数位数
     * @returns {String} 格式化后的字符串
     */
    formatWithThousandSeparator(value, decimalPlaces = 2) {
        return value.toLocaleString('zh-CN', {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces
        });
    }
    
    /**
     * 使用大数单位格式化
     * @param {Number} value - 数值
     * @param {String} unit - 单位（'万' 或 '亿'）
     * @param {Number} decimalPlaces - 小数位数
     * @returns {String} 格式化后的字符串
     */
    formatWithLargeUnit(value, unit, decimalPlaces = 2) {
        let converted;
        if (unit === '万') {
            converted = value / 10000;
        } else if (unit === '亿') {
            converted = value / 100000000;
        } else {
            converted = value;
        }
        
        return converted.toFixed(decimalPlaces) + unit;
    }
    
    /**
     * 解析公式字符串（简单实现）
     * @param {String} formulaStr - 公式字符串
     * @returns {Function} 公式函数
     */
    parseFormula(formulaStr) {
        // 简单实现，实际项目可能需要更复杂的解析器
        try {
            // 支持简单的公式，如 "value / 10000"
            return new Function('value', `return ${formulaStr}`);
        } catch (e) {
            console.error('[DataPreprocessor] 公式解析失败:', e);
            return (v) => v;
        }
    }
    
    /**
     * 记录预处理历史
     * @param {Object} record - 历史记录
     */
    recordHistory(record) {
        this.preprocessingHistory.unshift(record);
        
        // 限制历史记录数量
        if (this.preprocessingHistory.length > this.maxHistorySize) {
            this.preprocessingHistory = this.preprocessingHistory.slice(0, this.maxHistorySize);
        }
    }
    
    /**
     * 获取预处理历史
     * @param {Number} limit - 返回数量限制
     * @returns {Array} 历史记录
     */
    getHistory(limit = 10) {
        return this.preprocessingHistory.slice(0, limit);
    }
    
    /**
     * 清除预处理历史
     */
    clearHistory() {
        this.preprocessingHistory = [];
        console.log('[DataPreprocessor] 预处理历史已清除');
    }
    
    /**
     * 获取支持的单位转换列表
     * @returns {Array} 单位转换列表
     */
    getSupportedConversions() {
        return Object.keys(this.unitConversions).map(key => ({
            name: key,
            ...this.unitConversions[key]
        }));
    }
    
    /**
     * 获取支持的公式计算列表
     * @returns {Array} 公式计算列表
     */
    getSupportedFormulas() {
        return Object.keys(this.formulaCalculations).map(key => ({
            id: key,
            ...this.formulaCalculations[key]
        }));
    }
    
    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStatistics() {
        return {
            historySize: this.preprocessingHistory.length,
            supportedConversions: Object.keys(this.unitConversions).length,
            supportedFormulas: Object.keys(this.formulaCalculations).length
        };
    }
}

// 导出单例实例
const dataPreprocessor = new DataPreprocessor();
export default dataPreprocessor;
