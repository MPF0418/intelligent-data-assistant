/**
 * 数据清洗模块
 * 对标Excel数据清洗功能，支持去重、空值处理、数据类型转换等
 */

const DataCleaner = {
    /**
     * 去除重复行
     * 对应Excel: 数据 → 删除重复值
     * @param {Array} data - 原始数据
     * @param {Array} columns - 用于判断重复的列（不传则使用所有列）
     * @returns {Object} { cleanedData, duplicates, stats }
     */
    removeDuplicates(data, columns = null) {
        if (!data || data.length === 0) {
            return { cleanedData: [], duplicates: [], stats: { original: 0, unique: 0, duplicates: 0 } };
        }
        
        const checkColumns = columns || Object.keys(data[0]);
        const seen = new Map();
        const cleanedData = [];
        const duplicates = [];
        
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const key = checkColumns.map(col => row[col]).join('|||');
            
            if (!seen.has(key)) {
                seen.set(key, i);
                cleanedData.push(row);
            } else {
                duplicates.push({
                    index: i,
                    row: row,
                    duplicateOf: seen.get(key)
                });
            }
        }
        
        return {
            cleanedData,
            duplicates,
            stats: {
                original: data.length,
                unique: cleanedData.length,
                duplicates: duplicates.length
            }
        };
    },

    /**
     * 标记重复行（不删除）
     * @param {Array} data - 原始数据
     * @param {Array} columns - 用于判断重复的列
     * @returns {Array} 带有isDuplicate标记的数据
     */
    markDuplicates(data, columns = null) {
        if (!data || data.length === 0) return [];
        
        const checkColumns = columns || Object.keys(data[0]);
        const seen = new Map();
        
        return data.map((row, index) => {
            const key = checkColumns.map(col => row[col]).join('|||');
            const isDuplicate = seen.has(key);
            
            if (!isDuplicate) {
                seen.set(key, index);
            }
            
            return {
                ...row,
                __isDuplicate: isDuplicate,
                __originalIndex: index
            };
        });
    },

    /**
     * 空值处理
     * 对应Excel: 查找和选择 → 定位条件 → 空值
     * @param {Array} data - 原始数据
     * @param {Object} options - 处理选项
     * @param {Array} options.columns - 要处理的列
     * @param {string} options.strategy - 处理策略：'remove'|'fill'|'interpolate'|'mean'|'median'|'mode'
     * @param {*} options.fillValue - 填充值（strategy='fill'时使用）
     * @returns {Object} { cleanedData, stats }
     */
    handleMissingValues(data, options = {}) {
        if (!data || data.length === 0) {
            return { cleanedData: [], stats: { total: 0, missing: 0, handled: 0 } };
        }
        
        const { columns = null, strategy = 'remove', fillValue = '' } = options;
        const targetColumns = columns || Object.keys(data[0]);
        
        let cleanedData = [...data];
        const stats = {
            total: data.length,
            missing: 0,
            handled: 0,
            byColumn: {}
        };
        
        // 统计每列的空值数量
        for (const col of targetColumns) {
            stats.byColumn[col] = data.filter(row => 
                row[col] === null || row[col] === undefined || row[col] === ''
            ).length;
            stats.missing += stats.byColumn[col];
        }
        
        switch (strategy) {
            case 'remove':
                // 删除包含空值的行
                cleanedData = data.filter(row => {
                    return !targetColumns.some(col => 
                        row[col] === null || row[col] === undefined || row[col] === ''
                    );
                });
                stats.handled = data.length - cleanedData.length;
                break;
            
            case 'fill':
                // 使用指定值填充
                cleanedData = data.map(row => {
                    const newRow = { ...row };
                    for (const col of targetColumns) {
                        if (newRow[col] === null || newRow[col] === undefined || newRow[col] === '') {
                            newRow[col] = fillValue;
                            stats.handled++;
                        }
                    }
                    return newRow;
                });
                break;
            
            case 'mean':
                // 使用平均值填充（仅数值列）
                const meanValues = {};
                for (const col of targetColumns) {
                    const values = data
                        .map(row => parseFloat(row[col]))
                        .filter(v => !isNaN(v));
                    meanValues[col] = values.length > 0 
                        ? values.reduce((a, b) => a + b, 0) / values.length 
                        : 0;
                }
                cleanedData = data.map(row => {
                    const newRow = { ...row };
                    for (const col of targetColumns) {
                        if (newRow[col] === null || newRow[col] === undefined || newRow[col] === '') {
                            newRow[col] = meanValues[col].toFixed(2);
                            stats.handled++;
                        }
                    }
                    return newRow;
                });
                break;
            
            case 'median':
                // 使用中位数填充
                const medianValues = {};
                for (const col of targetColumns) {
                    const values = data
                        .map(row => parseFloat(row[col]))
                        .filter(v => !isNaN(v))
                        .sort((a, b) => a - b);
                    const mid = Math.floor(values.length / 2);
                    medianValues[col] = values.length > 0 
                        ? (values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2)
                        : 0;
                }
                cleanedData = data.map(row => {
                    const newRow = { ...row };
                    for (const col of targetColumns) {
                        if (newRow[col] === null || newRow[col] === undefined || newRow[col] === '') {
                            newRow[col] = medianValues[col].toFixed(2);
                            stats.handled++;
                        }
                    }
                    return newRow;
                });
                break;
            
            case 'mode':
                // 使用众数填充
                const modeValues = {};
                for (const col of targetColumns) {
                    const counts = {};
                    data.forEach(row => {
                        if (row[col] !== null && row[col] !== undefined && row[col] !== '') {
                            const val = String(row[col]);
                            counts[val] = (counts[val] || 0) + 1;
                        }
                    });
                    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                    modeValues[col] = sorted.length > 0 ? sorted[0][0] : '';
                }
                cleanedData = data.map(row => {
                    const newRow = { ...row };
                    for (const col of targetColumns) {
                        if (newRow[col] === null || newRow[col] === undefined || newRow[col] === '') {
                            newRow[col] = modeValues[col];
                            stats.handled++;
                        }
                    }
                    return newRow;
                });
                break;
            
            case 'interpolate':
                // 线性插值（仅数值列）
                cleanedData = this.interpolateMissing(data, targetColumns);
                stats.handled = stats.missing;
                break;
        }
        
        return { cleanedData, stats };
    },

    /**
     * 线性插值填充空值
     * @param {Array} data - 原始数据
     * @param {Array} columns - 要处理的列
     * @returns {Array} 处理后的数据
     */
    interpolateMissing(data, columns) {
        const result = data.map(row => ({ ...row }));
        
        for (const col of columns) {
            // 找到所有非空值的位置和值
            const nonEmpty = [];
            for (let i = 0; i < result.length; i++) {
                const val = parseFloat(result[i][col]);
                if (!isNaN(val)) {
                    nonEmpty.push({ index: i, value: val });
                }
            }
            
            if (nonEmpty.length < 2) continue;
            
            // 对空值进行插值
            for (let i = 0; i < result.length; i++) {
                if (result[i][col] === null || result[i][col] === undefined || result[i][col] === '') {
                    // 找到前后的非空值
                    let prev = null, next = null;
                    for (const item of nonEmpty) {
                        if (item.index < i) prev = item;
                        if (item.index > i && !next) next = item;
                    }
                    
                    if (prev && next) {
                        // 线性插值
                        const ratio = (i - prev.index) / (next.index - prev.index);
                        result[i][col] = (prev.value + ratio * (next.value - prev.value)).toFixed(2);
                    } else if (prev) {
                        result[i][col] = prev.value.toFixed(2);
                    } else if (next) {
                        result[i][col] = next.value.toFixed(2);
                    }
                }
            }
        }
        
        return result;
    },

    /**
     * 数据类型转换
     * 对应Excel: 分列、文本转数字等
     * @param {Array} data - 原始数据
     * @param {Object} conversions - 转换配置 { columnName: targetType }
     * @param {string} targetType - 'number'|'text'|'date'
     * @returns {Object} { convertedData, stats }
     */
    convertDataTypes(data, conversions) {
        if (!data || data.length === 0) {
            return { convertedData: [], stats: {} };
        }
        
        const stats = {};
        const convertedData = data.map(row => ({ ...row }));
        
        for (const [column, targetType] of Object.entries(conversions)) {
            stats[column] = { total: data.length, converted: 0, failed: 0 };
            
            for (const row of convertedData) {
                const original = row[column];
                let converted;
                
                try {
                    switch (targetType) {
                        case 'number':
                            converted = parseFloat(original);
                            if (isNaN(converted)) {
                                converted = null;
                                stats[column].failed++;
                            } else {
                                row[column] = converted;
                                stats[column].converted++;
                            }
                            break;
                        
                        case 'text':
                        case 'string':
                            row[column] = String(original || '');
                            stats[column].converted++;
                            break;
                        
                        case 'date':
                            const date = new Date(original);
                            if (isNaN(date.getTime())) {
                                stats[column].failed++;
                            } else {
                                row[column] = date.toISOString().split('T')[0];
                                stats[column].converted++;
                            }
                            break;
                    }
                } catch (e) {
                    stats[column].failed++;
                }
            }
        }
        
        return { convertedData, stats };
    },

    /**
     * 文本处理
     * @param {Array} data - 原始数据
     * @param {string} column - 要处理的列
     * @param {string} operation - 操作类型
     * @param {Object} options - 操作选项
     * @returns {Object} { processedData, stats }
     */
    processText(data, column, operation, options = {}) {
        if (!data || data.length === 0) {
            return { processedData: [], stats: {} };
        }
        
        const stats = { total: data.length, processed: 0 };
        const processedData = data.map(row => ({ ...row }));
        
        for (const row of processedData) {
            const original = String(row[column] || '');
            let result = original;
            
            switch (operation) {
                case 'uppercase':
                    result = original.toUpperCase();
                    break;
                
                case 'lowercase':
                    result = original.toLowerCase();
                    break;
                
                case 'trim':
                    result = original.trim();
                    break;
                
                case 'substring':
                    const { start = 0, length } = options;
                    result = original.substring(start, start + (length || original.length));
                    break;
                
                case 'replace':
                    const { search, replacement } = options;
                    result = original.split(search).join(replacement);
                    break;
                
                case 'split':
                    const { delimiter = ',', index = 0 } = options;
                    result = original.split(delimiter)[index] || '';
                    break;
                
                case 'concat':
                    const { columns = [], separator = '' } = options;
                    result = columns.map(c => row[c] || '').join(separator);
                    break;
            }
            
            if (result !== original) {
                stats.processed++;
            }
            row[column] = result;
        }
        
        return { processedData, stats };
    },

    /**
     * 异常值检测
     * @param {Array} data - 原始数据
     * @param {string} column - 要检测的列
     * @param {string} method - 检测方法：'iqr'|'zscore'|'percentile'
     * @param {Object} options - 选项
     * @returns {Object} { outliers, stats }
     */
    detectOutliers(data, column, method = 'iqr', options = {}) {
        const values = data
            .map((row, index) => ({ index, value: parseFloat(row[column]) }))
            .filter(item => !isNaN(item.value));
        
        if (values.length === 0) {
            return { outliers: [], stats: { total: 0, outliers: 0 } };
        }
        
        const sortedValues = values.map(v => v.value).sort((a, b) => a - b);
        const outliers = [];
        
        switch (method) {
            case 'iqr':
                // 四分位距方法
                const q1 = this.percentile(sortedValues, 25);
                const q3 = this.percentile(sortedValues, 75);
                const iqr = q3 - q1;
                const lowerBound = q1 - 1.5 * iqr;
                const upperBound = q3 + 1.5 * iqr;
                
                for (const item of values) {
                    if (item.value < lowerBound || item.value > upperBound) {
                        outliers.push({
                            index: item.index,
                            value: item.value,
                            reason: item.value < lowerBound ? '低于下限' : '高于上限',
                            bounds: { lower: lowerBound, upper: upperBound }
                        });
                    }
                }
                break;
            
            case 'zscore':
                // Z-score方法
                const mean = sortedValues.reduce((a, b) => a + b, 0) / sortedValues.length;
                const stdDev = Math.sqrt(
                    sortedValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / sortedValues.length
                );
                const threshold = options.threshold || 3;
                
                for (const item of values) {
                    const zscore = Math.abs((item.value - mean) / stdDev);
                    if (zscore > threshold) {
                        outliers.push({
                            index: item.index,
                            value: item.value,
                            zscore: zscore,
                            reason: `Z-score (${zscore.toFixed(2)}) 超过阈值 (${threshold})`
                        });
                    }
                }
                break;
            
            case 'percentile':
                // 百分位方法
                const lowerP = options.lowerPercentile || 1;
                const upperP = options.upperPercentile || 99;
                const lowerPercentile = this.percentile(sortedValues, lowerP);
                const upperPercentile = this.percentile(sortedValues, upperP);
                
                for (const item of values) {
                    if (item.value < lowerPercentile || item.value > upperPercentile) {
                        outliers.push({
                            index: item.index,
                            value: item.value,
                            reason: item.value < lowerPercentile 
                                ? `低于第${lowerP}百分位` 
                                : `高于第${upperP}百分位`,
                            bounds: { lower: lowerPercentile, upper: upperPercentile }
                        });
                    }
                }
                break;
        }
        
        return {
            outliers,
            stats: {
                total: values.length,
                outliers: outliers.length,
                outlierRatio: (outliers.length / values.length * 100).toFixed(2) + '%'
            }
        };
    },

    /**
     * 辅助函数：计算百分位数
     */
    percentile(sortedValues, p) {
        const rank = (p / 100) * (sortedValues.length - 1);
        const lower = Math.floor(rank);
        const fraction = rank - lower;
        if (lower === sortedValues.length - 1) {
            return sortedValues[lower];
        }
        return sortedValues[lower] + fraction * (sortedValues[lower + 1] - sortedValues[lower]);
    },

    /**
     * 数据质量报告
     * @param {Array} data - 原始数据
     * @returns {Object} 数据质量报告
     */
    generateQualityReport(data) {
        if (!data || data.length === 0) {
            return { error: '数据为空' };
        }
        
        const columns = Object.keys(data[0]);
        const report = {
            totalRows: data.length,
            totalColumns: columns.length,
            columns: {},
            overallScore: 0
        };
        
        let totalScore = 0;
        
        for (const col of columns) {
            const values = data.map(row => row[col]);
            const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== '');
            const unique = new Set(nonEmpty).size;
            const numeric = nonEmpty.filter(v => !isNaN(parseFloat(v))).length;
            
            // 计算列质量分数（0-100）
            const completeness = (nonEmpty.length / data.length) * 100;
            const uniqueness = (unique / nonEmpty.length) * 100;
            const consistency = numeric > 0 
                ? Math.min(100, (numeric / nonEmpty.length) * 100) 
                : 100;
            
            const columnScore = (completeness * 0.4 + uniqueness * 0.3 + consistency * 0.3);
            totalScore += columnScore;
            
            report.columns[col] = {
                totalValues: data.length,
                nonEmptyValues: nonEmpty.length,
                emptyValues: data.length - nonEmpty.length,
                uniqueValues: unique,
                duplicateValues: nonEmpty.length - unique,
                numericValues: numeric,
                completeness: completeness.toFixed(2) + '%',
                uniqueness: uniqueness.toFixed(2) + '%',
                score: columnScore.toFixed(2)
            };
        }
        
        report.overallScore = (totalScore / columns.length).toFixed(2);
        
        return report;
    }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataCleaner;
}
