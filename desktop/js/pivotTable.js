/**
 * 数据透视表模块
 * 对标Excel数据透视表功能，支持多维交叉分析
 * 支持行维度、列维度、值聚合
 */

class PivotTable {
    /**
     * 构造函数
     * @param {Array} data - 原始数据（对象数组）
     * @param {Object} config - 透视表配置
     * @param {Array} config.rows - 行维度字段（支持多字段）
     * @param {Array} config.cols - 列维度字段（支持多字段）
     * @param {Object} config.values - 值字段配置 { field, aggFunc }
     * @param {Object} config.filters - 筛选条件
     */
    constructor(data, config) {
        this.data = data || [];
        this.config = config || {};
        this.result = null;
    }

    /**
     * 生成透视表
     * @returns {Object} 透视表结果
     */
    generate() {
        const { rows = [], cols = [], values = {}, filters = {} } = this.config;
        
        // 1. 应用筛选条件
        let filteredData = this.applyFilters(this.data, filters);
        
        // 2. 获取所有唯一的行键和列键
        const rowKeys = this.getUniqueKeys(filteredData, rows);
        const colKeys = this.getUniqueKeys(filteredData, cols);
        
        // 3. 构建透视表数据结构
        const pivotData = {
            rows: rows,
            cols: cols,
            rowKeys: rowKeys,
            colKeys: colKeys,
            values: values,
            data: {},
            rowTotals: {},
            colTotals: {},
            grandTotal: null
        };
        
        // 4. 计算交叉聚合值
        for (const rowKey of rowKeys) {
            pivotData.data[rowKey] = {};
            
            for (const colKey of colKeys) {
                // 筛选出当前行列组合的数据
                const matchedData = this.filterByKeys(filteredData, rows, cols, rowKey, colKey);
                
                // 计算聚合值
                pivotData.data[rowKey][colKey] = this.aggregate(matchedData, values);
            }
            
            // 计算行小计
            const rowMatchedData = this.filterByRowKey(filteredData, rows, rowKey);
            pivotData.rowTotals[rowKey] = this.aggregate(rowMatchedData, values);
        }
        
        // 5. 计算列小计
        for (const colKey of colKeys) {
            const colMatchedData = this.filterByColKey(filteredData, cols, colKey);
            pivotData.colTotals[colKey] = this.aggregate(colMatchedData, values);
        }
        
        // 6. 计算总计
        pivotData.grandTotal = this.aggregate(filteredData, values);
        
        this.result = pivotData;
        return pivotData;
    }

    /**
     * 应用筛选条件
     * @param {Array} data - 原始数据
     * @param {Object} filters - 筛选条件 { field: [values] }
     * @returns {Array} 筛选后的数据
     */
    applyFilters(data, filters) {
        if (!filters || Object.keys(filters).length === 0) {
            return data;
        }
        
        return data.filter(row => {
            for (const [field, allowedValues] of Object.entries(filters)) {
                if (!allowedValues.includes(row[field])) {
                    return false;
                }
            }
            return true;
        });
    }

    /**
     * 获取唯一的键组合
     * @param {Array} data - 数据
     * @param {Array} fields - 字段列表
     * @returns {Array} 唯一键数组
     */
    getUniqueKeys(data, fields) {
        if (!fields || fields.length === 0) {
            return ['(全部)'];
        }
        
        const keySet = new Set();
        
        for (const row of data) {
            const key = fields.map(f => row[f] || '(空)').join('|');
            keySet.add(key);
        }
        
        return Array.from(keySet).sort();
    }

    /**
     * 根据行键和列键筛选数据
     * @param {Array} data - 原始数据
     * @param {Array} rowFields - 行字段
     * @param {Array} colFields - 列字段
     * @param {string} rowKey - 行键
     * @param {string} colKey - 列键
     * @returns {Array} 匹配的数据
     */
    filterByKeys(data, rowFields, colFields, rowKey, colKey) {
        const rowValues = rowKey.split('|');
        const colValues = colKey.split('|');
        
        return data.filter(row => {
            // 检查行键匹配
            for (let i = 0; i < rowFields.length; i++) {
                const field = rowFields[i];
                const expected = rowValues[i];
                if (row[field] !== expected && expected !== '(全部)') {
                    return false;
                }
            }
            
            // 检查列键匹配
            for (let i = 0; i < colFields.length; i++) {
                const field = colFields[i];
                const expected = colValues[i];
                if (row[field] !== expected && expected !== '(全部)') {
                    return false;
                }
            }
            
            return true;
        });
    }

    /**
     * 根据行键筛选数据
     */
    filterByRowKey(data, rowFields, rowKey) {
        if (rowKey === '(全部)') return data;
        
        const rowValues = rowKey.split('|');
        return data.filter(row => {
            for (let i = 0; i < rowFields.length; i++) {
                if (row[rowFields[i]] !== rowValues[i]) {
                    return false;
                }
            }
            return true;
        });
    }

    /**
     * 根据列键筛选数据
     */
    filterByColKey(data, colFields, colKey) {
        if (colKey === '(全部)') return data;
        
        const colValues = colKey.split('|');
        return data.filter(row => {
            for (let i = 0; i < colFields.length; i++) {
                if (row[colFields[i]] !== colValues[i]) {
                    return false;
                }
            }
            return true;
        });
    }

    /**
     * 聚合计算
     * @param {Array} data - 数据
     * @param {Object} valueConfig - 值配置 { field, aggFunc }
     * @returns {number|Object} 聚合结果
     */
    aggregate(data, valueConfig) {
        const result = {};
        
        // 支持多个值字段
        const valueFields = Array.isArray(valueConfig) ? valueConfig : [valueConfig];
        
        for (const config of valueFields) {
            const { field, aggFunc = 'sum' } = config;
            const values = data
                .map(row => parseFloat(row[field]))
                .filter(v => !isNaN(v));
            
            result[field] = this.calculateAggregate(values, aggFunc);
        }
        
        // 如果只有一个值字段，直接返回数值
        if (valueFields.length === 1) {
            return result[valueFields[0].field];
        }
        
        return result;
    }

    /**
     * 执行聚合计算
     * @param {Array} values - 数值数组
     * @param {string} aggFunc - 聚合函数名
     * @returns {number} 计算结果
     */
    calculateAggregate(values, aggFunc) {
        if (!values || values.length === 0) {
            return aggFunc === 'count' ? 0 : null;
        }
        
        switch (aggFunc.toLowerCase()) {
            case 'sum':
                return values.reduce((a, b) => a + b, 0);
            
            case 'avg':
            case 'average':
            case 'mean':
                return values.reduce((a, b) => a + b, 0) / values.length;
            
            case 'count':
                return values.length;
            
            case 'max':
                return Math.max(...values);
            
            case 'min':
                return Math.min(...values);
            
            case 'median':
                const sorted = [...values].sort((a, b) => a - b);
                const mid = Math.floor(sorted.length / 2);
                return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
            
            case 'stddev':
            case 'stdev':
                const mean = values.reduce((a, b) => a + b, 0) / values.length;
                const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
                return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
            
            case 'variance':
            case 'var':
                const avg = values.reduce((a, b) => a + b, 0) / values.length;
                return values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
            
            default:
                return values.reduce((a, b) => a + b, 0);
        }
    }

    /**
     * 生成HTML表格展示
     * @returns {string} HTML字符串
     */
    toHTML() {
        if (!this.result) {
            this.generate();
        }
        
        const { rowKeys, colKeys, data, rowTotals, colTotals, grandTotal, rows, cols, values } = this.result;
        
        let html = '<div class="pivot-table-container" style="overflow-x: auto;">';
        html += '<table class="pivot-table" style="border-collapse: collapse; width: 100%;">';
        
        // 表头
        html += '<thead><tr>';
        html += `<th style="background: #667eea; color: white; padding: 10px; border: 1px solid #ddd;">${rows.join(' / ')}</th>`;
        
        for (const colKey of colKeys) {
            html += `<th style="background: #667eea; color: white; padding: 10px; border: 1px solid #ddd;">${colKey}</th>`;
        }
        
        html += `<th style="background: #764ba2; color: white; padding: 10px; border: 1px solid #ddd;">小计</th>`;
        html += '</tr></thead>';
        
        // 数据行
        html += '<tbody>';
        
        for (let i = 0; i < rowKeys.length; i++) {
            const rowKey = rowKeys[i];
            const bgColor = i % 2 === 0 ? '#fff' : '#f8f9fa';
            
            html += '<tr>';
            html += `<td style="background: ${bgColor}; padding: 10px; border: 1px solid #ddd; font-weight: bold;">${rowKey}</td>`;
            
            for (const colKey of colKeys) {
                const value = data[rowKey][colKey];
                const displayValue = value !== null && value !== undefined 
                    ? (typeof value === 'number' ? value.toFixed(2) : value) 
                    : '-';
                html += `<td style="background: ${bgColor}; padding: 10px; border: 1px solid #ddd; text-align: right;">${displayValue}</td>`;
            }
            
            // 行小计
            const rowTotal = rowTotals[rowKey];
            const displayRowTotal = rowTotal !== null && rowTotal !== undefined 
                ? (typeof rowTotal === 'number' ? rowTotal.toFixed(2) : rowTotal) 
                : '-';
            html += `<td style="background: #e8f4f8; padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${displayRowTotal}</td>`;
            
            html += '</tr>';
        }
        
        // 总计行
        html += '<tr>';
        html += `<td style="background: #764ba2; color: white; padding: 10px; border: 1px solid #ddd; font-weight: bold;">总计</td>`;
        
        for (const colKey of colKeys) {
            const colTotal = colTotals[colKey];
            const displayColTotal = colTotal !== null && colTotal !== undefined 
                ? (typeof colTotal === 'number' ? colTotal.toFixed(2) : colTotal) 
                : '-';
            html += `<td style="background: #e8f4f8; padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${displayColTotal}</td>`;
        }
        
        // 总计
        const displayGrandTotal = grandTotal !== null && grandTotal !== undefined 
            ? (typeof grandTotal === 'number' ? grandTotal.toFixed(2) : grandTotal) 
            : '-';
        html += `<td style="background: #764ba2; color: white; padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${displayGrandTotal}</td>`;
        
        html += '</tr>';
        html += '</tbody></table></div>';
        
        return html;
    }

    /**
     * 钻取功能 - 获取某个单元格的详细数据
     * @param {string} rowKey - 行键
     * @param {string} colKey - 列键
     * @returns {Array} 详细数据
     */
    drillDown(rowKey, colKey) {
        const { rows = [], cols = [] } = this.config;
        return this.filterByKeys(this.data, rows, cols, rowKey, colKey);
    }

    /**
     * 更新筛选条件并重新生成
     * @param {Object} newFilters - 新的筛选条件
     * @returns {Object} 新的透视表结果
     */
    updateFilters(newFilters) {
        this.config.filters = { ...this.config.filters, ...newFilters };
        return this.generate();
    }

    /**
     * 更改聚合函数
     * @param {string} newAggFunc - 新的聚合函数
     * @returns {Object} 新的透视表结果
     */
    changeAggregation(newAggFunc) {
        if (Array.isArray(this.config.values)) {
            this.config.values = this.config.values.map(v => ({ ...v, aggFunc: newAggFunc }));
        } else {
            this.config.values.aggFunc = newAggFunc;
        }
        return this.generate();
    }
}

/**
 * 从自然语言配置生成透视表
 * @param {Array} data - 数据
 * @param {Object} config - 配置对象
 * @returns {PivotTable} 透视表实例
 */
function createPivotTable(data, config) {
    const pivot = new PivotTable(data, config);
    pivot.generate();
    return pivot;
}

/**
 * 解析自然语言为透视表配置
 * @param {string} input - 用户输入
 * @param {Array} columns - 可用列名
 * @returns {Object} 透视表配置
 */
function parsePivotConfig(input, columns) {
    const config = {
        rows: [],
        cols: [],
        values: { field: null, aggFunc: 'sum' },
        filters: {}
    };
    
    const lowerInput = input.toLowerCase();
    
    // 解析聚合函数
    if (lowerInput.includes('平均') || lowerInput.includes('均值')) {
        config.values.aggFunc = 'avg';
    } else if (lowerInput.includes('计数') || lowerInput.includes('数量')) {
        config.values.aggFunc = 'count';
    } else if (lowerInput.includes('最大')) {
        config.values.aggFunc = 'max';
    } else if (lowerInput.includes('最小')) {
        config.values.aggFunc = 'min';
    }
    
    // 解析行维度（按XX统计）
    const rowMatch = input.match(/按(.+?)(统计|分析|汇总)/);
    if (rowMatch) {
        const rowFields = rowMatch[1].split(/[、,，和]/);
        config.rows = rowFields
            .map(f => findBestColumn(f.trim(), columns))
            .filter(f => f);
    }
    
    // 解析列维度（XX和XX交叉分析）
    const crossMatch = input.match(/(.+?)和(.+?)交叉/);
    if (crossMatch) {
        config.rows = [findBestColumn(crossMatch[1].trim(), columns)].filter(f => f);
        config.cols = [findBestColumn(crossMatch[2].trim(), columns)].filter(f => f);
    }
    
    // 解析值字段
    for (const col of columns) {
        if (input.includes(col)) {
            // 检查是否已经被用作行列维度
            if (!config.rows.includes(col) && !config.cols.includes(col)) {
                config.values.field = col;
                break;
            }
        }
    }
    
    return config;
}

/**
 * 查找最佳匹配列名
 */
function findBestColumn(keyword, columns) {
    // 精确匹配
    if (columns.includes(keyword)) {
        return keyword;
    }
    
    // 包含匹配
    for (const col of columns) {
        if (col.includes(keyword) || keyword.includes(col)) {
            return col;
        }
    }
    
    return null;
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PivotTable, createPivotTable, parsePivotConfig };
}
