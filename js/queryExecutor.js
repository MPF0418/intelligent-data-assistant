// 查询执行器 - V5.0
import { parseNumericValue, calculateAggregate, evaluateCondition } from './utils.js';

class QueryExecutor {
    constructor() {
        this.configGenerator = null;
        this.init();
    }
    
    // 初始化
    async init() {
        try {
            // 动态导入配置生成器
            const { default: QueryConfigGenerator } = await import('./queryConfigGenerator.js');
            this.configGenerator = new QueryConfigGenerator();
        } catch (error) {
            console.error('[QueryExecutor] 初始化失败:', error);
        }
    }
    
    // 执行查询
    async execute(config, data, headers) {
        if (!config || !data || !headers) {
            throw new Error('缺少必要的参数');
        }
        
        try {
            switch (config.queryType) {
                case 'find_max':
                    return this.executeFindMax(config, data, headers);
                case 'find_min':
                    return this.executeFindMin(config, data, headers);
                case 'aggregate':
                    return this.executeAggregate(config, data, headers);
                case 'filter_aggregate':
                    return this.executeFilterAggregate(config, data, headers);
                case 'filter':
                    return this.executeFilter(config, data, headers);
                case 'sort':
                    return this.executeSort(config, data, headers);
                default:
                    throw new Error(`不支持的查询类型: ${config.queryType}`);
            }
        } catch (error) {
            console.error('[QueryExecutor] 执行查询失败:', error);
            throw error;
        }
    }
    
    // 执行最大值查询
    executeFindMax(config, data, headers) {
        const { column } = config;
        
        if (!column || !headers.includes(column)) {
            throw new Error(`列 ${column} 不存在`);
        }
        
        let maxValue = -Infinity;
        let maxRow = null;
        
        data.forEach(row => {
            const value = parseNumericValue(row[column]);
            if (!isNaN(value) && value > maxValue) {
                maxValue = value;
                maxRow = row;
            }
        });
        
        return {
            type: 'find_max',
            column: column,
            value: maxValue,
            row: maxRow
        };
    }
    
    // 执行最小值查询
    executeFindMin(config, data, headers) {
        const { column } = config;
        
        if (!column || !headers.includes(column)) {
            throw new Error(`列 ${column} 不存在`);
        }
        
        let minValue = Infinity;
        let minRow = null;
        
        data.forEach(row => {
            const value = parseNumericValue(row[column]);
            if (!isNaN(value) && value < minValue) {
                minValue = value;
                minRow = row;
            }
        });
        
        return {
            type: 'find_min',
            column: column,
            value: minValue,
            row: minRow
        };
    }
    
    // 执行聚合查询
    executeAggregate(config, data, headers) {
        const { aggregateFunction, valueColumn, groupColumn } = config;
        
        if (!valueColumn || !headers.includes(valueColumn)) {
            throw new Error(`数值列 ${valueColumn} 不存在`);
        }
        
        if (!groupColumn || !headers.includes(groupColumn)) {
            throw new Error(`分组列 ${groupColumn} 不存在`);
        }
        
        const result = {};
        
        data.forEach(row => {
            const groupKey = row[groupColumn];
            const value = parseNumericValue(row[valueColumn]);
            
            if (!isNaN(value) && groupKey !== null && groupKey !== undefined) {
                if (!result[groupKey]) {
                    result[groupKey] = [];
                }
                result[groupKey].push(value);
            }
        });
        
        // 计算聚合值
        const aggregatedResult = {};
        for (const [key, values] of Object.entries(result)) {
            aggregatedResult[key] = calculateAggregate(values, aggregateFunction);
        }
        
        return {
            type: 'aggregate',
            aggregateFunction: aggregateFunction,
            valueColumn: valueColumn,
            groupColumn: groupColumn,
            result: aggregatedResult
        };
    }
    
    // 执行筛选聚合查询
    executeFilterAggregate(config, data, headers) {
        const { filterColumn, filterValue, filterValues, valueColumn, aggregateFunction } = config;
        
        if (!filterColumn || !headers.includes(filterColumn)) {
            throw new Error(`筛选列 ${filterColumn} 不存在`);
        }
        
        if (!valueColumn || !headers.includes(valueColumn)) {
            throw new Error(`数值列 ${valueColumn} 不存在`);
        }
        
        const filteredData = data.filter(row => {
            const rowValue = row[filterColumn];
            if (filterValues && Array.isArray(filterValues)) {
                return filterValues.includes(rowValue);
            }
            return rowValue === filterValue;
        });
        
        // 计算聚合值
        const values = filteredData.map(row => parseNumericValue(row[valueColumn])).filter(v => !isNaN(v));
        const result = calculateAggregate(values, aggregateFunction);
        
        return {
            type: 'filter_aggregate',
            filterColumn: filterColumn,
            filterValue: filterValue,
            filterValues: filterValues,
            valueColumn: valueColumn,
            aggregateFunction: aggregateFunction,
            result: result,
            count: filteredData.length
        };
    }
    
    // 执行筛选查询
    executeFilter(config, data, headers) {
        const { conditions } = config;
        
        if (!conditions || !Array.isArray(conditions)) {
            throw new Error('筛选条件无效');
        }
        
        const filteredData = data.filter(row => {
            return conditions.every(condition => {
                const { column, operator, value } = condition;
                if (!headers.includes(column)) return false;
                
                const rowValue = row[column];
                return evaluateCondition(rowValue, operator, value);
            });
        });
        
        return {
            type: 'filter',
            conditions: conditions,
            result: filteredData,
            count: filteredData.length
        };
    }
    
    // 执行排序查询
    executeSort(config, data, headers) {
        const { sortColumn, sortOrder } = config;
        
        if (!sortColumn || !headers.includes(sortColumn)) {
            throw new Error(`排序列 ${sortColumn} 不存在`);
        }
        
        const sortedData = [...data].sort((a, b) => {
            const valueA = parseNumericValue(a[sortColumn]);
            const valueB = parseNumericValue(b[sortColumn]);
            
            if (isNaN(valueA) || isNaN(valueB)) {
                // 非数值比较
                return sortOrder === 'asc' ? 
                    String(a[sortColumn]).localeCompare(String(b[sortColumn])) :
                    String(b[sortColumn]).localeCompare(String(a[sortColumn]));
            }
            
            // 数值比较
            return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
        });
        
        return {
            type: 'sort',
            sortColumn: sortColumn,
            sortOrder: sortOrder,
            result: sortedData
        };
    }
}

// 导出查询执行器
export default QueryExecutor;