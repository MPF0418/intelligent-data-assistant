// 公共工具函数 - V5.0

/**
 * 解析数值
 * 产品意义：统一处理各种格式的数值，确保计算一致性
 */
export function parseNumericValue(value) {
    if (value === null || value === undefined) return NaN;
    
    let str = String(value).replace(/,/g, '').replace(/[￥$€£\s]/g, '');
    return parseFloat(str);
}

/**
 * 转义HTML特殊字符
 * 产品意义：防止XSS攻击，确保用户输入安全显示
 */
export function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * 计算聚合值
 * 产品意义：统一处理各种聚合函数的计算逻辑
 */
export function calculateAggregate(values, functionName) {
    if (!values || values.length === 0) return 0;
    
    switch (functionName.toLowerCase()) {
        case 'sum':
            return values.reduce((sum, val) => sum + val, 0);
        case 'avg':
        case 'average':
            return values.reduce((sum, val) => sum + val, 0) / values.length;
        case 'max':
            return Math.max(...values);
        case 'min':
            return Math.min(...values);
        case 'count':
            return values.length;
        default:
            return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
}

/**
 * 评估条件
 * 产品意义：统一处理各种筛选条件的评估逻辑
 */
export function evaluateCondition(rowValue, operator, targetValue) {
    const numRowValue = parseNumericValue(rowValue);
    const numTargetValue = parseNumericValue(targetValue);
    
    switch (operator) {
        case 'eq':
        case '=':
            return rowValue === targetValue;
        case 'ne':
        case '!=':
            return rowValue !== targetValue;
        case 'gt':
        case '>':
            return numRowValue > numTargetValue;
        case 'lt':
        case '<':
            return numRowValue < numTargetValue;
        case 'ge':
        case '>=':
            return numRowValue >= numTargetValue;
        case 'le':
        case '<=':
            return numRowValue <= numTargetValue;
        case 'contains':
            return String(rowValue).includes(String(targetValue));
        case 'not_contains':
            return !String(rowValue).includes(String(targetValue));
        default:
            return false;
    }
}

/**
 * 检查是否是数值列
 * 产品意义：智能识别列类型，为后续处理提供基础
 */
export function isNumericColumn(header, data) {
    const sample = data.slice(0, 10).map(row => row[header]);
    const numericCount = sample.filter(v => {
        if (v === null || v === undefined || v === '') return false;
        const num = parseFloat(String(v).replace(/,/g, ''));
        return !isNaN(num);
    }).length;
    return numericCount > sample.length * 0.7;
}

/**
 * 去重并排序候选实体
 * 产品意义：确保实体提取结果的唯一性和顺序性
 */
export function deduplicateAndSort(candidates) {
    const seen = new Set();
    return candidates
        .filter(c => {
            if (seen.has(c.text)) return false;
            seen.add(c.text);
            return true;
        })
        .sort((a, b) => a.position - b.position);
}

/**
 * 生成唯一ID
 * 产品意义：为各种元素生成唯一标识，避免冲突
 */
export function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9);
}

/**
 * 深拷贝对象
 * 产品意义：确保数据操作不会影响原始数据
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

/**
 * 格式化数字
 * 产品意义：统一数字显示格式，提升用户体验
 */
export function formatNumber(num) {
    if (isNaN(num)) return 'N/A';
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(2);
}

/**
 * 格式化日期
 * 产品意义：统一日期显示格式，提升用户体验
 */
export function formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * 延迟函数
 * 产品意义：提供异步延迟能力，用于模拟操作或控制执行顺序
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 批量执行Promise
 * 产品意义：控制并发执行，避免过度消耗资源
 */
export async function batchExecute(promises, batchSize = 5) {
    const results = [];
    for (let i = 0; i < promises.length; i += batchSize) {
        const batch = promises.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch);
        results.push(...batchResults);
    }
    return results;
}

// 导出所有工具函数
export default {
    parseNumericValue,
    escapeHtml,
    calculateAggregate,
    evaluateCondition,
    isNumericColumn,
    deduplicateAndSort,
    generateId,
    deepClone,
    formatNumber,
    formatDate,
    delay,
    batchExecute
};